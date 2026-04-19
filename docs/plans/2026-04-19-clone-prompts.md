# Clone Session Prompts -- Phase 1 Fan-Out

**Date:** 2026-04-19
**Phase 0 shell:** landed in branch `claude/epic-fermat-6f2589` (commits `1f2c9ad..eb13877`).
**How to use:** open four fresh Claude Code sessions and paste each prompt into its own session. Each session works in its own git worktree and commits to its own branch so they do not collide.

---

## Shared setup commands (each session starts with these)

Every clone session starts by creating its own worktree off the Phase 0 shell:

```bash
cd /Users/clancybond/lanaehealth
git fetch origin
git worktree add .claude/worktrees/clone-<NAME> -b claude/clone-<NAME> origin/claude/epic-fermat-6f2589
cd .claude/worktrees/clone-<NAME>
```

(replace `<NAME>` with `calories`, `cycle`, `symptoms`, or `sleep`).

---

## Non-negotiable contract (repeated in every prompt)

Every clone session MUST respect these or the four parallel branches will conflict on merge:

1. **Forbidden to edit:**
   - `src/components/TopNav.tsx`
   - `src/components/BottomNav.tsx`
   - `src/components/AppShell.tsx`
   - `src/app/page.tsx`
   - `src/lib/nav/config.ts` (except adding one line to the tab's `fab` descriptor if needed)
   - `src/lib/home/widgets.ts`, `src/lib/home/legacy-widgets.ts` (except calling `registerWidget()`)
2. **Own only your tab's files:** `src/app/<tab>/**`, `src/components/<tab>/**`, `src/lib/<tab>/**`, `src/app/api/<tab>/**`.
3. **Register home widgets by calling `registerWidget()`** from a side-effect file like `src/lib/<tab>/home-widgets.ts` that is imported once from `src/app/<tab>/layout.tsx`.
4. **Reference existing design tokens** in `src/app/globals.css`. Do NOT introduce a new theme; polish within the warm-modern palette.
5. **Never shame the user.** Follow [docs/plans/2026-04-16-non-shaming-voice-rule.md](2026-04-16-non-shaming-voice-rule.md) verbatim.
6. **Don't copy the bugs.** Study the "what users hate" section of the reference app's `user-reviews.md` and engineer around those failures.

---

## PROMPT 1 -- Calories (MyNetDiary clone)

```
You are building the LanaeHealth Calories tab. This tab is a best-in-class replacement for a user's calorie tracker, built by studying MyNetDiary and avoiding its reviewed failures.

Run first:
  cd /Users/clancybond/lanaehealth
  git fetch origin
  git worktree add .claude/worktrees/clone-calories -b claude/clone-calories origin/claude/epic-fermat-6f2589
  cd .claude/worktrees/clone-calories

Read, in order:
  1. docs/plans/2026-04-19-compartmentalized-ux-overhaul-design.md  (overall contract)
  2. docs/plans/2026-04-19-clone-prompts.md                          (your forbidden-files list is in here)
  3. docs/competitive/mynetdiary/patterns.md                          (the good patterns to emulate)
  4. docs/competitive/mynetdiary/user-reviews.md                      (what to avoid: AI-intrusion, food DB gaps, autopilot glitches)
  5. docs/research/competitive-analysis-2026-04-17.md                 (cross-cutting weakness themes)
  6. docs/plans/2026-04-16-non-shaming-voice-rule.md                  (voice rule)

Your tab id is "calories". Its NavConfig entry already exists at src/lib/nav/config.ts. The FAB on this tab navigates to /calories/search.

Deliverables (in this order, each as its own commit):
  1. /calories landing page (server component) -- today's running total, meal sections, weekly trend, readiness banner.
  2. /calories/search flow polish -- this is the FAB destination. USDA autocomplete exists; verify search, portion picker, and add-to-meal flow feel like MyNetDiary's best moment.
  3. /calories/plan page -- macro + calorie targets, weight plan card already built.
  4. 3 home widgets registered in src/lib/calories/home-widgets.ts, imported once from src/app/calories/layout.tsx. Suggested:
       - "calories-today-ring" (MFN apple-ring parity, condensed)
       - "macros-today" (protein/carb/fat stacked bars)
       - "weekly-calorie-delta" (today vs 7d average)
     Register each via registerWidget() from src/lib/home/widgets.ts. Do NOT edit src/app/page.tsx.
  5. /patterns/calories view -- 30-day calorie + macro time series.

Forbidden files: listed in the clone-prompts doc.

Verify before you finish:
  - npx tsc --noEmit passes.
  - npx vitest run passes.
  - preview_start lanaehealth-dev, load /calories on mobile + desktop. FAB (+) should appear and go to /calories/search. Back to home, the 3 new widgets should appear. Customize sheet should list them.

Commit every logical chunk. Push to origin/claude/clone-calories when done.

Avoid at all costs (from MyNetDiary reviews):
  - AI suggestions that are wrong or paywalled (the "AI infecting every level" complaint).
  - Rigid protein/macro settings with no dietary accommodations.
  - Autopilot-style features that surprise the user.
  - US-only food DB blind spot (use USDA but flag when the user queries a non-US food and let them add manually).
```

---

## PROMPT 2 -- Cycle (Natural Cycles clone)

```
You are building the LanaeHealth Cycle tab. Reference app: Natural Cycles (best-in-class cycle tracker). Replace it for users who want cycle + fertility + period tracking without the review-documented failures.

Run first:
  cd /Users/clancybond/lanaehealth
  git fetch origin
  git worktree add .claude/worktrees/clone-cycle -b claude/clone-cycle origin/claude/epic-fermat-6f2589
  cd .claude/worktrees/clone-cycle

Read, in order:
  1. docs/plans/2026-04-19-compartmentalized-ux-overhaul-design.md
  2. docs/plans/2026-04-19-clone-prompts.md
  3. docs/competitive/natural-cycles/patterns.md
  4. docs/competitive/natural-cycles/user-reviews.md  (ovulation-detection failures, price-hike trust loss, auto-renewal trap, thermometer defects)
  5. docs/research/competitive-analysis-2026-04-17.md
  6. docs/plans/2026-04-16-non-shaming-voice-rule.md
  7. src/lib/cycle/current-day.ts  (DO NOT reinvent this; it is the canonical cycle-day algorithm)
  8. docs/qa/2026-04-16-cycle-day-three-values.md  (history of why local cycle-day computation is banned)

Your tab id is "cycle". FAB goes to /cycle/log.

Deliverables:
  1. /cycle landing page -- hero ring showing current day + phase + days-until-period-estimate, daily "did your period come?" prompt, quick fertility/ovulation signal cards.
  2. /cycle/log -- single-screen period logging (flow 0-4, symptoms carousel, notes). This is the FAB destination.
  3. /cycle/history -- monthly calendar (reuse CalendarHeatmap) + cycle list with prev-period date + length.
  4. /cycle/predict -- next-period + fertility-window prediction. Be honest about confidence; when data is thin, say so. Don't ever say "safe day".
  5. 3 home widgets via registerWidget() in src/lib/cycle/home-widgets.ts:
       - "cycle-today-ring" (day + phase)
       - "next-period-countdown"
       - "fertility-window-now" (in/out + confidence)
     Imported from src/app/cycle/layout.tsx.
  6. /patterns/cycle view -- cycle-length trend, symptom-by-phase heatmap.

Voice rules (very important for this tab):
  - "Cycle unknown" rather than "No data".
  - No positive framing of fertility ("it's your lucky day!"). Users include people trying to avoid pregnancy and those with PCOS for whom ovulation is uncertain.
  - No red/alarm styling for late period. Blush stripe only.

Never say "99% effective" or any contraceptive-efficacy claim. We are not a contraceptive device; we are a tracker.

Verify:
  - tsc, vitest, lint clean.
  - Load /cycle on both breakpoints; check FAB goes to /cycle/log; check home shows 3 new widgets under a "Cycle" category in the Customize sheet.

Commit + push to origin/claude/clone-cycle.
```

---

## PROMPT 3 -- Symptoms / Pain (Bearable clone)

```
You are building the LanaeHealth Symptoms tab. Reference app: Bearable. Replace it for chronic-illness users who want finer granularity and real data ownership -- both areas where Bearable's reviews show persistent failure.

Run first:
  cd /Users/clancybond/lanaehealth
  git fetch origin
  git worktree add .claude/worktrees/clone-symptoms -b claude/clone-symptoms origin/claude/epic-fermat-6f2589
  cd .claude/worktrees/clone-symptoms

Read, in order:
  1. docs/plans/2026-04-19-compartmentalized-ux-overhaul-design.md
  2. docs/plans/2026-04-19-clone-prompts.md
  3. docs/competitive/bearable/patterns.md
  4. docs/competitive/bearable/user-reviews.md  (5-yr unfixed sleep bug, 6hr block granularity, subscription nag, export-doesnt-include-"none" rows)
  5. docs/research/competitive-analysis-2026-04-17.md
  6. docs/plans/2026-04-16-non-shaming-voice-rule.md

Your tab id is "symptoms". Default route is /log (pre-existing). FAB goes to /log.

Deliverables:
  1. /log landing -- convert the existing multi-section check-in into Bearable-style pill carousels, but with per-entry timestamp (not 6hr blocks). Keep every existing save path.
  2. /log/quick -- ten-second symptom log (emoji grid + severity).
  3. /log/attack -- headache/migraine timed attack. Extends src/lib/logic/headache timer.
  4. /symptoms/:id -- detail page for a single symptom type (severity trend, triggers, medications that helped).
  5. 3 home widgets via registerWidget() in src/lib/symptoms/home-widgets.ts:
       - "today-symptom-grid" (pills to add now)
       - "pain-7day-sparkline"
       - "top-triggers-this-week" (computed server-side)
  6. /patterns/symptoms -- year-in-pixels already exists, extend with trigger-vs-symptom correlation.

Export contract (Bearable's biggest fail): any export MUST include "none" / no-symptom rows so the user can prove absence, not just presence.

Granularity contract: every symptom entry stores a full ISO timestamp, not a 6-hour block. Never bucket on write.

Verify:
  - tsc, vitest, lint clean.
  - Load /log and /log/quick; check FAB goes to /log; 3 widgets in home's Customize sheet under Symptoms.

Commit + push to origin/claude/clone-symptoms.
```

---

## PROMPT 4 -- Sleep (Oura clone)

```
You are building the LanaeHealth Sleep tab. Reference app: Oura. Replace the mobile app experience for users who already have the ring (we pull Oura data via the existing OAuth integration). Fix the things Oura users gripe about in reviews.

Run first:
  cd /Users/clancybond/lanaehealth
  git fetch origin
  git worktree add .claude/worktrees/clone-sleep -b claude/clone-sleep origin/claude/epic-fermat-6f2589
  cd .claude/worktrees/clone-sleep

Read, in order:
  1. docs/plans/2026-04-19-compartmentalized-ux-overhaul-design.md
  2. docs/plans/2026-04-19-clone-prompts.md
  3. docs/competitive/oura/patterns.md
  4. docs/competitive/oura/user-reviews.md  (billing/FSA gaps, AI-only support, firmware-breaking-sync, battery degradation)
  5. docs/research/competitive-analysis-2026-04-17.md
  6. docs/plans/2026-04-16-non-shaming-voice-rule.md
  7. src/lib/oura/* and the oura_daily table to see what data already flows in

Your tab id is "sleep". FAB goes to /sleep/log. Default route /sleep does not yet exist -- you create it.

Deliverables:
  1. /sleep landing page -- readiness-score ring, sleep-score ring, HRV trend, body-temp-deviation gauge. Uses existing oura_daily rows; no new DB tables.
  2. /sleep/log -- manual sleep entry for days the ring didn't sync (bedtime, wake, perceived quality 1-5, naps). Writes to daily_logs.
  3. /sleep/stages -- last-night REM/deep/light breakdown + 7-day average.
  4. /sleep/recovery -- Readiness + HRV + RHR vs 28-day baseline (BaselineCard pattern exists). Extend, don't duplicate.
  5. 3 home widgets via registerWidget() in src/lib/sleep/home-widgets.ts:
       - "sleep-last-night" (score + hours)
       - "readiness-today" (number + top contributor)
       - "hrv-trend-7d" (small sparkline)
  6. /patterns/sleep -- 30-day sleep score + HRV + RHR time series.

FSA gap fix (from Oura reviews): if you surface any billing UI (you shouldn't, this is not our product), always show a downloadable itemized receipt.

Sync-broken fallback: when oura_daily is stale (latest row > 24h old), show a "Last synced <date>" banner with a refresh link to /api/oura/sync. Do not pretend fresh data exists.

Verify:
  - tsc, vitest, lint clean.
  - Load /sleep on mobile + desktop; FAB goes to /sleep/log; 3 widgets register under Sleep category in Customize sheet.

Commit + push to origin/claude/clone-sleep.
```

---

## After all four clones return

Open a new session in this worktree (`claude/epic-fermat-6f2589`) and:

1. `git fetch origin`
2. Pull each clone branch in and merge: `git merge origin/claude/clone-calories`, then cycle/symptoms/sleep.
3. Resolve any conflicts in `src/lib/nav/config.ts` (should be trivial one-line additions).
4. Run `npx tsc --noEmit && npx vitest run && npm run build`.
5. Smoke-test each tab + Customize sheet on mobile + desktop.
6. Open a single PR back to main with the whole shell + 4 clones.
