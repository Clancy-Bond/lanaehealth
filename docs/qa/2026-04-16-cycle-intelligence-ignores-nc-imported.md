---
date: 2026-04-16
status: UNFIXED (flagged for review)
severity: MEDIUM
areas: [cycle-intelligence]
---

# Bug: cycle-intelligence engine ignores `nc_imported.menstruation` for period detection

## Repro steps
1. `curl http://localhost:3005/api/intelligence/cycle`
2. Observe `cycleDay`, `currentPhase`, and the period prediction.

## Expected
The engine should treat Lanae's most comprehensive period history - `nc_imported` (1,490 days from Natural Cycles) - as authoritative for detecting period starts, and combine it with any newer `cycle_entries` data.

## Actual
- Response: `cycleDay: 51, currentPhase: late_luteal, flags: long_cycle`.
- `nc_imported` contains menstruation strings like `'MENSTRUATION'` and `'SPOTTING'` going back to 2024-01-15, but the engine only looks for `menstruation` in `cycle_entries` (a newer table where all 316 sampled rows have `menstruation: false`).
- Because `cycle_entries` never lights up, the engine infers `lastPeriodStart` from Oura temperature-shift signals alone, producing a speculative `cycleDay: 51` that is flagged as a "long cycle" but is really "we don't actually know when her last period was".

## Root cause
`src/lib/ai/cycle-intelligence.ts:278-302`:

```ts
const [cycleResult, ouraResult, ncResult] = await Promise.all([...])
const cycles = cycleResult.data ?? []
const nc = ncResult.data ?? []  // <-- fetched but never used for menstrualDays

// Find last period start
const menstrualDays = cycles
  .filter(c => c.menstruation)
  .map(c => c.date)
  ...
```

`nc.filter(n => n.menstruation === 'MENSTRUATION')` is never computed. `nc` is only consulted later, as a fallback for *temperature* data (line 336) and nowhere else.

The symmetric case to the Oura/NC temperature fallback pattern applies here too: if `cycle_entries.menstruation` is sparse, fall back to `nc_imported.menstruation`.

## Proposed fix (needs review)

```ts
const menstrualDaysFromCycles = cycles
  .filter(c => c.menstruation)
  .map(c => c.date)

const menstrualDaysFromNc = nc
  .filter(n => n.menstruation === 'MENSTRUATION')  // exclude 'SPOTTING'
  .map(n => n.date)

const menstrualDays = Array.from(new Set([
  ...menstrualDaysFromCycles,
  ...menstrualDaysFromNc,
])).sort().reverse()
```

Open questions for @clancy:
- Should `'SPOTTING'` count as a period-start signal? Clinical convention is usually no - spotting 1-2 days before flow isn't cycle day 1.
- If `cycle_entries.menstruation` is present, should it override `nc_imported` for the same date? (Currently NC is the older system; going forward, `cycle_entries` will be the authoritative source of truth for Lanae's new logs.)

## Verification plan
- After fix, `/api/intelligence/cycle` should return `cycleDay` derived from `nc_imported`'s last MENSTRUATION entry.
- Add a unit test in `src/lib/__tests__/cycle-intelligence.test.ts` with fixture: `cycles=[]`, `nc=[{date:'2026-03-15', menstruation:'MENSTRUATION'}]`, assert `lastPeriodStart === '2026-03-15'`.

## Impact
- The "long cycle" flag is misleading when it fires because of missing data rather than an actual long cycle.
- `/api/log/prefill` uses a separate `calculateCyclePhase` from `src/lib/cycle-calculator.ts` (currently returns `day: 47` vs intelligence endpoint's `51`), which may have a parallel issue - worth auditing at the same time.
