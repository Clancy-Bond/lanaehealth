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

### c-013 — In-memory rate limiter is per-Vercel-instance

- **Severity:** P3
- **Why not fixed:** Vercel serverless functions each keep their own
  Map; a burst spread across N parallel instances can let ~N x limit
  requests through before throttling. We would need Upstash Redis (or
  equivalent shared state) to enforce a strict global cap. Not worth
  adding a stateful dependency for a single-patient app.
- **Compensating controls:** Health-sync route is also bearer-gated,
  so the rate limit is a secondary defense, not the primary. Import
  routes have small limits (5/min) and the practical N is 1 to 2.
- **Revisit when:** the app becomes multi-tenant, OR Vercel introduces
  a native rate-limit primitive we can use.
- **Acknowledged by:** pending Clancy's sign-off on merge.

