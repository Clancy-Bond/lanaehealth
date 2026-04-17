# Competitive Feature Matrix

**Status:** Research wave COMPLETE (13/13 subagents). Awaiting Lanae's approval on priorities + schema changes.

**Last updated:** 2026-04-16

---

## At a Glance

- **39 features** surfaced across 13 apps
- **10 Small-effort wins** (score 10.0) ready for fast implementation
- **26 Medium-effort** features, most score 5.0
- **3 Large-effort** items deferred from top 3
- **12 new Supabase tables proposed** (exceeds 10-table cap by 2)
- **3 ALTER-existing-table migrations proposed** (require explicit Lanae approval)

---

## Top 10 Global Quick Wins (Small effort, score 10.0)

Implement in Wave 1. Most are copy/UX changes, some single-file additions.

| Rank | Feature | App | Effort | Impact | Migration | Notes |
|---|---|---|---|---|---|---|
| 1 | Non-shaming copy audit (streak/guilt removal + CLAUDE.md rule) | Bearable | S | 5 | none | Safety rail for every future feature |
| 2 | Plain-English insight cards (r-value + lag badges) | Bearable | S | 5 | none | Uses existing correlation_results |
| 3 | Endo/anti-inflammatory diet preset | Cronometer | S | 5 | none | One-tap target set for iron/D/selenium/omega-3/fiber |
| 4 | HIT-6 + MIDAS clinical scales | Headache-Diary | S | 5 | none | Extends src/lib/clinical-scales.ts pattern |
| 5 | Anovulatory cycle detection flag | Clue | S | 5 | none | Uses existing correlation_results |
| 6 | Adaptive Movement Suggestion | Oura | S | 5 | none | Readiness-scaled UI, no new data |
| 7 | Frequency-weighted meal suggestions per meal_type | MFP | S | 5 | none | One-tap chips from 5,781 food_entries |
| 8 | Copy meal from yesterday / any prior date | MFP | S | 5 | none | Same infra as #7 |
| 9 | Graceful barcode not-found fallback | MFP | S | 4 | none | 3-field quick-add instead of 15-field form |
| 10 | Phase-matched Home InsightBanner | Flo | S | 4 | none | Tags Layer 2 summaries by cycle phase |

**Wave 1 scope if approved:** 10 features, all Small, zero migrations, zero new tables, zero existing-table ALTERs. Estimated 30-40 hours across parallel subagents.

---

## Medium-Effort Features (full top-3-per-app rollup)

### Bearable
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Plain-English insight cards | S | none | 10.0 |
| 2 | Non-shaming copy audit | S | none | 10.0 |
| 3 | PRN post-dose efficacy polling | M | 020 prn_dose_events | 5.0 |

### MyFitnessPal
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Frequency-weighted meal chips | S | none | 10.0 |
| 2 | Copy meal from prior date | S | none | 10.0 |
| 3 | Barcode not-found fallback | S | none | 8.0 |

### Cronometer
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Endo/anti-inflammatory diet preset | S | none | 10.0 |
| 2 | Nutrient x Lab cross-reference alerts | M | 018 user_nutrient_targets + 019 nutrient_lab_map (or in-code seed) | 5.0 |
| 3 | Expanded micronutrient tracking (4→25) | M | shares 018 | 5.0 |

### Flo
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Cycle-symptom correlation surfacing | M | 015 cycle_correlation_cache | 5.0 |
| 2 | Phase-matched Home InsightBanner | S | none | 8.0 |
| 3 | Cycle Health Report for OB/GYN Apr 30 | M | none | 5.0 |

### Oura
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Adaptive Movement Suggestion | S | none | 10.0 |
| 2 | Readiness Contributor Waterfall + Morning Signal | M | 016 readiness_signals | 5.0 |
| 3 | Temperature Trend + Cycle Overlay + Illness Flag | M | 017 temp_events | 5.0 |

### Finch
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Energy-Adaptive Goal Scaling | M | **ALTER daily_logs: +energy_mode** (APPROVAL) | 5.0 |
| 2 | Rest Day Action | M | **ALTER daily_logs: +rest_day** (APPROVAL) | 5.0 |
| 3 | Micro-Care Drawer | M | 021 micro_care_completions | 5.0 |

### Daylio
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Lite Log (30-second entry) | M | none (uses existing tables + seed data) | 5.0 |
| 2 | Year-in-Pixels view | M | none | 5.0 |
| 3 | Top 5 Best vs Worst days card | S | none | 8.0 |

### CareClinic
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Cover-page-first clinical PDF + toggles | M | none | 5.0 |
| 2 | Care Card + QR share | M | 023 share_tokens | 5.0 |
| 3 | Condition-tagging for symptoms | M | 024 symptom_conditions | 5.0 |

### Flaredown
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Retrospective Trigger Surface (72h rewind) | M | none | 5.0 |
| 2 | Time-Lagged Correlation (0-7 day lags) | M | none (lag_days column exists) | 5.0 |
| 3 | Barometric + Weather Auto-Enrichment | M | 014 weather_daily | 5.0 |

### Headache Diary (Migraine Buddy + N=1 + Migraine Monitor)
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | HIT-6 + MIDAS clinical scales | S | none | 10.0 |
| 2 | Aura tracking multi-category | M | depends on 013 headache_attacks | 8.0 |
| 3 | One-tap during-attack logging | M | 013 headache_attacks (FOUNDATION) | 5.0 |

### Guava Health
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Multi-Specialist Unified Timeline | M | none | 5.0 |
| 2 | Pre-Visit Doctor Prep Sheet | M | none | 5.0 |
| 3 | Multi-Year Lab Trend Sparklines | M | none | 5.0 |

