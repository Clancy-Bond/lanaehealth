# Design: Make LanaeHealth Genuinely Delightful

**Date:** 2026-04-16
**Author:** Claude (Design Director role)
**Status:** Approved by Clancy on 2026-04-16; working fire-and-forget with no mid-phase checkpoints

## Problem

LanaeHealth is feature-complete across 12 routes and 44 components but was built feature-first. Presentation has not been treated with the care its patient deserves. Lanae (24F, Kailua HI) has a complex chronic illness stack (iron deficiency, vitamin D deficiency, POTS-like syncope, suspected endometriosis, MCAS, telogen effluvium, borderline hyperlipidemia, migraines) and uses this app daily. Tired users punish apps that make them think. The goal is not "polished." The goal is that Lanae WANTS to open the app.

## Non-goals

- No removing features. Every existing capability must still work after this pass.
- No architectural rewrites. We operate in the presentation layer (components, tokens, motion, microcopy).
- No new dependencies unless absolutely required for a specific interaction.

## Approach: Thorough D (inspiration-then-route-sweep)

1. **Phase 0 Setup.** Verify dev server on 3005. Create `docs/design/` scaffolding (`2026-findings.md`, `audit-results.md`, `before-after/<route>/`). Read current tokens (`globals.css`), `AppShell`, `BottomNav` to inventory what already exists.

2. **Phase 1 Inspiration.** Deep dive into 8 apps: Linear, Things 3, Raycast, Arc, Oura, Strava, Notion Calendar, Airbnb. Extract SPECIFIC values (px, ms, rgba, easing) not vibes. Write `2026-findings.md` with numeric detail and quotable microcopy examples. End of phase: a working vocabulary of ~8-12 patterns we commit to adopting.

3. **Phase 2 Flagship routes `/` and `/log`.** For each: screenshot at 375/768/1440, log audit in `audit-results.md` (first impression, hierarchy, clarity, consistency, delight), prioritize fixes (blocker/high/medium/polish), implement ALL of them, re-screenshot, save before/after. Interactive states inventory (hover/active/focus/loading/error/success). Empty states inventory. Microcopy audit.

4. **Phase 3 Sweep remaining 10 routes.** Same rigor applied to `/chat`, `/doctor`, `/imaging`, `/import`, `/intelligence`, `/onboarding`, `/patterns`, `/profile`, `/records`, `/settings`, `/timeline`. Still fully audited, but now applying the vocabulary from Phase 2.

5. **Phase 4 Global pass.** TypeScript clean. Console clean at every route. Cross-route consistency. Commits per phase, deploy to Vercel at the end.

## Design constraints (standing rules from CLAUDE.md)

- Never use em dashes anywhere in copy.
- Warm Modern palette only: cream #FAFAF7 bg, sage #6B9080, blush #D4A0A0. Extend with tints/shades if needed, but do not introduce a new hue.
- Real patient data. Respect it. No jokey empty states.
- Mobile first at 375px (iPhone SE); tablet 768px and desktop 1440px must not break.
- Zero TypeScript errors, zero console errors at finish.

## Delight principles for THIS app (Lanae-specific)

- **Low-energy usage is the default.** She may be in a flare. Default to big tap targets, calm motion, no timers pressuring her.
- **Celebrate gently.** Strava-style confetti is wrong. Things 3-style quiet checkmarks are right.
- **Don't shame low-energy days.** Oura does this well ("Focus on Recovery" not "You Had a Bad Night"). We steal this.
- **Every number has context.** A standing pulse of 106 isn't just 106. It's paired with "+58 from resting" and a gentle "worth mentioning to your cardiologist."
- **One job per screen.** Each route should answer one question fast. Everything else is secondary.
- **Microcopy like a friend.** Not "Error occurred." Not "Loading..." Instead: "Something broke on my end. Try again?" and "One moment, pulling your data."

## Deliverables

- `docs/design/2026-findings.md` — inspiration research
- `docs/design/audit-results.md` — per-route findings and fixes log
- `docs/design/before-after/<route>/` — 3-breakpoint before + after screenshots
- Route-level component changes across `src/app/**` and `src/components/**`
- `docs/plans/2026-04-16-design-delight-audit-design.md` (this doc), committed

## Risks and mitigations

- **Scope creep into architecture.** Mitigation: if I find a data layer bug, I log it for a follow-up, I do not fix it in this pass.
- **Breaking mobile.** Mitigation: screenshot 375 first, always.
- **Patient data concerns.** Mitigation: never modify data. Only presentation. Memory rule: ZERO data loss.
- **Time.** Mitigation: user approved fire-and-forget. Continuous execution.

## Success criteria

- All 12 routes have a full audit entry with before/after screenshots.
- Every blocker and high-priority finding is fixed.
- Every interactive element has all 6 states (hover/active/focus/loading/error/success).
- Every empty state teaches the next action.
- Zero TS errors, zero console errors.
- Design patterns are consistent cross-route (nav, cards, empty states, loading skeletons share a voice).
- Lanae can open the app, on a tired morning, and find what she needs in 3 seconds or less.
