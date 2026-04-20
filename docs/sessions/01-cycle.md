# Session 01 — Cycle (Phase 1, pattern proof)

> **Copy this entire file as the opening message of a fresh Claude Code session in the cycle worktree.**

---

You are building Phase 1 of the LanaeHealth v2 mobile UI rebuild — the **Cycle** section. This is the smallest section and it runs **first**, alone, as the proof that the rebuild pattern works. If this section feels right, the other parallel sessions can fan out. If not, we pivot before scaling.

## Worktree setup (run this in your terminal first)

```bash
cd /Users/clancybond/lanaehealth/.claude/worktrees/sweet-rosalind-cea925/
scripts/v2-worktree-setup.sh cycle
cd ../v2-cycle
claude
```

Then paste this prompt as your first message.

## Hard prerequisite

Do not start until **Session 00 (Foundation)** has merged to `main`. Verify by checking that `src/v2/theme/tokens.css`, `src/v2/components/primitives/`, `src/v2/components/shell/`, and `docs/v2-design-system.md` exist. Rebase your branch on `main` to pull them in.

## Read first (in order)

1. `docs/sessions/README.md` — the design philosophy, coordination rules, locked-file rule
2. `docs/v2-design-system.md` — tokens, primitives, naming conventions (output of Foundation phase)
3. `docs/reference/natural-cycles/frames/full-tour/` — **319 reference frames; this IS your visual spec.** Browse them all once before building.
4. `src/lib/cycle/load-cycle-context.ts` — the data loader your pages will call
5. `src/lib/cycle/*` — engine, predictions, signal fusion, current-day, cycle-stats, phase-symptoms, fertile-window, cover-line
6. `src/lib/api/cycle.ts` and `src/lib/api/nc-cycle.ts` — the typed data access helpers
7. `src/components/cycle/widgets/CycleTodayRingWidget.tsx` — already a clean server component example to model after

## Scope: routes to build

Build the v2 versions of these 4 routes:

- `src/app/v2/cycle/page.tsx` — cycle today (NC's primary "Today" screen analog)
- `src/app/v2/cycle/log/page.tsx` — log period flow
- `src/app/v2/cycle/history/page.tsx` — past cycles list
- `src/app/v2/cycle/predict/page.tsx` — prediction view

## Design layer assignments

- **Visual chrome:** Oura (use the v2 primitives from foundation; don't reinvent)
- **Voice / pedagogy:** Natural Cycles. Every screen explains what it's showing in plain language. Match NC's gentle, never-leave-the-user-confused micro-copy.
- **Section UX patterns:** Natural Cycles. Direct clone of how NC tracks and presents cycles. Specifically:
  - The today/check-in centerpiece (BBT, cycle day, phase, current state)
  - The calendar-style history view (grid of days with phase coloring)
  - The fertility/prediction signaling (rings, dotted future days, color-coded states)
  - The log-period sheet pattern

## Reference frames to focus on

NC reference frames that map to your routes (browse `docs/reference/natural-cycles/frames/full-tour/` and curate):

- `frame_0001` to `frame_0050` — likely the today/check-in flow
- Calendar/history views — look for grid layouts of days with phase coloring (saw one at `frame_0150`)
- Period-log sheet — look for sheet/modal patterns
- Prediction views — look for charts and forward-looking displays

**First task:** scrub `docs/reference/natural-cycles/frames/full-tour/` and rename canonical frames semantically (`today-default.png`, `today-bbt-prompt.png`, `calendar-monthly.png`, `log-period-sheet.png`, etc.). Delete obvious non-canonicals. Output your curation as `docs/reference/natural-cycles/frames/cycle-section.md` mapping each canonical frame to which v2 route it informs.

## Reuse from `src/lib/`

- `loadCycleContext(date)` from `src/lib/cycle/load-cycle-context.ts`
- Cycle engine: `src/lib/cycle/engine.ts`, `current-day.ts`, `cycle-stats.ts`, `phase-symptoms.ts`, `period-prediction.ts`, `fertile-window.ts`, `cover-line.ts`, `signal-fusion.ts`
- API helpers: `src/lib/api/cycle.ts`, `src/lib/api/nc-cycle.ts`
- Existing pure UI to model after: `src/components/cycle/CycleTodayRing.tsx`, `src/components/cycle/PhaseSymptomHeatmap.tsx`, `src/components/cycle/CycleLengthChart.tsx`

## Reuse from foundation primitives

`MetricRing`, `MetricTile`, `Card`, `ListRow`, `Sheet`, `Stepper`, `EmptyState`, `Skeleton`, `Button`. Plus `MobileShell`, `TopAppBar`, `BottomTabBar`.

## Acceptance criteria (per route)

1. **Visual match:** side-by-side screenshot of your `/v2/cycle/*` page vs the corresponding NC reference frame passes visual match (same layout, same color usage, same density, same primitives).
2. **Voice match:** every screen has at least one piece of explanatory copy in NC's voice ("Your follicular phase typically lasts 14 days — we estimate based on your last 3 cycles").
3. **Mobile correctness:** renders correctly on iOS Safari at 375pt, 390pt, 428pt. Tap targets ≥ 44pt. No horizontal overflow. Safe-area respected.
4. **Data parity:** open legacy `/cycle` and your new `/v2/cycle` for the same date — confirm identical data displayed.
5. **No engine touch:** no edits to `src/lib/*`, `src/app/api/**`, primitives, or theme.

## Locked files (DO NOT EDIT)

- `src/v2/components/primitives/*`
- `src/v2/components/shell/*`
- `src/v2/theme/*`
- `src/lib/*`
- `src/app/api/**`
- Any other section's pages or components

If you need a primitive that doesn't exist, file an issue (or note in your PR description) and use a temporary local copy in your section's directory marked `// FOUNDATION-REQUEST: extract to primitives`.

## Submission

- Open a PR to `main` titled `feat(v2/cycle): Phase 1 — cycle section (NC clone)`
- PR description must include: side-by-side screenshots for each route (legacy vs reference vs v2), data parity check confirmation, list of any FOUNDATION-REQUEST markers
- Rebase on `main` daily — foundation may evolve

## Why this is the proof session

If your built `/v2/cycle` looks and feels like Natural Cycles, sounds like Natural Cycles, and shows our data accurately, then the pattern works and the other 4 sessions can fan out using the same workflow. If it drifts visually or feels muddled, we pause and refine the design system before launching the rest.
