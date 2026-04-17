# Natural Cycles -- Implementation Notes (Top 3)

Derived from plan.md. Exact file targets, data models, components, acceptance criteria, verification plan, risks. Follows design-decisions.md section 3 format.

All three features REIMPLEMENT published NC behaviors in our own code. No NC source code, assets, or UI copy used. Algorithm rationale cited inline from published papers:
- Scherwitzl E et al., Contraception 2017 (PMC5669828)
- Berglund Scherwitzl E et al., Eur J Contracept Reprod Health Care 2015 (PubMed 25592280)
- Berglund Scherwitzl E et al., npj Digital Medicine 2019 (600K+ cycles)
- FDA DEN170052 decision memo, August 2018

---

## Feature 1: Multi-signal cycle intelligence engine with individualized uncertainty

### File targets

**New files:**
- `src/lib/intelligence/cycle-engine/index.ts` -- main orchestrator, exports `computeCyclePrediction(userHistory, todayData)` -> `CyclePrediction`
- `src/lib/intelligence/cycle-engine/bbt-shift-detector.ts` -- cover line + biphasic shift logic
- `src/lib/intelligence/cycle-engine/fertile-window.ts` -- six-day window calc from ovulation day
- `src/lib/intelligence/cycle-engine/uncertainty.ts` -- individualized SD-based uncertainty calculator
- `src/lib/intelligence/cycle-engine/multi-signal-fusion.ts` -- weighted combine: BBT, HRV, RHR, LH, cycle stats
- `src/lib/intelligence/cycle-engine/types.ts` -- CyclePrediction, PhaseSignal, UncertaintyBand interfaces
- `src/lib/intelligence/cycle-engine/disturbance-detector.ts` -- auto-exclude from symptom log, Oura sleep score, alcohol
- `src/lib/intelligence/cycle-engine/__tests__/` -- vitest specs for each module

**Modified files:**
- `src/lib/cycle-calculator.ts` -- deprecate `DEFAULT_CYCLE_LENGTH`-based fallback path; delegate to `cycle-engine` for predictions. Keep existing `calculateCyclePhase` signature for backward compat but route to new engine.
- `src/lib/api/nc-cycle.ts` -- add `getCycleStatistics(userId)` helper that returns mean/SD/shortest/longest/anovulatory count for the intelligence engine.
- `src/lib/types.ts` -- add CyclePrediction, PhaseSignal, UncertaintyBand, CycleStatistics types.

### Data model

**No schema changes required.** All input data sources already exist:
- `nc_imported` (1,490 days, read-only) -- BBT, flow, LH, fertility color, ovulation status, cycle day, cycle number
- `cycle_entries` -- manual supplements
- `oura_daily` (1,187 days) -- temperature_trend, heart_rate_variance, resting_heart_rate, sleep_score
- `daily_logs` -- symptoms including fever, POTS flare, alcohol
- `health_profile` -- patient config including cycle-length assumptions if any

**Optional additive migration** (new, number = highest + 1, `0XX-cycle-predictions.sql`):
- Table `cycle_predictions` to cache computed predictions for fast read:
  - `date` (date, PK)
  - `predicted_phase` (text: menstrual/follicular/ovulatory/luteal)
  - `predicted_cycle_day` (int)
  - `predicted_ovulation_day` (date, nullable)
  - `ovulation_uncertainty_days` (int)
  - `predicted_period_start` (date, nullable)
  - `period_uncertainty_days` (int)
  - `confidence_score` (float 0-1)
  - `signals_used` (jsonb: which signals contributed)
  - `excluded_reasons` (jsonb: which data was excluded and why)
  - `computed_at` (timestamp)

Read-only in app flow except for cache writes via `src/lib/api/cycle-predictions.ts`.

### Component plan

**New components:**
- `src/components/cycle/PhasePredictionCard.tsx` -- shows current phase, cycle day, next period range, uncertainty band
- `src/components/cycle/UncertaintyBand.tsx` -- visual +/- range rendering for predicted dates
- `src/components/cycle/SignalBreakdown.tsx` -- expandable "why this prediction" panel showing per-signal contribution (BBT, HRV, RHR, LH, cycle stats) and any exclusions

**Reused existing:**
- `src/components/cycle/CycleCard.tsx` -- compose PhasePredictionCard into existing cycle view
- `src/components/log/BBTRow.tsx` -- add disturbance flag UI (sick / slept differently / alcohol)
- `src/components/log/InsightBanner.tsx` -- surface "we weighted today's temp lower because X"

### Acceptance criteria

1. `computeCyclePrediction(lanaeHistory, today)` returns a `CyclePrediction` with:
   - `currentPhase`: one of menstrual/follicular/ovulatory/luteal
   - `predictedOvulationDay`: Date + uncertainty days (+/-)
   - `predictedPeriodStart`: Date + uncertainty days
   - `confidenceScore`: 0-1 float
   - `signalsUsed`: array of signal sources
   - `excludedData`: array of {date, reason}
