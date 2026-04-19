/**
 * In-memory fixed-window rate limiter.
 *
 * Scope note: Vercel functions each keep their own map, so the
 * effective ceiling is roughly `limit * concurrent_instances`. That is
 * acceptable for a single-patient app; migrate to Upstash Redis if we
 * ever go multi-tenant. Documented as accepted risk C-013.
 *
 * Usage:
 *
 *   const gate = rateLimit({ windowMs: 60_000, max: 60 })
 *   if (!gate.consume(token)) return new Response('rate limited', { status: 429 })
 */

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimiter {
  consume(key: string): boolean
  reset(key?: string): void
}

export interface RateLimitOptions {
  windowMs: number
  max: number
}

export function rateLimit(opts: RateLimitOptions): RateLimiter {
  const buckets = new Map<string, Bucket>()
  // Vitest sets NODE_ENV=test. Disable the limiter in that environment so
  // the large existing suite does not need to thread a reset hook through
  // every route. Tests that specifically want to exercise the limiter
  // set RATE_LIMIT_IN_TESTS=1 in their beforeEach and unset it in afterEach.
  const disabled =
    process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TESTS !== '1'

  return {
    consume(key: string): boolean {
      if (disabled) return true
      if (!key) return false
      const now = Date.now()
      const existing = buckets.get(key)
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
        return true
      }
      if (existing.count >= opts.max) return false
      existing.count += 1
      return true
    },
    reset(key?: string) {
      if (key === undefined) buckets.clear()
      else buckets.delete(key)
    },
  }
}

/**
 * Extract a stable client identifier from a request. Preference order:
 *   1. Bearer token (opaque hash, never the raw token)
 *   2. x-forwarded-for (first hop)
 *   3. Falls back to the literal string "anon"
 */
export function clientKey(req: Request): string {
  const auth = req.headers.get('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim()
    if (token) {
      // Hash to avoid retaining raw tokens in memory.
      let hash = 0
      for (let i = 0; i < token.length; i++) {
        hash = (hash * 31 + token.charCodeAt(i)) | 0
      }
      return `t:${hash}`
    }
  }
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return `ip:${fwd.split(',')[0].trim()}`
  const real = req.headers.get('x-real-ip')
  if (real) return `ip:${real.trim()}`
  return 'anon'
}
