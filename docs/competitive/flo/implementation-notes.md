# Flo -- Implementation Notes (Top 3)

For the 3 flagged features from plan.md. All are additive, none modify existing tables. Highest existing migration is 012, so new migrations start at 013.

---

## Feature 1: Cycle-symptom correlation surfacing

### File targets
- `src/lib/intelligence/cycle-symptom-correlation.ts` (NEW) -- computes phase-banded correlations
- `src/lib/api/nc-cycle.ts` (MODIFY) -- expose `getPhaseForDate(date)` helper if not already present
- `src/app/patterns/page.tsx` (MODIFY) -- add "Cycle Correlations" card
- `src/components/patterns/CycleCorrelationCard.tsx` (NEW) -- render correlations with uncertainty language
- `src/lib/migrations/013_cycle_correlation_cache.sql` (NEW) -- cache computed correlations per run

### Data model
- READ: `nc_imported` (cycle phase per day, read-only), `daily_logs` (pain, fatigue, mood, read-only), `symptoms` (read-only), `food_entries` (read-only), `correlation_results` (existing table, new rows only via analysis_runs)
- NEW TABLE `cycle_correlation_cache` (migration 013):
  - `id uuid primary key default gen_random_uuid()`
  - `run_id uuid references analysis_runs(id)`
  - `symptom text not null` (e.g., 'headache', 'bloating', 'pelvic_pain')
  - `phase text not null check (phase in ('menstrual','follicular','ovulatory','luteal'))`
  - `mean_severity numeric`
  - `n_days integer not null`
  - `confidence numeric` (0 to 1)
  - `effect_size numeric`
  - `computed_at timestamptz default now()`
- ADDITIVE only. No existing row modifications.

### Component plan
- NEW: `CycleCorrelationCard.tsx` -- shows top 3 phase-symptom associations with phrasing like "In your last 6 cycles, pelvic pain averaged 6.2/10 in menstrual phase vs 2.1/10 in follicular. n=48 days."
- REUSE: existing `src/components/log/CycleCard.tsx` phase color tokens, `clinical-scales.ts` for severity thresholds.
- Empty state: "We need at least 3 logged cycles with symptom data to surface correlations. You have X."

### Acceptance criteria
1. Patterns page renders a Cycle Correlations card when Lanae has >=3 complete cycles logged with symptom data
2. Top 3 strongest phase-symptom correlations shown, sorted by effect size
3. Uncertainty language on every statement ("averaged," "in your last N cycles," sample size shown)
4. No correlation shown if n<10 days for that phase-symptom combination
5. Zero diet or fertility prescriptions in output copy
6. Cached in `cycle_correlation_cache`, recomputed when new cycle completes

### Verification plan
1. Query `nc_imported` for Lanae's distinct cycle count; confirm >=3
2. Run correlation job manually via `scripts/run-cycle-correlations.mjs` (new script)
3. Eyeball output rows in `cycle_correlation_cache`
4. Load `/patterns` on port 3005, confirm card renders with at least 3 correlations
5. Unit test `cycle-symptom-correlation.ts` with fixture data covering: normal cycle, anovulatory cycle, sparse logging

### Risks
- Natural Cycles phase labels do not always line up with actual biology (BBT-based detection can miss anovulatory cycles). Mitigation: cross-reference Oura temperature shift detection if available.
- False positives when n is small. Mitigation: strict n>=10 per phase-symptom cell, report sample size in UI.
- Diet-culture drift if we add food correlations later. Mitigation: food correlations shipped in a separate follow-up with editorial review.

---

## Feature 2: Phase-matched Home InsightBanner

### File targets
- `src/lib/context/summary-engine.ts` (MODIFY) -- add optional `cycle_phase` metadata tag to each summary
- `src/lib/api/nc-cycle.ts` (MODIFY if needed) -- expose `getCurrentPhase()` pulling latest phase from nc_imported
- `src/components/log/InsightBanner.tsx` (MODIFY) -- accept phase prop, filter insight pool
- `src/content/phase-insights.ts` (NEW) -- editorial content array, each item tagged with phase
- `src/app/page.tsx` (MODIFY) -- pass current phase to InsightBanner

### Data model
- READ: `nc_imported` (latest row for current date), `context_summaries` (existing table, reads only)
- NO new table. Phase tags live in `phase-insights.ts` as static content and as an optional field in `context_summaries` added via ALTER TABLE in an ADDITIVE migration if we want dynamic phase tags (hold off, static content is sufficient for v1).

### Component plan
- MODIFY `InsightBanner.tsx`: accept `currentPhase` prop, filter insights to match phase or "all"
- NEW `src/content/phase-insights.ts`: array of `{ phase: 'menstrual'|'follicular'|'ovulatory'|'luteal'|'all', title, body, evidence_tag: 'clinical'|'educational'|'self-care' }`
- Editorial rule: no diet claims, no fertility pressure, no cycle-syncing workout prescriptions for a POTS patient. Content focuses on symptom expectations and validated self-care (heat, hydration, pacing).

