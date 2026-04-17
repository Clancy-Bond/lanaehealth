# Guava Health - Implementation Notes

Top 3 features from plan.md. All three are Medium effort, read-only on existing tables, no migrations required.

---

## 1. Multi-Specialist Unified Timeline (enhanced)

**File targets**
- Modify: `src/app/timeline/page.tsx` (existing)
- New: `src/components/timeline/TimelineFilters.tsx` (provider facet + type filter + date range)
- New: `src/components/timeline/TimelineEvent.tsx` (per-row renderer, color-coded by specialty)
- New: `src/components/timeline/TimelineProviderLegend.tsx` (color key for specialties)
- New server-side assembler: `src/lib/api/timeline.ts` (merges appointments + medical_timeline + lab_results + imaging_studies + active_problems into a single chronological feed)

**Data model**
- READ-ONLY from existing tables:
  - `appointments` (5 rows for Lanae)
  - `medical_timeline` (7 events)
  - `lab_results` (52 tests)
  - `imaging_studies` (2 studies)
  - `active_problems` (6 problems - used for context chips, not timeline rows)
- No schema changes. No migration.

**Component plan**
- New `TimelineFilters` for facet controls
- New `TimelineEvent` component with variant prop (`appointment` | `lab` | `imaging` | `milestone`)
- Reuses existing design tokens (colors, radius, shadow) per design-decisions.md section 5
- Provider color map in `src/lib/provider-colors.ts` - sage for PCP, blush for OB/GYN, deep-plum for cardio, warm-amber for neurology, slate for IM. Map to existing CSS vars where possible. No raw hex.
- Default view: last 3 months. Toggle for "all time" and "custom range".
- Empty state if no events in selected range.

**Acceptance criteria**
- Page renders all 7 medical_timeline events, 5 appointments, 2 imaging studies, and at least one lab entry per month in Lanae's history
- Provider filter chips show only specialties present in Lanae's data (not a hardcoded full list)
- Color coding is consistent across all event types
- Clicking a lab event opens a sparkline preview (links to feature 3)
- Mobile responsive at 375px width
- Loads in under 1 second on Lanae's Supabase

**Verification plan**
- Run `npm run build` - must pass
- Load `/timeline` on port 3005 - must show real data, not empty
- Toggle filters - verify counts match expected (e.g., only PCP filter shows 1 appointment Apr 13 2026)
- Screenshot top and middle of scroll, attach to this file
- Verify "all time" shows 2022-2026 range correctly

**Risks**
- Date sort bugs if any record has null or malformed timestamp
- Performance: 52 lab rows + 7 events + 5 appointments = 64 rows, trivial. Scale risk only if user imports multi-decade history.
- Color mapping assumes known specialties. Unknown provider defaults to slate gray.
- Prefer server-side merge in `src/lib/api/timeline.ts` over client-side to keep bundle size down.

---

## 2. Pre-Visit Doctor Prep Sheet

**File targets**
- Modify: `src/app/doctor/page.tsx` (add "Upcoming Visits" section with link to pre-visit view)
- New: `src/app/doctor/pre-visit/[appointmentId]/page.tsx`
- New: `src/app/api/doctor/pre-visit/[appointmentId]/route.ts` (server generation, calls context assembler)
- New: `src/components/doctor/PreVisitTop3.tsx` (compressed top-3 view)
- New: `src/components/doctor/PreVisitFullPacket.tsx` (expanded full view)
- New: `src/components/doctor/PreVisitScreenMode.tsx` (large-text phone-to-clinician display)
- New: `src/lib/api/pre-visit.ts` (assembles context: recent symptoms, active problems, new labs, questions, follow-ups from last visit)

**Data model**
- READ-ONLY from:
  - `appointments` (target visit + last visit with same provider)
  - `daily_logs` (last 30 days symptoms)
  - `lab_results` (results since last visit)
  - `active_problems` (current open problems)
  - `medical_timeline` (recent events)
  - `chat_messages` (patient-flagged questions with a "for doctor" tag if we add it - see Risks)
- No new tables. No migration.

