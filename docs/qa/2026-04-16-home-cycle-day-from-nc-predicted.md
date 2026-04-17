---
date: 2026-04-16
agent: R1
area: computed-values
status: FIXED
severity: HIGH
verification_method: sql-vs-api
fixed_by: IMPL-W2B-1 (2026-04-17)
---

# Home page cycle day trusts Natural Cycles' predicted period starts

## FIX (IMPL-W2B-1, 2026-04-17)

`src/app/page.tsx` no longer reads `ncImported.cycle_day`. It now calls
`getCurrentCycleDay(today)` from the new shared helper
`src/lib/cycle/current-day.ts`, which unions `cycle_entries.menstruation`
+ `nc_imported.menstruation === 'MENSTRUATION'` (SPOTTING excluded) and
back-walks to the real start-of-period. The 60-day stale-data hack is
removed: if no real menstruation is found in the last 90 days, the UI
shows "Cycle unknown" rather than a misleading number.

Verified on live DB (2026-04-17): home now renders **CD 51 Luteal** and
matches both `/api/log/prefill` (day 51) and `/api/intelligence/cycle`
(cycleDay 51). Prior value was **CD 27**, derived from NC's predicted
rebase at 2026-03-22.

Regression covered by vitest `src/lib/__tests__/cycle/current-day.test.ts`.
See also: `docs/qa/2026-04-16-cycle-day-three-values.md` (parent finding).

## One-sentence finding
The home page's HealthRing displays `CD 27` because `ncImported.cycle_day` is a Natural Cycles counter rebased at its predicted period start of 2026-03-22 that never actually happened; Lanae's last real period started 2026-02-26, making her true CD on 2026-04-16 = 50.

## Expected
Home page displays a cycle day that reflects days since the most recent *actual* menstruation. Source of truth should be `cycle_entries.menstruation = true` (user-confirmed) or `nc_imported.menstruation = 'MENSTRUATION'` (NC-confirmed), not NC's forward prediction.

## Actual
`src/app/page.tsx:268`:
```
let cycleDay: number | null = ncImported?.cycle_day ?? null;
```
`nc_imported` rows beyond the last real period carry NC's predicted-cycle rebasing:
```
2026-02-26 CD=1 MENSTRUATION     <- last real period start
2026-03-01 CD=4 MENSTRUATION
2026-03-21 CD=24 (no mens)
2026-03-22 CD=1 (NC predicted period, mens=null)  <- NC rebased here
2026-04-17 CD=27 (continued from predicted)
```
Because no actual period occurred on 2026-03-22, the real CD continues climbing from 2026-02-26; it should be 50 on 2026-04-16 and 51 on 2026-04-17, not 27.

## Verification evidence

nc_imported CD=1 entries since 2026-01-01:
```
[ '2026-01-04', 'MENSTRUATION' ],    // real
[ '2026-01-30', 'MENSTRUATION' ],    // real
[ '2026-02-26', 'MENSTRUATION' ],    // real (last)
[ '2026-03-22', null ],              // predicted, not a real period
[ '2026-04-18', null ],              // predicted
[ '2026-05-15', null ],              // predicted
...continues into Sep 2026
```

cycle_entries with `menstruation = true` after 2026-02-26:
```
(none)
```

So the true CD on 2026-04-16 counting from Feb 26 = 49 days + 1 = 50.

## Recommended action
- FIX `src/app/page.tsx:264-279`:
  1. Compute cycle day from a shared helper that inspects real menstruation rows, not the NC predicted counter.
  2. Or keep `ncImported.cycle_day` as a fallback only when `ncImported.menstruation IS NOT NULL` across the current cycle span - i.e. trust NC only where NC has observed blood.
- INVESTIGATE: is the "stale after 60 days" branch intended to catch exactly this case? Right now that branch only fires when `ncImported.date` is more than 60 days old, which is never true if NC continues importing predicted rows.
- RELATED: this is one of three divergent cycle-day implementations. See `docs/qa/2026-04-16-cycle-day-three-values.md`.
