# v2 mobile rebuild — parallel session briefings

This directory holds self-contained briefing prompts for the parallel Claude Code sessions building the LanaeHealth v2 mobile UI. Each `0N-*.md` file is a copy-paste prompt for the opening message of a fresh session.

## Best-of-three design philosophy

Every session inherits this:

| Layer | Source | Applies to |
|-------|--------|-----------|
| Visual language ("vibes") | **Oura** | Shell, palette, ring metaphors, white space, premium feel |
| Clarity / pedagogy / voice | **Natural Cycles** | All copy: labels, subtext, onboarding, error states |
| Per-section interaction patterns | Section-specific (see each prompt) | The actual section surfaces |

When the three conflict, the per-section pattern wins for that section's surface, but the visual chrome and copy voice stay consistent.

## Reference assets available to all sessions

| Source | Recording | Frames | Primary use |
|--------|-----------|--------|-------------|
| Natural Cycles | `docs/reference/natural-cycles/recordings/full-tour.mp4` | `docs/reference/natural-cycles/frames/full-tour/` (319 PNGs) | Cycle UX patterns, voice/pedagogy |
| MyNetDiary | `docs/reference/mynetdiary/recordings/full-tour.mp4` | `docs/reference/mynetdiary/frames/full-tour/` (424 PNGs) | Food/calorie UX patterns |
| Oura | `docs/reference/oura/recordings/full-tour.mp4` | `docs/reference/oura/frames/full-tour/` (255 PNGs) | Visual chrome, ring metaphors, data viz, readiness model |

All frames extracted at scene-change threshold 0.04 for max coverage of subtle states (active button states, sub-tab swaps, modal openings, etc.).

## Hard prerequisite: Phase 0 (foundation) must run first

Before any of the 5 section sessions can start, run **Session 00 — Foundation**.

Full prompt: [`00-foundation.md`](./00-foundation.md)

Foundation produces:
1. Pre-flight refactor of the 3 components writing to Supabase directly
2. `src/v2/theme/tokens.css` (extracted from Oura + NC frames)
3. `src/v2/components/primitives/` (Button, Card, ListRow, MetricRing, MetricTile, Sheet, Stepper, EmptyState, Skeleton, Banner, Toggle, SegmentedControl)
4. `src/v2/components/shell/` (MobileShell, TopAppBar, BottomTabBar, FAB)
5. Stubbed `/v2/*` route placeholders for every route the 5 sessions will own
6. `docs/v2-design-system.md` documenting everything
7. Per-app derived analysis: `docs/reference/<app>/{colors,typography,components,flows}.md`

Once Session 00 merges to `main`, Session 01 (Cycle) runs as the pattern proof. After Session 01 lands, Sessions 02-05 fan out in parallel.

## Session order and parallelization

| Session | Phase | Section | When to run | Reference dominance |
|---------|-------|---------|-------------|---------------------|
| 01 | 1 | Cycle (proof of pattern) | After Foundation, BEFORE other sessions | Natural Cycles |
| 02 | 2 | Calories / Food | After Session 01 lands (pattern proven) | MyNetDiary |
| 03 | 3 | Home + Log + Patterns | Parallel with 02 | Oura |
| 04 | 4 | Doctor mode (sacred, last) | Parallel with 02-03 BUT do not ship until last | Original (Oura chrome) |
| 05 | 5 | Weekly tail | Parallel with 02-04 | Mixed, lighter polish |

**Recommended ramp:**
- Week 1: Foundation (sequential), then Session 01 (Cycle).
- Week 2-3: Sessions 02-05 in parallel (4 worktrees, daily rebases).
- Week 3-4: Polish merge + Session 04 acceptance test at real doctor visit.

## Coordination rules (non-negotiable)

1. **One git worktree per session.** Create with `git worktree add ../v2-<section> -b claude/v2-<section>` from the main repo.
2. **Daily rebase on main.** Each parallel session rebases daily so it picks up the latest foundation/primitives.
3. **Locked files.** Parallel sessions MUST NOT modify `src/v2/components/primitives/*`, `src/v2/components/shell/*`, or `src/v2/theme/*`. These live in foundation. If a session needs a missing primitive, file a request and use a temporary local copy marked `// FOUNDATION-REQUEST: extract to primitives` — the foundation owner extracts it during merge.
4. **No cross-section imports.** Section sessions import only from `src/v2/components/primitives/*`, `src/v2/components/shell/*`, and `src/lib/*` — never from another section's components.
5. **Untouchable engine.** No edits to `src/lib/*`, `src/app/api/**`, Supabase migrations, or `src/lib/supabase.ts`.

## Acceptance gate (every session)

For each route built:
- Side-by-side screenshot vs reference frame passes visual match
- Renders correctly on iOS Safari at 375pt, 390pt, 428pt
- Tap targets ≥ 44pt, no horizontal overflow, safe-area respected
- Data parity with legacy route (same date returns same numbers)
- Voice follows Natural Cycles' pedagogy pattern (every screen explains what it shows)
