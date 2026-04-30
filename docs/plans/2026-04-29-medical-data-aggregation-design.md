# Medical Data Aggregation: Universal Ingestion Architecture

**Date:** 2026-04-29
**Status:** Design (awaiting implementation plan handoff)
**Author:** Claude (autonomous run)
**Scope:** Whole-product, not Lanae-specific. Every patient. Every provider. Every API. Every fallback.

---

## Why this exists

The product promise is "all your medical data in one place." In practice the patient (Lanae today, every patient eventually) is on calls all day, sets up ten appointments between sync points, and the data never makes it back into the app because manual import is exhausting. We do not have a data problem; we have an ingestion problem. The 21st Century Cures Act (information-blocking enforcement officially turned on in February 2026) and ONC's USCDI v3 mandate (compliance required January 2026) mean that every certified EHR is now legally required to expose patient data via FHIR R4. The infrastructure for *getting* the data exists by federal mandate. The work is in the consent flow, the aggregation, and the fallbacks for everything that isn't a certified EHR (small specialty practices, regional labs, older systems, paper).

We are building a system where, for any user with any combination of providers, the answer to "is your latest data in the app" is always yes — within minutes of the data existing.

## What exists in this codebase today

A surprising amount, and almost none of it is connected to v2:

| Layer | Path | Status |
|---|---|---|
| FHIR R4 parser (Bundles + individual resources) | `src/lib/import/parsers/fhir.ts` | Built. Handles Patient, Observation, Condition, MedicationRequest/Statement, AllergyIntolerance, Immunization, Procedure, DiagnosticReport, Encounter. |
| C-CDA parser (older XML format) | `src/lib/import/parsers/ccda.ts` | Built. |
| PDF parser (text extraction + AI fallback) | `src/lib/import/parsers/pdf.ts` | Built. |
| Screenshot OCR + AI extraction | `src/lib/import/parsers/screenshot.ts` | Built. |
| Generic CSV / generic JSON / text-AI parsers | `src/lib/import/parsers/{generic-csv,generic-json,text-ai}.ts` | Built. |
| Universal import pipeline (format detection → parse → normalize → dedupe → save) | `src/app/api/import/universal/` | Built. |
| Integrations hub (registry, OAuth manager, sync scheduler) | `src/lib/integrations/{hub,oauth-manager,sync-scheduler,registry}.ts` | Built. |
| 8 connectors registered | `src/lib/integrations/connectors/` | Dexcom, Whoop, Garmin, Withings, FHIR Portal (SMART on FHIR), Fitbit, Libre, Strava. |
| Apple HealthKit integration (vitals, sleep, activity) | `src/v2/components/healthkit/HealthKitSyncCard.tsx` via `capacitor-health` | Reads non-clinical samples. Does NOT read `HKClinicalRecord`. |
| Settings UI for integrations | `src/components/settings/IntegrationHub.tsx` | Lives at legacy `/settings#integrations`; not surfaced in v2. |
| App-specific integrations (Oura, Natural Cycles, MyNetDiary) | `src/lib/oura.ts`, `src/app/api/import/{natural-cycles,mynetdiary}/` | Live. |

The bottleneck is not parsing or normalization. The bottleneck is **getting the data into the parsers without manual user action**. That is what this design fixes.

## Architecture

One spine, many spokes. Every ingestion path produces canonical records that flow through the same normalize → dedupe → save pipeline. Adding a new spoke never requires changing the spine.

```
            ┌─────────────────────────────┐
            │   v2 "Connections" UI       │   one screen, every source
            └─────────────┬───────────────┘
                          │
   ┌──────────────────────┼──────────────────────────────────────────┐
   │                      │                                          │
   ▼                      ▼                                          ▼
[ INGESTION PATHS ]   [ INGESTION PATHS ]                    [ INGESTION PATHS ]
                                                              
A. iOS Health Records    C. Aggregator (1upHealth /          E. AI text/photo capture
   (HKClinicalRecord)      Health Gorilla) FHIR proxy
B. SMART on FHIR direct  D. Email-ingest                     F. Manual file upload
   (per-EHR registered)    (Mailgun Route / SES+Lambda)
G. Wearable / app APIs (Oura, NC, Whoop, Dexcom, ...)    H. Browser extension (last resort)
   │                      │                  │                       │
   └──────────────────────┴──────────────────┴───────────────────────┘
                          │
                          ▼
            ┌─────────────────────────────┐
            │  format-detector.ts          │
            │  parser-router.ts            │
            └─────────────┬───────────────┘
                          ▼
            ┌─────────────────────────────┐
            │  parsers/{fhir,ccda,pdf,    │
            │   screenshot,csv,json,      │
            │   text-ai}.ts               │
            └─────────────┬───────────────┘
                          ▼
            ┌─────────────────────────────┐
            │  normalizer.ts → dedupe     │
            │  → write to canonical tables│
            └─────────────────────────────┘
```