2. On Lanae's actual data (nc_imported + oura_daily + daily_logs), output matches NC's `fertility_color` column in at least 85% of days over the last 180 days (ignoring the first 3 cycles to allow for learning).
3. Period prediction range width reflects her actual cycle-length SD; range is never fixed to 0 days.
4. Short luteal (<10 d post-BBT-shift) produces a clinical anomaly flag (feeds Feature 3).
5. Anovulatory cycle (no biphasic BBT shift + no LH surge) produces a flag after the cycle exceeds 35 days.
6. If temperature data is missing or excluded for >=3 days in the expected ovulation window, confidence drops to <0.5 and UI shows "Insufficient data to confirm ovulation."
7. `npm run build` passes. `npm test` covers all public engine functions with >=80% branch coverage.
8. No direct Anthropic calls from engine (engine is pure data in, pure data out).

### Verification plan

1. Unit tests on synthetic cycles (classic 28-day, irregular 24-42 range, anovulatory, short luteal).
2. Backtest against Lanae's nc_imported rows: for each day, compute our prediction and compare to NC's `fertility_color` and `ovulation_status`. Target >=85% agreement in cycle days 8-30 of each cycle (excluding learning period).
3. Manual review of mismatches: identify which rows differ and verify our explanation (e.g., "we weighted BBT lower due to low sleep, NC did not").
4. Performance: engine returns prediction for a single day in <100 ms.
5. Run on port 3005 `/log` page, verify PhasePredictionCard renders with Lanae's real data.
6. Screenshot captured for implementation record.

### Risks

- **Risk: Oura temp trend transform is undocumented.** NC does not publish the exact function they use to convert Oura trend to an absolute value. We will need to empirically fit a transform using Lanae's overlap period (Oura + NC same dates) and document the fit in code comments.
- **Risk: BBT and Oura disagree.** When manual BBT and Oura both exist for a day, we need a deterministic precedence rule. Default: prefer manual BBT (higher precision) but downweight if it is an outlier vs. Oura (may be thermometer error).
- **Risk: 85% agreement with NC may be hard to hit.** Her cycles are irregular and she has endo. If our engine does better or worse than NC on her cycles, we should document and adjudicate case-by-case, not tune to match NC blindly.
- **Risk: Prediction caching.** If we cache predictions in `cycle_predictions`, we must invalidate on any new temperature, LH, or symptom log for the cycle. Stale cache = wrong phase shown.

---

## Feature 2: Cycle Report PDF for Apr 30 OB/GYN visit

### File targets

**New files:**
- `src/app/api/cycle-report/route.ts` -- POST endpoint, returns PDF blob
- `src/app/doctor/cycle-report/page.tsx` -- preview page with "Download PDF" button
- `src/lib/reports/cycle-report-generator.ts` -- orchestrator, pulls data and composes report
- `src/lib/reports/cycle-report-pdf.tsx` -- PDF layout (react-pdf or @react-pdf/renderer)
- `src/lib/reports/cycle-report-sections.ts` -- section builders (summary, cycles, chart data, symptoms, anomalies)

**Modified files:**
- `src/app/doctor/page.tsx` -- add "Cycle Report" card linking to the preview page
- `src/components/doctor/VisitPrepList.tsx` -- add cycle report as a prep item for Apr 30 OB/GYN

### Data model

**No schema changes.** Read-only composition from:
- `nc_imported` + `cycle_entries` (merged via existing `getCombinedCycleEntries`)
- `cycle_predictions` (if Feature 1 cache exists, else compute in-memory)
- `daily_logs` (symptoms filtered to relevant cycle categories: pain, cramping, GI, mood)
- `pain_points` (for pain-location map if relevant)
- `health_profile` (patient demographics, conditions, medications)
- `medical_timeline` (prior relevant events)

### Component plan

**New components:**
- `src/components/reports/CycleReportPreview.tsx` -- on-screen preview (desktop-optimized)
- `src/components/reports/CycleReportPdfLayout.tsx` -- PDF-only rendered via react-pdf
- `src/components/reports/CycleStatisticsTable.tsx` -- reusable: mean, SD, shortest, longest, luteal range, anovulatory count
- `src/components/reports/BBTChartForPdf.tsx` -- Recharts chart exportable to PDF-safe SVG
- `src/components/reports/SymptomDistributionTable.tsx` -- symptom x cycle-phase counts
- `src/components/reports/AnomaliesCallout.tsx` -- flagged clinical items (short luteal, anovulatory, long cycle)

**Reused existing:**
- `src/components/doctor/VisitPrepList.tsx`
- `src/components/doctor/SectionHeader.tsx`