### Apple Health
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Unified Medical Records Timeline | M | none | 5.0 |
| 2 | Today vs Your Baseline morning card | M | none | 4.0 |
| 3 | Favorites/pinned metrics | M | **ALTER health_profile: +home_favorites JSONB** (APPROVAL) | 4.0 |

### Clue
| Rank | Feature | Effort | Migration | Score |
|---|---|---|---|---|
| 1 | Anovulatory cycle detection | S | none | 10.0 |
| 2 | Uncertainty-honest cycle prediction | M | none | 5.0 |
| 3 | Privacy settings + full ZIP export | M | 022 privacy_prefs | 5.0 |

---

## Migration Coordination Plan (013-024, no collisions)

Existing migrations: 001, 002, 003, 009, 010, 011, 012. Next available: 013.

| # | Name | Source | Type | Blocks |
|---|---|---|---|---|
| 013 | headache_attacks | Headache-Diary | new table | Aura tracking depends on this |
| 014 | weather_daily | Flaredown | new table | none |
| 015 | cycle_correlation_cache | Flo | new table | none |
| 016 | readiness_signals | Oura | new table | none |
| 017 | temp_events | Oura | new table | Illness flag |
| 018 | user_nutrient_targets | Cronometer | new table | Endo preset + alerts |
| 019 | nutrient_lab_map | Cronometer | **possibly merge to in-code seed** | Cross-ref alerts |
| 020 | prn_dose_events | Bearable | new table | PRN polling |
| 021 | micro_care_completions | Finch | new table | Micro-Care Drawer |
| 022 | privacy_prefs | Clue | new table | Privacy export |
| 023 | share_tokens | CareClinic | new table | Care Card QR |
| 024 | symptom_conditions | CareClinic | new table (junction) | Condition tagging |
| 025 | ALTER daily_logs: +energy_mode, +rest_day | Finch | **NEEDS APPROVAL** | Both Finch features |
| 026 | ALTER health_profile: +home_favorites | Apple Health | **NEEDS APPROVAL** | Favorites feature |

**Table count check:** 12 new tables proposed. Design-decisions.md section 14 set cap at 10. **Overshoot by 2.**

**Mitigation options:**
- Merge 019 (nutrient_lab_map) into in-code seed data in `src/lib/nutrition/lab-map.ts` (no table). Saves 1.
- Drop 015 (cycle_correlation_cache) and compute on-demand (slower but saves 1 table). Saves 1.
- Net: 10 new tables, fits cap.

---

## Approvals Needed From Lanae

Before implementation dispatch:

1. **ALTER daily_logs**: add `energy_mode` (text enum) and `rest_day` (bool) columns. Enables Finch features 1 + 2. Both additive, no existing-row changes, but DDL on core patient table.
2. **ALTER health_profile**: add `home_favorites` JSONB column. Apple Health feature 3. Additive.
3. **10 vs 12 new tables**: accept the mitigation above (in-code seed + on-demand cycle cache), or lift the cap to 12.
4. **Priorities**: Wave 1 as proposed (10 Small-effort wins), or reshuffle?
5. **OB/GYN time-pressure**: Flo Cycle Health Report is Medium effort but relevant for Apr 30 appointment (14 days). Want to fast-track?

---

## App Coverage Summary

| App | Research | Top 3 | Migration needs | Wave fit |
|---|---|---|---|---|
| Bearable | done | done | 020 (M feature only) | W1: #1, #2; W2: #3 |
| MyFitnessPal | done | done | none | W1: all 3 |
| Cronometer | done | done | 018 (+019 optional) | W1: #1; W2: #2, #3 |
| Flo | done | done | 015 (or defer) | W1: #2; W2: #1, #3 |
| Oura | done | done | 016, 017 | W1: #1; W2: #2, #3 |
| Finch | done | done | 021 + ALTER daily_logs | W2 (all, pending approval) |
| Daylio | done | done | none | W1: #3; W2: #1, #2 |
| CareClinic | done | done | 023, 024 | W2-W3 |
| Flaredown | done | done | 014 | W2 |
| Headache Diary | done | done | 013 | W2 (foundation) + W3 (dependents) |
| Guava Health | done | done | none | W2 (all 3 M) |
| Apple Health | done | done | ALTER health_profile | W2-W3 |
| Clue | done | done | 022 | W1: #1; W2: #2, #3 |

---

## Proposed Implementation Waves

**Wave 1 (Fast wins, no DB schema, fully parallel):** 10 Small-effort score-10 features. ~5 parallel subagents, each handling 2 features. No approval blockers. ~30 hours wall-clock if parallelized.

**Wave 2 (DB schema work, requires approval):** 12 Medium features with new tables or column additions. Must wait for migration-number coordination + Lanae's ALTER approval. ~5 parallel subagents, each owning 2-3 features. ~60 hours wall-clock if parallelized.

**Wave 3 (Dependent features):** Features that depend on Wave 2 tables (Aura tracking depends on headache_attacks; some analytics depend on Wave 2 caches). ~8 features. ~40 hours.

**Wave 4 (Large/deferred, later sprint):** Guava gaps not in top 3 (family history tree, voice capture, condition network graph UI, insurance denial tracking). Defer.

---

## Pipeline

- [x] Design decisions locked (2026-04-16)
- [x] Research wave (13/13 complete)
- [x] Matrix populated
- [ ] Lanae approves priorities + ALTER migrations
- [ ] Wave 1 dispatch
- [ ] Wave 2 dispatch (post-approval)
- [ ] Wave 3 dispatch
- [ ] Final QA