### The eight ingestion paths

#### A. iOS Health Records (`HKClinicalRecord`) — biggest single unlock

Apple Health Records aggregates from 12,000+ healthcare institutions on Apple's directory. Once a user adds a provider in the iPhone Health app, the FHIR JSON for that provider's records flows into HealthKit automatically and updates in the background. The current `capacitor-health` plugin does NOT expose `HKClinicalRecord` types — it covers vitals, sleep, activity. We will either fork it or ship a tiny custom Capacitor plugin that adds clinical types: `allergyRecord`, `conditionRecord`, `immunizationRecord`, `labResultRecord`, `medicationRecord`, `procedureRecord`, `vitalSignRecord`, `coverageRecord`. Apple returns the original FHIR R4 JSON in `fhirResource.data` on each sample. We pipe it directly into `parsers/fhir.ts`.

Setup cost for the user: one tap in the iPhone Health app per provider. After that, automatic forever.
Setup cost for us: Capacitor plugin work, Info.plist key (`NSHealthClinicalHealthRecordsShareUsageDescription`), Xcode capability ("Clinical Health Records"), App Store review. ~1-2 weeks.
Coverage: every provider in Apple's directory (search at https://institutions.healthrecords.apple.com/). Includes Epic (Queen's, Mayo, Kaiser, Stanford), Cerner/Oracle (Adventist, VA), athenahealth, eClinicalWorks, NextGen, Greenway, Allscripts, ModMed, Meditech, and most certified EHRs.

#### B. SMART on FHIR direct — for providers we want first-class

Already implemented in `src/lib/integrations/connectors/fhir-portal.ts`. The blocker is that it requires per-EHR-vendor registration: Epic, Cerner, athenahealth each issue their own client IDs and run app reviews. We do this only when the volume of users on a specific vendor justifies the bureaucracy. For 99% of providers, path A handles them.

#### C. Aggregator (1upHealth or Health Gorilla)

For users who are not on iOS, or for providers Apple's directory does not cover, an aggregator gives us OAuth access to hundreds of EHRs through a single API. 1upHealth's developer docs are public; Health Gorilla offers Patient Access as an out-of-the-box product. Costs are usage-based (fractions of a cent per FHIR call at 1upHealth; per-record at Health Gorilla). One sign-up, one token, hundreds of providers covered.

#### D. Email-ingest — for everything that emails results

Some labs and small specialty practices simply email results as PDF attachments. Diagnostic Lab Services in Hawaii (uses Luminate Health, which does not expose patient FHIR) is a real example. The user sets up a Gmail / Apple Mail forwarding filter to send those results to a per-user magic address (`import-<userid>@lanaehealth.app`). An inbound email service (Mailgun Routes is the most mature; AWS SES → S3 → Lambda is the cheapest at scale) calls our existing `/api/import/universal/` endpoint with the attachment. PDF parser does the rest. Zero ongoing user effort after the filter is set up.

#### E. AI text / photo capture — for "I have it on paper / a screenshot"

Already partially built. The user pastes a doctor's visit summary, snaps a photo of a printed lab report, or screenshots their patient portal — `parsers/text-ai.ts` and `parsers/screenshot.ts` extract structured records. Always available, never the primary path, but the safety net for everything else.

#### F. Manual file upload

Already shipping. PDF, FHIR Bundle JSON, C-CDA XML, CSV, generic JSON. Users export from a portal that has no API and we accept the file. Fallback only.

#### G. Wearable / app APIs

Already implemented for Oura, Natural Cycles, Whoop, Dexcom, Garmin, Withings, Fitbit, Libre, Strava. To extend: Apple Watch (already via HealthKit non-clinical), Eight Sleep, Levels, Polar, Suunto, Cronometer, MyFitnessPal, Clue, Flo. Same connector pattern as the existing eight.

#### H. Browser extension — last-resort long tail

