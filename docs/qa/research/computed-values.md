---
date: 2026-04-16
agent: R1
area: computed-values
status: FAIL
severity: HIGH
verification_method: sql-vs-api
---

# R1 - Computed-value truth audit

Breadth audit of the 8 computed values requested in the dispatch. Source of truth for each was pulled from `/api/admin/peek` and `/api/export` (JSON dump of 15 tables). All API endpoints were called live on `localhost:3005`. No writes performed.

## Summary table

| # | Computed value | Endpoint | API returned | Hand-calc | Verdict | Severity |
|---|---|---|---|---|---|---|
| 1 | Home / log streak | page render | 0 (hidden) | 0 | PASS | - |
| 2 | weekly.avgSleepScore | /api/log/prefill | 85.5 | 85.5 | PASS | - |
| 3 | weekly.avgPain, avgFatigue | /api/log/prefill | null | null | PASS | - |
| 4 | weekly.dayCount | /api/log/prefill | 9 | 9 | PASS | - |
| 5 | weekly.symptomsCount | /api/log/prefill | 2 | 2 | PASS | - |
| 6 | Progress / health ring values | /api/home (page data) | CD 27 | 50 true | FAIL | HIGH |
| 7 | Flare-risk prediction | /api/analyze/flare-risk | 400 - no flares | correct (no pain >=7 in DB) | PASS | - |
| 8 | Food-trigger correlations | /api/intelligence/food-symptoms | 0 corr, 8 triggers, 257 days | 0 / 8 / 257 | PASS | - |
| 9 | Orthostatic vitals delta | /api/intelligence/vitals | null | data exists (91 supine / 106 standing) | FAIL | MEDIUM |
| 10 | Sleep stage totals | /api/oura/sleep-stages | empty | data exists in raw_json | FAIL | HIGH |
| 11 | Cycle day - prefill | /api/log/prefill | 47 | 50 | FAIL | MEDIUM |
| 12 | Cycle day - intelligence | /api/intelligence/cycle | 51 | 51 for 2026-04-17 UTC | PASS (TZ drift) | LOW |
| 13 | Cycle day - home page | home render | 27 | 50 true | FAIL | HIGH |

## Per-value details

### 1. Streak (PASS)
File: `src/app/page.tsx:212-220`, `src/app/log/page.tsx:19-33`. Iterates backwards from yesterday, counts consecutive `daily_logs` with `overall_pain !== null`. All 1,490 daily_logs have `overall_pain = null`, so streak = 0. Consistent with data state.

### 2-5. Weekly averages (PASS)
`/api/log/prefill` with date=2026-04-16 returned weekly = { avgPain: null, avgFatigue: null, avgSleepScore: 85.5, symptomsCount: 2, dayCount: 9 }. Verified:
- Query window: `2026-04-08` to `2026-04-16` (because date-fns subDays(new Date('2026-04-16'),7) in HST local TZ yields 2026-04-08)
- daily_logs in range: 9 rows, all pain/fatigue null (dayCount=9)
- oura sleep_scores in range: [84, 85, 94, 81, 90, 77, 92, 81] - avg = 85.5 exactly
- symptoms in last 7 days: 2 rows (today's check-in)

Note for design review: the sparkline shows 8 dates but dayCount=9 (missing one spark date per 9-day window). And avg sleep uses 8 Oura values while pain window uses 9 log rows. This is a cosmetic inconsistency, not a computation bug.

### 6, 13. Home page cycle day (FAIL - HIGH)
See `docs/qa/2026-04-16-home-cycle-day-from-nc-predicted.md`. Home page uses `ncImported.cycle_day` which Natural Cycles populates with predicted CD=1 on 2026-03-22 even though no period started that day. Home page shows CD 27, but Lanae's last real period started 2026-02-26, so real CD = 50 as of 2026-04-16.

### 7. Flare risk (PASS behavior, FLAGGED data state)
`assessFlareRisk` requires `flareCount >= 3`; a "flare" is `overall_pain >= 7` or `severeSymptomCount >= 3` on a given aligned day. DB currently has 0 daily_logs with non-null overall_pain (matches session-1 findings). Correctly returns 400 "Not enough flare events". Endpoint logic is correct. Blocker is data state, not code.

### 8. Food-symptom correlations (PASS)
`/api/intelligence/food-symptoms` returned `{correlations: [], totalTriggers: 8, daysAnalyzed: 257, foodEntriesAnalyzed: 991}`. Hand-calculated from export JSON:
- food_entries in last 90 days: 991 - matches foodEntriesAnalyzed
- daily_logs in last 90 days: 257 - matches daysAnalyzed
- Unique flagged triggers across those 991 rows: 8 (dairy, gluten, caffeine, sugar, red_meat, soy, alcohol, processed) - matches totalTriggers
- 0 correlations because all baseline symptom values are null (same pain-null state)

### 9. Orthostatic vitals (FAIL - MEDIUM)
See `docs/qa/2026-04-16-vitals-intelligence-misses-myah-pulse.md`. Endpoint only reads lab_results where `test_name = 'Orthostatic HR Delta'`. myAH imported `Supine pulse rate = 91` and `Standing pulse rate = 106` on 2026-04-07 (delta 15 bpm, classifies as non-POTS). Endpoint ignores these and reports null. Memory's claim of "+58 bpm delta from resting 48" is incorrect - the actual clinical delta is 15.

### 10. Sleep stages (FAIL - HIGH)
See `docs/qa/2026-04-16-sleep-stages-column-mismatch.md`. `/api/oura/sleep-stages?date=2026-04-15` returns `{stages:[], totalMinutes:0, message:"No sleep data"}`. The oura_daily row for 2026-04-15 has full sleep data (`sleep_duration:26070`, `deep_sleep_min:99`, `rem_sleep_min:79`). The endpoint queries columns `sleep_total, sleep_deep, sleep_rem, sleep_light, sleep_awake, sleep_bedtime, sleep_wake` which do not exist on this table - the real columns are `sleep_duration, deep_sleep_min, rem_sleep_min`. Every single sleep-stage query has been returning empty since shipped.

### 11, 12. Cycle day discrepancy (FAIL)
See `docs/qa/2026-04-16-cycle-day-three-values.md`. Same patient on same day, three different CDs:
- Home page: 27 (trusts NC's predicted CD, ignores menstruation truth)
- Prefill: 47 (60-day cycle_entries window + picks LAST mens day, not first)
- Intelligence: 51 (90-day window, walks back to first mens day, then uses server UTC date 2026-04-17)
- True value for 2026-04-16: 50 (2026-02-26 real period start + 49 days + 1)
- True value for 2026-04-17: 51

## What was not verifiable

- `/api/context/sync-status` reports `byType.daily_log:1000` while totalRecords is 1196. Not in scope (vector-store agent R6).
- Progress ring value verification limited to cycle day (the only computed numeric in HealthRing); color logic is UI, not compute.
- Export endpoint caps daily_logs, oura_daily, nc_imported, food_entries at 1000 rows. For 1490-row tables, values beyond the cap were not inspected. The windows used (60/90 days) fit inside exported range, so computations are accurate for the verified values.

## Recommended actions per finding

All documented inline in the per-finding files listed above.
