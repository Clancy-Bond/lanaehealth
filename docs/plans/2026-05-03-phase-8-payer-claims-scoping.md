# Phase 8 Payer Patient Access API: Scoping + Operator Runbook

**Date:** 2026-05-03
**Status:** Scaffold landed. Going live blocked on payer dev-portal signups (no code work).
**Branch:** `claude/phase-8-payer-claims`
**Reference connector:** `src/lib/integrations/connectors/cms-blue-button.ts`

---

## Why this exists

Phase 1-7 of the medical-data-aggregation plan brings in **clinical** data (what the doctor wrote in the chart) via Apple Health Records, SMART on FHIR, aggregators, email-ingest, and AI capture. None of those carry **claims** data: the parallel record of what insurance was billed for, going back years, including visits and procedures that never produced a clean EHR note.

myFHR by CareEvolution is the clearest proof point that a single patient timeline can unify both lanes. The Phase 8 work brings us to feature parity on the data-shape side. The federal infrastructure exists by mandate; the work is in the consent flow.

## The two ingestion lanes, side by side

| Lane | Source | Returns | OAuth audience | Identity | When it wins |
|---|---|---|---|---|---|
| Provider Patient Access (Phase 2 + 5) | EHR -> patient | Observation, Condition, MedicationRequest, AllergyIntolerance, Immunization, Procedure, Encounter, DiagnosticReport, Patient | The hospital's portal user | `patient` resource id from the EHR | A doctor wrote a structured note about you |
| Payer Patient Access (this phase) | Insurance -> patient | ExplanationOfBenefit, Coverage, Patient (CARIN profiles) | The insurance member portal user | `patient` resource id from the payer | Anything was billed to insurance, regardless of whether the EHR captured it cleanly |

Same parser pipeline downstream. Different consent flow and different OAuth registration upstream.

## Federal mandate and which payers are in scope

The CMS-9115-F final rule (active since 2021, enforcement strengthened Feb 2026) requires the following payers to expose a CARIN-profile FHIR R4 Patient Access API at no cost:

- Medicare Advantage Organizations
- Medicaid Fee-for-Service programs (per state)
- Medicaid Managed Care plans
- ACA exchange Qualified Health Plans
- CHIP

CMS Blue Button 2.0 is the federal exposure for traditional Medicare and the canonical reference implementation. Commercial (employer-sponsored) plans are **not** required, but the largest commercial payers have voluntarily exposed CARIN endpoints because their employer-group customers ask for them.

## Recommended payer list, with sources

| Payer | API status today | Dev portal | Signup path | Notes |
|---|---|---|---|---|
| **CMS Blue Button 2.0** (Medicare) | Live, FHIR R4 v2 | https://bluebutton.cms.gov/developers | Self-serve sandbox, then production-access application | The reference. 64M+ Medicare enrollees. **Connect this first.** |
| **UnitedHealthcare Patient Access** | Live, FHIR R4 | https://www.uhc.com/legal/interoperability-apis/patient-access-api | Optum Flex portal at https://flex.optum.com/portal/homepage; OneHealthcare ID + app-owner registration | Largest commercial payer. PKCE supported. Authorize/token endpoints under `https://flex.optum.com/authz/[payer]/oauth/{authorize,token}`. |
| **Cigna Patient Access** | Live, FHIR R4 | https://developer.cigna.com/docs/service-apis/patient-access | Self-serve sandbox; production application takes "several weeks" per their portal | OAuth 2.0 + FHIR R4. Documentation behind a developer login. |
| **Aetna Interoperability APIs** | Live, FHIR R4 | https://developerportal.aetna.com/fhirapiasegregation | Register at https://developerportal.aetna.com/gettingstarted | Sandbox apps named `sandbox-patientaccessapi-fhir{,a..e}`. Carin code-of-conduct attestation on registration. |
| **HMSA (BCBS Hawaii)** | Live but undocumented externally | https://hmsa.com/help-center/developing-a-mobile-health-app/ | **Email CWS@hmsa.com** to start; not self-serve | Dev portal at `https://io-devportal.hmsa-services.com:8446/HMSADevPortal/`. Patient Access + Provider + Formulary directories. **Likely Lanae's primary commercial payer.** |
| **HMAA** (Hawaii TPA) | Not found | none located | Not published | TPAs administering self-funded employer plans are not always covered by CMS-9115-F. Defer until we see Lanae's plan documents. |
| **Kaiser Permanente Hawaii** | Live (their member-app + Flexpa-validated FHIR endpoint) | Their EHR (Epic MyChart) covers clinical AND claims at the Kaiser-network level | Apple Health Records or SMART-on-FHIR direct via Phase 2 | Integrated payer-provider model means the clinical lane already pulls everything billed inside Kaiser. The CARIN payer endpoint is mostly redundant for Kaiser members. |

For Lanae specifically: we do not know her insurer from data in this codebase. The runbook therefore defaults to two flips:

