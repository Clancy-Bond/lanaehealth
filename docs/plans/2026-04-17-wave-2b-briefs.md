# Wave 2b Subagent Briefs

**Status:** Ready to dispatch on branch `feat/competitive-wave-2b` after Wave 2a is merged to main (or rebased).

**Wave 2b scope:** 5 features that depend on Wave 2a schema. All Medium effort.

Wave 2a schema landed:
- `headache_attacks` table (014) — columns: id, patient_id, started_at, ended_at, severity, head_zones jsonb, aura_categories jsonb, triggers jsonb, medications_taken jsonb, medication_relief_minutes, notes, cycle_phase, hit6_score, midas_grade
- `weather_daily` ALTER via migration 015 (columns added to table originally created in migration 009): date pk, patient_id, location_lat, location_lon, temp_high_c, temp_low_c, humidity_mean, pressure_mean_hpa, pressure_change_24h, wind_mean_kmh, precipitation_mm, raw_json, synced_at
- `cycle_engine_state` table (016) — (see run-016 migration for exact columns)
- `user_nutrient_targets` table (017) — columns: id, patient_id, nutrient, target_amount, target_unit, source, rationale, citation, active, created_at; registry in `src/lib/nutrition/nutrients-list.ts`
- `daily_logs.energy_mode` text + `daily_logs.rest_day` bool (020)

Exported APIs ready to consume:
- `src/lib/api/headache.ts` — `startAttack, updateAttack, endAttack, getActiveAttack, getAttacks, deleteAttack`
- `src/lib/api/weather-daily.ts` — `getWeatherRange, getPriorPressure, upsertWeatherRecords`
- `src/lib/intelligence/cycle-engine/engine.ts` — multi-signal cycle engine (top-level orchestrator)
- `src/lib/api/nutrient-targets.ts` — `listTargets, upsertUserOverride, upsertPresetRows, deactivateTarget, getResolvedTargets`
- `src/lib/intelligence/energy-inference.ts` — `inferEnergyMode`

---

## Dispatch checklist

- [ ] Wave 2a merged to main (or at least applied as base for 2b branch)
- [ ] Create branch: `git checkout -b feat/competitive-wave-2b`
- [ ] Dispatch 5 subagents in parallel on shared branch
- [ ] Each briefing includes the "contested file" guardrail

---

## Subagent Brief A2 — Aura tracking multi-category

```
MISSION: Surface ICHD-3 aura categories in the headache logging flow.
Wave 2a already created the schema (aura_categories jsonb on
headache_attacks). This subagent builds the interaction layer and
the hemiplegic-migraine advisory.

READ FIRST:
1. docs/competitive/design-decisions.md
2. docs/competitive/headache-diary/implementation-notes.md
3. src/lib/api/headache.ts (existing, Wave 2a — AURA_CATEGORIES const
   already exports visual/sensory/speech/motor)
4. src/components/log/HeadacheQuickLog.tsx (existing)

YOUR FILE OWNERSHIP:
- CREATE src/components/log/AuraCategoryPicker.tsx (multi-select, 4
  options per ICHD-3 with subtle iconography)
- CREATE src/lib/clinical-advisories/hemiplegic-migraine.ts (advisory
  text + risk factors per IHS 2018 guidance)
- MODIFY src/components/log/HeadacheQuickLog.tsx (replace current
  simple aura chips with AuraCategoryPicker)
- CREATE src/lib/__tests__/aura-category-picker.test.ts
- CREATE src/lib/__tests__/hemiplegic-advisory.test.ts

ADVISORY RULES:
- Motor aura selection triggers gentle non-diagnostic advisory:
  "Motor weakness during headache can indicate hemiplegic migraine.
   If this is the first time or symptoms last over 24 hours, contact
   your doctor."
- NOT a diagnostic block. Lanae can still save the log.
- Advisory links to /doctor/appointments scheduler if she wants
  follow-up

VERIFY:
1. npm run build + npm test pass
2. Dev server: /log active headache flow shows new picker

COMMIT:
feat(headache): ICHD-3 aura categories with hemiplegic migraine advisory

Adds multi-select aura picker (visual/sensory/speech/motor) to the
active headache log. Motor selection triggers non-diagnostic
hemiplegic-migraine advisory with link to doctor follow-up.

Ref: docs/competitive/headache-diary/implementation-notes.md
     IHS ICHD-3 criteria 1.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Subagent Brief B2 — Menstrual-migraine correlation

```
MISSION: Build a menstrual-migraine correlation analyzer that uses the
cycle_phase column (denormalized at write time on headache_attacks by
Wave 2a A1) to quantify perimenstrual migraine bias.

READ FIRST:
1. docs/competitive/design-decisions.md
2. docs/competitive/headache-diary/implementation-notes.md (Phase E
   section on menstrual-migraine classifier)
3. docs/competitive/flo/implementation-notes.md
4. src/lib/api/headache.ts (getAttacks function, Wave 2a)
5. src/lib/intelligence/cycle-engine/engine.ts (Wave 2a)
6. src/lib/intelligence/anovulatory-detection.ts (Wave 1D,
   buildCyclesFromNc utility)

YOUR FILE OWNERSHIP:
- CREATE src/lib/intelligence/menstrual-migraine.ts
  - Function: classifyAttack(attack) returns 'menstrual' | 'non-menstrual'
    where menstrual = occurred within 2 days before period start through
    day 3 of menstrual phase (IHS A1.1.1 criterion)
  - Function: computeMenstrualMigraineStats(attacks, cycles) returns
    { totalAttacks, menstrualAttacks, pct, oddsRatio, p }
