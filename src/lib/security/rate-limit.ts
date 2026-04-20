// ---------------------------------------------------------------------------
// In-memory rate limiter for API routes.
//
// Single-patient app on a single Vercel region, so a lambda-local LRU is
// enough. Sliding-window counter per (scope, key) pair. When a deployment
// spawns a new lambda instance the counter resets; that is acceptable for
// the threat model (rate limits here mitigate accidental thrash and cheap
// external scanning, not determined DDoS).
//
// NOT a substitute for a real rate limiter in a multi-tenant context.
// ---------------------------------------------------------------------------

interface Bucket {
  resetAt: number
  count: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export interface RateLimitOptions {
  /** Logical scope, e.g. 'export:json'. Keeps buckets isolated per route. */
  scope: string
  /** Per-key budget within the window. */
  max: number
  /** Window length in milliseconds. */
  windowMs: number
  /** Identifier (IP, session id, etc). Falls back to 'anon' when empty. */
  key: string
}

export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const key = `${opts.scope}|${opts.key || 'anon'}`
  let bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    bucket = { resetAt: now + opts.windowMs, count: 0 }
    buckets.set(key, bucket)
  }

  if (bucket.count >= opts.max) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt }
  }

  bucket.count += 1
  return {
    ok: true,
    remaining: Math.max(0, opts.max - bucket.count),
    resetAt: bucket.resetAt,
  }
}

/** Test-only: reset all buckets so suites don't leak state. */
export function resetRateLimitsForTests(): void {
  buckets.clear()
}

/**
 * Derive a best-effort client identifier from a Next.js request. Looks at
 * x-forwarded-for, x-real-ip, and falls back to the header-set user label.
 */
export function clientIdFromRequest(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'anon'
}
