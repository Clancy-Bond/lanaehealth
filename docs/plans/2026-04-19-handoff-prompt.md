# Handoff prompt - LanaeHealth /calories 1:1 MyNetDiary parity

**Paste this verbatim into the next Claude Code session.**

---

## Context (read first)

You are resuming an unfinished job on **LanaeHealth**, a personal
medical health tracking app for one patient (Lanae Bond, 24F, POTS
+ endo + chronic migraine). The user is **not** willing to settle
until the `/calories` section is a **one-to-one copy of
MyNetDiary** in both feature set and UX. The previous session made
substantial progress but ran out of time.

**Project location**

- Local: `/Users/clancybond/lanaehealth/`
- GitHub: `Clancy-Bond/lanaehealth`
- Production: `https://lanaehealth.vercel.app`
- Dev server: `lanaehealth-dev` on port 3005 (via `.claude/launch.json`)
- Latest commit before this handoff: see `git log --oneline | head -5`

**Tech stack**: Next.js 16, React 19, TypeScript, Tailwind CSS 4,
Supabase Postgres + pgvector, Vercel deploys on push to `main`,
Claude API (model `claude-sonnet-4-6`).

**Standing user authorizations** (do not ask before doing any of these):
- `git push` freely (no permission needed, including `-u origin`)
- Vercel deploys fire on push; do not pause
- Never modify existing Supabase row data - additive only
- Never use em dashes anywhere in code or output
- Force-push and destructive git ops still need explicit confirmation

**Warm-modern palette** in CSS variables (already wired):
`--accent-sage`, `--accent-blush`, `--phase-luteal`, `--bg-card`,
`--bg-primary`, `--text-primary`, `--text-secondary`, `--text-muted`,
`--text-inverse`, `--border-light`, `--shadow-sm`, `--shadow-md`.
No new color system. No em dashes. Sage = good / sage-muted = ok
/ blush-light = watch / blush = flag.

---

## What's done (do not redo)

**Overnight build 2026-04-17 to 04-18** shipped 40 commits with
16 new routes. See `docs/plans/2026-04-18-overnight-build-log.md`
for the full punch list.

**Parity audit + fix pass 2026-04-19** (today, in-progress):

Read `docs/plans/2026-04-19-mynetdiary-parity-audit.md` for the
complete 16-gap matrix. Summary:

- **Bugs fixed** (all committed + pushed + verified live):
  - Bug #1 (React #418 hydration on food detail): commit `a8376a4`
  - Bug #2 (search alphabetical put Branded first): commit `b700394`
  - Bug #3 (USDA `?nutrients=` filter returned 0 nutrients - BLOCKER,
    made every meal log with `calories=null`): commit `b700394`
  - Bug #4 (orthostatic `test_time NOT NULL` violation): commit `da420c8`

- **Gaps fixed** (committed + pushed, need live verification):
  - GAP #1 Weight Plan card on `/calories` (commit `ebc2667`)
  - GAP #4 Fd. Grade column in `/calories/food` table (commit `0831841`)
  - GAP #13 QuickLog `+` FAB on `/calories` (commit `b99d521`)
  - GAP #2 TipsCard on `/calories` (commit `66672cb`)
  - GAP #9 Staples for all 4 meal types in `/calories/search`
    (commit `f7849f7`)
  - GAP #10 Favorites star-toggle + persistence (commit `147fd65`)

- **All 9 POST endpoints E2E-verified via direct curl**:
  `/api/food/log`, `/api/calories/plan`, `/api/calories/custom-foods`,
  `/api/calories/custom-foods/log`, `/api/calories/recipes`,
  `/api/calories/favorites/toggle`, `/api/weight/log`,
  `/api/water/log`, `/api/cycle/bbt`, `/api/cycle/hormones`,
  `/api/symptoms/quick-log`, `/api/migraine/attacks`,
  `/api/orthostatic/tests` - all return 200 and persist correctly.

- **Full UI click-through E2E** via Playwright:
  1. Open `/calories` ✓
  2. Navigate to `/calories/search?q=banana`
  3. Click first result (Foundation Bananas) → food detail ✓
  4. Click "Add to Breakfast" → 303-redirect → `/calories` shows
     "Breakfast 85 cal / 1 item" ✓

---

## What is NOT done - pick these up

### Remaining gaps from the parity audit

Open `docs/plans/2026-04-19-mynetdiary-parity-audit.md` and look at
the Tier B/C/D lists. The remaining ones:

- **GAP #6**: Apple ring visualization at the bottom of `/calories/food`
  (MFN shows it both on Dashboard AND Food tabs). Extract the
  inline `CalorieApple` component from `src/app/calories/page.tsx`
  into a shared component at `src/components/calories/CalorieApple.tsx`,
  then render it on both pages.

- **GAP #7**: Collapsible meal sections in `/calories/food` (MFN has
  a chevron per section; tap collapses items under that meal).
  Complicated because the current layout is a `<table>` and
  `<details>` cannot wrap `<tr>`s. Two workable approaches:
  (a) convert the meal table to stacked `<section>` blocks per
  meal; (b) client component with `useState` for open/closed.

- **GAP #8**: Per-meal overflow menu (⋮) with Copy / Reorder / Delete
  actions. Build a small client component in
  `src/components/calories/MealOverflow.tsx` and inject into the
  MealSection header row.

- **GAP #11**: "My Meals" template save - let user save a full meal
  (e.g., "typical Tuesday breakfast") and re-add with one tap.
  Stored in `health_profile.section='meal_templates'` as jsonb.
  Needs: lib, POST endpoint, form on /calories, list in
  /calories/search?view=my-meals.

