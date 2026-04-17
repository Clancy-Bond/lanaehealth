# Cronometer -- Implementation Notes

Detailed implementation plan for the top 3 features from plan.md. All references use absolute paths.

Constraints reaffirmed:
- `food_entries` and `lab_results` tables are READ-ONLY. No schema changes, no row modifications.
- New tables only via additive migrations, next available number is 013.
- Every feature must work on Lanae's REAL data (5,781 meals, 52 lab tests).
- No em dashes in any file.
- Supabase writes go through `src/lib/api/<domain>.ts`.

---

## Feature 1: Expanded Micronutrient Tracking + Custom User Targets

**Shipped first. Foundation for Features 2 and 3.**

### File targets (create unless noted)

- `/Users/clancybond/lanaehealth/src/lib/migrations/013-user-nutrient-targets.sql` (NEW)
- `/Users/clancybond/lanaehealth/src/lib/api/nutrient-targets.ts` (NEW, server-side data access)
- `/Users/clancybond/lanaehealth/src/lib/api/food-nutrients.ts` (NEW, aggregates food_entries intake)
- `/Users/clancybond/lanaehealth/src/lib/nutrient-catalog.ts` (NEW, canonical list of 25 tracked nutrients + default RDAs)
- `/Users/clancybond/lanaehealth/src/lib/types.ts` (MODIFY, add `UserNutrientTarget` and `NutrientIntakeRollup` interfaces)
- `/Users/clancybond/lanaehealth/src/components/log/NutrientDailyRollup.tsx` (NEW, UI card)
- `/Users/clancybond/lanaehealth/src/components/settings/NutrientTargetsEditor.tsx` (NEW, override UI)
- `/Users/clancybond/lanaehealth/src/app/log/page.tsx` (MODIFY, import the new card)
- `/Users/clancybond/lanaehealth/src/app/settings/page.tsx` (MODIFY, import the target editor)
- `/Users/clancybond/lanaehealth/src/app/api/nutrient-targets/route.ts` (NEW, GET + POST)
- `/Users/clancybond/lanaehealth/src/app/api/nutrient-intake/route.ts` (NEW, GET rolling window)

### Data model

**Migration 013: user_nutrient_targets**

```sql
-- 013-user-nutrient-targets.sql (up only, no down)
CREATE TABLE IF NOT EXISTS user_nutrient_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrient_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  default_rda NUMERIC,
  user_target NUMERIC,
  priority INTEGER NOT NULL DEFAULT 100,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  source_rationale TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_nutrient_targets_priority ON user_nutrient_targets(is_priority, priority);

-- Seed 25 priority nutrients. Values derived from NIH ODS RDA for adult female 19-30.
-- Source: https://ods.od.nih.gov/factsheets/list-all/
INSERT INTO user_nutrient_targets (nutrient_key, display_name, unit, default_rda, priority, is_priority) VALUES
  ('iron_mg',         'Iron',              'mg',   18,    10, true),
  ('vitamin_c_mg',    'Vitamin C',         'mg',   75,    15, true),
  ('vitamin_d_iu',    'Vitamin D',         'IU',   600,   20, true),
  ('calcium_mg',      'Calcium',           'mg',   1000,  30, true),
  ('magnesium_mg',    'Magnesium',         'mg',   310,   35, true),
  ('potassium_mg',    'Potassium',         'mg',   2600,  40, true),
  ('sodium_mg',       'Sodium',            'mg',   1500,  45, true),
  ('selenium_mcg',    'Selenium',          'mcg',  55,    25, true),
  ('iodine_mcg',      'Iodine',            'mcg',  150,   26, true),
  ('zinc_mg',         'Zinc',              'mg',   8,     50, true),
  ('b12_mcg',         'Vitamin B12',       'mcg',  2.4,   55, true),
  ('folate_mcg',      'Folate',            'mcg',  400,   60, true),
  ('b6_mg',           'Vitamin B6',        'mg',   1.3,   65, false),
  ('thiamin_mg',      'Thiamin (B1)',      'mg',   1.1,   70, false),
  ('riboflavin_mg',   'Riboflavin (B2)',   'mg',   1.1,   75, false),
  ('niacin_mg',       'Niacin (B3)',       'mg',   14,    80, false),
  ('vitamin_a_mcg',   'Vitamin A',         'mcg',  700,   85, false),
  ('vitamin_e_mg',    'Vitamin E',         'mg',   15,    90, false),
  ('vitamin_k_mcg',   'Vitamin K',         'mcg',  90,    95, false),
  ('omega3_g',        'Omega-3 (EPA+DHA)', 'g',    1.1,   28, true),
  ('fiber_g',         'Fiber',             'g',    25,    12, true),
  ('protein_g',       'Protein',           'g',    46,    8,  true),
  ('calories',        'Calories',          'kcal', 2000,  5,  true),
  ('cholesterol_mg',  'Cholesterol',       'mg',   300,   48, true),
  ('saturated_fat_g', 'Saturated Fat',     'g',    20,    58, true);
```