**Component plan**
- Pre-visit page at `/doctor/pre-visit/[appointmentId]`
- Server component fetches appointment by ID, runs assembler, returns structured JSON
- Tab switcher: "Top 3" | "Full Packet" | "Screen Mode"
- Top 3 uses Claude with specialty-aware system prompt (cardio visits prioritize cardiovascular markers, OB/GYN prioritize cycle + pelvic pain)
- System prompt lives in `src/lib/context/specialty-prompts.ts`
- Static/Dynamic boundary enforced. Prompt caching ON per CLAUDE.md rule.
- Model: `claude-sonnet-4-6`
- Every claim in the summary must cite source. Claims without source evidence must be suppressed. This is the Guava hallucination risk mitigation.
- Screen mode: large-type list, high contrast, works at arm's length

**Acceptance criteria**
- `/doctor` page shows upcoming visits from appointments table
- Clicking an appointment opens `/doctor/pre-visit/[id]`
- Top 3 mode returns exactly 3 bullet points, each with a source cite
- Full packet mode returns a structured view: symptoms delta, labs delta, questions, meds, follow-ups
- Screen mode renders at minimum 18pt equivalent, high contrast
- Loads in under 4 seconds (Claude API call)
- Works for Lanae's 5 upcoming appointments (PCP Apr 13, OB/GYN Apr 30, IM Jun 5, Cardio Aug 17, MRI Apr 2027)

**Verification plan**
- Run `npm run build` - must pass
- Run `npm test` - add 2 tests: specialty prompt selection, citation enforcement
- Manually verify against Lanae's appointments in Supabase
- Generate for OB/GYN Apr 30 visit - verify it surfaces cycle + pelvic pain themes
- Generate for Cardio Aug 17 - verify it surfaces POTS pulse data (Standing 106 bpm, resting 48)
- Screenshot each mode, attach to this file

**Risks**
- LLM hallucination. Mitigation: cite-every-claim enforcement, suppress any bullet without source citation. A final pass must validate cites exist in the retrieved data.
- Performance on Claude API call. Use caching for static portion per our static/dynamic boundary rule.
- Specialty inference from provider name. Fallback: ask user to confirm specialty once per provider, store in local prefs.
- Question-tagging in chat_messages may need a `tagged_for_next_visit` column or metadata field. Stop and flag if so - this triggers Red Flag Rule 1 from design-decisions.md section 12. Alternative: use a separate lightweight `doctor_questions` table (would need migration - paused until decided).

---

## 3. Multi-Year Lab Trend Sparklines

**File targets**
- Modify: `src/app/records/page.tsx` (add sparkline preview in lab list)
- New: `src/components/records/LabSparkline.tsx` (Recharts LineChart with reference range shading)
- New: `src/components/records/LabTrendCard.tsx` (card wrapper with delta badge)
- New: `src/components/records/LabOverlayChart.tsx` (multi-marker overlay, e.g., TSH + FT4 + TPO together)
- New: `src/lib/api/lab-trends.ts` (groups lab_results by test_name, computes patient baseline, flags deltas)
- Possibly new: `src/lib/clinical-scales.ts` extensions if any new reference range logic needed (check first - do not duplicate existing)

**Data model**
- READ-ONLY from `lab_results` (52 rows for Lanae)
- Group by test_name, sort by date. Compute patient-baseline mean and standard deviation for each test. Flag current value deltas from baseline.
- Reference ranges come from existing `lab_results.reference_range` column where populated. Fallback to per-test defaults stored in a lookup (NOT a new table - use a static constant in `src/lib/lab-reference-ranges.ts`).
- No schema changes. No migration.

**Component plan**
- `LabSparkline`: stateless, takes array of {date, value} and optional range. Uses Recharts.
- IMPORTANT: per CLAUDE.md and design-decisions.md, use `useRef` explicit width measurement, NOT `ResponsiveContainer`. Recharts SSR quirk.
- `LabTrendCard`: sparkline + current value + delta badge + "view history" expand
- `LabOverlayChart`: related-marker overlay mode. Initial overlays: thyroid panel (TSH, FT4, FT3, TPO), lipid panel (LDL, HDL, TG, Total), iron panel (Ferritin, Iron, TIBC, Transferrin sat), inflammation (CRP, ESR)
- Delta badge: `--pain-none` through `--pain-extreme` severity scale repurposed: green if in range and stable, yellow if drifting, orange if near threshold, red if crossed
- Always use CSS vars, never raw hex per design rules

