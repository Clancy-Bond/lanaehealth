/**
 * Shared guard for file-upload routes on the external boundary.
 *
 * Checks a `Content-Length` header against a per-route cap before the
 * server begins streaming the body. Returns a `NextResponse` (413) when
 * the declared size already exceeds the cap, or `null` to proceed.
 *
 * Notes:
 *  - Attackers can omit `Content-Length`; the route still needs to
 *    enforce the cap once it reads the payload. Pair this with
 *    `checkActualSize(...)` after `request.formData()` /
 *    `request.arrayBuffer()`.
 *  - For rate-limiting, use `src/lib/rate-limit.ts`.
 */

import { NextResponse } from 'next/server'
import { rateLimit, clientKey, type RateLimiter } from './rate-limit'

export const DEFAULT_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024 // 25 MB
export const LARGE_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024 // 50 MB (Apple Health exports)

export function enforceDeclaredSize(
  request: Request,
  maxBytes: number,
): NextResponse | null {
  const declared = request.headers.get('content-length')
  if (declared) {
    const n = Number(declared)
    if (Number.isFinite(n) && n > maxBytes) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
    }
  }
  return null
}

export function enforceActualSize(
  actualBytes: number,
  maxBytes: number,
): NextResponse | null {
  if (actualBytes > maxBytes) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }
  return null
}

export interface UploadGuardOptions {
  maxBytes?: number
  rateLimiter?: RateLimiter
}

const DEFAULT_UPLOAD_LIMITER = rateLimit({ windowMs: 60_000, max: 10 })

/**
 * One-liner at the top of an upload route. Enforces the declared
 * content-length and the rate limit. Callers are still responsible
 * for checking actual body size after reading it.
 */
export function guardUpload(request: Request, opts: UploadGuardOptions = {}): NextResponse | null {
  const maxBytes = opts.maxBytes ?? DEFAULT_UPLOAD_LIMIT_BYTES
  const sizeDeny = enforceDeclaredSize(request, maxBytes)
  if (sizeDeny) return sizeDeny
  const limiter = opts.rateLimiter ?? DEFAULT_UPLOAD_LIMITER
  if (!limiter.consume(clientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  return null
}

export { rateLimit, clientKey } from './rate-limit'
