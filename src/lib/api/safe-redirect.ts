/**
 * Shared open-redirect guard.
 *
 * API routes that accept a `returnTo` (or any post-mutation redirect
 * target) on a form submission can be turned into open-redirect bait
 * if they trust the value blindly. Examples of attacker payloads:
 *
 *   //evil.com           -> protocol-relative redirect off-site
 *   /\evil.com           -> WHATWG URL spec normalises `\` -> `/`
 *   https://evil.com     -> absolute URL
 *
 * `safeReturnPath` returns the input only when it represents a
 * single-slash, site-relative pathname; anything else returns `null`
 * so the caller can fall back to a known-safe destination.
 *
 * Mirrored from the inline implementation that originally lived in
 * `src/app/api/food/log/route.ts` (PR #54). Centralising it removes
 * the per-route copy/paste risk.
 */

export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  if (raw.length > 500) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.startsWith('/\\')) return null
  if (raw.includes('\\')) return null
  // Defense-in-depth: resolve against a sentinel origin and verify the
  // result stays on that origin. Catches any normalisation gaps.
  try {
    const resolved = new URL(raw, 'https://lanaehealth.internal')
    if (resolved.origin !== 'https://lanaehealth.internal') return null
    if (!resolved.pathname.startsWith('/')) return null
  } catch {
    return null
  }
  return raw
}