### Acceptance criteria

Report must contain:
1. Patient header: name, DOB, date range covered, cycle count, generated date
2. **Cycle Summary Table**: last 6-12 cycles, columns: cycle start, cycle length, period length, ovulation day, luteal length, flow level, flagged anomalies
3. **Cycle Statistics**: mean cycle length, SD, shortest, longest, mean luteal length, luteal SD, number of anovulatory cycles, number of short-luteal cycles
4. **BBT Chart**: 6-cycle overlay with cover line per cycle, ovulation marker, period markers, excluded days visually distinct
5. **Symptom Distribution**: pain, mood, GI, POTS symptoms grouped by cycle phase (menstrual / follicular / ovulatory / luteal), frequency counts
6. **Flagged Anomalies**: short luteal, anovulatory, long cycle, severe dyspareunia, heavy flow; each with cycle date and clinical note
7. **Narrative Summary**: 2-3 paragraph Claude-generated summary suitable for OB/GYN (routed through `src/lib/context/assembler.ts`, max 300 tokens)
8. PDF loads in <5 seconds, prints cleanly on Letter and A4
9. Preview renders correctly on port 3005 `/doctor/cycle-report`
10. `npm run build` passes

### Verification plan

1. Generate report against Lanae's real data covering Apr 2025 - Apr 2026 (~12 cycles).
2. Manually verify each section matches nc_imported rows spot-checked.
3. Verify all clinical flags (short luteal, anovulatory, long cycle) are present if any occurred.
4. Print-preview the PDF for legibility.
5. Confirm Lanae's OB/GYN Apr 30 is listed in `appointments` and the report date range is appropriate.
6. Attach screenshot of preview + PDF download to implementation-notes.md.

### Risks

- **Risk: Recharts doesn't render in @react-pdf out of the box.** May need to render the chart to an SVG/PNG via a server-side renderer and embed. Alternative: custom SVG cycle chart built for PDF.
- **Risk: HIPAA-style care with PHI in PDF.** The PDF will contain Lanae's full cycle data. Storage and transmission must be local-only. Never email; download only. Document this in security posture.
- **Risk: Narrative summary hallucination.** Claude-generated narrative could misinterpret a flag. Constrain prompt tightly, include validation that narrative only cites numbers present in the structured data, and mark as "AI-assisted draft, review before sharing."
- **Risk: Six cycles may not be enough for Lanae.** NC ships with 6; we should offer 12 for Lanae given her irregularity.

---

## Feature 3: Clinical anomaly alerts (short luteal, anovulatory, long cycle)

### File targets

**New files:**
- `src/lib/intelligence/anomalies/luteal-phase-detector.ts` -- detects luteal length from BBT shift to period onset, flags <10 days
- `src/lib/intelligence/anomalies/anovulatory-detector.ts` -- detects absence of biphasic shift + no LH surge, flags after cycle exceeds 35 days
- `src/lib/intelligence/anomalies/long-cycle-detector.ts` -- flags cycles >35 days with clinical context (PCOS, thyroid, perimenopause)
- `src/lib/intelligence/anomalies/index.ts` -- orchestrator, returns all anomalies for a given window
- `src/lib/intelligence/anomalies/types.ts` -- Anomaly, AnomalySeverity, AnomalyCategory
- `src/lib/intelligence/anomalies/__tests__/` -- vitest specs

**Modified files:**
- `src/components/home/InsightBanner.tsx` -- add AnomalyAlert variant (severity-colored, action link to Patterns page)
- `src/app/patterns/page.tsx` -- add "Cycle Anomalies" section pulling from anomalies engine
- `src/lib/api/correlations.ts` (if exists, else `src/lib/api/cycle-anomalies.ts`) -- persistence layer if we cache detected anomalies

### Data model

**Optional additive migration** (new, number = highest + 1, `0YY-cycle-anomalies.sql`):
- Table `cycle_anomalies`:
  - `id` (uuid, PK)
  - `date_detected` (date, index)
  - `cycle_start_date` (date, foreign reference to cycle logical entity)
  - `anomaly_type` (enum: short_luteal / anovulatory / long_cycle / severe_dyspareunia / heavy_flow)
  - `severity` (enum: info / notice / flag / urgent)
  - `details` (jsonb: computed metrics that triggered)
  - `user_acknowledged_at` (timestamp, nullable)
  - `dismissed_reason` (text, nullable)
  - `created_at` (timestamp)

If we skip the table and compute on every render, that is acceptable for v1 given scale (Lanae, single patient, ~50 cycles history).

### Component plan

**New components:**
- `src/components/cycle/AnomalyAlertCard.tsx` -- individual alert with severity, description, clinical context, "Discuss with doctor" link
- `src/components/cycle/AnomalySection.tsx` -- section wrapper on Patterns page grouping alerts by severity

