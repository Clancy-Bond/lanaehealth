# Flaredown - Implementation Notes (Top 3)

---

## Feature 1: Retrospective Trigger Surface

### File targets
- **New component**: `src/components/log/FlareTriggerSurface.tsx` - the retrospective panel
- **New API**: `src/app/api/flare-retrospective/route.ts` - GET handler returning 72h window factors for a given date
- **New data access**: `src/lib/api/flare-retrospective.ts` - server-side query composition across food_entries, oura_daily, cycle_entries, daily_logs, medications
- **Modify**: `src/components/log/FlareToggle.tsx` - when toggled ON, mount FlareTriggerSurface beneath the toggle
- **Modify**: `src/app/log/page.tsx` - wire the new panel
- **Optional**: `src/lib/intelligence/flare-analysis.ts` - formatting/sorting of retrospective factors with data-reliability weighting (uses existing `DATA_RELIABILITY` map from `src/lib/intelligence/types.ts`)

### Data model
- **No new tables required** for v1.
- Read-only queries against existing tables: `daily_logs`, `food_entries`, `oura_daily`, `cycle_entries`, `nc_imported`, `medications` (if exists), `correlation_results` (cross-reference established patterns).
- Optional future table `flare_trigger_snapshots` (migration 013) to cache retrospective lookups for 1,490 daily_logs rows; skip for v1.

### Component plan
- **New**: `FlareTriggerSurface.tsx`
  - Props: `{ logDate: string }`
  - Fetches 72h preceding window via `/api/flare-retrospective`
  - Renders a vertical timeline grouped by day (T-0, T-1, T-2, T-3)
  - Each factor category = card: Food (inflammatory? FODMAP? histamine?), Sleep (<6h flag, low HRV flag), Cycle phase, Weather (if Feature 3 shipped), Missed meds, New meds
  - Footer: "Noticed in the 3 days before. Not necessarily the cause."
  - If correlation_results has a matching established pattern, link inline: "This pattern has come up before: Food X has r=0.48 with pain at 2-day lag."
- **Reused**: CollapsibleSection, existing card chrome, pain/severity color tokens

### Acceptance criteria
1. Toggling FlareToggle ON triggers a fetch of retrospective data.
2. Panel renders within 500ms on cached data, <2s on cold.
3. Shows factors only if data exists (no fake placeholders).
4. Non-causal language throughout ("noticed", "observed", never "caused").
5. Links to matching correlation_results rows if any exist.
6. Passes `npm run build` + `npm test`.

### Verification plan
1. Pick a day from Lanae's history where she's had a bad pain day (e.g., Feb 14 2026 based on symptoms table).
2. Manually toggle FlareToggle on for that date in dev.
3. Verify retrospective panel surfaces: food_entries from 72h prior, Oura sleep/HRV, cycle phase, any flagged triggers.
4. Confirm correlation_results cross-references appear when patterns match (table has 8 rows).
5. Screenshot at port 3005 /log?date=2026-02-14.

### Risks
- 72h lookups across 5+ tables could be slow. Mitigate with parallel Promise.all and per-table indexes (most exist).
- False-attribution risk if user misreads causation. Mitigate with explicit non-causal copy.
- If Lanae's historical data is sparse for a given date, empty states must be graceful.

---

## Feature 2: Time-Lagged Correlation Extension

### File targets
- **Verify first**: `src/lib/intelligence/` + search for current correlation engine location (may be in `src/lib/api/` or a separate `src/lib/correlations/`). Grep for `correlation_results` writes to find the engine.
- **Modify/Create**: `src/lib/intelligence/lagged-correlations.ts` - new module, iterates lags [0, 1, 2, 3, 7] per pair, calls existing Spearman/Mann-Whitney routines, writes separate rows per lag.
- **Modify**: the cron or trigger that runs correlation analysis (likely `src/app/api/correlations/run/route.ts` or similar) to call the new multi-lag path.
- **Modify**: `src/components/patterns/CorrelationCards.tsx` - surface lag in the display ("2-day lag" badge on each card).
- **Modify**: `src/lib/api/correlations.ts` or equivalent - query by lag_days to avoid showing duplicates when only lag_days differs.

### Data model
- **Existing table `correlation_results` is sufficient.** Schema already has `lag_days INTEGER DEFAULT 0`. No migration needed.
- FDR correction must re-run across the full expanded test set (5x more tests when adding lags 1, 2, 3, 7). Existing `passed_fdr BOOLEAN` column supports this.

### Component plan
- **Modify CorrelationCards.tsx**:
  - When a row has `lag_days > 0`, show a badge: "2-day lag" (sage color)
  - Tooltip: "This pattern appears 2 days after the factor, not the same day."
  - Sort: same-day first (lag=0), then lag=1, lag=2, lag=3, lag=7.
- **New unit tests**: Verify `lagged-correlations.ts` writes 5 rows for a single (factor_a, factor_b) pair across the 5 lag values, and that FDR adjusts accordingly.

### Acceptance criteria
1. Correlation engine computes Spearman at lags [0, 1, 2, 3, 7] for all factor pairs.
2. Each (factor_a, factor_b, lag_days) produces a separate row in correlation_results.
3. FDR correction applied across the expanded test set.
4. CorrelationCards shows lag badges when `lag_days > 0`.
5. Existing 8 rows remain (additive, not destructive).
6. Existing tests still pass; new tests added for lag iteration.