Notes:
- `user_target` left NULL means use `default_rda`. Writes only set `user_target` to override.
- `is_priority` controls default Log page display (Pattern 6).
- `source_rationale` documents clinician notes when targets are overridden.

**Schema: `food_nutrient_cache` (EXISTING, read + write)**

The existing `nutrients` JSONB column accepts arbitrary keys. No migration needed. When we look up a food that is not cached, we call USDA FDC API and populate the full 25-nutrient set, not just 4. This is a data backfill task, not a schema change.

### Component plan

**New components**:
- `NutrientDailyRollup.tsx`: On Log page. Shows top 8-10 priority nutrients with progress bars. Uses `var(--accent-sage)` for on-track, `var(--accent-blush)` for below target, `--pain-mild` for above target. Rounded corners `var(--radius-md)`. Collapsible "Show all" reveals non-priority nutrients.
- `NutrientTargetsEditor.tsx`: On Settings page. List of all 25 nutrients, each row editable, shows RDA default + current user override. Save button triggers API POST.

**Reused**:
- `CollapsibleSection.tsx` from log components.
- `useRef` width measurement pattern from existing Recharts SSR fix.

### Acceptance criteria

1. `npm run build` passes on main with migration applied.
2. Migration 013 runs via `src/lib/migrations/run-migration.mjs 013`.
3. Visiting `/log` on port 3005 shows the NutrientDailyRollup card with real data computed from Lanae's latest day's food_entries joined to food_nutrient_cache.
4. Visiting `/settings` shows NutrientTargetsEditor listing all 25 nutrients. Override value for iron (set to 27), save, reload -- value persists.
5. Daily rollup updates to reflect the new iron target.
6. Vitest tests in `src/lib/api/__tests__/nutrient-targets.test.ts` pass for: default lookup, override write, priority ordering.

### Verification plan (against Lanae's real Supabase data)

1. Query: `SELECT COUNT(*), MIN(logged_at), MAX(logged_at) FROM food_entries` should return 5,781 rows and a date range spanning myNetDiary history.
2. Spot-check: pick 10 random food_entries, verify food_nutrient_cache has iron/vitamin C populated. If gaps, log them and note for a backfill task.
3. Targets editor: override iron to 27 mg, verify `SELECT user_target FROM user_nutrient_targets WHERE nutrient_key='iron_mg'` returns 27.
4. Daily rollup: compute iron intake for Lanae's last logged day manually via SQL, compare to UI value, must match within 5% tolerance (due to food matching fuzziness).

### Risks

- food_nutrient_cache gaps: many of the 5,781 entries may lack full 25-nutrient data. Mitigation: show "?" with tooltip "nutrient data pending" rather than zero, never overstate. Backfill asynchronously.
- Backfill cost: USDA FDC API has rate limits. Mitigation: batch backfill in background job, stop gracefully if rate-limited.
- Target weighting controversy: RDAs differ by source. Mitigation: cite NIH ODS in `source_rationale` for every default, allow user override for every value.

---

## Feature 2: Endometriosis / Anti-Inflammatory Diet Preset

**Shipped second. Depends on Feature 1 (user_nutrient_targets table).**

### File targets

