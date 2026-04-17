---
date: 2026-04-16
agent: R1
area: computed-values
status: FAIL
severity: HIGH
verification_method: sql-vs-api
---

# `/api/oura/sleep-stages` queries non-existent columns

## One-sentence finding
The sleep-stages endpoint selects column names (`sleep_total`, `sleep_deep`, `sleep_rem`, `sleep_light`, `sleep_awake`, `sleep_bedtime`, `sleep_wake`) that do not exist on `oura_daily`, so every call returns an empty hypnogram even when 180 days of real sleep data is sitting in the row.

## Expected
For a date with Oura data, the endpoint returns a populated `stages[]` array, a non-zero `totalMinutes`, and a bedtime/waketime pair that the Hypnogram component can render.

## Actual
```
$ curl -s http://localhost:3005/api/oura/sleep-stages?date=2026-04-15
{"stages":[],"totalMinutes":0,"bedtime":null,"wakeTime":null,"message":"No sleep data for this night"}
```
This happens silently because the Supabase client does not throw on unknown column names in `.select(...)`; it simply returns `null` for each missing field, so `sleep_total ?? 0` collapses to 0 and the early return fires.

## Verification evidence

Actual columns on `oura_daily` (from the 2026-04-15 row in `/api/export`):
```
[
  'body_temp_deviation', 'date', 'deep_sleep_min', 'hrv_avg', 'hrv_max',
  'id', 'raw_json', 'readiness_score', 'rem_sleep_min', 'respiratory_rate',
  'resting_hr', 'sleep_duration', 'sleep_score', 'spo2_avg', 'stress_score', 'synced_at'
]
```
Row for 2026-04-15 contains `sleep_duration: 26070` seconds (7h14m), `deep_sleep_min: 99`, `rem_sleep_min: 79`.

Endpoint query (`src/app/api/oura/sleep-stages/route.ts:28-32`):
```
.from('oura_daily')
.select('date, sleep_total, sleep_deep, sleep_rem, sleep_light, sleep_awake, sleep_bedtime, sleep_wake')
.eq('date', targetDate)
```
None of these columns exist. `sleep_total` should be `sleep_duration` (and is in seconds, not minutes - another bug). `sleep_deep` should be `deep_sleep_min`. `sleep_rem` should be `rem_sleep_min`. There is no `sleep_light` or `sleep_awake` column at all; those are only inside `raw_json.sleep_detail` (under keys `light_sleep_duration`, `awake_time` in seconds).

## Recommended action
- FIX `src/app/api/oura/sleep-stages/route.ts`:
  1. Replace the `.select(...)` with real column names: `date, sleep_duration, deep_sleep_min, rem_sleep_min, raw_json, synced_at`.
  2. Convert `sleep_duration` from seconds to minutes before using it as `total`.
  3. Pull `light_sleep_duration`, `awake_time`, `bedtime_start`, `bedtime_end` from `raw_json.sleep_detail` (values are seconds, convert to minutes).
  4. Keep the existing hypnogram reconstruction logic unchanged once the inputs are correct.
- TEST: add a fixture-based test that calls the endpoint against a known `oura_daily` row and asserts totalMinutes matches `sleep_duration / 60`.
- ACCEPT is not appropriate; this route has been shipping but never rendering real data.
