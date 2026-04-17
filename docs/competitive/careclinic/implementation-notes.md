# CareClinic - Implementation Notes (Top 3)

File targets use absolute paths. Data model additions follow the additive-migration rule (existing tables read-only). Each feature has acceptance criteria verifiable against Lanae's real Supabase data.

Current migration count: inspect `/Users/clancybond/lanaehealth/src/lib/migrations/` to determine highest existing number before assigning new ones. Placeholder numbers below assume `0NN` as next-available.

---

## Feature 1: Cover-page-first clinical PDF with per-section toggles

### File targets

- MODIFY `/Users/clancybond/lanaehealth/src/lib/reports/clinical-report.ts`
  - Add `generateCoverPage(doc, data)` function that renders page 1 with patient identity, diagnoses, meds, allergies, period, generated timestamp.
  - Refactor main `generateClinicalReport` to accept a `sections: ReportSectionToggles` argument controlling which sections to include.
  - Strip "EndoTracker Clinical Report" title; replace with "Clinical Report - [Patient Name]" and no app branding.
  - Add a footer on every page with page number + patient name + DOB (top-right, small helvetica 8pt gray).
- MODIFY `/Users/clancybond/lanaehealth/src/lib/reports/report-data.ts`
  - Ensure ReportData carries patient identity block (currently only summary stats).
- NEW `/Users/clancybond/lanaehealth/src/components/doctor/ExportModal.tsx`
  - Modal triggered from DoctorClient's FileDown button.
  - Checkbox list of report sections (Cover, Summary, Symptoms, Pain, Vitals, Oura, Cycle, Labs, Medications, Correlations, Journal, Appointments, Care Team, Timeline).
  - "Filter by specialist" row that pre-selects sections via SpecialistToggle's existing bucket config.
  - Date-range selector (last 30, last 90, custom).
  - Primary button: Generate PDF.
- MODIFY `/Users/clancybond/lanaehealth/src/components/doctor/DoctorClient.tsx`
  - Replace existing FileDown button handler with opening ExportModal.
  - Pass current SpecialistView to pre-filter sections.
- MODIFY `/Users/clancybond/lanaehealth/src/app/api/reports/doctor/route.ts`
  - Accept `sections` and `specialist` query params; forward to generator.

### Data model

- Read-only pass. No new tables, no migration. All data sourced from existing tables.

### Component plan

- REUSE: `SpecialistToggle`, all data-fetching in `page.tsx`, existing `clinical-report.ts` PDF primitives.
- NEW: `ExportModal`, `generateCoverPage`, `ReportSectionToggles` type.

### Acceptance criteria

1. Clicking the FileDown icon in DoctorClient opens ExportModal.
2. Modal shows checkbox list of sections with current specialist's recommended subset pre-checked.
3. Date range defaults to "Since last appointment" (computed from `lastAppointmentDate` in DoctorPageData).
4. Clicking Generate downloads a PDF whose page 1 is the cover page (name, age, sex, DOB if stored, blood type, allergies, current meds, current diagnoses, reporting period).
5. Only checked sections appear in the PDF.
6. No app branding in the PDF body; no "EndoTracker" or "LanaeHealth" strings.
7. Page footer on every page: "Lanae A. Bond - Page X of Y".

### Verification plan

- Local dev at port 3005, navigate to /doctor, click export, generate PDF for last 90 days, open locally.
- Verify cover page renders with Lanae's actual patient data (24F, A+, known allergies from health_profile).
- Toggle specialist to "cardiology", verify Cycle section auto-unchecks and Vitals auto-checks.
- Toggle specialist to "obgyn", verify Cycle re-checks.
- Generate a 30-day vs 90-day PDF and confirm period header differs.

### Risks

- jsPDF Helvetica rendering across platforms. Already in use, low risk.
- Section pre-selection logic for specialist views needs test cases per specialist or it silently ships wrong defaults.
- Some sections depend on data Lanae may not have for the selected period (e.g., cycle entries). Empty-section handling must be "skip section, do not print placeholder", not "render empty section".