### Verification plan
1. Count correlation_results rows before run: should be 8.
2. Run the correlation cron/endpoint.
3. Expected: more rows, each with distinct `lag_days` values. Spot-check a known pair (e.g., sleep_quality vs. pain).
4. Open Patterns page, verify lag badges render correctly.
5. Screenshot at port 3005 /patterns.

### Risks
- Test count explodes (5x), FDR becomes harsher, some same-day correlations may lose significance. This is correct statistical behavior but may surprise the user. Add copy: "Stricter testing means fewer patterns show, but those that do are more trustworthy."
- Sparse data at long lags (7 days) may produce unstable correlations. Consider minimum sample size threshold (e.g., n >= 20 at each lag).
- If the engine currently lives somewhere we haven't found, plan may need rescoping after grep.

---

## Feature 3: Barometric Pressure + Weather Auto-Enrichment

### File targets
- **New migration**: `src/lib/migrations/013-weather-daily.sql`
- **New data access**: `src/lib/api/weather.ts` - upsert daily weather rows
- **New ingestion**: `src/lib/ingestion/weather-fetch.ts` - calls Open-Meteo API, normalizes response
- **New cron/endpoint**: `src/app/api/weather/sync/route.ts` - POST handler to run daily (Vercel cron config)
- **Modify**: `src/components/patterns/TrendChart.tsx` - optional weather overlay layer (pressure line on secondary y-axis)
- **Modify**: correlation engine (see Feature 2) - add `pressure_inHg` and `humidity_pct` as factor_a candidates
- **Config**: `vercel.json` or cron config - schedule daily at 06:00 HST (16:00 UTC)

### Data model - NEW TABLE
Migration number: **013-weather-daily.sql** (011 and 012 are used)

```sql
CREATE TABLE IF NOT EXISTS weather_daily (
  date DATE PRIMARY KEY,
  zip_code VARCHAR(10),
  latitude REAL,
  longitude REAL,
  temp_high_f REAL,
  temp_low_f REAL,
  pressure_inhg REAL,
  pressure_delta_24h REAL,
  humidity_pct REAL,
  precipitation_in REAL,
  weather_condition VARCHAR(50),
  source VARCHAR(30) DEFAULT 'open-meteo',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_daily_date ON weather_daily (date DESC);
```

- Additive migration, up-only.
- Primary key on date prevents duplicates. Upsert on conflict.
- Default location: Kailua HI (lat 21.3928, lon -157.7394) for Lanae.

### Component plan
- **New `src/lib/ingestion/weather-fetch.ts`**:
  - Calls `https://api.open-meteo.com/v1/forecast?latitude=21.3928&longitude=-157.7394&daily=temperature_2m_max,temperature_2m_min,surface_pressure_mean,relative_humidity_2m_mean,precipitation_sum&temperature_unit=fahrenheit&timezone=Pacific%2FHonolulu`
  - No API key required.
  - Convert pressure hPa to inHg (divide by 33.8639).
  - Compute pressure_delta_24h client-side after write by comparing to previous day's row.
- **Modify TrendChart.tsx**:
  - Add optional `showWeather` boolean prop.
  - Render pressure as a thin secondary-axis line, muted color.
  - Use existing `useRef` width pattern (NOT ResponsiveContainer).
- **Modify correlation engine (Feature 2 overlap)**:
  - `pressure_inhg`, `pressure_delta_24h`, `humidity_pct` become factor_a candidates.
  - Run against pain, fatigue, POTS-event flags.

### Acceptance criteria
1. Migration 013 applies cleanly. Table created.
2. Cron endpoint fetches and upserts one row per day.
3. Backfill script retrieves last 90 days of historical weather (Open-Meteo supports `archive-api` for past data).
4. Weather overlay renders on TrendChart when enabled.
5. Correlation engine computes pressure-vs-symptom pairs. New rows appear in correlation_results.
6. Lanae-specific: at least one pressure-related correlation becomes visible within 30 days of data.

### Verification plan
1. Run migration against Supabase dev instance.
2. Trigger `/api/weather/sync` endpoint manually, verify 1 row inserted for today.
3. Run backfill, verify 90 rows inserted covering Jan-Apr 2026.
4. Open Patterns page with showWeather enabled, verify overlay.
5. Check correlation_results for any pressure_inhg rows. With POTS, expect inverse correlation (low pressure -> worse dizziness/fatigue).
6. Screenshot at port 3005 /patterns.

### Risks
- Open-Meteo rate limit: 10,000 calls/day free. Way under with 1 call/day. Safe.
- Hawaii pressure variance is lower than continental US (tropical stable climate). Correlation signal may be weaker. Still worth tracking, POTS is pressure-sensitive even at small deltas.
- Zip-to-coord hardcoded for Lanae. If app goes multi-tenant later, needs per-user location. Document this.
- Time zone handling: Hawaii = HST (UTC-10, no DST). Store dates in local HST to align with daily_logs dates.
- New migration must be explicitly user-approved per design-decisions.md rule 6.1, before applying to production Supabase.

---

## Cross-cutting notes

- All 3 features obey the "observation only, not causation" rule.
- None modify existing rows in existing tables. Only Feature 3 adds a new table.
- Feature 1 and Feature 2 are pure additive logic + UI, no schema change.
- Feature 3's new table (`weather_daily`) is the only migration requiring explicit user sign-off before `npm run migration` on prod Supabase.
- All 3 reference existing reliability weights from `src/lib/intelligence/types.ts` (`DATA_RELIABILITY` map). Weather source should be registered there with weight ~0.9 (highly reliable meteorological data).
