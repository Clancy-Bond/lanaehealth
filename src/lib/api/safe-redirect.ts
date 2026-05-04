// Safe redirect helpers for API route handlers (Track D, sweep 2026-04-19).
//
// `new URL("https://evil.com", req.url)` returns `https://evil.com` — the
// base is ignored when the input is itself a fully qualified URL. So a
// raw `body.returnTo` flowing into `NextResponse.redirect(new URL(returnTo,
// req.url))` is an open redirect: the attacker hosts a CSRF form that
// posts to a real LanaeHealth route with `returnTo=https://attacker.test`
// and a 303 carries the victim onto the attacker's page (typical use:
// phishing page that mimics the LanaeHealth login).
//
// `safeReturnTo()` constrains the destination to same-origin path-only
// URLs and falls back to a known-safe default otherwise.

/**
 * Build a same-origin redirect target from a user-supplied path.
 *
 * Accepts `/some/path?with=query`. Rejects:
 *   - Absolute URLs (`https://evil.com/...`)
 *   - Protocol-relative URLs (`//evil.com`)
 *   - Anything not starting with `/`
 *   - `/\evil.com` and similar backslash tricks (some browsers normalize
 *     these to `//evil.com`)
 *
 * Returns a URL anchored at `baseUrl`'s origin, never the attacker's.
 */
export function safeReturnTo(
  raw: unknown,
  fallback: string,
  baseUrl: string | URL,
): URL {
  if (typeof raw !== 'string' || raw.length === 0) {
    return new URL(fallback, baseUrl)
  }
  // Same-origin relative paths only. Reject any leading double slash,
  // backslash, or scheme.
  if (!raw.startsWith('/')) return new URL(fallback, baseUrl)
  if (raw.startsWith('//') || raw.startsWith('/\\')) {
    return new URL(fallback, baseUrl)
  }
  // `new URL("/a", "https://x.com")` is "https://x.com/a" — origin is
  // anchored at the base. The startsWith('/') gate above guarantees we
  // never hit the absolute-URL case.
  return new URL(raw, baseUrl)
}
