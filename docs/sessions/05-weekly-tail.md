# Session 05 — Weekly tail (Phase 5)

> **Copy this entire file as the opening message of a fresh Claude Code session in the records worktree.**

---

You are building Phase 5 of the LanaeHealth v2 mobile UI rebuild — the **weekly tail**. These are pages the user opens weekly (not daily): records, labs, imaging, condition deep-dives, settings, secondary import flows, and supporting health trackers. The polish bar is **on-brand and mobile-correct**, not showcase-grade. Run in parallel with Sessions 02, 03, 04 after Session 01 lands.

## Worktree setup (run this in your terminal first)

```bash
cd /Users/clancybond/lanaehealth/.claude/worktrees/sweet-rosalind-cea925/
scripts/v2-worktree-setup.sh tail
cd ../v2-tail
claude
```

Then paste this prompt as your first message.

## Hard prerequisite

Do not start until **Session 00 (Foundation)** AND **Session 01 (Cycle)** have merged to `main`. Rebase your branch on `main` to pull them in.

## Read first (in order)

1. `docs/sessions/README.md` — design philosophy, coordination rules
2. `docs/v2-design-system.md` — tokens, primitives, conventions
3. `docs/sessions/01-cycle.md` and the merged `claude/v2-cycle` branch — the proven pattern
4. All three reference frame folders for inspiration; no single dominant reference for this section
5. `src/lib/api/labs.ts`, `src/lib/api/cycle.ts`, `src/lib/api/headache.ts`, `src/lib/api/orthostatic.ts`-equivalent (look for relevant helpers)
6. Existing legacy components in `src/components/labs/*`, `src/components/imaging/*`, `src/components/topics/*`, `src/components/settings/*`

## Scope: routes to build

Build the v2 versions of these 11 routes:

- `src/app/v2/records/page.tsx` — records hub
- `src/app/v2/labs/page.tsx` — lab results
- `src/app/v2/imaging/page.tsx` — imaging studies
- `src/app/v2/topics/orthostatic/page.tsx` — orthostatic deep-dive
- `src/app/v2/topics/orthostatic/new/page.tsx` — log orthostatic event
- `src/app/v2/topics/cycle/page.tsx` — cycle deep-dive (separate from /v2/cycle — this is condition-focused)
- `src/app/v2/topics/cycle/hormones/page.tsx` — hormones page
- `src/app/v2/topics/nutrition/page.tsx` — nutrition deep-dive
- `src/app/v2/settings/page.tsx` — settings hub
- `src/app/v2/import/myah/page.tsx` — MyAH-specific import
- `src/app/v2/calories/health/blood-pressure/page.tsx` — BP tracker (light)
- `src/app/v2/calories/health/heart-rate/page.tsx` — HR tracker (light)

## Design layer assignments

- **Visual chrome:** Oura. Use v2 primitives consistently with the rest of the app.
- **Voice / pedagogy:** Natural Cycles. Especially important for the topic deep-dives — these are pages where the user goes to learn or document, so explanatory copy is the value proposition.
- **Section UX patterns:** Mixed:
  - **Records / Labs / Imaging:** list-heavy. Use Oura's clean ListRow + Card patterns. Labs especially: a chronological list of results with abnormal-flag badges.
  - **Topics (orthostatic / hormones / nutrition):** content-heavy. Article-style layouts with NC's explanatory voice; embed live data where relevant (e.g., orthostatic page shows the user's recent test results inline).
  - **Settings:** classic iOS settings list. ListRow with chevrons. Sectioned. Toggle switches consistent with foundation primitives.
  - **Import:** simple form / file upload patterns.
  - **BP / HR trackers:** lightweight time-series plots; reuse the recharts patterns from `src/components/calories/health/*`.

## Reference frames

No single dominant reference here. Browse all three reference folders for inspiration:

- `docs/reference/oura/frames/full-tour/` — for chrome and list patterns
- `docs/reference/natural-cycles/frames/full-tour/` — for educational/topic page layouts (NC's "Learn" tab is a good model)
- `docs/reference/mynetdiary/frames/full-tour/` — specifically for the BP/HR/weight tracker patterns (MFN's health subtrackers)

**First task:** browse the three frame folders and identify the 5-10 frames that map to your routes. Output as `docs/reference/tail-section.md` with route-to-frame mapping.

## Reuse from `src/lib/`

- `src/lib/api/labs.ts` — lab results CRUD
- `src/lib/api/headache.ts`, `src/lib/api/bowel.ts`, `src/lib/api/mood.ts` — symptom-specific data
- `src/lib/imaging/*` if it exists, otherwise data lives in `src/app/api/imaging/route.ts`
- `src/lib/api/cycle.ts` and intelligence engines for the topic deep-dives
- `src/lib/api/privacy-prefs.ts`, `src/lib/api/favorites.ts` for settings
- Existing components to model: `src/components/records/LabsTab.tsx`, `src/components/imaging/ImagingViewerClient.tsx`, `src/components/topics/*`, `src/components/settings/*`

## Reuse from foundation primitives

`ListRow` (everything is a list), `Card`, `MetricTile` (for BP/HR sparklines), `Sheet`, `EmptyState`, `Skeleton`, `Button`. Plus shell.

## Acceptance criteria (per route)

1. **Visual consistency:** uses v2 primitives correctly. Looks like the same app as `/v2/cycle`, `/v2/calories`, `/v2/`.
2. **Voice match:** topic pages have NC-style explanatory voice. Settings rows have helpful subtext (not just a label).
3. **Mobile correctness:** iOS Safari at 375/390/428pt. Tap targets ≥ 44pt. No overflow. Safe area.
4. **Data parity:** legacy route vs `/v2/...` for same dataset — identical data displayed.
5. **No engine touch.**

## Polish bar note

This is the only session where "good enough and mobile-correct" is acceptable. Don't over-invest in showcase polish here at the expense of finishing. The user's time savings come from getting all the weekly pages on-brand quickly, not from each one being a masterpiece.

## Locked files (DO NOT EDIT)

Same as other sessions: primitives, shell, theme, lib, api, other sessions' work.

## Submission

- PR title: `feat(v2/tail): Phase 5 — weekly tail section`
- PR description: side-by-side screenshots for each route (one per row, no need for elaborate per-route docs), data parity confirmation.
- Rebase on `main` daily.
