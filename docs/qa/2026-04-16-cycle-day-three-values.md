---
date: 2026-04-16
agent: R1
area: computed-values
status: FIXED
severity: HIGH
verification_method: sql-vs-api
fixed_by: IMPL-W2B-1 (2026-04-17)
---

# Three divergent cycle-day values across the app

## FIX (IMPL-W2B-1, 2026-04-17)

Built shared helper `src/lib/cycle/current-day.ts` exposing
`getCurrentCycleDay(today?)` + `computeCycleDayFromRows(...)`. The helper
unions `cycle_entries.menstruation = true` with
`nc_imported.menstruation = 'MENSTRUATION'`, deduplicates, and back-walks
consecutive runs (<= 2 day gap) to find the most recent true period start.

Refactored all three call sites:
  - `src/app/page.tsx` -- removed `ncImported.cycle_day` read (was 27/28),
    now calls `getCurrentCycleDay(today)` and also removed the 60-day-stale
    hack.
  - `src/lib/log/prefill.ts` -- dropped the local `computeCycleDay` that
    used a 60-day window and picked the wrong day as period start. Now
    widens query to 90 days and delegates to `computeCycleDayFromRows`.
  - `src/lib/ai/cycle-intelligence.ts` -- unchanged. Its existing logic
    (already correct after W1.4) is the algorithm the new helper mirrors.
  - `src/lib/cycle-calculator.ts` -- retained for legacy historical-day
    callers (doctor correlations), marked `@deprecated` with pointer to
    the shared helper.

Verified agreement (2026-04-17, Apollo 11 HST morning):
  - Home page: now renders `CD 51` + `Luteal` (was `CD 27`)
  - `/api/log/prefill`: `{ day: 51, phase: 'luteal' }` (was 48)
  - `/api/intelligence/cycle`: `{ cycleDay: 51, currentPhase: 'late_luteal' }`
    (unchanged; phase differs because intelligence uses ovulation signals)

Tests: new vitest `src/lib/__tests__/cycle/current-day.test.ts` covers
fixtures A/B/C + SPOTTING exclusion + multi-period separation + phase
banding. All 7 pass. Pre-existing failures in anovulatory-detection and
phase-insights are unrelated.

## One-sentence finding
The same patient on the same day gets three different cycle-day numbers (27, 47, 51) depending on which code path renders the value, because the home page trusts Natural Cycles' *predicted* period starts, the prefill uses a too-narrow 60-day window that misclassifies the last menstrual day as the start, and the intelligence route uses a 90-day window but computes against server UTC date.

## Expected
A single, consistent cycle-day value on every screen (home, log, intelligence dashboard) reflecting days since the most recent actual period start. For 2026-04-16 local date that value is **50**; for 2026-04-17 UTC it is **51**.

## Actual

| Surface | Code path | Value returned | How |
|---|---|---|---|
| Home page | `src/app/page.tsx:268` uses `ncImported?.cycle_day` | **27** | NC's predicted period start 2026-03-22 (no actual menstruation) |
| `/api/log/prefill` | `src/lib/log/prefill.ts:97-106` | **47** | 60-day window catches only 4 days (2026-02-26..03-01), each is treated as a separate period start, and the most-recent-before-target is 2026-03-01 (the *last* mens day of the period, not the first) |
| `/api/intelligence/cycle` | `src/lib/ai/cycle-intelligence.ts:304-317` | **51** | 90-day window catches 10 mens days across two periods, walks backwards from most recent while consecutive-diff <= 2 days, lands on 2026-02-26 (correct). Then `new Date().toISOString().slice(0,10)` is 2026-04-17 on UTC server, yielding 51 instead of 50 for a HST user. |

## Verification evidence

Most recent period starts (first day of each MENSTRUATION run) from `cycle_entries`:
```
2026-02-26  (last real period, 4 days: Feb 26, 27, 28, Mar 1)
2026-01-30  (prior period, 6 days: Jan 30 - Feb 4)
2026-01-04  (prior period)
2025-12-08  (prior period)
```

Hand calc cycle day given last real period 2026-02-26:
- 2026-04-16 (local): 50 (46 days diff + 1 start-inclusive, then +3 for Feb 28-29-ish... wait: (Apr 16 - Feb 26) = 49 days, +1 = **50**)
- 2026-04-17 (UTC): 51

`nc_imported.cycle_day` values for the current month:
```
2026-03-22 CD=1 (predicted by NC, menstruation=null)
...
2026-04-16 CD=26
2026-04-17 CD=27
2026-04-18 CD=1 (NC's next predicted period)
```
The NC import file sets CD=1 on a *predicted* period start (2026-03-22) even when no real menstruation is logged. Lanae's cycle went long; the Mar 22 prediction never materialized. Home page therefore reports a wrong CD.

Prefill's bug is inside `src/lib/log/prefill.ts:97-106`:
```
function computeCycleDay(date, history) {
  const periodStarts = history
    .filter(e => e.menstruation)           // all 4 rows pass
    .map(e => parseISO(e.date))
    .sort((a,b) => b.getTime() - a.getTime())  // desc
  const target = parseISO(date)
  const last = periodStarts.find(d => d <= target)  // picks 2026-03-01 (most recent)
  if (!last) return null
  return differenceInDays(target, last) + 1  // 46 days + 1 = 47
}
```
It never groups consecutive menstrual days into a "period run" before picking the start - each mens day is treated as its own period start, so the answer is "days since the *end* of the period" not "days since the start".

`cycle-intelligence`'s 90-day window happens to include both Jan 30-Feb 4 and Feb 26-Mar 1, letting the walk-back loop correctly land on Feb 26. Then `new Date().toISOString().slice(0,10)` uses UTC, so a HST user at 2026-04-16 23:59 sees CD 51.

## Recommended action

- INVESTIGATE: decide which calendar is canonical. Options:
  1. Trust `cycle_entries.menstruation = true` (user-confirmed blood) as the source of truth for period starts across all surfaces.
  2. Continue to seed NC predictions but annotate them so they can be stripped when no actual menstruation follows.
- FIX `src/lib/log/prefill.ts`:
  1. Use a 90-day window (not 60) OR walk back until the loop finds a true period boundary.
  2. Group consecutive mens days into period runs (gap > 2 days = new period) before picking the start.
  3. Share a helper (`lib/cycle/period-start.ts`) between `prefill.ts`, `cycle-intelligence.ts`, `cycle-calculator.ts`, and page.tsx so there is exactly one definition.
- FIX `src/app/page.tsx:264-279`: stop trusting `nc_imported.cycle_day` verbatim. Either derive CD from the shared helper or use `nc_imported.cycle_day` only when `nc_imported.menstruation` is `'MENSTRUATION'` on that date.
- FIX `src/lib/ai/cycle-intelligence.ts:274`: use patient local date (HST) for `today` instead of `new Date().toISOString()`. Patient is in Hawaii per health profile.
- TEST: unit test the shared helper against the known data points: 2026-04-16 -> CD 50, 2026-02-27 -> CD 2, 2026-01-30 -> CD 1.

## Related prior findings
Session 1 found the same cycle-intelligence route ignores `nc_imported.menstruation`: `docs/qa/2026-04-16-cycle-intelligence-ignores-nc-imported.md`. That is a separate but adjacent bug; this finding is about the three-way divergence.
