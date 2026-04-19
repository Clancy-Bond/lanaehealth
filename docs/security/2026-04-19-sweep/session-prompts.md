# Session Prompts

Copy-paste these into the 3 other Claude Code sessions. The web
session that generated this sweep is running Track A.

All four sessions point at the same repo. Each creates its own branch
off `claude/understand-app-status-rTPke` and opens a draft PR when
done.

---

## Session B — AI & PHI Surface

Paste this into a fresh Claude Code session (Desktop / CLI / second web):

> You are Session B of a four-session parallel security sweep on
> LanaeHealth, a single-patient medical data app (real patient PHI,
> Next.js 16, Supabase, Claude API).
>
> Read these files in order before starting, then execute the track:
>
> 1. `docs/security/2026-04-19-sweep/README.md` — master plan, threat
>    model, coordination rules.
> 2. `docs/security/2026-04-19-sweep/track-b-ai-phi.md` — your brief.
> 3. `docs/security/2026-04-19-sweep/findings-template.md` — copy to
>    `findings-track-b.md` and use for every finding.
>
> Your branch: `security/track-b-ai-phi` off
> `claude/understand-app-status-rTPke`.
>
> Your merge order is LAST (after A, D, C). If
> `src/lib/auth/require-user.ts` does not exist yet because Track A is
> still in flight, stub it locally and leave a TODO to rebase. Do not
> block on Track A.
>
> Do NOT edit files outside your track scope. Use
> `cross-track-notes.md` to flag anything you find in another track's
> files.
>
> Start with the entry checklist in the README. When every P0/P1 in
> your scope is fixed + tested + `npm test` green, open a draft PR
> describing findings by severity and mark cross-track notes for
> anyone depending on your output.

---

## Session C — External Boundary

> You are Session C of a four-session parallel security sweep on
> LanaeHealth, a single-patient medical data app (real patient PHI,
> Next.js 16, Supabase, Claude API).
>
> Read these files in order before starting, then execute the track:
>
> 1. `docs/security/2026-04-19-sweep/README.md` — master plan, threat
>    model, coordination rules.
> 2. `docs/security/2026-04-19-sweep/track-c-external-boundary.md` —
>    your brief.
> 3. `docs/security/2026-04-19-sweep/findings-template.md` — copy to
>    `findings-track-c.md` and use for every finding.
>
> Your branch: `security/track-c-external-boundary` off
> `claude/understand-app-status-rTPke`.
>
> Your merge order is THIRD (after A, D). You depend on
> `requireUser()` (Track A) and the Next.js middleware (Track D). If
> either is missing, stub locally and TODO-rebase.
>
> HIGHEST PRIORITY on your track: Vercel cron lockdown (anyone can
> hit `/api/cron/*` today) and the new `/api/health-sync` iOS Shortcut
> endpoint. Ship those first.
>
> Do NOT edit files outside your track scope. Use
> `cross-track-notes.md` to flag anything you find in another track's
> files.
>
> When every P0/P1 in your scope is fixed + tested + `npm test` green,
> open a draft PR.

---

## Session D — Infrastructure, Client, Config, Dependencies

> You are Session D of a four-session parallel security sweep on
> LanaeHealth, a single-patient medical data app (real patient PHI,
> Next.js 16, Supabase, Claude API).
>
> Read these files in order before starting, then execute the track:
>
> 1. `docs/security/2026-04-19-sweep/README.md` — master plan, threat
>    model, coordination rules.
> 2. `docs/security/2026-04-19-sweep/track-d-infra-client.md` — your
>    brief.
> 3. `docs/security/2026-04-19-sweep/findings-template.md` — copy to
>    `findings-track-d.md` and use for every finding.
>
> Your branch: `security/track-d-infra-client` off
> `claude/understand-app-status-rTPke`.
>
> Your merge order is SECOND (right after Track A). You establish the
> perimeter: Next.js middleware, security headers, CSP, dep audit.
> Track C depends on your middleware being in place.
>
> HIGHEST PRIORITY: `src/middleware.ts` with auth gate + security
> headers, and the client-bundle secrets grep (any leaked secret is
> P0 and must be rotated).
>
> You also own baseline hardening of the generic CRUD API routes not
> claimed by other tracks (list is in your brief).
>
> Do NOT edit files outside your track scope. Use
> `cross-track-notes.md` to flag anything you find in another track's
> files.
>
> When every P0/P1 in your scope is fixed + tested + `npm test` green,
> open a draft PR.

---

## Coordination reminders for all three sessions

- Each session creates its own branch off
  `claude/understand-app-status-rTPke`.
- Each session opens a **draft** PR so review can happen as the sweep
  progresses.
- No session merges its own PR. Clancy merges in the order A → D → C
  → B.
- No `git push --force`. No destructive git operations. CLAUDE.md
  standing authorization covers regular pushes only.
- No em dashes anywhere (CLAUDE.md rule).
- Findings must be PHI-free. Redact to shape.
- Every P0/P1 fix ships with a regression test or it is not merged.
- If blocked waiting on another track, keep moving in your own scope
  and stub the dependency.