- **GAP #12**: Food tab settings gear - lets the user customize
  which nutrient columns show. Stub for now: show a gear icon
  that links to `/calories/plan` where they already set macro
  targets.

- **GAP #14**: Manual workout entry form (we sync from Oura but
  have no manual log). Build `/activity/new` form that writes
  to a new `health_profile.section='workouts'` jsonb.

- **GAP #15**: Weekly/monthly Analysis comparison reports (MFN
  calls these "Reports"). Add to `/calories/analysis` as a
  tabbed interface: Today / This Week / This Month.

- **GAP #16**: `/calories/health/blood-pressure` and
  `/calories/health/heart-rate` log pages, same jsonb pattern
  as weight.

### Re-verify before calling any gap closed

For every gap fix:
1. `npx tsc --noEmit` clean
2. `npx vitest run` - all 993 pre-existing tests still pass
3. `git push` triggers Vercel deploy; wait ~60s
4. **Playwright E2E** - navigate the actual prod URL, click
   the new button/form, verify the expected row lands in
   Supabase (use the inline node script pattern shown below).
5. Commit with real message. Each commit stands alone.

### How to read Supabase (ad-hoc diagnostics)

Create `tmp-check.mjs` in repo root (gitignored via the existing
`tmp_*.mjs` / `tmp-*.mjs` patterns in `.gitignore`):

```js
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ... query or delete test rows here
```

Run with `node tmp-check.mjs && rm tmp-check.mjs`.

### Persistence strategy summary

All new writable surfaces live in `health_profile` jsonb sections
(never a new table - the user does not want migrations overnight):

- `nutrition_goals`, `weight_log`, `water_log`, `hormone_log`,
  `bbt_log`, `custom_foods`, `recipes`, `food_favorites`,
  `meal_templates` (TBD by GAP #11), `workouts` (TBD by GAP #14).

Each section has a lib file in `src/lib/calories/` or `src/lib/cycle/`
with `load*`, `add*` or `toggle*`, and a `sanitize*` guard.

### Routes shipped (reference)

`/`, `/calories`, `/calories/food`, `/calories/food/[fdcId]`,
`/calories/search`, `/calories/plan`, `/calories/analysis`,
`/calories/photo`, `/calories/custom-foods/new`,
`/calories/recipes/new`, `/calories/health/weight`,
`/cycle`, `/topics/cycle`, `/topics/cycle/hormones`,
`/topics/orthostatic`, `/topics/orthostatic/new`,
`/topics/migraine`, `/topics/migraine/new`,
`/labs`, `/emergency`, `/sleep`, `/activity`, `/all`,
`/help/keyboard`, `/intelligence/readiness`.

Plus pre-existing: `/log`, `/patterns`, `/records`, `/doctor`,
`/doctor/care-card`, `/doctor/cycle-report`, `/doctor/post-visit`,
`/chat`, `/imaging`, `/timeline`, `/intelligence`, `/profile`,
`/settings`, `/import/myah`, `/expenses`.

### Architecture principle (pinned by user)

**Pull-add-rebrand**. Every feature layers on top of existing data
sources. We do NOT reinvent calculations MyNetDiary / Oura / USDA
have already made. Full rationale in
`docs/intelligence/readiness-formula.md`.

### Competitor research library (local only)

`~/competitor-research/` contains HTTrack mirrors of 13 competitor
sites (bearable, oura, mynetdiary, cronometer, clue, natural cycles,
whoop, careclinic, migrainebuddy, myfitnesspal, flaredown, guava,
abraham.com). These are for reference only - do NOT commit them.

### MCP Chrome tab for live MFN observation

User was logged into MyNetDiary in an MCP-controlled tab earlier.
Session may or may not still be live. If you need to see MFN's
current UX, ask the user to log in again. Do NOT attempt to log
in on their behalf.

### Testing tools available

- **Playwright** via `mcp__plugin_playwright_playwright__*` (load
  with `ToolSearch` query `select:<name>`)
- **Claude in Chrome** via `mcp__Claude_in_Chrome__*`
- **USDA FoodData Central** key in `USDA_API_KEY` env var

---

## Explicit next actions (pick up here)

1. **Run the E2E walk for the already-committed fixes** (GAP #1,
   #2, #4, #9, #10, #13) to confirm they render cleanly on prod.
   Route list: see "Routes shipped" above. Use Playwright +
   `browser_evaluate` to assert no console errors on each.

2. **Open `docs/plans/2026-04-19-mynetdiary-parity-audit.md`** and
   work the remaining Tier B/C/D gaps in order. Close each gap with
   a dedicated commit. Add a row to the "Exit criteria" checklist
   at the bottom of the audit doc when closed.

3. **Do NOT add features outside the parity audit**. The user's
   explicit bar is 1:1 MFN parity. Scope creep will frustrate them.

4. **Commit discipline**: one gap = one commit (+ any test fix).
   Push after every commit. If tsc or a test fails, fix before
   pushing; never bypass pre-push hook.

5. **When every Tier A/B gap is closed**, write a summary reply
   to the user listing each gap with its commit hash and "verified
   via E2E on prod" next to it.

---

## One more thing

The user is tired of half-measures. They specifically called out:
- No E2E tests from the overnight build
- No frame-by-frame MFN comparison
- No function-by-function parity audit

Today's session addressed those directly (Playwright E2E on every
flow, parity audit doc with 16 explicit gaps). **Do not regress to
"ship features, skip verification" mode**. Every fix must:
(a) match an explicit gap in the audit doc, (b) be E2E-verified
end to end, (c) survive a `curl -I` + Playwright console-error check
on prod, (d) not break existing tests.

If you cannot verify a fix end-to-end, explicitly say so - do not
claim parity you haven't confirmed.

---

**End of handoff. Good luck.**
