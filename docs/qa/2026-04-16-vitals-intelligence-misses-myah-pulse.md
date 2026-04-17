---
date: 2026-04-16
agent: R1
area: computed-values
status: FIXED
severity: MEDIUM
verification_method: sql-vs-api
fixed_by: IMPL-W2A-8
fixed_date: 2026-04-17
---

# Vitals intelligence ignores myAH-imported supine/standing pulse rows

## One-sentence finding
`/api/intelligence/vitals` only reads `lab_results` rows where `test_name = 'Orthostatic HR Delta'`, which is the name written by the app's own save-orthostatic POST flow. The real myAH-imported data uses `test_name = 'Supine pulse rate'` and `'Standing pulse rate'` and is therefore invisible to the intelligence reader, even though a clinically complete supine/standing pair exists for 2026-04-07.

## Expected
Given real positional vitals in `lab_results`, the endpoint should calculate the delta (standing - supine), classify POTS status, and report `latestOrthostatic` and `thirtyDayTrend.totalTests >= 1`.

## Actual
```
$ curl -s http://localhost:3005/api/intelligence/vitals
{
  "latestOrthostatic": null,
  "thirtyDayTrend": {
    "avgDelta": null,
    "deltaDirection": "insufficient",
    "meetsPOTSCount": 0,
    "totalTests": 0
  },
  "todayOutlier": null,
  "recommendations": ["Log orthostatic vitals (supine then standing HR) at least 3 times per week for trend analysis."]
}
```

## Verification evidence

`lab_results` rows on 2026-04-07 (from `/api/export`):
```
{test_name: 'Supine pulse rate',   value: 91,  unit: 'bpm'}
{test_name: 'Sitting pulse rate',  value: 101, unit: 'bpm'}
{test_name: 'Standing pulse rate', value: 106, unit: 'bpm', flag: 'high'}
```
Standing 106 vs supine 91 = delta 15 bpm. That is below the POTS threshold of 30, so the correct clinical summary is "orthostatic HR rise but below POTS cutoff", not "insufficient data".

Endpoint reader (`src/lib/ai/vitals-intelligence.ts:122-127`):
```
const { data: deltaHistory } = await sb
  .from('lab_results')
  .select('date, value')
  .eq('test_name', 'Orthostatic HR Delta')  // <-- never matches myAH imports
  .gte('date', thirtyDaysAgo)
  .order('date')
```

Note also: the project memory in `CLAUDE.md` claims "Standing pulse 106 bpm (POTS +58 from resting 48)". The live database does not support that delta. Resting HR of 48 comes from `oura_daily.resting_hr`, but Oura's resting HR is recorded while asleep; it is not the supine baseline you use for POTS classification. The supine baseline from myAH is 91, so the true delta is 15, not 58. Doctor-facing code that relies on that +58 figure should be re-audited separately.

## Recommended action
- INVESTIGATE: confirm whether the schema intends `Orthostatic HR Delta` as a derived value written only by the app's POST flow, and whether the reader should fall back to computing the delta on the fly from paired `Supine pulse rate` and `Standing pulse rate` rows on the same date.
- FIX in `src/lib/ai/vitals-intelligence.ts`:
  1. If no `Orthostatic HR Delta` rows, also query `test_name IN ('Supine pulse rate','Standing pulse rate')` for the same window, pair by date, and synthesize delta rows.
  2. Keep the existing POST-save path so future in-app orthostatic tests continue to write `Orthostatic HR Delta` explicitly.
- FIX separately in `CLAUDE.md` / session-1 memory: the `+58 bpm` claim is wrong; delta is 15. But memory rule already states memory is hints, not truth, so this may not need a code fix.

## Fix notes (IMPL-W2A-8, 2026-04-17)

Live test_name strings in `lab_results` for this pair (verified via `/api/export`):
- `Supine pulse rate` (lowercase p, r)
- `Standing Pulse Rate` (uppercase P, R)
- plus `Sitting pulse rate` which is not used for the POTS delta

The reader in `src/lib/ai/vitals-intelligence.ts` now:
1. Queries `lab_results` for `test_name IN ('Orthostatic HR Delta', 'Supine pulse rate', 'HR (supine)', 'Standing pulse rate', 'Standing Pulse Rate', 'HR (standing)')` in one round-trip.
2. Builds a `directDeltaByDate` map from `Orthostatic HR Delta` rows and a `computedByDate` map from paired supine+standing rows (pairing is case-insensitive to tolerate the mixed casing myAH uses).
3. Unions the two sets: for any given date, a direct delta wins over a computed one. Dates with only supine OR only standing are dropped as partial.
4. The response shape adds `latestOrthostatic.source: 'direct' | 'computed'` and `thirtyDayTrend.directCount` / `thirtyDayTrend.computedCount`.

Regression tests live in `src/lib/__tests__/intelligence/vitals-intelligence.test.ts` (8 new cases covering the pairing helper plus the full intelligence function). Live verification:

```
GET /api/intelligence/vitals (after fix)
{
  "latestOrthostatic": {
    "date": "2026-04-07",
    "supineHR": 91,
    "standingHR": 106,
    "hrDelta": 15,
    "meetsPOTSThreshold": false,
    "classification": "Mild (10-19 bpm)",
    "source": "computed",
    ...
  },
  "thirtyDayTrend": {
    "avgDelta": 15,
    "meetsPOTSCount": 0,
    "totalTests": 1,
    "directCount": 0,
    "computedCount": 1,
    ...
  }
}
```

Before the fix, the same endpoint returned `latestOrthostatic: null` and `totalTests: 0`.

No DB writes, no schema change. Test suite: 301 passing, 2 pre-existing failures (anovulatory-detection and phase-insights) unrelated to this fix.