---

## Feature 2: Care Card (1-page emergency summary + expiring QR share)

### File targets

- NEW `/Users/clancybond/lanaehealth/src/app/doctor/care-card/page.tsx`
  - Server component. Fetches patient identity, diagnoses, meds, allergies, emergency contact, blood type.
  - Renders a 1-page layout optimized for print to wallet card (3.5 x 2 inches) or full page.
- NEW `/Users/clancybond/lanaehealth/src/components/doctor/CareCard.tsx`
  - Client component. Layout with patient photo placeholder, name, DOB, blood type, diagnoses (top 5), current meds (top 5), allergies, emergency contact, insurance member ID, and a QR code.
  - "Print wallet size" and "Print full page" buttons.
- NEW `/Users/clancybond/lanaehealth/src/app/api/share/care-card/route.ts`
  - POST: generate a signed token with 7-day expiration, return a public URL.
  - GET with token: return the Care Card as HTML (read-only), verifying token signature + expiry.
- NEW `/Users/clancybond/lanaehealth/src/app/share/[token]/page.tsx`
  - Public-accessible route that renders the Care Card for a valid token.
- NEW `/Users/clancybond/lanaehealth/src/lib/share/tokens.ts`
  - HMAC-signed token generation and verification. Uses SUPABASE_JWT_SECRET.
- MODIFY `/Users/clancybond/lanaehealth/src/components/doctor/DoctorClient.tsx`
  - Add a "Care Card" button near FileDown that links to `/doctor/care-card`.
- NEW table migration `/Users/clancybond/lanaehealth/src/lib/migrations/0NN-share-tokens.sql`
  - `share_tokens(id uuid pk, token_hash text unique not null, resource_type text not null, expires_at timestamptz not null, created_at timestamptz default now(), revoked_at timestamptz)`.

### Data model

- NEW table `share_tokens` (additive). Stores hashed tokens (not plaintext) with expiration and optional revocation.
- Resource_type values for this feature: `'care_card'`. Extensible later for full-report share.
- Existing tables: read-only. Care Card sources data from `health_profile`, `active_problems`, `health_profile.medications`, `health_profile.allergies`.

### Component plan

- NEW: CareCard, care-card/page.tsx, share/[token]/page.tsx, tokens.ts, api/share/care-card/route.ts.
- REUSE: patient identity fetch pattern from `/doctor/page.tsx`.

### Acceptance criteria

1. Navigating to `/doctor/care-card` renders a print-optimized 1-page summary with Lanae's actual data.
2. "Print wallet size" applies a 3.5 x 2 inch CSS print layout.
3. Clicking "Generate share link" creates a signed URL that expires in 7 days.
4. Visiting the shared URL (unauthenticated) shows the Care Card in read-only HTML.
5. After 7 days, the same URL returns 410 Gone.
6. Revoking a token (future admin action) invalidates the URL immediately.
7. The QR code on the printed card encodes the shared URL.

### Verification plan

- `npm run build` passes.
- Navigate to /doctor/care-card on port 3005 and verify patient data renders.
- Print preview in Chrome, check wallet and full-page layouts.
- Generate a share link, open in an incognito tab, verify unauthenticated access works.
- Manually adjust `expires_at` in Supabase to simulate expiration, verify 410 response.

### Risks

- QR code library dependency (qrcode or qrcode.react). Add to package.json.
- Token security: use HMAC SHA-256, compare in constant time, never log full tokens.
- Unauth route must NEVER render any data outside the Care Card scope. Component must be strictly bounded.
- Supabase RLS: share route must use service client since it has no user session, but must only query the authorized patient's data (in Lanae's case, single-patient app, but make this explicit to prevent leaks).

---

## Feature 3: Condition-tagging for symptoms + condition-filtered views

### File targets