1. Ship the CMS Blue Button connector as the reference and document it as the path for any user on Medicare.
2. Surface "Add your insurance" with a prompt-driven flow once we know the user's payer name; the registry lookup picks the matching connector or falls back to "your insurer is required to expose this under federal law; if you don't see them here, email us and we'll add it."

We do **not** add a UI card in this PR. The Connections page renders cards from the registry, so registering `cms-blue-button` is enough to make it appear automatically.

## Why claims data is structurally different from clinical EHR data

Three concrete differences for the Doctor Mode brief copy and any user-facing explainer:

1. **Coverage** is timeless: the EHR knows what your doctor noted today, the payer knows the entire history of every encounter you billed to insurance going back as far as their retention window (typically 4-7 years).
2. **Diagnoses** in claims are billing codes (ICD-10), not clinical impressions. They are how your visit was paid for, not necessarily what the doctor concluded. They overlap heavily but are not identical. Useful for spotting events the EHR missed; should not be displayed as "your diagnoses" to the user.
3. **Procedures** in claims are CPT/HCPCS codes with dollar amounts. A claim says "you had blood drawn on 2024-11-04 and the lab billed $187 for these CPTs"; the EHR may or may not have the actual lab result. Together they reconstruct the timeline; either alone has gaps.

The user-facing copy in the connector card should reflect this without being legally fraught: "Your Medicare claims and coverage history. Different from your doctor's chart, this shows everything billed to Medicare." That's what the connector config currently advertises.

## CMS Blue Button 2.0 specifics (the reference)

### Endpoints

- Sandbox authorize: `https://sandbox.bluebutton.cms.gov/v2/o/authorize/`
- Sandbox token: `https://sandbox.bluebutton.cms.gov/v2/o/token/`
- Sandbox FHIR base: `https://sandbox.bluebutton.cms.gov/v2/fhir/`
- Production authorize: `https://api.bluebutton.cms.gov/v2/o/authorize/`
- Production token: `https://api.bluebutton.cms.gov/v2/o/token/`
- Production FHIR base: `https://api.bluebutton.cms.gov/v2/fhir/`

### Scopes

```
openid profile patient/Patient.rs patient/Coverage.rs patient/ExplanationOfBenefit.rs
```

### PKCE

Required. The authorize URL must include `code_challenge` and `code_challenge_method=S256`. The connector accepts a pre-computed challenge via `CMS_BLUE_BUTTON_PKCE_CHALLENGE` and a verifier via `CMS_BLUE_BUTTON_PKCE_VERIFIER`. The shared `/api/integrations/[id]/authorize` route should generate these per session and store them in a signed cookie.

### Resources to fetch

The sync runner pulls in this order:

1. `GET /Patient/{patient_id}` to anchor the bundle
2. `GET /Coverage?beneficiary={patient_id}` for plan info
3. `GET /ExplanationOfBenefit?patient={patient_id}&_count=100` for the claims feed (paginated)

The `patient_id` is delivered in the token response payload as `patient`. We persist it on `IntegrationToken.metadata.patient_id`.

### Access duration

CMS Blue Button issues tokens in three categories:
- 1 hour, no refresh (one-time-use apps)
- 13 months, refreshable (personal-health-aggregator apps -- our category)
- Research, indefinite, IRB-approved studies only

We apply for the **13-month** category. Refresh token rotation is handled by the existing `OAuthManager`.

## Human-action steps to flip Blue Button live

Listed in order.

### 1. Sign up at the CMS Blue Button sandbox
Create a sandbox account at https://sandbox.bluebutton.cms.gov/v2/accounts/mfa/login. This is free and self-serve.

### 2. Register a sandbox app
Inside the sandbox dashboard, create an app:

- Name: "LanaeHealth"
- Redirect URI: `https://lanaehealth.app/api/integrations/cms-blue-button/callback` (production). For local development, also add `http://localhost:3005/api/integrations/cms-blue-button/callback`.
- Production access category: pick **13 months**. Personal health aggregators are explicitly the canonical use case.
- PKCE: enabled.

This issues a **sandbox** `CLIENT_ID` and `CLIENT_SECRET`. Set them in Vercel env:

```
CMS_BLUE_BUTTON_CLIENT_ID=...sandbox...
CMS_BLUE_BUTTON_CLIENT_SECRET=...sandbox...
CMS_BLUE_BUTTON_SANDBOX=true
```

### 3. Verify the sandbox flow end to end
Run the sync against synthetic Medicare data (CMS provides Doctor John Doe etc.) at the sandbox. Watch for:
- Token exchange returns `patient` field
- `Patient/`, `Coverage?beneficiary=`, and `ExplanationOfBenefit?patient=` queries all return 200 with non-empty Bundles
- The connector log shows the EOB-not-yet-parsed warning until the followup parser ships

### 4. Draft and publish the privacy policy + terms of service
CMS production access requires both documents at public URLs. They must:
- Be human-readable (Medicare enrollee audience)
- Detail data use, retention, third-party sharing, and notification on policy change
- Allow active opt-in (no pre-checked agreement)

CMS reviews privacy policy + ToS within five business days when changes are submitted. Published copies must be live before applying.