- `/Users/clancybond/lanaehealth/src/lib/nutrient-presets.ts` (NEW, preset bundle definitions)
- `/Users/clancybond/lanaehealth/src/lib/api/nutrient-targets.ts` (MODIFY, add `applyPreset` function)
- `/Users/clancybond/lanaehealth/src/components/settings/NutrientPresetPicker.tsx` (NEW, UI card listing presets)
- `/Users/clancybond/lanaehealth/src/app/settings/page.tsx` (MODIFY, import the preset picker)
- `/Users/clancybond/lanaehealth/src/app/api/nutrient-targets/apply-preset/route.ts` (NEW, POST)

### Data model

No new tables. Preset is a static config object in `nutrient-presets.ts` that, when applied, calls the `applyPreset` function which writes target overrides to `user_nutrient_targets`.

Preset definition shape:

```typescript
// nutrient-presets.ts
export interface NutrientPreset {
  key: string
  displayName: string
  description: string
  citations: string[]
  targets: Record<string, number>  // nutrient_key -> user_target
  rationale: Record<string, string> // per-nutrient clinical note
}

export const ENDO_ANTI_INFLAMMATORY_PRESET: NutrientPreset = {
  key: 'endo_anti_inflammatory',
  displayName: 'Endometriosis / Anti-Inflammatory Protocol',
  description: 'Elevated iron, omega-3, fiber, vitamin D targets for endometriosis with heavy bleeding. Anti-inflammatory emphasis.',
  citations: [
    'Parazzini et al. 2013, Reprod Biomed Online, diet and endometriosis risk',
    'NIH ODS iron, vitamin D, omega-3 fact sheets',
    'Harris et al. 2018, Am J Epidemiol, dairy and endometriosis'
  ],
  targets: {
    iron_mg: 27,
    vitamin_c_mg: 120,
    vitamin_d_iu: 2000,
    selenium_mcg: 200,
    omega3_g: 2.0,
    fiber_g: 35,
    magnesium_mg: 400
  },
  rationale: {
    iron_mg: 'Elevated from 18 to 27 mg due to heavy menstrual blood loss, per endo clinical guidance.',
    vitamin_c_mg: 'Elevated to support iron absorption.',
    vitamin_d_iu: 'Endo patients often deficient. Lanae has low 25-OH-D trend. Target 2000 IU.',
    selenium_mcg: 'Supports thyroid + anti-inflammatory; relevant to borderline TSH 5.1.',
    omega3_g: 'EPA+DHA 2g target for anti-inflammatory omega-3:omega-6 ratio.',
    fiber_g: 'Elevated from 25 to 35g to support estrogen clearance.',
    magnesium_mg: 'Elevated for cramping and cholesterol 286 support.'
  }
}
```

### Component plan

**New components**:
- `NutrientPresetPicker.tsx`: Card per preset. Apply button. Shows which targets will change. Confirmation modal on apply.

**Reused**:
- Existing `Dialog` or modal primitive (check `/src/components/ui/`).

### Acceptance criteria

1. Settings page shows "Nutrient Presets" section with the endo protocol card.
2. Applying preset writes 7 target overrides to `user_nutrient_targets`.
3. Rollup card on Log page reflects new targets immediately (iron now targets 27 mg not 18 mg).
4. Unit tests in `src/lib/__tests__/nutrient-presets.test.ts` verify preset shape, target merging.

### Verification plan

1. Apply preset, then `SELECT nutrient_key, user_target FROM user_nutrient_targets WHERE user_target IS NOT NULL` should return exactly 7 rows matching preset targets.
2. Log page iron rollup now shows "/27 mg" not "/18 mg".
3. Revert via Settings editor on single row, verify only that row changes.

### Risks

- Clinical defensibility: preset values must be explicitly cited. Mitigation: citations array in preset, displayed in UI tooltip.
- Preset drift over time: if science updates, we need to version presets. Mitigation: `key` includes a version suffix if revised (`endo_anti_inflammatory_v2`).

---

## Feature 3: Nutrient Intake x Lab Result Cross-Reference Alerts

**Shipped third. Depends on Features 1 and 2.**

### File targets

