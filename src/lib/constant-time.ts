import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string equality check. Use for any comparison against a
 * server-held secret (bearer tokens, API keys, cron secrets). Prevents
 * timing side channels that reveal the secret one byte at a time.
 *
 * Returns false (without throwing) for any undefined / empty / different
 * length input so callers can treat all negative branches identically.
 */
export function timingSafeEqualStrings(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length === 0 || b.length === 0) return false
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