**Acceptance criteria**
- `/records` page shows lab list with inline sparklines
- Clicking any lab opens detail view with full trendline and reference range shaded
- Overlay view for thyroid panel shows all 4 markers on one chart
- Lanae's TSH of 5.1 triggers yellow delta badge (reference 0.5 to 4.5)
- Lanae's total cholesterol 286 triggers red delta badge (reference under 200)
- Mobile responsive at 375px (sparkline collapses to sparkbar)
- Reference ranges correct for at least her 10 most recent labs

**Verification plan**
- Run `npm run build` - must pass (Recharts SSR the #1 risk)
- Run `npm test` - add test for delta classification logic
- Load `/records` on port 3005 with real data
- Verify TSH panel: 5.1 should show yellow, sparkline trending up from 2024 baseline
- Verify cholesterol panel: 286 should show red
- Screenshot lab list and a detail view, attach to this file
- Check that sparkline renders on first page load (no hydration jump)

**Risks**
- Recharts SSR. Memory bank flag: use useRef, not ResponsiveContainer.
- Reference range mismatches between labs. Fallback: use standard adult reference if row-level range missing.
- Baseline computation unstable with fewer than 3 historical values. Mitigation: show the sparkline but suppress the delta badge until 3+ values exist.
- Unit inconsistency if Lanae ever imports international data. Lanae is US-only today, defer.
- Performance: 52 labs across ~10 test names, trivial render load.

---

## Shared risks and cross-feature concerns

1. All three features depend on existing read-only tables. No migrations. No Red Flag triggers unless the question-tagging in feature 2 needs a new column.
2. None touch `src/lib/context/` core infra beyond calling the assembler for feature 2.
3. All three respect the design system: cream/blush/sage, CSS vars, rounded corners, no em dashes.
4. All three should be shippable on a single feature branch `feat/guava-health-batch` or split into three: `feat/guava-timeline`, `feat/guava-pre-visit`, `feat/guava-lab-trends`. Recommend split for reviewability.
5. Claude API usage: only feature 2 uses Claude. Features 1 and 3 are pure data presentation.
6. Each implementation should complete the Done Definition in design-decisions.md section 13 before claiming "shipped".

## Matrix row proposals

Proposed rows for `docs/competitive/matrix.md`:

| Feature | Origin app | Exists? | Planned? | Status | Impact | Effort | Owner | Code location | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Multi-Specialist Unified Timeline | Guava Health | Partial | Y | Researched | 5 | M | TBD | src/app/timeline | Enhance existing minimal timeline page |
| Pre-Visit Doctor Prep Sheet | Guava Health | N | Y | Researched | 5 | M | TBD | src/app/doctor/pre-visit | Subroute of existing /doctor |
| Multi-Year Lab Trend Sparklines | Guava Health | Partial | Y | Researched | 5 | M | TBD | src/app/records | Adds to existing records page |
| Condition Network Graph | Guava Health | N | Y | Researched | 4 | L | TBD | src/app/patterns | Deferred past top 3 |
| Family History Tree | Guava Health | N | Y | Researched | 4 | L | TBD | src/app/profile | Needs migration 013 |
| Voice Symptom Capture | Guava Health | N | Y | Researched | 4 | M | TBD | src/app/log | Web Speech API |
| Second Opinion PDF Assembly | Guava Health | N | Y | Researched | 4 | L | TBD | src/app/doctor or /records | Cite-every-claim enforcement |
| Insurance Denial Tracker | Guava Health | N | N | Researched | 3 | L | TBD | TBD | Deferred |
| Generic Record Upload + Parse | Guava Health | Partial | N | Researched | 3 | XL | TBD | scripts/parse-ccd-import.mjs | Mostly covered by existing CCD parser |
| Privacy Posture Docs | Guava Health | N | Y | Researched | 3 | S | TBD | /privacy page | Docs task, not app feature |

Main session to merge into matrix.md.
