# Accepted Risks

Findings that are known but explicitly NOT fixed this sweep. Every
entry requires the user's explicit acknowledgement in the commit that
adds it.

Format:

```markdown
### {track}-{nnn} — {short title}

- **Severity:** P0 / P1 / P2 / P3
- **Why not fixed:** one paragraph.
- **Compensating controls:** what mitigates the risk today.
- **Revisit when:** condition or date.
- **Acknowledged by:** Clancy, YYYY-MM-DD
```

---

<!-- Append accepted risks below this line -->

### D-009 — CSP allows `'unsafe-inline'` / `'unsafe-eval'` in script-src

- **Severity:** P3
- **Why not fixed:** Next.js 16's runtime emits inline bootstrap
  scripts and, in dev, uses `eval` for HMR. Tightening to
  `'nonce-<per-request>' 'strict-dynamic'` requires threading a nonce
  through every component that reads `headers()` and every inline
  `<script>` Next generates. Non-trivial, out of scope for a security
  sweep focused on auth + data-exposure vectors.
- **Compensating controls:** The shipped CSP still blocks the most
  dangerous vectors: `frame-ancestors 'none'` stops clickjacking,
  `object-src 'none'` stops Flash/plugin injection, `connect-src`
  is allowlisted to only the vendors we actually call, and
  `base-uri 'self'` / `form-action 'self'` block classic XSS
  persistence. Codebase is also clean of
  `dangerouslySetInnerHTML` / `innerHTML` / `eval` (D-010).
- **Revisit when:** Next.js ships a first-class nonce API, or a
  dedicated CSP-hardening sprint is scheduled.
- **Acknowledged by:** Clancy, 2026-04-19

### D-011 — Offline queue stores PHI write ops in `localStorage`

- **Severity:** P3
- **Why not fixed:** The offline queue exists specifically because
  the app needs to capture a symptom log even when Lanae is in a
  no-signal area (common during migraines or clinic visits). The
  trust boundary for a single-user PWA on a personal device is
  narrow: the user AND malicious browser extensions with host
  permission both have access to `localStorage`, but so does the
  React app itself. An extension that owns the host already has
  every credential in the page.
- **Compensating controls:** Queue entries are short-lived (drained
  on next online cycle, typically seconds to minutes). `clearQueue()`
  is called after successful drain so data does not persist longer
  than necessary.
- **Revisit when:** App ever supports multiple users on one device,
  OR the queue is repurposed to carry long-lived secrets.
- **Acknowledged by:** Clancy, 2026-04-19

### D-012 — Service worker caches `/doctor` HTML containing PHI

- **Severity:** P3
- **Why not fixed:** `/doctor` is the clinic-visit brief. Lanae needs
  it available on spotty hospital wifi. Caching the HTML is the
  reason the service worker exists; the feature is explicitly
  documented in `public/sw.js:30-32`.
- **Compensating controls:** The SW does NOT cache API responses
  (the `fetch` listener short-circuits on any non-navigate request).
  Its scope is the origin, not a sub-path that could be hijacked.
  Activation clears old cache versions so stale PHI from an earlier
  version does not accumulate. Device security (biometric unlock,
  encrypted storage) is the outer defense.
- **Revisit when:** Browsers ship a first-class "expire after N
  minutes of idle" cache policy, OR the app ever runs on a shared
  device.
- **Acknowledged by:** Clancy, 2026-04-19
