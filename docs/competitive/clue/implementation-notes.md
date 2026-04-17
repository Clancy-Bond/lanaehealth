# Clue -- Implementation Notes for Top 3 Features

Last updated: 2026-04-16

Each feature below is implementation-ready. File targets are absolute paths. Migrations follow the sequential numbering rule. All existing tables remain read-only.

---

## Feature 1: Uncertainty-honest cycle prediction

### File targets

- Create: `src/components/patterns/CyclePredictionCard.tsx` (new)
- Create: `src/components/patterns/PredictedVsConfirmedLegend.tsx` (new)
- Modify: `src/app/patterns/page.tsx` to render the new card
- Modify: `src/lib/api/cycle.ts` to return a prediction object shaped `{ nextPeriodCenter, rangeStart, rangeEnd, confidenceLabel, reason }`
- Modify (light): `src/lib/intelligence/cycle-intelligence.ts` (or equivalent file in `src/lib/intelligence/`) to compute range from signal strength. If the file does not yet exist, create it at that path.

### Data model

- No schema changes. All existing cycle data is read-only.
- Runtime object only: `CyclePrediction = { nextPeriodCenter: Date, rangeStart: Date, rangeEnd: Date, confidenceLabel: 'high' | 'medium' | 'low', contributingSignals: string[], reason?: string }`
- Signal sources (already in DB): `oura_daily` (temp, HRV, RHR), `nc_imported` (BBT), `cycle_entries` (logged periods), `daily_logs` (LH surge, mucus if tracked).

### Component plan

- New card shows: big centered date = `nextPeriodCenter`. Below: "+/- N days" from range. Below: a small sparkline or day-chip row showing past 14 and future 14 days. Past = solid fill in phase color. Future = dashed outline in same hue at 40% opacity.
- Plain-language reason appears only when confidenceLabel is medium or low. Example: "Predictions have wider range because your last two cycles varied by more than 5 days."
- Confidence label drives the width of the range and the phrasing of the reason.
- Use design tokens only: `--phase-menstrual`, `--radius-lg`, `--shadow-sm`, `--text-xs`. No raw hex.

### Acceptance criteria

1. Patterns page renders a card with a predicted center date, a dashed range, and a legend (solid = confirmed, dashed = predicted).
2. When Lanae's last 3 cycles have stdev > 5 days, the reason text appears.
3. No em dashes in any copy.
4. Zero changes to `cycle_entries` schema or rows.

### Verification plan

1. Pull Lanae's last 6 months of `cycle_entries` + `oura_daily` via existing `src/lib/api/cycle.ts`.
2. Render patterns page at `http://localhost:3005/patterns`.
3. Confirm the prediction center matches manual calculation (average cycle length since last period start).
4. Confirm the range widens when `oura_daily` temperature data is missing for > 7 days.
5. Unit test `src/lib/intelligence/cycle-intelligence.ts` with fixtures for (a) regular cycles, (b) irregular cycles, (c) sparse signals.

### Risks

- If cycle-intelligence module does not exist yet, creating it could conflict with a future subagent. Pause and report if the file exists with different shape.
- Visual dashed-vs-solid may clash with Recharts defaults. Confirm we can style chart strokes dashed, or use pure divs for the day-chip row.
- SSR width issue: if we use any chart, follow the useRef-measured-width pattern, NOT ResponsiveContainer.

---

## Feature 2: Privacy settings page with granular consent and full data export

### File targets

- Create: `src/app/settings/privacy/page.tsx`
- Create: `src/components/settings/PrivacyToggles.tsx`
- Create: `src/components/settings/DataExportButton.tsx`
- Create: `src/app/api/export/route.ts` (server route that builds a ZIP of CSV + JSON)
- Modify: `src/app/settings/page.tsx` to link to the new privacy sub-page
- Create: `src/lib/api/privacy-prefs.ts` (server-side data access for the new preferences table)

### Data model

- New migration file: `src/lib/migrations/0XX-privacy-prefs.sql` (number = highest existing + 1).
- Additive only. Create `privacy_prefs` table:

  ```sql
  CREATE TABLE privacy_prefs (
    user_id uuid PRIMARY KEY,
    allow_claude_context boolean NOT NULL DEFAULT true,
    allow_correlation_analysis boolean NOT NULL DEFAULT true,
    long_term_storage boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ```

- No modification to existing tables.
- Export endpoint reads from all existing tables (read-only) and returns a ZIP.

### Component plan

- Privacy page shows three toggles with plain-text explanations beneath each (two sentences each, no jargon).
- Below toggles: a "Download all my data" button. Clicking builds a ZIP in the server route and returns it with `Content-Disposition: attachment`.
- Trust signals block: a static list of three bullets (data stays in your Supabase, no third-party sharing, full export anytime).
- Copy voice: warm, second person. Example toggle label: "Let Claude see your context." Explanation: "When on, Claude can use your logs to give you personalized answers. When off, conversations stay generic. Your data never leaves your Supabase either way."

