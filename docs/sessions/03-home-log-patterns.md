# Session 03 — Home + Log + Patterns (Phase 3)

> **Copy this entire file as the opening message of a fresh Claude Code session in the home worktree.**

---

You are building Phase 3 of the LanaeHealth v2 mobile UI rebuild — the **Home, Log, and Patterns** section. This is the **showcase**: it's the screen the user sees first every time they open the app, and it's where the Oura aesthetic shines hardest. Run in parallel with Sessions 02, 04, 05 after Session 01 lands.

## Worktree setup (run this in your terminal first)

```bash
cd /Users/clancybond/lanaehealth/.claude/worktrees/sweet-rosalind-cea925/
scripts/v2-worktree-setup.sh home
cd ../v2-home
claude
```

Then paste this prompt as your first message.

## Hard prerequisite

Do not start until **Session 00 (Foundation)** AND **Session 01 (Cycle)** have merged to `main`. Rebase your branch on `main` to pull them in.

## Read first (in order)

1. `docs/sessions/README.md` — design philosophy, coordination rules
2. `docs/v2-design-system.md` — tokens, primitives, conventions
3. `docs/sessions/01-cycle.md` and the merged `claude/v2-cycle` branch — the proven pattern
4. `docs/reference/oura/frames/full-tour/` — **255 reference frames; this IS your visual spec.** Browse them all.
5. Cross-reference: `docs/reference/natural-cycles/frames/full-tour/` for explanatory copy patterns
6. `src/lib/cycle/load-cycle-context.ts`, `src/lib/calories/home-data.ts`, `src/lib/api/oura.ts`
7. Existing legacy widgets in `src/components/home/widgets/*` and `src/components/home/*` — many are already clean server components

## Scope: routes to build

Build the v2 versions of these 8 routes:

- `src/app/v2/page.tsx` — **THE home screen** (Oura's home/readiness analog)
- `src/app/v2/today/page.tsx` — today snapshot
- `src/app/v2/log/page.tsx` — daily symptom/vitals log
- `src/app/v2/sleep/page.tsx` — sleep / Oura data
- `src/app/v2/timeline/page.tsx` — medical timeline
- `src/app/v2/patterns/page.tsx` — patterns hub
- `src/app/v2/patterns/calories/page.tsx` — calorie patterns (30-day)
- `src/app/v2/patterns/cycle/page.tsx` — cycle patterns (user said "depends on how good we make it" — make it great)
- `src/app/v2/import/page.tsx` — universal data import (the user uses this daily)

## Design layer assignments

- **Visual chrome:** Oura. This section IS where Oura's aesthetic lives most directly. Dark mode capable, ring-centric, generous white space, premium feel. The home screen should feel like Oura's home screen.
- **Voice / pedagogy:** Natural Cycles. Match Oura's cleanliness but inject NC's explanatory layer. Every metric on the home screen should answer "what does this mean for me today?" — not just display a number.
- **Section UX patterns:** Oura. Specifically:
  - The home screen is a horizontal-scrolling chip strip of metric tiles (Readiness / Sleep / Activity / Cycle day / Heart) at the top, then a primary insight card below ("Bedtime's Approaching" pattern), then drilldowns
  - Sleep view follows Oura's day-detail pattern with arc visualizations
  - Educational explainer modals (saw "Sleep regularity" at frame ~120 — copy that pattern for our metrics)
  - Trends/patterns use Oura's chart styling

## Reference frames to focus on

Oura reference frames (browse `docs/reference/oura/frames/full-tour/`):

- Home / readiness — the daily landing screen with metric chips and insight card
- Sleep view — day detail with arc visualizations
- Activity view — drill-down patterns
- Trends — historical chart styling
- Educational modals — the "Sleep regularity" explainer pattern; replicate for ours

Cross-reference Natural Cycles frames for explanatory copy voice (NC frames around the today/check-in flow).

**First task:** scrub `docs/reference/oura/frames/full-tour/` and rename canonical frames semantically (`home-readiness-default.png`, `home-readiness-tile-active.png`, `sleep-day-detail.png`, `sleep-explainer-modal.png`, `activity-trends.png`, etc.). Output curation as `docs/reference/oura/frames/home-section.md`.

## Reuse from `src/lib/`

- `src/lib/cycle/load-cycle-context.ts` — for the cycle metric on home
- `src/lib/calories/home-data.ts` — for the calorie metric on home
- `src/lib/api/oura.ts` — for Oura/sleep data
- `src/lib/ai/*` — for "today's insight" generation (uses Three-Layer Context Engine)
- `src/lib/context/assembler.ts` — for any AI-driven daily narrative
- Legacy widgets to model: `src/components/home/widgets/*` (already clean server components), `src/components/home/CalorieCard.tsx`, `src/components/home/HealthRing.tsx`, `src/components/home/CalendarHeatmap.tsx`, `src/components/home/YearInPixels.tsx`

## Reuse from foundation primitives

`MetricRing` (large home ring), `MetricTile` (the chip strip), `Card` (insight cards), `ListRow`, `Sheet` (educational modals), `EmptyState`, `Skeleton`, `Button`. Plus shell.

## Acceptance criteria (per route)

1. **Visual match:** side-by-side vs Oura reference frames passes visual match (especially the home screen's chip strip + primary insight pattern).
2. **Voice match:** every metric on home has explanatory subtext in NC's voice. No raw numbers without context. Bonus: every metric tile has a tap-to-explain modal in the "Sleep regularity" Oura pattern.
3. **AI insight integration:** the home screen surfaces today's insight from the Three-Layer Context Engine (`src/lib/context/assembler.ts`). Test that it loads.
4. **Mobile correctness:** iOS Safari at 375/390/428pt. Tap targets ≥ 44pt. No overflow. Safe area.
5. **Data parity:** legacy `/` vs `/v2` for same date — identical metrics displayed.
6. **No engine touch.**

## Special concern: the home screen IS the front door

This screen sets the bar for the entire app. If it doesn't feel premium and clear on first open, the user won't trust the rest. Spend extra time on it. Consider a 1-day polish pass at the end of this session focused on home alone.

## Locked files (DO NOT EDIT)

Same as other sessions: primitives, shell, theme, lib, api, other sessions' work.

## Submission

- PR title: `feat(v2/home): Phase 3 — home + log + patterns (Oura clone)`
- PR description: side-by-side screenshots for each route (especially home), data parity confirmation, AI insight integration screenshot.
- Rebase on `main` daily.