For any patient portal that is not on Apple Health Records, not on an aggregator, has no FHIR endpoint, and does not email results. The user installs a Chrome / Safari extension. When they log into the portal manually, a content script reads visible records and ships them to our API. Higher maintenance burden (each portal needs its own DOM selectors), but covers the remaining ~1% of providers. We do not ship this in phase 1.

### One canonical pipeline, every source

Every path lands at `runImportPipeline()` (`src/lib/import/index.ts`). Every record passes through:

1. `format-detector.ts` (FHIR? CCDA? PDF? CSV? text? screenshot?)
2. The appropriate parser → `CanonicalRecord[]`
3. `normalizer.ts` (units, code systems, provenance)
4. `deduplicator.ts` (`createDedupeKey()`)
5. Canonical tables: `lab_results`, `medications`, `appointments`, `imaging_studies`, `medical_timeline`, `health_profile`, etc.

Adding ingestion path X means writing a path-specific receiver and producing a payload `runImportPipeline()` already knows how to handle. No changes to the spine.

### v2 "Connections" UI

One screen at `/v2/connections`. Lists every potential source with state:

```
APPLE HEALTH RECORDS                  [ Connect ]
  Pulls labs, conditions, meds, allergies, immunizations,
  procedures, vitals from 12,000+ providers via the iPhone Health app.

YOUR LAB / PRACTICE EMAILS            [ Set up forwarding ]
  Forward result emails to import-<userid>@lanaehealth.app
  and we'll process the attachments.

PATIENT PORTAL (any FHIR portal)      [ Connect ]
  Sign in to your hospital's portal directly. SMART on FHIR.

WEARABLES                              [ Connect Oura · Connect Whoop · ... ]

UPLOAD A FILE                          [ Choose file ]
  PDF, FHIR Bundle JSON, C-CDA XML, CSV, screenshot.

CONNECTED:
  Apple Health Records                last sync 2h ago    [ Sync now ] [ Disconnect ]
  Oura Ring                           last sync 14m ago   [ Sync now ] [ Disconnect ]
  ...
```

Built on top of the existing `IntegrationHub.tsx` logic, ported to v2 primitives. The legacy `/settings#integrations` remains as the source of truth until v2 is at parity.

### Provider directory

A static lookup the UI consults. For each provider: which ingestion path works (HealthKit / aggregator / SMART direct / email / manual). Sourced from:

- Apple Health Records institution directory (https://institutions.healthrecords.apple.com/)
- ONC-certified FHIR endpoint registry (e.g. https://fhir.luxera.io/)
- Aggregator directories (1upHealth, Health Gorilla)

When a user types "Queen's" we tell them: "Apple Health Records → tap to connect." When they type "DLS" we tell them: "Email forwarding → here's the address."

## Phased implementation

Each phase ships independently and produces user-visible value.

### Phase 1 — v2 Connections page (foundation, makes everything else discoverable)

Move the integration UI out of legacy `/settings#integrations` into a dedicated `/v2/connections` route built on v2 primitives. Wire it to the existing connector registry. Add status chips, "sync now" buttons, last-sync timestamps. Add a link in the v2 settings tab.

Effort: 2-3 days. Pure section-local work; no foundation request needed.
User-visible win: every existing wearable + Oura + NC + Apple Health (non-clinical) becomes discoverable inside v2 in one screen.

### Phase 2 — iOS Health Records bridge (`HKClinicalRecord`)

Either fork `capacitor-health` or write a small custom Capacitor plugin that exposes the eight `HKClinicalTypeIdentifier` types. Add Info.plist usage description, Xcode capability. Implement a sync runner that reads new clinical samples, extracts FHIR JSON, posts to `/api/import/universal/`. Add a "Connect Apple Health Records" tile to the v2 Connections page that triggers the auth prompt.

Effort: 1-2 weeks (most of it is iOS native plugin work + App Store review).
User-visible win: Lanae taps "Add Account" once per provider in iPhone Health app. From then on, every lab, condition, medication, allergy, immunization, procedure, and vital from every Apple-supported provider lands in the app automatically. Queen's, Adventist, the allergist (if their EHR is on Apple's directory) all flow in.

### Phase 3 — Email-ingest pipeline

Stand up Mailgun Routes (or SES + Lambda + S3). Create a per-user inbound address scheme (`import-<token>@lanaehealth.app`). Webhook into `/api/import/universal/` with attachment + sender metadata for provenance. Add a "Connect lab / practice emails" tile to the Connections page with copy-the-address UX and a how-to-set-up-Gmail-forwarding modal.

Effort: 3-5 days.
User-visible win: any provider that emails results (DLS via Luminate, billing PDFs, after-visit summaries) becomes automatic.

### Phase 4 — AI text / photo capture in v2

Surface the existing `text-ai` and `screenshot` parsers behind a "Paste or snap a result" tile. Voice dictation via the iPhone keyboard. Camera capture wired through Capacitor.

Effort: 2-3 days.
User-visible win: anything paper or screenshot-able is a 30-second flow, not a desktop export.

### Phase 5 — Aggregator integration (1upHealth or Health Gorilla)

Sign up. Wire their Patient Access API as a connector. For users who can't or don't want to use Apple Health Records (web-only users, Android users in the future, or providers Apple doesn't cover), the aggregator is the catch-all FHIR path.

Effort: 1 week.
Decision pending: 1upHealth is cheaper at scale and has better dev docs; Health Gorilla offers more clinical-network reach. We can validate with a free dev account before committing.

### Phase 6 — In-app symptom capture replaces iPhone Notes

Make our v2 notes feature less friction than iPhone Notes. Voice capture, sticky bottom-bar quick-log, "since I last logged" prompt. Small product polish, biggest behavioural payoff.

Effort: 3-5 days.
User-visible win: the biggest source of "data I have but never imported" — daily symptom notes — flows directly without leaving our app.

### Phase 7 — Browser extension (deferred; tracked, not scheduled)

For the long tail of portals not on Apple, not on an aggregator, no FHIR, no email delivery. We track this but do not ship it in the first round. The five paths above cover well above 90% of US providers.

## Technical risks (real, not theoretical)

- **Apple Health Records App Store review.** Apps that read clinical records get extra scrutiny. We need a clear privacy policy, a clear use case, and a Health Records Usage Description string that survives review. Risk is mitigated by Lanae's app being a personal health record manager — exactly the canonical use case Apple designed this for.
- **Capacitor plugin maintenance.** If we fork `capacitor-health`, we own the upstream merge burden. A custom Capacitor 6 plugin is ~200 lines of Swift. Not large, but real.
- **HIPAA / data residency.** Aggregators and email-ingest both involve a third party touching PHI. Both vendors offer BAAs. Sign before going live.
- **Per-user inbound email addresses.** Each user gets a unique routing key. The address must be unguessable (so an attacker cannot inject fake records); a 32-byte token in the local part is sufficient. The receiver must verify the From address against an allow-list of known senders or warn the user.
- **Information-blocking pushback.** Some providers technically still block patient access despite the law. Where this happens we file a complaint with HHS' Office of Inspector General and document the block. The aggregators are also legally pursuing this; we ride their coattails.

## Success criteria

The product is doing its job when, on any given morning:

1. A new lab result the patient had drawn yesterday is in the app within 24 hours, with no user action.
2. A new visit summary from any provider is in the app within 24 hours, with no user action.
3. A new prescription is in the app within 24 hours, with no user action.
4. The Doctor Mode brief at `/v2/doctor` reflects all of the above without the user noticing the import happened.

The data-completeness footer at the bottom of `/v2/doctor` becomes the verifier. When it stops reporting "0% data streams for the recent window" — when it instead says "Apple Health Records: 100% · Oura: 100% · Email-ingest: 100%" — the system is working.

## Out of scope for this design

- Insurance claims data (CMS Blue Button, payer FHIR APIs). Different ingestion class; separate design.
- Medical imaging viewer (DICOM rendering). The DiagnosticReport metadata flows through fine; pixel-level imaging is a separate problem.
- Genome / microbiome aggregation (23andMe, Viome). Tracked, separate.
- Provider-to-provider HIE coverage (Carequality, CommonWell). The aggregator phase pulls from these networks transitively; we do not connect directly.
- HL7 v2 messaging. Pre-Cures-Act format; almost nothing patient-facing uses it. If we hit it, the aggregator handles translation.

## What I'm doing now

Committing this design and moving to the implementation plan. Phase 1 (the v2 Connections page) is section-local, has no foundation dependency, and unlocks discoverability for everything that follows. I will start there, then proceed through the phases in order. I will not pause for further input unless I hit a real product decision (e.g. 1upHealth vs Health Gorilla in Phase 5) — those will be flagged in the implementation plan with clear options.