- NEW migration `/Users/clancybond/lanaehealth/src/lib/migrations/0NN+1-symptom-conditions.sql`
  - `symptom_conditions(id uuid pk, symptom_id uuid not null references symptoms(id) on delete cascade, condition_id uuid not null references active_problems(id) on delete cascade, created_at timestamptz default now(), unique(symptom_id, condition_id))`.
  - Index on `symptom_id`, index on `condition_id`.
- NEW `/Users/clancybond/lanaehealth/src/lib/api/symptom-conditions.ts`
  - `getConditionsForSymptom(symptomId: string)`, `tagSymptomWithConditions(symptomId, conditionIds[])`, `getSymptomsForCondition(conditionId, dateRange)`.
- MODIFY `/Users/clancybond/lanaehealth/src/lib/api/symptoms.ts`
  - Extend symptom fetch to include optional joined condition tags.
- NEW `/Users/clancybond/lanaehealth/src/components/log/ConditionChipSelector.tsx`
  - Multi-select chip UI showing all of Lanae's active_problems as chips.
  - Rendered inline under the symptom log form.
- MODIFY `/Users/clancybond/lanaehealth/src/components/log/SymptomLogger.tsx` (or equivalent current log-page symptom UI)
  - Embed ConditionChipSelector below the severity slider.
  - On save, call tagSymptomWithConditions with selected IDs.
- MODIFY `/Users/clancybond/lanaehealth/src/components/doctor/DataFindings.tsx`
  - If a SpecialistView is active and has mapped conditions, filter symptoms list to only those tagged with the mapped conditions.
- MODIFY `/Users/clancybond/lanaehealth/src/lib/doctor/specialist-config.ts`
  - Add `relevantConditions: string[]` per specialist view. Examples: pcp => all, obgyn => endo, cardiology => POTS.
- MODIFY `/Users/clancybond/lanaehealth/src/components/doctor/QuickTimeline.tsx`
  - Accept optional condition filter; when active, only render events tagged to that condition.

### Data model

- NEW table `symptom_conditions` (additive junction between `symptoms` and `active_problems`).
- `symptoms` table remains read-only (no schema change).
- `active_problems` remains read-only.
- No destructive operations anywhere.

### Component plan

- REUSE: SpecialistToggle, DataFindings, QuickTimeline.
- NEW: ConditionChipSelector, symptom-conditions API module.

### Acceptance criteria

1. Logging a symptom on /log offers a ConditionChipSelector populated with Lanae's 6 active_problems.
2. Saving the symptom creates rows in `symptom_conditions` for each selected condition.
3. On /doctor, toggling SpecialistToggle to "cardiology" filters DataFindings to show only symptoms tagged with POTS and other cardiology-mapped conditions.
4. Untagged symptoms remain visible under "pcp" view (catch-all).
5. Backfill-friendly: existing symptoms without tags are treated as tagged to "all conditions" (no orphaning).
6. Migration is idempotent (safe to run twice).

### Verification plan

- Run migration via `scripts/run-migration.mjs 0NN+1-symptom-conditions.sql` on Lanae's Supabase.
- Verify table created, no rows modified in `symptoms` or `active_problems`.
- Log a new symptom with 2 condition tags on port 3005; verify rows appear in `symptom_conditions`.
- Toggle SpecialistToggle through pcp, obgyn, cardiology on /doctor; verify DataFindings filters correctly.
- Confirm older untagged symptoms remain visible under pcp view (catch-all).
- Run vitest suite; add tests for `getSymptomsForCondition` with empty, single, multi-condition cases.

### Risks

- If a symptom is tagged to 0 conditions, specialist views might hide it entirely. Mitigation: "pcp" is an explicit catch-all that ignores tag filter.
- Cascade on active_problems deletion. Since active_problems is effectively append-only for our use, cascade is safe, but document it.
- Backfill: do NOT auto-tag existing symptoms. Leave un-tagged, treat as "all conditions" for display until Lanae manually tags them.
- UI clutter: ConditionChipSelector must collapse to a single button when no conditions are selected; expand on click.
