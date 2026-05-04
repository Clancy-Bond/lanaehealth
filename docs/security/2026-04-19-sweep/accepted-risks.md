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

### D-008 — `dompurify` <= 3.3.3 transitive via `jspdf` (GHSA-39q2-94rc-95cp)

- **Severity:** P2 (moderate, CVSS unscored)
- **Why not fixed:** `dompurify` is pulled in only by `jspdf`, which has not yet released a version pinning a fix. Forcing an override risks breaking PDF generation (Doctor Brief / Care Card) which Lanae uses in clinical settings.
- **Compensating controls:** None of the PDF-generation paths feed user-supplied HTML to jspdf. Inputs are all server-rendered components from controlled data shapes.
- **Revisit when:** `jspdf` ships an updated dependency, or quarterly (whichever sooner).
- **Acknowledged by:** Clancy, 2026-04-19

### D-003 — `LANAEHEALTH_CSP_DISABLED` / `LANAEHEALTH_CSP_REPORT_ONLY` ops flags

- **Severity:** P3 (rollback affordance)
- **Why not fixed:** Track D's CSP uses `'strict-dynamic'` with a per-request nonce. If a Next.js 16 framework chunk we did not anticipate ships without the propagated nonce, the page render breaks. To avoid a code revert in that scenario, the middleware honors two env flags:
  - `LANAEHEALTH_CSP_DISABLED=1` — strip CSP entirely. Other headers still ship.
  - `LANAEHEALTH_CSP_REPORT_ONLY=1` — send `Content-Security-Policy-Report-Only` instead of the enforcing variant. Browser logs violations, does not block.
- **Compensating controls:** Default behavior is full enforcement. Flags are only consulted at runtime; tests pin the default.
- **Revisit when:** N/A — these are intended to remain available indefinitely as ops escape hatches. Flag use should be paired with a follow-up issue capturing the directive that needed adjustment.
- **Acknowledged by:** Clancy, 2026-04-19

### D-002 — `LANAEHEALTH_AUTH_DISABLED=1` transition flag in middleware

- **Severity:** P1 (operational risk, not a code defect)
- **Why not fixed:** Track D's middleware enforces auth at the edge by default. The `LANAEHEALTH_AUTH_DISABLED=1` env flag is a deliberate ops escape hatch so the live deployment can ship middleware before Track A's Supabase Auth sign-in flow is wired through end-to-end. Without the flag, the production app would 401 every request to PHI routes the moment the PR merges, before the sign-in flow exists.
- **Compensating controls:** When the flag is set, every passing response carries `X-Lanae-Auth-Bypass: 1` so the bypass is detectable in Vercel logs. The flag must NOT be left on once Track A's sign-in flow ships and Lanae has a session cookie.
- **Revisit when:** Track A's `requireUser()` lands and Lanae has signed in once. Operator action: remove `LANAEHEALTH_AUTH_DISABLED` from Vercel env, redeploy, confirm 401s for unauth requests via `curl`.
- **Acknowledged by:** Clancy, 2026-04-19