- `/Users/clancybond/lanaehealth/src/lib/migrations/014-nutrient-lab-map.sql` (NEW)
- `/Users/clancybond/lanaehealth/src/lib/api/nutrient-lab-alerts.ts` (NEW, correlation engine, READ-ONLY)
- `/Users/clancybond/lanaehealth/src/lib/intelligence/nutrient-lab-correlator.ts` (NEW, alert generation logic)
- `/Users/clancybond/lanaehealth/src/components/log/NutrientLabAlerts.tsx` (NEW, alert card UI)
- `/Users/clancybond/lanaehealth/src/components/doctor/NutrientDeficiencySection.tsx` (NEW, for doctor reports)
- `/Users/clancybond/lanaehealth/src/app/log/page.tsx` (MODIFY, import alert card)
- `/Users/clancybond/lanaehealth/src/app/doctor/page.tsx` (MODIFY, import deficiency section)
- `/Users/clancybond/lanaehealth/src/app/api/nutrient-lab-alerts/route.ts` (NEW, GET)

### Data model

**Migration 014: nutrient_lab_map**

```sql
-- 014-nutrient-lab-map.sql (up only)
CREATE TABLE IF NOT EXISTS nutrient_lab_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrient_key TEXT NOT NULL REFERENCES user_nutrient_targets(nutrient_key),
  lab_test_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('low_is_bad', 'high_is_bad')),
  clinical_rationale TEXT,
  citation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nutrient_lab_map_lookup ON nutrient_lab_map(nutrient_key, lab_test_name);

-- Seed mappings. lab_test_name must match values present in lab_results.test_name.
INSERT INTO nutrient_lab_map (nutrient_key, lab_test_name, direction, clinical_rationale, citation) VALUES
  ('iron_mg',       'Ferritin',             'low_is_bad',  'Low ferritin reflects depleted iron stores. Pair low lab with low intake to flag dietary shortfall.', 'NIH ODS Iron 2022'),
  ('iron_mg',       'Hemoglobin',           'low_is_bad',  'Low hemoglobin suggests iron-deficiency anemia.', 'CDC MMWR anemia criteria'),
  ('iron_mg',       'Iron',                 'low_is_bad',  'Serum iron reflects recent intake + transport.', 'Lab Tests Online iron panel'),
  ('vitamin_d_iu',  '25-Hydroxy Vitamin D', 'low_is_bad',  'Deficiency defined below 20 ng/mL. Endo patients often below range.', 'Endocrine Society 2011 guideline'),
  ('b12_mcg',       'Vitamin B12',          'low_is_bad',  'B12 below 200 pg/mL indicates deficiency.', 'NIH ODS B12 2022'),
  ('folate_mcg',    'Folate',               'low_is_bad',  'Low folate can be dietary.', 'NIH ODS folate 2022'),
  ('calcium_mg',    'Calcium',              'low_is_bad',  'Hypocalcemia correlates with calcium intake deficits.', 'NIH ODS calcium 2022'),
  ('magnesium_mg',  'Magnesium',            'low_is_bad',  'Serum Mg undercounts total body Mg but is the clinical marker.', 'NIH ODS Mg 2022'),
  ('selenium_mcg',  'TSH',                  'low_is_bad',  'Selenium deficiency can exacerbate thyroid dysfunction; borderline TSH flags this axis.', 'Rayman 2019, Lancet selenium thyroid'),
  ('iodine_mcg',    'TSH',                  'low_is_bad',  'Iodine intake directly affects TSH.', 'NIH ODS iodine'),
  ('cholesterol_mg', 'Cholesterol',         'high_is_bad', 'Dietary cholesterol contributes modestly; fiber inversely.', 'AHA 2019'),
  ('saturated_fat_g','Cholesterol',         'high_is_bad', 'Saturated fat is primary dietary driver of LDL.', 'AHA 2019');
```

### Correlation engine logic

`src/lib/intelligence/nutrient-lab-correlator.ts` (READ-ONLY over food_entries and lab_results):

