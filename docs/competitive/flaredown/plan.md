# Flaredown - Implementation Plan

Features ranked by `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 flagged for implementation.

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort | Depends on | Notes |
|------|---------|---------------|--------------------|--------|-----------|-------|
| 1 | **Retrospective Trigger Surface ("What happened in the 72h before this flare?")** | Pattern 1 | 5 | M | FlareToggle (exists), food_entries, oura_daily, cycle_entries, daily_logs | FLAG FOR IMPL. Activates on FlareToggle toggle-on. Pulls factors from last 72h and shows timeline cards. Observation only, no causation claims. |
| 2 | **Time-Lagged Correlation Extension (lag 0, 1, 2, 3, 7 days)** | Pattern 4 | 5 | M | correlation_results.lag_days column (exists) | FLAG FOR IMPL. Extend existing correlation engine in src/lib/intelligence/ to compute correlations at multiple lags, write separate rows per lag. FDR-correct across the expanded test set. |
| 3 | **Barometric Pressure + Weather Auto-Enrichment** | Pattern 2 | 5 | M | New `weather_daily` table, Open-Meteo API, Kailua HI zip code | FLAG FOR IMPL. Critical for POTS (pressure + blood pooling) and endo pain. Add cron job to pull daily weather, feed into correlation engine. |
| 4 | Treatment Effectiveness Scoring | Pattern 5 | 4 | L | Medication adherence data, PRN log flow, notification system | Nice to have. Requires T0 + T+90 pain ratings. Defer to separate plan. |
| 5 | Pre-Defined Trigger Library (100+ items, condition-filtered) | Pattern 3 | 4 | M | CustomFactorsCard.tsx, new `trigger_library` seed table | Nice to have. Endo mode partially covers this. Can ship as seed-only constants first, normalize later. |
| 6 | Multi-Condition Timeline Overlay | Pattern 6 | 4 | L | Timeline page, existing TrendChart component | Nice to have. Timeline page exists, needs condition-layer toggle. Defer. |
| 7 | Quick-Log Pattern (90-second daily) | Pattern 8 | 3 | S | DailyLogClient.tsx | Already present in our app. No new work. |
| 8 | Research Opt-In Pipeline | Pattern 7 | 2 | XL | Multi-tenant infra, IRB review, data export | Skip for v1. Single-patient app. |

---

## Top 3 Summary (for implementation-notes.md)

### Feature 1: Retrospective Trigger Surface
When Lanae flags a flare, show her the factors from the 72 hours leading up to it. Timeline of food (flagged FODMAP/histamine), sleep (short nights, low HRV), cycle phase (luteal? menstrual?), stress markers, weather changes, new or missed meds. Observational, non-causal language. Links out to established patterns from correlation_results if any match.

### Feature 2: Time-Lagged Correlation Extension
Our correlation_results table has a `lag_days INTEGER DEFAULT 0` column that's underutilized. Extend the correlation engine (likely in `src/lib/intelligence/` or elsewhere) to iterate across lags 0, 1, 2, 3, 7 and write separate rows per lag. FDR-correct across the expanded test set. Surface the strongest lagged pairs ("Alcohol 2 days ago predicts pain today, r=0.52") in CorrelationCards.tsx.

### Feature 3: Barometric Pressure + Weather Auto-Enrichment
Add `weather_daily` table (new migration 013). Cron pull from Open-Meteo API (free, no auth key) daily for Kailua HI (lat 21.3928, lon -157.7394). Store pressure (inHg), humidity, temp, precipitation. Feed as factor_a candidate into the correlation engine. Overlay on TrendChart on Patterns page. Especially valuable for POTS (barometric pressure drops correlate with blood pooling / orthostatic symptoms).

---

## Ranking formula check

- #1: impact 5, effort M(2) -> (5*2)/2 = 5.0
- #2: impact 5, effort M(2) -> (5*2)/2 = 5.0
- #3: impact 5, effort M(2) -> (5*2)/2 = 5.0
- #4: impact 4, effort L(4) -> (4*2)/4 = 2.0
- #5: impact 4, effort M(2) -> (4*2)/2 = 4.0
- #6: impact 4, effort L(4) -> (4*2)/4 = 2.0

Top 3 tied at 5.0. Ordering by strategic fit (flare surface most visible to user, then quiet improvements to correlation engine, then new data ingestion).

## New tables needed

1. `weather_daily` (Feature 3) - 1 new table
2. `flare_trigger_snapshots` (Feature 1, optional, for caching retrospective lookups) - could skip and just query live

Total new tables: 1-2. Well under the 10-table cap.
