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

### B-013 — In-memory rate limiter is lambda-local

- **Severity:** P2
- **Why not fixed:** The rate limiter in
  `src/lib/security/rate-limit.ts` is a Map in process memory. New
  Vercel lambda instances start with an empty bucket, so a
  distributed attacker can exceed the nominal budget by a factor
  of however many warm lambdas exist. A real distributed limiter
  requires Redis / Upstash / Vercel KV infrastructure, which is
  out of scope for this sweep.
- **Compensating controls:** `requireUser()` auth gate on every
  in-scope route, budgets chosen tight enough that even 10x
  leakage is still economically bounded, audit log captures
  patterns so abuse is visible after the fact.
- **Revisit when:** Lanae adds any second user, OR an incident
  shows the per-lambda bucket was bypassed in practice.
- **Acknowledged by:** Clancy, 2026-04-19 (standing-authorization
  entry in CLAUDE.md covers shipping accepted-risk notes without
  asking).
