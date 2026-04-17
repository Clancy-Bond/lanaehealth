# Oura - Implementation Notes (Top 3)

Hard rules. oura_daily is READ-ONLY. No migrations modify it. New analysis tables are additive, migration number = highest existing + 1 (currently 012, next is 013). All new tables written through `src/lib/api/<domain>.ts`, never from components. CSS vars only, no em dashes, warm cream/blush/sage palette, 44px touch targets, skeleton loaders, second person voice.

---

## Feature 1: Readiness Contributor Waterfall + Morning Signal

### File targets

Create:
- `src/lib/intelligence/readiness-insights.ts` - pure computation from oura_daily rows: per-contributor deviation vs 30-day baseline, alert thresholds.
- `src/components/home/ReadinessWaterfall.tsx` - horizontal bar chart showing contributors ranked by deviation, green/amber/red driven by `--pain-none` through `--pain-severe`.
- `src/components/home/MorningSignalCard.tsx` - conditional card. Renders only when alert conditions fire. Gentle language.
- `src/lib/api/readiness.ts` - server-side wrapper calling `getOuraData()` and the insights module.

Modify:
- `src/app/page.tsx` (Home) - mount MorningSignalCard (top of morning content) and ReadinessWaterfall (inside today's card).
- `src/lib/context/summary-engine.ts` - add a new summary topic "readiness-trends" that surfaces contributor waterfall context for Claude chat.

### Data model

No schema change to oura_daily. NEW additive table (migration 013):

```sql
CREATE TABLE IF NOT EXISTS readiness_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  readiness_score INT,
  contributors JSONB NOT NULL, /* { resting_hr: { value, baseline, z, direction }, ... } */
  alert_fired BOOLEAN DEFAULT FALSE,
  alert_reasons TEXT[],
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_readiness_signals_date ON readiness_signals(date DESC);
```

Write path: nightly sync job (extended from existing Oura sync pipeline) computes per-day row. Additive only, no backfill of oura_daily.

### Component plan

New components:
- `ReadinessWaterfall` - consumes `ReadinessSignal` shape. Uses Recharts with explicit useRef width. Horizontal bars from 0-100, deviation dots overlaid.
- `MorningSignalCard` - uses Card shell (`--bg-card`, `--radius-md`, `--shadow-sm`). Icon + message + "tell me more" disclosure.

Reused:
- `Card`, `Badge`, `LoadingSpinner` from `src/components/ui/`
- Severity color tokens (`--pain-none` green through `--pain-severe` red)
- `useRef`-based sizing pattern from existing Recharts usage

### Acceptance criteria

1. Morning visit to Home shows today's readiness score and contributor waterfall if oura_daily has today's row.
2. MorningSignalCard renders ONLY when: readiness dropped > 10 vs 7-day avg, OR temp deviation > +0.4C, OR HRV avg dropped > 20%.
3. Each contributor bar shows: name, value, delta from 30-day baseline, direction arrow.
4. Waterfall is readable on 375px mobile viewport (44px touch targets).
5. Skeleton renders if oura_daily query > 200ms.
6. If oura_daily is empty for today, shows graceful empty state ("Your ring hasn't synced today yet") not error.

### Verification plan

1. Run migration 013 via `scripts/run-migration.mjs`.
2. Unit test `readiness-insights.ts` in vitest: mock 30 oura_daily rows, assert contributor deltas, assert alert thresholds.
3. Query real oura_daily row for 2026-04-13 and render locally on port 3005.
4. Spot-check two low-readiness days (search oura_daily for readiness_score < 60) and verify alert fires, contributor waterfall shows the right dominant driver.
5. Screenshot Home at 375px width, attach to this file.

### Risks

- oura_daily's raw_json format may vary. Insights module must guard against missing keys.
- Over-alerting causes fatigue. Add a cooldown: no alert 2 days in a row (show a gentler "Take it easy" instead).
- Contributors weight differs from Oura's internal formula. Document clearly that our contributor analysis is based on deviation from her baseline, not Oura's weights.

---

## Feature 2: Temperature Trend with Cycle Overlay + Illness Flag

### File targets

Create:
- `src/lib/intelligence/temp-trend.ts` - computes rolling temp deviation, cycle-phase-aware baseline, illness detection.
- `src/components/patterns/TempTrendChart.tsx` - line chart with shaded cycle phase bands and illness markers.
- `src/components/home/IllnessAlertCard.tsx` - conditional card if 2+ consecutive days temp > +0.5C deviation.

Modify:
- `src/app/patterns/page.tsx` - add TempTrendChart as a new section near CycleOverview.
- `src/app/page.tsx` - wire IllnessAlertCard.
- `src/lib/api/oura.ts` - add `getTempTrend(startDate, endDate)` reader.
- `src/lib/context/summary-engine.ts` - add "temperature-trends" topic.

### Data model

No schema change to oura_daily. NEW additive table (migration 014):

```sql
CREATE TABLE IF NOT EXISTS temp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  event_type TEXT NOT NULL, /* 'illness_suspected', 'luteal_persistent', 'ovulation_detected' */
  deviation_c NUMERIC(4,2) NOT NULL,
  cycle_phase TEXT,
  consecutive_days INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, event_type)
);
CREATE INDEX idx_temp_events_date ON temp_events(date DESC);
```

Write path: nightly, computes from oura_daily + nc_imported joined on date.

### Component plan

New components:
- `TempTrendChart` - Recharts LineChart + ReferenceArea for cycle phases. Phase colors from `--phase-menstrual`, `--phase-follicular`, `--phase-ovulatory`, `--phase-luteal`. Illness markers as red dots.
- `IllnessAlertCard` - warm non-alarming message, "Your temperature has been elevated the last 2 days. Could be a bug. Keep an eye on symptoms."

Reused:
- AGPChart pattern (percentile bands, explicit useRef width)
- CycleOverview visual grammar
- Existing cycle phase color tokens

### Acceptance criteria

1. Patterns page shows 60-day temp trend with cycle phases shaded.
2. Days where body_temp_deviation > +0.5C for 2+ consecutive days marked as illness dots.
3. Luteal-phase persistent elevation (temp still high 3+ days past period start) flagged as luteal_persistent event.
4. If event active today, Home renders IllnessAlertCard.
5. Tapping a marker shows tooltip with date, deviation, phase, and contextual note.
6. Works with real 1,187 days of data.

### Verification plan

1. Run migration 014.
2. Backfill temp_events by running `src/lib/intelligence/temp-trend.ts` script over Lanae's full oura_daily history.
3. Manual spot check: April 2026 has several +0.4C days, verify correct event classification.
4. Test empty path: date range with no oura_daily rows should empty-state not crash.
5. Screenshot of Patterns page attached.

### Risks

- Cycle phase from nc_imported may not cover her full oura_daily range. Default gracefully to "unknown" phase.
- False positive illness flags around known cycle events. Suppress illness flag during 5 days pre-period.
- 60-day window may miss chronic elevations. Add a "show 180d" toggle.

---

## Feature 3: Adaptive Movement Suggestion

### File targets

Create:
- `src/lib/intelligence/movement-suggestion.ts` - pure function. Input: today's readiness_score, recent 7-day avg, any active symptoms. Output: { category, label, rationale }.
- `src/components/home/MovementSuggestionCard.tsx` - soft card, no progress ring, no completion %, no streak.

Modify:
- `src/app/page.tsx` - replace any existing static activity goal with MovementSuggestionCard.

No new table. No DB writes. Pure derivation from oura_daily.

### Data model

Uses oura_daily.readiness_score (read-only). No migration. No additive table. Optionally reads daily_logs.fatigue / pain on today's date for context.

### Component plan

New components:
- `MovementSuggestionCard` - card with icon, label, one-line rationale, optional "tell me more" disclosure.

Categories (from readiness_score):
- < 55: "Rest day" / "Your body is asking for recovery. Gentle stretching, rest, hydration."
- 55-69: "Gentle day" / "Low-impact movement for 20 min if you feel up to it."
- 70-84: "Moderate day" / "You have capacity for a regular walk or yoga."
- >= 85: "Full capacity" / "Your body is ready for whatever feels good."

No goal met / not met language. No numbers.

Reused:
- Card primitive
- Sage accent (`--accent-sage`) for all categories (no red/amber/green, those imply pass/fail)

### Acceptance criteria

1. Home page shows MovementSuggestionCard with today's category.
2. Copy uses second person, warm voice, no em dashes.
3. No completion %, no ring, no streak counter, no "goal met" language.
4. Rationale expanded on tap shows the readiness score and deviation from her typical.
5. If oura_daily missing for today, falls back to yesterday's suggestion with "yesterday" label.

### Verification plan

1. Pull 10 sample days across the readiness distribution from her data, manually verify category output.
2. Unit test `movement-suggestion.ts` with 5 boundary cases (54, 55, 69, 70, 100).
3. Visual QA at port 3005, Home page.
4. Read aloud the 4 rationale strings, check for em dashes, shaming language, streak references.

### Risks

- Lanae may WANT goal-based motivation sometimes. Settings toggle can be added later, do not build it now. Ship the anti-shame default first.
- If readiness_score is null (partial ring wear), fall back to "We're missing today's readiness signal, go by how you feel."
- Over-use of "gentle" language can feel patronizing. Review copy with Lanae post-ship.
