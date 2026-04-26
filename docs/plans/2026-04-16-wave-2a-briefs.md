# Wave 2a Subagent Briefs (pre-drafted)

**Status:** Ready to paste-dispatch when Wave 1B is cleaned up.

**Wave 2a scope:** 5 foundation subagents, running in parallel on branch `feat/competitive-wave-2a`.

Tier A features that block dependent Tier B work:
- A1: headache_attacks table + one-tap during-attack logging
- A3: weather_daily + Open-Meteo cron
- B1: multi-signal cycle intelligence engine (Natural Cycles inspired, BBT + HRV + RHR fusion)
- C1: micronutrient expansion (4 to 25 nutrients) + user_nutrient_targets table
- E1+E2: daily_logs ALTER adding energy_mode + rest_day columns (Finch features)

---

## Dispatch checklist (main session, pre-dispatch)

- [ ] Confirm Wave 1 merged to main (or rebased cleanly on top of other session's work)
- [ ] Create branch: `git checkout -b feat/competitive-wave-2a`
- [ ] Update matrix.md migration numbers 014-017 + 020 (if any have shifted)
- [ ] Confirm no collisions with in-flight work from other sessions
- [ ] Dispatch 5 subagents via Agent tool calls in a single parallel message

---

## Subagent Brief A1 - headache_attacks + one-tap logging

```
MISSION: Implement headache attack logging. Ship new table (migration
014), data-access layer, one-tap logging UI on /log, and head-zone body
map extension.

REPO: /Users/clancybond/lanaehealth, branch feat/competitive-wave-2a

READ FIRST:
1. /Users/clancybond/lanaehealth/docs/competitive/design-decisions.md
2. /Users/clancybond/lanaehealth/docs/competitive/headache-diary/implementation-notes.md
3. /Users/clancybond/lanaehealth/src/components/log/AnatomicalBodyMap.tsx
4. /Users/clancybond/lanaehealth/src/components/log/BodyPainMap.tsx
5. /Users/clancybond/lanaehealth/src/lib/clinical-scales.ts (HIT-6 + MIDAS
   from Wave 1C exist here; reference but do not modify)

YOUR FILE OWNERSHIP:
- CREATE migration src/lib/migrations/014_headache_attacks.sql
- CREATE migration runner src/lib/migrations/run-014-headache-attacks.mjs
- CREATE data access src/lib/api/headache.ts
- CREATE one-tap UI src/components/log/HeadacheQuickLog.tsx
- CREATE head zones component src/components/log/HeadZoneMap.tsx
- CREATE test src/lib/__tests__/headache.test.ts
- MODIFY src/app/log/page.tsx to mount HeadacheQuickLog (localized add)

DATA MODEL (migration 014):
CREATE TABLE IF NOT EXISTS headache_attacks (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null default 'lanae',
  started_at timestamptz not null,
  ended_at timestamptz,
  severity int check (severity >= 0 and severity <= 10),
  head_zones jsonb default '[]',   -- array of zone enums
  aura_categories jsonb default '[]',  -- visual/sensory/speech/motor
  triggers jsonb default '[]',
  medications_taken jsonb default '[]',
  medication_relief_minutes int,
  notes text,
  cycle_phase text,  -- denormalized at write time
  hit6_score int,    -- optional; reference clinical-scales.ts
  midas_grade text,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_headache_attacks_started ON headache_attacks(started_at);
CREATE INDEX IF NOT EXISTS idx_headache_attacks_cycle_phase ON headache_attacks(cycle_phase);

HEAD ZONES: frontal-l, frontal-r, frontal-c, temporal-l, temporal-r,
orbital-l, orbital-r, occipital, vertex, c-spine

AURA CATEGORIES (per ICHD-3): visual, sensory, speech, motor. Motor
aura triggers a hemiplegic-migraine advisory (not diagnostic).

VERIFY:
1. npm run build passes
2. npm test passes
3. Run migration: node src/lib/migrations/run-014-headache-attacks.mjs
4. Dev server: /log page shows the HeadacheQuickLog component

COMMIT (single commit):
feat(headache): attack logging with head zones and aura categories

Adds headache_attacks table, data access layer, one-tap logging on /log,
and head-zone body map extension. Supports ICHD-3 aura categories with
hemiplegic-migraine advisory on motor aura. Cycle phase denormalized
for fast menstrual-migraine correlation in Wave 2b.

Migration 014. Ref: docs/competitive/headache-diary/implementation-notes.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

RETURN (under 250 words):
- Files created / modified
- Tests added
- Migration status (applied / pending)
- Dev server screenshot path
- Commit SHA
```

---

## Subagent Brief A3 - weather_daily + Open-Meteo cron

```
MISSION: Ship daily weather enrichment. New table (migration 015),
cron-driven pull from Open-Meteo (free, no auth) for Kailua HI.
Enables barometric-pressure correlation with POTS symptoms.

REPO: /Users/clancybond/lanaehealth, branch feat/competitive-wave-2a

READ FIRST:
1. /Users/clancybond/lanaehealth/docs/competitive/design-decisions.md
2. /Users/clancybond/lanaehealth/docs/competitive/flaredown/implementation-notes.md
3. /Users/clancybond/lanaehealth/src/lib/weather.ts (existing file, extend)
4. /Users/clancybond/lanaehealth/src/app/api/weather/ (existing route)

YOUR FILE OWNERSHIP:
- CREATE migration 015_weather_daily.sql
- CREATE runner run-015-weather-daily.mjs
- MODIFY src/lib/weather.ts (extend with Open-Meteo client)
- CREATE src/lib/api/weather-daily.ts (DB access)
- CREATE src/app/api/weather/sync/route.ts (cron target)
- CREATE test src/lib/__tests__/weather-daily.test.ts

DATA MODEL (migration 015):
CREATE TABLE IF NOT EXISTS weather_daily (
  date date primary key,
  patient_id text not null default 'lanae',
  location_lat numeric not null default 21.392,  -- Kailua HI
  location_lon numeric not null default -157.739,
  temp_high_c numeric,
  temp_low_c numeric,
  humidity_mean numeric,
  pressure_mean_hpa numeric,
  pressure_change_24h numeric,
  wind_mean_kmh numeric,
  precipitation_mm numeric,
  raw_json jsonb,
  synced_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_weather_pressure ON weather_daily(pressure_mean_hpa);

OPEN-METEO:
- Endpoint: https://api.open-meteo.com/v1/forecast
- Params: latitude=21.392&longitude=-157.739&daily=temperature_2m_max,temperature_2m_min,pressure_msl_max,pressure_msl_min,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum&timezone=Pacific/Honolulu&past_days=14
- Free tier, no auth, no rate limit for personal use
- Sync on-demand via POST /api/weather/sync (cron can hit this daily)

CONSTRAINTS:
- Data is READ-ONLY after insert (no mutations on existing rows)
- Upsert by date on sync to handle re-syncs cleanly
- Kailua HI is Lanae's location (from CLAUDE.md)

VERIFY:
1. npm run build + npm test pass
2. Migration runs
3. POST /api/weather/sync returns 200 with rows inserted

COMMIT:
feat(weather): daily weather + Open-Meteo sync for POTS correlation

Adds weather_daily table, Open-Meteo client, and /api/weather/sync route.
Pulls last 14 days of temperature, pressure, humidity, wind for Kailua
HI. Barometric-pressure correlation with POTS symptoms is the primary
driver (pressure drops worsen blood pooling).

Migration 015. Ref: docs/competitive/flaredown/implementation-notes.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

RETURN (under 200 words):
- Files, tests, migration status
- Sample of data pulled (first 3 days)
- Commit SHA
```

---

## Subagent Brief B1 - multi-signal cycle engine

```
MISSION: Ship multi-signal cycle intelligence engine replicating Natural
Cycles algorithm (BBT cover line + six-day fertile window + biphasic
shift confirmation) extended with Lanae's Oura HRV/RHR signals.
Reference: FDA DEN170052 memo, Scherwitzl et al 2015/2017 papers.

REPO: /Users/clancybond/lanaehealth, branch feat/competitive-wave-2a

READ FIRST (mandatory):
1. /Users/clancybond/lanaehealth/docs/competitive/design-decisions.md
2. /Users/clancybond/lanaehealth/docs/competitive/natural-cycles/implementation-notes.md
3. /Users/clancybond/lanaehealth/docs/competitive/natural-cycles/patterns.md (cites papers + algorithm)
4. /Users/clancybond/lanaehealth/src/lib/cycle-calculator.ts (existing, extend)
5. /Users/clancybond/lanaehealth/src/lib/api/nc-cycle.ts (data source, read-only)
6. /Users/clancybond/lanaehealth/src/lib/intelligence/anovulatory-detection.ts (Wave 1D, reuse its primitives)

YOUR FILE OWNERSHIP:
- CREATE migration 016_cycle_engine_state.sql (caching + state tracking)
- CREATE runner run-016-cycle-engine.mjs
- CREATE core engine src/lib/intelligence/cycle-engine/engine.ts
- CREATE cover-line calculator src/lib/intelligence/cycle-engine/cover-line.ts
- CREATE fertile window calculator src/lib/intelligence/cycle-engine/fertile-window.ts
- CREATE multi-signal fusion src/lib/intelligence/cycle-engine/signal-fusion.ts
- CREATE tests in src/lib/__tests__/cycle-engine/

ALGORITHM (observation-based reimplementation, NOT code copy):
Per Scherwitzl 2015 (JMIR Public Health and Surveillance):
- Per-user follicular baseline = mean temp of first 5 days of cycle
- Cover line = max(follicular-day-temps) + 0.05-0.1 C
- Biphasic shift confirmed after THREE consecutive days > cover line
- Ovulation day = first of the three elevated days minus 1.9 days (empirical median delay from LH+)
- Fertile window = ovulation day minus 5 through ovulation day + 1
- Per-user cycle-length SD used to scale uncertainty buffer around predictions

Multi-signal upgrade (not in NC's published algorithm, our addition):
- Oura HRV deviation on elevated-temp days corroborates ovulation
  (HRV typically drops ovulation day and rises through luteal)
- Oura RHR +3 to +5 bpm sustained is classic luteal signature
- Combine signals with weighted vote when BBT alone is ambiguous

CONSTRAINTS:
- nc_imported and cycle_entries are READ-ONLY
- oura_daily is READ-ONLY
- cycle_engine_state is a new write table for caching per-cycle computed
  values (cover_line, predicted_ovulation, predicted_fertile_window,
  confidence, signals_used). Recompute on new data, do not mutate past
  entries retroactively (NC's retroactive silent mutation breaks trust,
  per natural-cycles/patterns.md).

VERIFY:
1. npm run build + npm test pass
2. Migration applied
3. Engine run on Lanae's 1,490 days of nc_imported returns sensible
   cycles (report count of cycles with confirmed ovulation, count
   anovulatory, average luteal length, average cycle length)

COMMIT:
feat(cycle): multi-signal cycle intelligence engine (BBT + HRV + RHR)

Reimplements Natural Cycles algorithm (cover line, biphasic shift,
fertile window per Scherwitzl 2015/2017) with Lanae's Oura HRV/RHR as
corroborating signals. Replaces single-signal BBT approach that is
noise-prone for chronic-illness patients (POTS flares, disrupted sleep,
endo pain nights corrupt temp).

Migration 016 adds cycle_engine_state for caching. No retroactive
mutation of past predictions.

Refs:
- docs/competitive/natural-cycles/implementation-notes.md
- Scherwitzl et al 2015, JMIR Public Health (DOI ref)
- FDA DEN170052 (NC's FDA submission)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

RETURN (under 300 words):
- File structure created
- Tests (count + names)
- Lanae cycle aggregation stats (count confirmed ovulation, count
  anovulatory, average luteal length, SD)
- Commit SHA
```

---

## Subagent Brief C1 - micronutrient expansion + user_nutrient_targets

```
MISSION: Expand nutrition tracking from 4 nutrients to 25, add
per-user customizable targets, and a Log-page rollup card.

REPO: /Users/clancybond/lanaehealth, branch feat/competitive-wave-2a

READ FIRST:
1. /Users/clancybond/lanaehealth/docs/competitive/design-decisions.md
2. /Users/clancybond/lanaehealth/docs/competitive/cronometer/implementation-notes.md
3. /Users/clancybond/lanaehealth/src/lib/api/food.ts
4. /Users/clancybond/lanaehealth/src/lib/food-database.ts
5. /Users/clancybond/lanaehealth/src/lib/nutrition/diet-presets.ts (Wave 1C, ENDO preset exists)

YOUR FILE OWNERSHIP:
- CREATE migration 017_user_nutrient_targets.sql
- CREATE runner run-017-user-nutrient-targets.mjs
- CREATE src/lib/nutrition/nutrients-list.ts (the 25 priority nutrients with RDA defaults)
- CREATE src/lib/nutrition/target-resolver.ts (merges RDA + preset + user overrides)
- CREATE src/lib/api/nutrient-targets.ts
- CREATE src/components/log/NutrientRollupCard.tsx
- CREATE tests in src/lib/nutrition/__tests__/
- MODIFY src/app/log/page.tsx to mount NutrientRollupCard

25 PRIORITY NUTRIENTS:
Protein, carbs, fat, fiber, iron, vitamin D, vitamin B12, folate,
calcium, magnesium, selenium, zinc, vitamin C, vitamin A, vitamin E,
vitamin K, omega-3 (EPA+DHA), potassium, sodium, copper, manganese,
iodine, choline, chromium, molybdenum.

Each nutrient has: name, unit, adult-female RDA default, preset overrides
(endo, pots, thyroid, iron-deficiency - prep these, Wave 2b will apply),
citation for the RDA source.

DATA MODEL (migration 017):
CREATE TABLE IF NOT EXISTS user_nutrient_targets (
  id uuid primary key default gen_random_uuid(),
  patient_id text not null default 'lanae',
  nutrient text not null,
  target_amount numeric not null,
  target_unit text not null,
  source text not null,  -- 'rda' | 'preset:endo' | 'preset:pots' | 'user'
  rationale text,
  citation text,
  active boolean default true,
  created_at timestamptz default now(),
  UNIQUE(patient_id, nutrient)
);

VERIFY:
1. npm run build + npm test pass
2. Migration applied
3. On fresh install, RDA defaults pre-populated for all 25 nutrients
4. Rollup card displays current-day nutrient intake vs target

COMMIT:
feat(nutrition): 25-nutrient tracking + user-customizable targets

Expands from 4 to 25 priority nutrients. Adds user_nutrient_targets
table (migration 017) with RDA defaults, preset overrides, and user
customization. Rollup card on /log shows current-day intake vs target.

Foundation for Wave 2b endo/POTS preset application and Wave 2b
nutrient-lab cross-reference alerts.

Ref: docs/competitive/cronometer/implementation-notes.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

RETURN (under 250 words):
- Files created
- Tests
- Migration status
- Sample rollup card rendering with Lanae's data
- Commit SHA
```

---

## Subagent Brief E1+E2 - daily_logs ALTER + energy_mode + rest_day

```
MISSION: Add energy_mode and rest_day columns to daily_logs, plus the
Finch-inspired UI for both features. Audit (2026-04-16) already
confirmed these migrations are safe. Use IF NOT EXISTS per audit
recommendation.

REPO: /Users/clancybond/lanaehealth, branch feat/competitive-wave-2a

READ FIRST:
1. /Users/clancybond/lanaehealth/docs/competitive/design-decisions.md
2. /Users/clancybond/lanaehealth/docs/competitive/finch/implementation-notes.md
3. /Users/clancybond/lanaehealth/docs/plans/2026-04-16-non-shaming-voice-rule.md (critical voice context)
4. /Users/clancybond/lanaehealth/src/lib/migrations/009_bearable_killer.sql (model for IF NOT EXISTS ADD COLUMN)
5. /Users/clancybond/lanaehealth/src/lib/api/logs.ts
6. /Users/clancybond/lanaehealth/src/lib/types.ts (DailyLog interface)

YOUR FILE OWNERSHIP:
- CREATE migration 020_daily_logs_energy_mode_rest_day.sql
- CREATE runner run-020-daily-logs-energy.mjs
- MODIFY src/lib/types.ts (add fields to DailyLog)
- MODIFY src/lib/api/logs.ts (expose setEnergyMode, setRestDay fns)
- CREATE src/lib/intelligence/energy-inference.ts (inference from
  Oura readiness + cycle phase + yesterday pain)
- CREATE src/components/log/EnergyModeToggle.tsx (3-mode toggle)
- CREATE src/components/log/EnergyModeBanner.tsx (shows inferred mode)
- CREATE src/components/log/RestDayCard.tsx (positive rest-day action)
- CREATE tests
- MODIFY src/app/log/page.tsx (mount components)

MIGRATION 020:
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS energy_mode text
  CHECK (energy_mode IS NULL OR energy_mode IN ('minimal','gentle','full'))
  DEFAULT NULL;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS rest_day boolean
  DEFAULT false;

VOICE CONSTRAINTS (per non-shaming-voice-rule.md):
- Rest day action text: "I'm resting today" (positive frame)
- Energy mode copy: "Today feels minimal / gentle / full" (not "reduced" or "limited")
- After rest-day logged: "Rest day noted. See you tomorrow." (NOT "you missed X things today")
- Inference banner: "Oura suggests gentle mode today." (suggestion, not prescription)
- User can always override the inferred mode

ANALYSIS-PIPELINE COORDINATION:
- Flag: src/lib/intelligence/ adherence or compliance calculations
  MUST exclude rest_day=true rows from denominators. Otherwise the
  feature contradicts itself by counting rest days as "missing" logs.
- Audit existing intelligence files for any such metrics; add exclusions.
  Files to check: src/lib/ai/correlation-engine.ts, src/lib/intelligence/personas/clinical-analyst.ts

VERIFY:
1. npm run build + npm test pass
2. Migration applied (verify columns exist via direct SQL query)
3. Toggle on /log persists, rest day toggles flag + shows positive copy

COMMIT (single commit):
feat(energy): adaptive energy mode + rest day action (Finch-inspired)

Adds energy_mode and rest_day columns to daily_logs (migration 020,
uses IF NOT EXISTS per 2026-04-16 audit). Inference from Oura readiness
+ cycle phase + yesterday pain suggests a mode; user can override.
Rest day is a positive log, not a null log. Analysis pipeline updated
to exclude rest days from adherence denominators.

Voice per docs/plans/2026-04-16-non-shaming-voice-rule.md.

Ref: docs/competitive/finch/implementation-notes.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

RETURN (under 300 words):
- Files created / modified
- Tests
- Migration status
- Analysis pipeline files updated to exclude rest days
- Voice audit of all new copy (confirm no banned phrases)
- Commit SHA
```

---

## After Wave 2a Completes

1. Run full `npm test` + `npm run build` on the branch
2. Smoke test all 5 features on dev server
3. Update matrix.md with Wave 2a status rows
4. Dispatch Wave 2b (5 dependent subagents that build on A1, A3, B1, C1)
5. Continue serial waves 2c-2e

Wave 2b will be drafted after Wave 2a lands, because Wave 2b depends on specific interfaces that Wave 2a chooses (e.g., headache_attacks column names, cycle_engine_state shape).
