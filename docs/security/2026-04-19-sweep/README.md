# LanaeHealth Security Sweep — 2026-04-19

Four parallel Claude Code sessions running an intensive security sweep on a
single-patient medical-data app. This README is the shared brain. Every
session reads it before starting.

---

## STATUS: COMPLETE — 2026-04-19

All four tracks shipped and merged to `main`:

| Track | PR                                                           | Squash merge |
|-------|--------------------------------------------------------------|--------------|
| A     | [#13](https://github.com/Clancy-Bond/lanaehealth/pull/13) auth primitive + route gating + RLS migration | `8807919` |
| D     | [#15](https://github.com/Clancy-Bond/lanaehealth/pull/15) perimeter + CRUD hardening + cross-track closeout | `b535221` |
| C     | [#14](https://github.com/Clancy-Bond/lanaehealth/pull/14) external boundary hardening | `453f7dd` |
| B     | [#16](https://github.com/Clancy-Bond/lanaehealth/pull/16) PHI route gates + CSV injection + prompt-injection hardening | `afc3712` |

Every P0 / P1 finding is fixed on `main` or explicitly accepted with a
written risk note in `accepted-risks.md`. Cross-track notes are all
resolved. Deployment still needs: `APP_AUTH_TOKEN` + `APP_AUTH_PASSWORD`
set in Vercel, `SHARE_TOKEN_ADMIN_TOKEN` rotated, and `027_rls_sweep.sql`
applied via the Supabase dashboard.

---

## Why this sweep exists

LanaeHealth stores a real patient's complete medical history (Lanae Bond):
diagnoses, medications, cycle data, lab results, imaging, symptom logs,
doctor notes, imported FHIR/C-CDA bundles. CLAUDE.md flags ZERO DATA LOSS
as a critical rule and notes that every operation must be treated with
extreme care. The app is live at `https://lanaehealth.vercel.app` with 21+
new routes shipped in the last overnight sprint. Attack surface grew
faster than hardening. This sweep closes that gap.

## Threat model (single-patient app)

This is NOT a multi-tenant SaaS. The threat model is narrower but sharper:

| Threat                                    | Plausibility | Impact         |
|-------------------------------------------|--------------|----------------|
| Public internet probing of open endpoints | HIGH         | PHI disclosure |
| Credential theft via logs / git history   | MEDIUM       | Full DB access |
| Prompt injection exfiltrating PHI via Claude API | MEDIUM | PHI disclosure |
| Malicious file upload (PDF/OCR/CSV import)| LOW          | RCE / PHI read |
| OAuth callback abuse (Oura, SMART on FHIR)| LOW          | Token theft    |
| CSRF on mutating endpoints                | MEDIUM       | Data corruption|
| Vercel cron endpoints hit by anyone       | HIGH         | Data corruption / cost |
| Data exfil via `/api/export`, `/api/share`| HIGH         | Full PHI dump  |
| Supply-chain CVE in deps                  | MEDIUM       | Varies         |
| Service-role key leaked to client bundle  | LOW          | Full DB access |

Out of scope: hostile multi-tenant scenarios, insider threat from Lanae,
advanced nation-state attackers.

## Severity scale

Every finding must carry a severity. Use this taxonomy exactly:

- **P0 — Critical.** Active PHI disclosure, RCE, full-DB write, or
  credential exposure. Fix before merging anything else. Block deploys.
- **P1 — High.** Auth bypass, significant PHI leakage, CSRF on write
  endpoint, unauthenticated export, destructive cron exposed. Fix this
  sweep.
- **P2 — Medium.** Defense-in-depth (missing headers, verbose errors,
  missing rate limits, no CSP). Fix this sweep if time allows, otherwise
  logged as issues.
- **P3 — Low.** Hardening nice-to-haves, style, lint-level improvements.
  Logged, not necessarily fixed.

## Tracks (4 parallel sessions)

Each track owns a non-overlapping file scope. The brief for each track is
a standalone document that tells the session exactly what to audit, what
to fix, and what files it may touch.

| Track | Focus                                   | Brief                                |
|-------|-----------------------------------------|--------------------------------------|
| A     | Auth, authorization, DB, RLS, admin     | `track-a-auth-database.md`           |
| B     | AI/Claude surface, PHI handling, reports| `track-b-ai-phi.md`                  |
| C     | External boundary: integrations, imports, crons, file uploads | `track-c-external-boundary.md` |
| D     | Infrastructure, client, config, deps    | `track-d-infra-client.md`            |

## Branch & merge strategy

Each session works on its own branch off current HEAD
(`claude/understand-app-status-rTPke`):

- Track A: `security/track-a-auth-database`
- Track B: `security/track-b-ai-phi`
- Track C: `security/track-c-external-boundary`
- Track D: `security/track-d-infra-client`

Each session opens its own draft PR. Merge order:

1. **Track A first.** Track A publishes the shared `requireUser()` helper
   in `src/lib/auth/require-user.ts`. Other tracks depend on it to
   harden their scoped routes.
2. **Track D second.** Middleware + security headers + middleware-level
   auth gate. This establishes the perimeter.
3. **Track C third.** External boundary fixes (OAuth state verification,
   cron secrets, file-upload sanitization) — depends on middleware being
   in place.
4. **Track B last.** AI/PHI fixes — depends on all other perimeter work
   so PHI-minimization happens on a hardened base.

If Track A is behind, other tracks stub `requireUser()` as a local
placeholder and rebase once Track A merges.

## Shared file ownership (to prevent merge conflicts)

Some files would naturally be touched by multiple tracks. They are
allocated to exactly one track. Other tracks that need changes open a
cross-track note in `cross-track-notes.md` and the owning track makes
the change.

| File / directory                                  | Owner   |
|---------------------------------------------------|---------|
| `src/lib/supabase.ts`                             | Track A |
| `src/lib/auth/**` (new)                           | Track A |
| `src/lib/migrations/*.sql` (new RLS migrations)   | Track A |
| `next.config.ts`                                  | Track D |
| `vercel.json`                                     | Track D |
| `src/middleware.ts` (new)                         | Track D |
| `package.json` / `package-lock.json` (deps bumps) | Track D |
| `src/lib/types.ts`                                | Track A (additive only; if a track needs a non-trivial change, coordinate) |

All other `src/app/api/**/route.ts` files are partitioned by directory
per the individual track briefs.

## Coordination rules

1. **Stay in your scope.** If you find a P0/P1 outside your scope,
   append it to `cross-track-notes.md` with severity + location + a
   one-line suggested fix. Do NOT edit the file. The owning track
   handles it.
2. **No merging until your own suite is green.** `npm test` must pass
   on your branch before opening the PR.
3. **Zero data-loss rule stands.** No migration that drops, truncates,
   or destructively alters existing tables without explicit user
   confirmation. RLS policies are ADDITIVE only.
4. **No em dashes.** CLAUDE.md rule. Applies to all docs and code
   written this sweep.
5. **Log PHI-free.** No finding, report, or commit message may contain
   actual patient data. Redact to shape (e.g., "cycle entry on
   2025-11-12" not "cycle entry showing X symptom").
6. **Regression tests required** for every P0/P1 fix. A fix without a
   locking test is not merged.

## Deliverables per track

Each session produces:

1. **Findings report:** `docs/security/2026-04-19-sweep/findings-track-{a,b,c,d}.md`
   (one row per issue using the template in `findings-template.md`).
2. **Code fixes** for every P0/P1 finding.
3. **Regression tests** locking in each fix.
4. **PR description** listing findings by severity + a "what I did NOT
   fix" section for anything deferred with a reason.

## How the user drives this

The user opens 3 additional Claude Code sessions (Desktop, CLI, or
additional web). The user pastes the corresponding track prompt from
`session-prompts.md` into each. This web session (the one writing this
document) runs Track A.

When all four PRs are open, the user reviews in the order above and
merges. Any P0 found during review bounces back to the originating
session for immediate fix.

## What this sweep does NOT cover

- Formal HIPAA compliance certification. This is personal-use
  software; we apply HIPAA-spirit controls (encryption at rest,
  minimum necessary, audit logging) without claiming certification.
- Third-party Supabase / Vercel / Anthropic infrastructure controls.
- Physical device security on Lanae's phones / laptops.
- Social engineering.

## Entry checklist (each session runs before starting)

- [ ] Read this README end to end.
- [ ] Read your track brief.
- [ ] `git fetch origin && git checkout -b security/track-{X}-<slug> origin/claude/understand-app-status-rTPke`
- [ ] `npm install && npm test` — confirm baseline is green.
- [ ] Review `cross-track-notes.md` for anything flagged at you.
- [ ] Create `findings-track-{x}.md` from the template.
- [ ] Start auditing your scope, filing findings as you go.

## Exit checklist (each session runs before opening PR)

- [ ] Every P0/P1 finding in your scope is fixed or explicitly accepted
      with a note in `accepted-risks.md`.
- [ ] Every fix has a regression test.
- [ ] `npm test` green.
- [ ] `npm run build` green.
- [ ] PR description lists findings by severity.
- [ ] Cross-track notes filed for anything out of scope.
