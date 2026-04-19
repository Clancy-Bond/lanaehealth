# Findings Report Template

Copy this file to `findings-track-{a,b,c,d}.md` at the start of your
session. Append one entry per finding. Update status as you fix.

---

## Summary

| Severity | Count | Fixed | Deferred |
|----------|-------|-------|----------|
| P0       | 0     | 0     | 0        |
| P1       | 0     | 0     | 0        |
| P2       | 0     | 0     | 0        |
| P3       | 0     | 0     | 0        |

---

## Finding Template

Every finding uses this shape:

```markdown
### {TRACK}-{NNN} — {short title}

- **Severity:** P0 / P1 / P2 / P3
- **Status:** open / fixed / deferred / accepted-risk
- **Location:** `path/to/file.ts:LINE` (or multiple)
- **Category:** auth | authz | injection | phi-leak | csrf | ssrf |
  xss | deserialization | crypto | secrets | rate-limit | dos |
  supply-chain | misconfig | logic | privacy | other

**Description.** One paragraph, PHI-free. What is the issue and why
does it matter in the LanaeHealth threat model.

**Exploit scenario.** Concrete attacker steps. Skip for P3.

**Fix.** What you did (or what should be done if deferred).

**Regression test.** Path to the test that locks the fix in.

**References.** OWASP link, CVE, or upstream docs.
```

---

## Example filled-in finding (use this as a reference, then delete)

### A-001 — Admin `peek` route allows unauthenticated DB dump

- **Severity:** P0
- **Status:** fixed
- **Location:** `src/app/api/admin/peek/route.ts:1-40`
- **Category:** auth

**Description.** The `/api/admin/peek` route returns a dump of arbitrary
tables when called with a `?table=` query param. It has no auth check
and was reachable from the public internet on the production Vercel
deployment. An attacker could enumerate all Supabase table names and
read their full contents.

**Exploit scenario.** `curl https://lanaehealth.vercel.app/api/admin/peek?table=cycle_entries`
returned JSON rows for every cycle entry.

**Fix.** Deleted the route. Dev-only peeking can use the Supabase
dashboard. Added an E2E test that asserts the route returns 404.

**Regression test.** `src/__tests__/admin-routes-removed.test.ts`

**References.**
- OWASP API Top 10 #1 (Broken Object Level Authorization)
- Internal: `docs/security/2026-04-19-sweep/README.md` threat model

---

## Findings

<!-- Append new findings below this line -->