### 5. Apply for production access
Follow https://bluebutton.cms.gov/production-access/. The application requires:
- Application demo (recorded walkthrough)
- Privacy policy URL
- Terms of service URL
- Attestation that the policies cover the [Blue Button Terms of Service](https://bluebutton.cms.gov/terms/) requirements

CMS reviews in 1-3 weeks for personal-health-aggregator apps. They may ask follow-up questions about data flow.

### 6. Receive production credentials
On approval CMS issues a **production** `CLIENT_ID` and `CLIENT_SECRET`. Update Vercel:

```
CMS_BLUE_BUTTON_CLIENT_ID=...prod...
CMS_BLUE_BUTTON_CLIENT_SECRET=...prod...
CMS_BLUE_BUTTON_SANDBOX=false
```

### 7. Ship the EOB parser follow-up
Today the FHIR parser at `src/lib/import/parsers/fhir.ts` does **not** handle `ExplanationOfBenefit`. The connector logs the count of EOB resources it had to skip as a non-fatal warning. Until the parser extension lands (`docs/plans/2026-05-03-phase-8-followup-eob-parser.md`), Blue Button sync surfaces only Patient + Coverage as parseable records; EOBs are pulled but not yet mapped to canonical records. Live activation of Blue Button without the parser means users see "0 records imported" while we accumulate raw EOB JSON in `import_history`. Recommend not flipping to production until the parser is in.

## How EOB resources should surface in Doctor Mode (followup, NOT in this PR)

Once the parser handles `ExplanationOfBenefit`, the doctor brief at `/v2/doctor` should:

1. Add a "Claims timeline" section under the existing "Recent visits" panel. Pulls from `appointments` rows whose `source` is `cms-blue-button` (or any `cms-*` connector). Shows date, billing provider, claim type (Carrier / Inpatient / Outpatient / Pharmacy), and the primary diagnosis ICD-10 code with display text.
2. Surface a small badge on each existing appointment row when a claim corroborates it, and a different badge when a claim has no matching EHR encounter ("billed but no chart note found").
3. Include claims in the data-completeness footer ("Medicare claims: 92% of last 90 days covered").

The Doctor Mode brief copy when this surface ships should explicitly tell the patient: claims data is what insurance was billed for, not always what the doctor wrote, and ICD-10 codes are accounting tools more than diagnoses. This helps the patient interpret what they see without overestimating the clinical authority of the source.

## "Patient-mediated" pattern

Every payer in this phase uses the same shape: the **member** logs into the **payer's** portal during the OAuth dance, the payer issues the token, and we never touch the member's password or insurance credentials. Different from third-party-mediated bulk access (where we'd have an API key that pulls from a payer for all members). We do not pursue third-party-mediated access; CARIN Patient Access is patient-by-patient.

The OAuth flow is identical for every CARIN payer:

1. User taps "Connect Medicare" (or "Connect United Healthcare", etc.)
2. We redirect to that payer's `/authorize` endpoint with our `client_id`, the user's `redirect_uri`, and PKCE challenge
3. The user authenticates against the payer's member portal (Medicare.gov, member.uhc.com, etc.)
4. The user sees a CARIN-standard scope-confirmation screen ("LanaeHealth wants to access: Patient, Coverage, ExplanationOfBenefit")
5. The payer redirects to our `redirect_uri` with `code` + `state`
6. We POST to the payer's `/token` endpoint with the code + verifier
7. The payer returns `access_token`, `refresh_token`, `patient` (FHIR resource id), `expires_in`
8. We persist on `integration_tokens` and run the first sync

For each new payer, the only file that changes is the connector. UHC, Cigna, Aetna, HMSA each become a one-file copy of `cms-blue-button.ts` with different URLs and (for some) without PKCE. The registry registration is a single line.

## What this PR does NOT do

- No UI card. The registry-driven Connections page picks up the new connector automatically.
- No EOB parser. Locked file (`src/lib/import/**`); see the followup doc.
- No live credentials. The connector is wired but inert until env vars + production access land.
- No second-payer connector (UHC, Cigna, Aetna, HMSA). Those are mechanical copies; recommended order is Blue Button -> HMSA (Lanae's likely insurer) -> UHC (largest by member count) -> Cigna -> Aetna.

## Verification

- `npx tsc --noEmit` clean
- `npx vitest run src/lib/integrations/connectors/__tests__/cms-blue-button.test.ts` passes (7 tests)
- The connector is registered in `src/lib/integrations/registry.ts` and surfaces via `/api/integrations/status`

## Files

- `src/lib/integrations/connectors/cms-blue-button.ts` (new, ~300 lines)
- `src/lib/integrations/connectors/__tests__/cms-blue-button.test.ts` (new, ~210 lines)
- `src/lib/integrations/registry.ts` (modified: register the connector)
- `src/lib/integrations/types.ts` (modified: add `'cms-blue-button'` to `IntegrationId`)
- `docs/plans/2026-05-03-phase-8-followup-eob-parser.md` (new: parser gap)
- `docs/plans/2026-05-03-phase-8-payer-claims-scoping.md` (this file)
