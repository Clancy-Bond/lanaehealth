---
date: 2026-04-17
area: weather
status: FLAGGED -- blocked on SQL editor access
severity: MEDIUM
verification_method: api-smoke-test
fire_source: production smoke test
---

# `/api/weather/sync` returns 500 in production

## One-sentence finding
The route writes to `weather_daily` columns (`humidity_mean`, `temp_high_c`, `pressure_mean_hpa`, etc.) added by migration `015_weather_daily.sql`, which has never been applied to live Supabase.

## Repro
```bash
curl https://lanaehealth.vercel.app/api/weather/sync
# -> 500
# -> {"error":"weather_daily upsert failed: Could not find the 'humidity_mean' column of 'weather_daily' in the schema cache"}
```

## Discovery
Found by the Session 2 CI smoke test (`src/__tests__/api-smoke.test.ts`) run against production after the 46-commit PR #1 merged. The route was added by the parallel design session in Wave 2a and presumes migration 015 is applied.

## Unapplied migrations inventory (2026-04-17)
While investigating, pulled a list of migrations added by the parallel session that are probably also unapplied. Each is safe to batch-apply together: all use `IF NOT EXISTS`, zero `DROP`, additive columns only.

| File | Adds |
|---|---|
| 014_headache_attacks.sql | `headache_attacks` table + indexes |
| 015_weather_daily.sql | 11 columns on `weather_daily` + 2 indexes |
| 016_cycle_engine_state.sql | `cycle_engine_state` table + indexes |
| 017_user_nutrient_targets.sql | `user_nutrient_targets` table + RDA seed |
| 020_daily_logs_energy_mode_rest_day.sql | 2 columns on `daily_logs` |
| 021_micro_care_completions.sql | `micro_care_completions` table + indexes |

Concatenated SQL blob saved at `/tmp/apply-014-021.sql` during this session (285 lines, non-destructive).

## Fix path
Paste `/tmp/apply-014-021.sql` into the Supabase Dashboard SQL editor and click Run. Zero data loss since all statements are `IF NOT EXISTS` guarded.

Attempted via Chrome automation this session but the new Chrome tab group lost its Supabase auth cookie and could not render the editor. Original Chrome session DID work earlier (migrations 011, 012, W2.3, W3.8, W3.9, pgvector 1536->1024 all applied via Monaco eval). Recovery path: open the editor manually OR reconnect the Claude Chrome extension to the originally-authed browser window.

## Related code already in repo
- `src/app/api/weather/sync/route.ts`
- `src/lib/api/weather-daily.ts` (upsertWeatherRecords -- writes the missing columns)
- `src/lib/weather.ts` (fetches from Open-Meteo)

These files are correct and expect migration 015 to be applied. No code change needed; just the DDL.
