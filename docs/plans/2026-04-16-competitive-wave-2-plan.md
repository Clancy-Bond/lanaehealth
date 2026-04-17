# Wave 2 Implementation Plan

**Status:** DRAFT while Wave 1 runs. Finalize after Wave 1 merges.

**Prereqs:**
- Wave 1 must merge to main first (so Wave 2 doesn't conflict)
- Migration 013 is TAKEN (`013_orthostatic_tests.sql` from prior session). Wave 2 migrations start at **014**.
- ALTER audit approved both proposed migrations, but recommends EAV pattern for `health_profile.home_favorites` (saves one migration).

---

## Feature Set (15 features)

Integrates Wave 1 spillovers + NC/MyNetDiary late-add research.

### Tier A: Foundation tables (must ship first in Wave 2; other features depend)

| # | Feature | App | Migration | Dependencies |
|---|---|---|---|---|
| A1 | headache_attacks table + one-tap logging | Headache | 014 headache_attacks | unlocks A2, B2 |
| A2 | Aura tracking multi-category | Headache | uses 014 | blocked on A1 |
| A3 | weather_daily + Open-Meteo cron | Flaredown | 015 weather_daily | none |

### Tier B: Cycle intelligence (multi-app convergence)

| # | Feature | App | Migration | Notes |
|---|---|---|---|---|
| B1 | Multi-signal cycle engine (BBT + HRV + RHR fusion) | Natural Cycles | 016 cycle_engine_state | REPLACES Flo's cycle_correlation_cache |
| B2 | Menstrual-migraine correlation | Headache + Flo | uses 014 + nc_imported | blocked on A1 |
| B3 | Uncertainty-honest cycle prediction (dashed vs solid) | Clue | none (UI only) | uses B1 output |
| B4 | Retrospective trigger surface (72hr rewind on flare) | Flaredown | none | uses A3 data |

### Tier C: Nutrition depth

| # | Feature | App | Migration | Notes |
|---|---|---|---|---|
| C1 | Expanded micronutrient tracking (4 → 25) + user targets | Cronometer | 017 user_nutrient_targets | |
| C2 | Nutrient x Lab cross-reference alerts | Cronometer | in-code seed map (no table, saves migration) | uses C1 |
| C3 | Endo/POTS condition preset (sodium 5000mg) | MyNetDiary | uses C1 | extends Wave 1 endo preset |
| C4 | Cycle-aware AI Nutrition Coach | MyNetDiary | none (reuses chat_messages with subject tag) | |

### Tier D: Doctor-visit-prep

| # | Feature | App | Migration | Notes |
|---|---|---|---|---|
| D1 | Multi-Specialist Unified Timeline | Guava | none | |
| D2 | Pre-Visit Doctor Prep Sheet | Guava | none | |
| D3 | Multi-Year Lab Trend Sparklines | Guava | none | |
| D4 | Cover-page-first clinical PDF + toggles | CareClinic | none | |
| D5 | Condition-tagging for symptoms | CareClinic | 018 symptom_conditions | |
| D6 | Care Card + QR share | CareClinic | 019 share_tokens | |

### Tier E: Energy scaffolding (ALTER migrations, approval received)

| # | Feature | App | Migration | Notes |
|---|---|---|---|---|
| E1 | Energy-Adaptive Goal Scaling | Finch | 020 ALTER daily_logs +energy_mode | use IF NOT EXISTS per audit |
| E2 | Rest Day Action | Finch | 020 ALTER daily_logs +rest_day | bundle with E1 in one migration |
| E3 | Micro-Care Drawer | Finch | 021 micro_care_completions | |

### Tier F: Polish / UX

| # | Feature | App | Migration | Notes |
|---|---|---|---|---|
| F1 | Year-in-Pixels view | Daylio | none | |
| F2 | Lite Log (30-sec entry) | Daylio | seed icons (in-code) | |
| F3 | Top 5 Best vs Worst days card | Daylio | none | |
| F4 | Today vs Baseline morning card | Apple Health | none | |
| F5 | Favorites/pinned metrics on home | Apple Health | **EAV pattern, no migration** (per audit rec) | |
| F6 | Unified Medical Records Timeline | Apple Health | none | overlaps D1 |
| F7 | PRN post-dose efficacy polling | Bearable | 022 prn_dose_events | |
| F8 | Readiness Contributor Waterfall + Morning Signal | Oura | 023 readiness_signals | |
| F9 | Temp Trend + Cycle Overlay + Illness Flag | Oura | 024 temp_events | |
| F10 | Privacy settings + full ZIP export | Clue | 025 privacy_prefs | |
| F11 | Time-Lagged Correlation (0-7 day lags) | Flaredown | none (lag_days column exists) | uses B4 |
| F12 | Verified-source badge on food search | MyNetDiary | none (UI) | |

---

## Migration Numbering (Wave 2, final)

| # | Name | Tier | Adds |
|---|---|---|---|
| 014 | headache_attacks | A | new table |
| 015 | weather_daily | A | new table |
| 016 | cycle_engine_state | B | new table |
| 017 | user_nutrient_targets | C | new table |
| 018 | symptom_conditions | D | new table (junction) |
| 019 | share_tokens | D | new table |
| 020 | daily_logs ALTER: +energy_mode, +rest_day | E | ALTER existing (IF NOT EXISTS) |
| 021 | micro_care_completions | E | new table |
| 022 | prn_dose_events | F | new table |
| 023 | readiness_signals | F | new table |
| 024 | temp_events | F | new table |
| 025 | privacy_prefs | F | new table |

**Count:** 10 new tables + 1 ALTER = 11 new migrations. Under the 10-new-tables cap per design-decisions.md section 14.5.

Dropped to stay under cap:
- `cycle_correlation_cache` (Flo): replaced by B1 multi-signal engine, no separate table needed
- `nutrient_lab_map` (Cronometer): in-code seed file instead
- `home_favorites` column (Apple Health): EAV pattern via existing `health_profile` section row
- `mood_entries UNIQUE` drop (Daylio rank 4): deferred to Wave 3

---

## Implementation Wave Sequencing

Parallel within each wave, serial between waves.

**Wave 2a (5 subagents, foundation):**
- A1 (headache_attacks + logging)
- A3 (weather_daily + Open-Meteo cron)
- B1 (multi-signal cycle engine)
- C1 (micronutrient expansion + user_nutrient_targets)
- E1+E2 bundled (daily_logs ALTER + energy_mode + rest_day)

**Wave 2b (5 subagents, dependents):**
- A2 (aura tracking)
- B2 (menstrual-migraine correlation)
- B3 (uncertainty-honest prediction UI)
- C2 (nutrient x lab cross-ref)
- C3 (Endo/POTS preset)

**Wave 2c (5 subagents, features):**
- C4 (AI Nutrition Coach)
- D1+F6 merged (unified timeline, one implementation)
- D2 (doctor prep sheet)
- D3 (lab trend sparklines)
- E3 (micro-care drawer)

**Wave 2d (5 subagents, doctor-prep + polish):**
- D4 (clinical PDF)
- D5 (condition-tagging)
- D6 (Care Card QR)
- F1 (Year-in-Pixels)
- F4 (Baseline card)

**Wave 2e (5 subagents, final polish):**
- F2 (Lite Log)
- F3 (Best/worst days)
- F5 (Favorites EAV)
- F7 (PRN polling)
- F10 (Privacy export)

**Wave 3 (remaining):**
- B4 (retrospective trigger — depends on A3 data accumulating)
- F8, F9 (Oura readiness + temp)
- F11 (time-lagged correlation)
- F12 (verified-source badge)

---

## Pre-Wave-2 Checklist

Before dispatching Wave 2:
- [ ] Wave 1 all 5 subagents committed + verified
- [ ] Wave 1 branch merged to main (or left on branch for review)
- [ ] Copy audit subagent dispatched (cleanup after Wave 1 adds)
- [ ] Update matrix.md with final Wave 1 file locations
- [ ] Confirm new migration numbers (014-025) with user
- [ ] Confirm EAV pattern adoption for favorites