```
For each row in nutrient_lab_map:
  1. Pull latest lab_result where test_name = lab_test_name (within last 180 days).
  2. If lab value is "low" when direction=low_is_bad (using lab.flag or reference_range_low), note the lab concern.
  3. Compute 7-day and 30-day rolling intake for nutrient_key from food_entries joined to food_nutrient_cache.
  4. Compare to user_nutrient_targets.user_target (or default_rda).
  5. If intake also below target AND lab is concerning, emit an alert object:
       {
         severity: 'high' | 'medium',
         nutrient_key,
         nutrient_display_name,
         lab_test: { name, value, unit, date, flag },
         intake_7d_avg,
         intake_30d_avg,
         target,
         gap_percent,
         actionable: 'Your [nutrient] labs and dietary intake are both below target.'
       }
  6. Return sorted by severity, top 5.
```

All computation is derived. Zero writes to food_entries or lab_results.

### Component plan

**New components**:
- `NutrientLabAlerts.tsx`: Shows alert cards on Log page. Each card displays lab value, intake gap, suggested next step. Uses severity color tokens.
- `NutrientDeficiencySection.tsx`: Embeds in Doctor page export. Cleaner, text-heavy version for PDF.

**Reused**:
- `InsightBanner.tsx` from log components for styling consistency.

### Acceptance criteria

1. Migration 014 applied successfully.
2. Given Lanae's real data, visiting `/log` surfaces at least one alert (expected: iron or vitamin D based on known profile).
3. Alert cards link to a detail view showing 30-day trend of intake vs target.
4. Doctor page `/doctor` shows a "Nutrient Deficiencies" section with same data, formatted for clinical review.
5. Tests: `src/lib/intelligence/__tests__/nutrient-lab-correlator.test.ts` passes for synthetic cases (low lab + low intake = alert, low lab + adequate intake = no alert, adequate lab = no alert).
6. No writes to food_entries or lab_results verified via SQL audit log review.

### Verification plan

1. Run correlator against Lanae's real data. Expected: iron or ferritin-related alert given her endo + heavy bleeding profile.
2. Manually compute 7-day iron intake for last week via SQL. Compare to engine output. Must match within 5%.
3. Force a scenario: temporarily override iron target to 50 mg in user_nutrient_targets. Reload Log page. Alert severity should increase. Revert target after test.
4. Confirm `SELECT COUNT(*) FROM food_entries` and `SELECT COUNT(*) FROM lab_results` are unchanged after running the correlator 100 times.

### Risks

- Lab test name matching: our `lab_results.test_name` may use different strings than our map (e.g., "Ferritin" vs "ferritin" vs "Ferritin, serum"). Mitigation: case-insensitive match + alias table if needed, or normalize in a view.
- False positives: an alert based on a single lab value + noisy food intake can mislead. Mitigation: require both 7-day intake BELOW target AND lab BELOW reference_range_low before raising. Medium severity if one threshold met, high only if both.
- Food_nutrient_cache gaps bias intake low: if some foods have no iron data cached, intake estimate undercounts. Mitigation: compute "completeness" percent alongside each intake estimate and surface it in UI.
- Does not constitute medical advice: UI copy must always frame this as "observation for discussion with your doctor," never as prescription.

---

## Verification summary (all three features)

Run after all three ship:

1. `npm run build` passes.
2. `npm test` passes with new tests added.
3. Migrations 013 and 014 applied to Lanae's Supabase (via `src/lib/migrations/run-migration.mjs`).
4. Manual UI verification on port 3005:
   - `/settings` shows nutrient targets editor and preset picker.
   - `/log` shows nutrient daily rollup AND cross-reference alerts.
   - `/doctor` export includes nutrient deficiency section.
5. SQL audit: `SELECT COUNT(*), MAX(logged_at) FROM food_entries` and `SELECT COUNT(*), MAX(date) FROM lab_results` unchanged from pre-implementation baseline.
6. Screenshots saved to `docs/competitive/cronometer/screenshots/`.
7. matrix.md updated with 3 new shipped rows.

---

## Red flags / escalation points

- If food_nutrient_cache coverage is under 40% for Lanae's meals, we stop and backfill before shipping Feature 3. Without coverage the alerts are unreliable.
- If any proposed migration conflicts with an existing unlisted migration, we stop and coordinate with main session.
- If lab_results.test_name values do not align with nutrient_lab_map seeds (spot check needed before shipping), we adjust seeds to match real data, not the other way around (lab_results stays read-only).