- CREATE src/components/patterns/MenstrualMigraineCard.tsx
  - Renders on /patterns page, shows stats + cycle-phase heatmap of
    attack frequency
  - If %menstrual >= 60% flags "pattern consistent with menstrual
    migraine" (non-diagnostic language)
- CREATE src/lib/__tests__/menstrual-migraine.test.ts
- MODIFY src/app/patterns/page.tsx to mount the card (only if file
  is not contested; otherwise report deferred)

CONSTRAINTS:
- headache_attacks, nc_imported read-only on existing rows
- Use cycle-engine output for phase determination, not manual math
- No diagnostic language, no menstrual-period shame
- Warm modern tokens

VERIFY + COMMIT (standard pattern)
```

---

## Subagent Brief B3 — Uncertainty-honest cycle prediction UI

```
MISSION: Surface cycle-engine predictions with honest uncertainty on
/patterns page. Dashed chips for predicted days, solid for confirmed.
Range (not single date) with plain-language reason when confidence low.

READ FIRST:
1. docs/competitive/clue/implementation-notes.md (Feature 1)
2. docs/competitive/natural-cycles/implementation-notes.md
3. src/lib/intelligence/cycle-engine/engine.ts (Wave 2a, output has
   confidence field)
4. src/lib/intelligence/cycle-engine/fertile-window.ts (Wave 2a,
   Bayesian shrinkage already implemented)

YOUR FILE OWNERSHIP:
- CREATE src/components/patterns/CyclePredictionCard.tsx
- CREATE src/components/patterns/DayChip.tsx (dashed vs solid)
- CREATE tests
- MODIFY src/app/patterns/page.tsx to mount (if not contested)

CONSTRAINTS:
- Use cycle-engine confidence output
- When confidence < 0.7, show range instead of single date
- Plain-language reason: "Cycle length varies, predicted window is
  wider than average." NOT "algorithmic uncertainty"
- No em dashes

VERIFY + COMMIT (standard pattern)
```

---

## Subagent Brief C2 — Nutrient x Lab cross-reference alerts

```
MISSION: Build the flagship cross-reference alerts feature. Join
user_nutrient_targets + food_entries intake + lab_results to surface:
"Low iron labs + low iron intake" or similar. Directly targets Lanae's
endo iron depletion + borderline TSH (selenium/iodine) + high
cholesterol (fiber + omega-3).

READ FIRST:
1. docs/competitive/cronometer/implementation-notes.md (Feature 1,
   flagship)
2. src/lib/api/nutrient-targets.ts (Wave 2a)
3. src/lib/nutrition/nutrients-list.ts (Wave 2a, 25-nutrient registry)
4. src/lib/food-database.ts, src/lib/food-triggers.ts
5. src/lib/api/labs.ts

YOUR FILE OWNERSHIP:
- CREATE src/lib/nutrition/nutrient-lab-map.ts (in-code seed per
  Wave 2 plan, NO new table)
  - Maps lab tests to relevant nutrients
  - Example: ferritin low → iron deficit; TSH borderline → selenium
    iodine; HDL low → omega-3; LDL high → fiber omega-3
  - Each mapping cites source
- CREATE src/lib/intelligence/nutrient-lab-alerts.ts
  - Function: generateAlerts(labs, targets, intakeDays) returns
    actionable suggestions
  - Threshold-based, not diagnostic
- CREATE src/components/patterns/NutrientLabAlertsCard.tsx
- CREATE tests
- MODIFY src/app/patterns/page.tsx to mount (if not contested)

CONSTRAINTS:
- lab_results, food_entries read-only
- Alerts must be actionable: "Your iron intake averages 12mg/day
  (target 27mg). Consider lean red meat, lentils, or talk to your
  doctor about supplementation." NOT "YOU HAVE LOW IRON"
- Use clinical citations
- No em dashes

VERIFY + COMMIT (standard pattern)
```

---

## Subagent Brief C3 — Endo/POTS condition preset

```
MISSION: Add POTS preset (sodium 5000mg, fluids 3L) that composes
with the existing Endo preset. MyNetDiary research showed this is
a LanaeHealth-unique win.

READ FIRST:
1. docs/competitive/mynetdiary/implementation-notes.md
2. src/lib/nutrition/diet-presets.ts (Wave 1C, ENDO preset)
3. src/lib/api/nutrient-targets.ts (Wave 2a)

YOUR FILE OWNERSHIP:
- MODIFY src/lib/nutrition/diet-presets.ts (add POTS_PRESET with
  sodium 5000mg, fluids 3L, potassium 4700mg, each cited)
- CREATE src/lib/nutrition/preset-composer.ts (merges multiple
  presets, user edits take precedence over preset values)
- CREATE src/components/settings/PresetPicker.tsx (multi-select)
- CREATE tests
- MODIFY src/app/settings/page.tsx to mount (if not contested)

CONSTRAINTS:
- Do NOT rewrite existing ENDO preset, only ADD POTS preset
- Multiple active presets compose; conflicts resolve by max (for
  intake-style nutrients) or by last-wins for thresholds
- Citations required for all POTS preset values (sodium 5000mg
  cites Vanderbilt Autonomic Dysfunction Center guidance)
- No em dashes

VERIFY + COMMIT (standard pattern)
```

---

## After Wave 2b

Wave 2c will add:
- C4 Cycle-aware AI Nutrition Coach (depends on C2)
- D1+F6 Unified Medical Records Timeline (merged)
- D2 Pre-Visit Doctor Prep Sheet
- D3 Multi-Year Lab Trend Sparklines
- E3 Micro-Care Drawer

Wave 2d and 2e continue from there per the Wave 2 plan doc.