**Reused existing:**
- `src/components/home/InsightBanner.tsx` -- variant extension
- `src/components/ui/SeverityBadge.tsx` (if exists, else create)

### Acceptance criteria

1. **Short luteal detector**:
   - Input: cycle with detected BBT biphasic shift day and next period start day
   - Output: luteal length in days, flag if <10 days
   - Clinical context copy: "Your luteal phase was 8 days in your cycle ending Mar 14. Luteal phases under 10 days can indicate low progesterone (luteal phase defect), which matters for fertility. This is worth raising with your OB/GYN, especially given your endometriosis context."
2. **Anovulatory detector**:
   - Input: cycle of >=35 days with no confirmed biphasic BBT shift AND no positive LH test
   - Output: flag with cycle length and reason for detection
   - Clinical context copy: "Your current cycle is at day 38 with no temperature-confirmed ovulation. This can happen occasionally and is called an anovulatory cycle. Common causes include stress, thyroid changes, or PCOS. If this happens often, mention to your OB/GYN."
3. **Long cycle detector**:
   - Input: cycle >35 days
   - Output: flag with possible causes (PCOS, thyroid, perimenopause)
   - Clinical context copy includes Lanae's specific TSH 5.1 borderline context: "Your last cycle was 42 days. Cycles longer than 35 days can relate to thyroid function (your TSH was 5.1, borderline high, at your Feb 19 labs). Discuss with your OB/GYN or PCP."
4. On Lanae's historical data: detector lists all short-luteal, anovulatory, and long cycles with dates. Lanae reviews and confirms these match her recollection.
5. Alerts surface on Home `InsightBanner` (urgent only) and full list on Patterns page.
6. `npm run build` passes. `npm test` with >=80% coverage on detectors.

### Verification plan

1. Unit tests on synthetic cycles covering each anomaly type and edge cases (9 vs 10 day luteal, 34 vs 36 day cycle, ovulation right at day 35).
2. Run detectors across Lanae's nc_imported history; enumerate detected anomalies; have Lanae validate against her own memory.
3. Verify alert copy is plain-language, not alarmist, and links to actionable next steps.
4. Verify alerts are scoped to the current user (Lanae only, no multi-tenant risk).
5. On port 3005 `/patterns` page, confirm AnomalySection renders with real data.
6. Screenshot the Patterns view + Home InsightBanner variant.

### Risks

- **Risk: False positives demoralize.** If we flag every 36-day cycle in an endo patient as "anovulatory," we will erode trust. Require BOTH no BBT shift AND no LH surge. If LH data is missing, require cycle >40 days to reduce false positives.
- **Risk: Clinical copy tone.** Must be informative, not alarmist. Never "you have a progesterone deficiency." Always "this pattern can indicate X, worth discussing." Voice-check against design-decisions.md Voice rules.
- **Risk: Intersection with Clinical Intelligence Engine (separate doc).** The clinical intelligence engine has broader evidence scoring and persona-based interpretation. Our anomaly detectors should emit structured findings that the Intelligence Engine can consume, not duplicate.
- **Risk: Short luteal flag depends on BBT shift detection accuracy.** If the shift is misdetected early by 2 days, a 12-day luteal looks like 10. Flag should display confidence ("luteal phase 10 +/- 2 days") not a raw number.

---

## Sequencing recommendation

Feature 1 (intelligence engine) must land first. Features 2 and 3 depend on its outputs.

**Week 1**: Feature 1 engine and tests. Light UI wiring.
**Week 2**: Feature 1 UI polish + Feature 3 detectors + Patterns page integration.
**Week 3**: Feature 2 Cycle Report PDF. Targeted for completion before Apr 30 OB/GYN.

---

## What I am NOT replicating from NC (explicit non-goals)

- Red/Green day labeling (not a contraceptive)
- Retroactive silent day-recoloring
- Partner (Clancy) separate app (already has admin access)
- NC Perimenopause algorithm (not Lanae's life stage)
- NC Postpartum mode (not Lanae's life stage)
- Learning-period cold start (we use 1,490 days of her NC data as prior)
- Subscription / paywall (single-patient app, no subscription model)

---

## References (for future maintainers)

Published papers cited in our code comments where behaviors are ported:
- `bbt-shift-detector.ts`: cites Scherwitzl 2015, FDA DEN170052
- `fertile-window.ts`: cites Scherwitzl 2017, NC help "What are Red and Green Days"
- `uncertainty.ts`: cites Berglund Scherwitzl 2019 (npj Digital Medicine), Scherwitzl 2015 luteal SD
- `multi-signal-fusion.ts`: cites Goodale 2019 (Oura HRV + RHR cycle phase marker paper) for added signals not in NC
- `disturbance-detector.ts`: cites NC help "When and how should I exclude my temperature"
