# Cronometer -- Implementation Plan

Ranked table of features to pull from Cronometer into LanaeHealth, scored by Lanae impact and effort. Top 3 flagged for immediate implementation.

Rubric: rank by `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Higher is better.

---

## Ranked feature table

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort | Score | Depends on | Notes | TOP 3 |
|------|---------|----------------|--------------------|--------|-------|------------|-------|-------|
| 1 | Nutrient Intake x Lab Result Cross-Reference Alerts | Pattern 1 | 5 | M | 5.0 | food_nutrient_cache expansion, new `nutrient_lab_map` table | Flagship feature. Directly addresses iron, vitamin D, selenium deficits. User-expressed wish nobody ships. | YES |
| 2 | Expanded Micronutrient Tracking with Custom Targets per User | Pattern 2 | 5 | M | 5.0 | food_nutrient_cache backfill, new `user_nutrient_targets` table | Foundation that powers all other Cronometer-inspired features. Without this, Pattern 1 and Pattern 5 cannot exist. | YES |
| 3 | Endo / Anti-Inflammatory Diet Preset | Pattern 5 | 5 | S | 10.0 | user_nutrient_targets (same as #2), existing endometriosis_mode | One-tap preset: elevates iron, omega-3, fiber, vitamin D targets; flags high-dairy / high-FODMAP foods. Leverages existing endo-mode infra. | YES |
| 4 | Transparent Nutrition Score (daily 0-100) | Pattern 4 | 4 | M | 4.0 | nutrient targets + cross-reference engine | Derived from target-vs-intake. Needs clear formula doc. | |
| 5 | PDF Nutrient Report Export on Doctor page | Pattern 9 | 4 | M | 4.0 | existing Doctor page, nutrient target system | Appends nutrient trend section to existing doctor export. | |
| 6 | Oracle Gap-Filler ("eat these foods to hit target") | Pattern 3 | 4 | L | 2.0 | full nutrient DB per food, optimization algorithm | Great UX, but depends on having richer per-food nutrient data than we currently cache. | |
| 7 | Priority-Nutrient Hierarchy UI (default 8 visible, rest collapsed) | Pattern 6 | 3 | S | 6.0 | nutrient target system | Pure UI layer on top of #2. Fast once target system exists. | |
| 8 | Recipe Builder with Nutrient Calc | Pattern 8 | 2 | L | 1.0 | food_nutrient_cache, new `custom_recipes` table | Low urgency. MyNetDiary already does this for Lanae's meals. | |
| 9 | CGM Integration (Dexcom / Libre) | Pattern 7 | 2 | XL | 0.5 | new integration provider, webhook infra | Out of scope. Lanae does not use CGM. Document only. | |
| 10 | Ad-free tier (already solved) | Pattern 10 | N/A | - | - | - | Already our default. No implementation needed. | |

---

## Top 3 rationale

### 1. Nutrient x Lab Cross-Reference Alerts

**Why top**: This is the single most differentiated feature in competitive research. No app ships it. Users of every major nutrition tracker explicitly wish for it. Lanae's profile (ferritin risk, vitamin D low in endo, borderline TSH, high cholesterol) is the canonical use case.

**Acceptance criteria**:
- Given Lanae's 52 lab results and 5,781 food entries, surface at least 3 actionable alerts on the Log page (example: "Ferritin 18 ng/mL is low AND your 7-day iron intake averages 10 mg/day below the 18 mg target").
- Alerts are read-only observations: no modification to lab_results or food_entries.
- Alert rules are clinician-curated in a new `nutrient_lab_map` table.

### 2. Expanded Micronutrient Tracking with Custom Targets

**Why top**: Pattern 1 and Pattern 5 both depend on this. Ship once, unlock three features. Also directly addresses Cronometer's core strength (82 nutrients vs MFP's 15) without blindly copying their UI.

**Acceptance criteria**:
- food_nutrient_cache expanded to include at least 25 clinically relevant nutrients (current: 4).
- New `user_nutrient_targets` table stores Lanae's personal target for each nutrient, defaulting to RDA but overridable by clinical recommendation.
- Daily rollup view on Log page: "Iron: 12/27 mg, 44%" for priority nutrients.

### 3. Endo / Anti-Inflammatory Diet Preset

**Why top**: Best score by the (impact*2)/effort formula (10.0). Once #2 ships, this is S-sized: a config bundle that sets target overrides for iron (27 mg), vitamin D (2000 IU), omega-3 (2g EPA+DHA), fiber (35g), selenium (200 mcg), and flags trigger thresholds. Leverages existing endometriosis_mode migration (011).

**Acceptance criteria**:
- New preset "Endometriosis / Anti-Inflammatory Protocol" applies a curated target bundle with one click.
- Preset is documented with clinical rationale (sources cited).
- Lanae can override individual values within the preset without losing the preset state.

---

## Skipped / deferred features

- **Oracle (#6)**: Deferred. Depends on full nutrient data per food. Reconsider in Phase 2 after food_nutrient_cache is fully backfilled.
- **Recipe Builder (#8)**: Skipped. MyNetDiary handles this for Lanae.
- **CGM Integration (#9)**: Skipped. Not a Lanae data source.

---

## New tables / migrations required

Based on top 3:

| Table | Migration # | Purpose | Read/Write |
|-------|-------------|---------|------------|
| `user_nutrient_targets` | 013 | Per-user custom nutrient target values | Write (user edits), Read (daily rollup) |
| `nutrient_lab_map` | 014 | Clinician-curated mapping of nutrient -> lab marker(s) -> direction | Read-only (seeded via migration) |
| `food_nutrient_cache` | existing | Expand schema by adding columns via migration if possible, else serialize into `nutrients` JSONB (preferred, no schema change) | Read (when computing intake), Write (cache refresh) |

food_entries and lab_results stay read-only as mandated.

Total new tables: 2. Well under the 10-table cap.

---

## Implementation order

1. Ship #2 (expanded nutrients + custom targets) first. Foundation.
2. Ship #3 (endo preset) next. Trivial once #2 exists. Quick Lanae win.
3. Ship #1 (cross-reference alerts) last. Depends on #2 target vectors and needs the nutrient_lab_map seed.

Estimated total effort: M + S + M = approx. 20-28 hours of focused build.