### Acceptance criteria
1. Home page InsightBanner renders an insight whose `phase` matches Lanae's current cycle phase
2. If no phase-matched insight available, falls back to an `all`-tagged insight
3. Every insight has an evidence_tag shown in the card
4. Content avoids diet-culture, fertility pressure, shame
5. Rotates daily within the matched pool (seeded by date)

### Verification plan
1. Query nc_imported for today's phase for Lanae
2. Load `/` on port 3005, confirm banner shows a phase-tagged insight
3. Change device clock or mock phase, confirm different insight shown
4. Editorial review of phase-insights.ts for excluded content (diet, fertility)
5. Snapshot test on InsightBanner with each phase

### Risks
- If nc_imported doesn't have today's row, phase is unknown. Mitigation: fall back to `all` tier gracefully, never fabricate phase.
- Editorial drift toward wellness tropes if content grows unmoderated. Mitigation: PR check requires evidence_tag for every new entry.

---

## Feature 3: Cycle Health Report for OB/GYN

### File targets
- `src/app/api/doctor/cycle-report/route.ts` (NEW) -- GET endpoint returns structured JSON
- `src/lib/intelligence/cycle-report.ts` (NEW) -- computes the report payload from nc_imported + cycle_entries + daily_logs + lab_results
- `src/app/doctor/page.tsx` (MODIFY) -- add "Cycle Report" button/section
- `src/components/doctor/CycleReportView.tsx` (NEW) -- renders the report in HTML (print-ready CSS)
- `src/components/doctor/CycleReportPDF.tsx` (NEW) -- optional, only if we add server-side PDF generation (can defer, print-to-PDF via browser is fine for v1)

### Data model
- READ ONLY: `nc_imported`, `cycle_entries`, `daily_logs`, `lab_results`, `appointments` (to know the next OB/GYN date)
- NO new tables.

### Component plan
- Report sections:
  1. Patient summary (name, age, active diagnoses from `active_problems`)
  2. Cycle length history (last 12 cycles: start date, length, flow days)
  3. Predicted next period with confidence window
  4. Flow pattern (light/medium/heavy day distribution from cycle_entries)
  5. Luteal phase length (flag if <10 days in any of the last 6 cycles)
  6. Top symptoms by phase (pulled from Feature 1 correlation cache if present, otherwise basic counts)
  7. Recent relevant labs (TSH, iron, vitamin D, sex hormones if present)
  8. Questions for your OB/GYN (editorial, checkbox list Lanae can print and annotate)
- Print-friendly CSS (no navbar, page break rules)
- "Open print dialog" button

### Acceptance criteria
1. `/doctor` page exposes "Generate Cycle Report" button
2. Clicking loads CycleReportView with all 8 sections populated from Lanae's real data
3. Empty sections degrade gracefully ("not enough data yet" rather than fabricating)
4. Short luteal phase flag renders visibly when triggered
5. Print dialog produces a clean 2-to-3 page PDF via browser print
6. No cycle data leaves our server (report is rendered client-side from API payload)
7. Available before Apr 30 OB/GYN appointment

### Verification plan
1. Query Lanae's appointments table for the Apr 30 OB/GYN row; confirm it exists
2. Run the API route locally, inspect JSON payload shape
3. Load `/doctor` on port 3005, generate report, confirm all sections populate
4. Print preview; ensure page breaks are sane, no clipping
5. Add vitest coverage for `cycle-report.ts`: normal cycle fixture, short luteal fixture, sparse data fixture, anovulatory fixture
6. Manual review of the "Questions for your OB/GYN" list (no leading questions, neutral phrasing)

### Risks
- Clinical interpretation creep. We must present data, not diagnose. Mitigation: every computed flag (short luteal, long cycle) phrased as "may be worth discussing with your provider" never as a diagnosis.
- nc_imported is read-only; if phase labels are missing for some days, cycle length math still needs to work. Mitigation: use cycle_entries period start dates as the authoritative cycle boundary, fall back to nc_imported.
- PDF fidelity across browsers. Mitigation: rely on browser print rather than server-side PDF for v1; revisit if user complaints arise.

---

## Cross-cutting notes

- All three features ship on branch `feat/flo-cycle-intelligence` or split into three sub-branches per design-decisions.md Section 5.
- No Claude API calls added in Feature 1 or 3; Feature 2 does not call Claude either (static content). Context engine untouched.
- Migration 013 is the only new schema for this push.
- Run `npm run build`, `npm test`, and migration via `scripts/run-migration.mjs` before merge (per Section 13 Done Definition).
- Screenshots captured at `/patterns`, `/`, and `/doctor` on port 3005 attached to PR.