### Acceptance criteria

1. `/settings/privacy` renders three toggles, loads current values from `privacy_prefs`.
2. Toggling writes to `privacy_prefs` via `src/lib/api/privacy-prefs.ts`.
3. Download button produces a ZIP with CSVs for each existing table Lanae has data in, plus a `README.txt` explaining contents.
4. Page never uses em dashes.
5. `allow_claude_context = false` actually shortcuts the context assembler at `src/lib/context/assembler.ts` so no user data is injected when disabled.

### Verification plan

1. `npm run build` passes.
2. Run migration via `scripts/run-migration.mjs`.
3. Manually toggle each preference, verify row in Supabase updates.
4. Click download, open ZIP, confirm files: `daily_logs.csv`, `cycle_entries.csv`, `oura_daily.csv`, `lab_results.csv`, `appointments.csv`, `food_entries.csv`, `symptoms.csv`, `pain_points.csv`, plus `README.txt`.
5. Confirm JSON export is byte-for-byte reproducible (deterministic ordering).
6. Screenshot settings page at port 3005 and attach here.

### Risks

- `chat_messages` may contain copies of personal context. Decide: include in export? Include by default, with a toggle to exclude.
- Export size. Lanae has ~5,781 food entries + 1,490 daily logs + 1,187 Oura days. Estimate under 10 MB total, acceptable for browser download.
- `allow_claude_context = false` must be read BEFORE context assembler fetches anything, otherwise toggling is cosmetic. Put the check at the top of `assembler.ts`.

---

## Feature 3: Anovulatory cycle detection flag

### File targets

- Modify: `src/lib/intelligence/cycle-intelligence.ts` (same file as feature 1) to add an `anovulatoryFlag(cycle)` function
- Modify: `src/lib/api/cycle.ts` to include an `anovulatory` boolean on each historical cycle object
- Create: `src/components/patterns/AnovulatoryBadge.tsx`
- Modify: `src/app/patterns/page.tsx` (same file as feature 1) to render the badge next to any cycle flagged anovulatory
- Modify: doctor report generator (path: `src/lib/api/doctor-report.ts` or `src/components/doctor/`) to include anovulatory cycle count in the summary. If the exact path does not exist, pause and ask main session.

### Data model

- No new tables.
- Write detection results to existing `correlation_results` table as rows with `pattern_type = 'anovulatory_cycle'`. This table is additive-only.
- Row shape: `{ pattern_type: 'anovulatory_cycle', cycle_start: date, confidence: 0-1, signals: jsonb, created_at: now() }`.

### Component plan

- Small badge with sage background, label "No ovulation detected this cycle."
- Tap badge opens a modal with reassuring copy: "This can happen occasionally, especially with stress, illness, or irregular cycles. If it happens in 3 or more cycles, consider mentioning to your doctor."
- Modal cites the signals that led to the flag (no BBT shift + no LH surge + RHR flat).

### Acceptance criteria

1. A cycle with no detected ovulation shows a badge in the patterns view.
2. Tapping badge opens an explanation modal.
3. Doctor report counts anovulatory cycles and includes in the summary.
4. `correlation_results` gets a new row per anovulatory cycle detected, idempotent (do not duplicate).
5. Honest copy, no em dashes, second person.

### Verification plan

1. Pick a Lanae cycle with known BBT/temp absence. Verify flag fires.
2. Pick a Lanae cycle with a clear biphasic shift. Verify NO flag fires.
3. `SELECT * FROM correlation_results WHERE pattern_type = 'anovulatory_cycle'` matches the flagged cycles.
4. Open doctor report, confirm anovulatory count appears in summary.
5. Screenshot at port 3005 attached here.

### Risks

- False positives if Oura temperature is missing. Gate detection: require at least 10 of 28 days of temp data to flag. Below that, show a "insufficient data" state instead.
- Must not retroactively modify cycle phase labels in existing tables. Use `correlation_results` only.
- User anxiety. The modal copy must be reassuring and specific about when to consult a doctor (3+ cycles).

---

## Cross-feature notes

- All three features share `src/lib/intelligence/cycle-intelligence.ts`. Implement features 1 and 3 in a single branch `feat/clue-cycle-honesty` to avoid merge conflicts. Feature 2 is independent, branch `feat/clue-privacy-export`.
- All copy uses voice tokens from `design-decisions.md` section 5. No em dashes. Second person. Plain language.
- No feature modifies any existing Supabase row. Only additive reads and new-table writes.
