# Prior Art and Design Revisions

**Date:** 2026-05-03
**Status:** Updates the medical-data-aggregation design based on existing apps that already solve part of this problem.
**Source:** User pointed me at six apps (Apple Health, CommonHealth, myFHR, OneRecord, Duke PillBox, Boston Children's Cardiac Risk app). I had not researched them. This doc captures what I learned and what we change.

## Prior art

### 1. Apple Health Records (iOS)

In our plan as Phase 2. No revision needed. iOS users tap "Add Account" in the iPhone Health app → Apple handles per-vendor SMART-on-FHIR auth → records stream into HealthKit → our Capacitor plugin reads `HKClinicalRecord` samples → existing FHIR parser pipeline saves them. Apple's directory at https://institutions.healthrecords.apple.com/ covers ~12,000 institutions.

### 2. CommonHealth (Android) — gap I missed

The Android equivalent of Apple Health Records. **Open source under Apache 2.0.** SDK at https://github.com/the-commons-project/CommonHealthClientSample. Same pattern: a single app aggregates from US providers via FHIR Patient Access APIs, then exposes records to consenting third-party apps via SDK.

**Our app builds for both iOS and Android via Capacitor.** Without CommonHealth integration we ship half a product on Android. **Adding Phase 2.5 (Android clinical records bridge).**

Two viable Android paths:
- **CommonHealth Client SDK** — third-party app the user installs first, then our app reads from its data store via SDK. Largest provider directory today.
- **Android Health Connect** (https://developer.android.com/health-and-fitness/health-connect/medical-records) — Google's first-party platform component. As of 2026 supports FHIR-based medical records. Tighter OS integration; smaller provider directory but growing fast.

Plan: ship both. Health Connect first because it's first-party and likely covers Apple's institutions over time; CommonHealth as a backstop for providers Health Connect hasn't reached yet.

### 3. myFHR by CareEvolution — gap I missed

Free app, both iOS + Android + web. Connects to physicians, hospitals, **and Medicare/insurance companies**. The insurance side is what I missed.

The 21st Century Cures Act has two ingestion lanes, not one:
- **Provider Patient Access API** (the one I planned for): EHR → patient. Surfaces clinical records — labs, conditions, meds, allergies, procedures, encounters.
- **Payer Patient Access API** (CMS-9115-F): insurance → patient. Surfaces *claims* data — every visit billed, every procedure billed, every prescription filled, every diagnosis coded, going back years. Mandated for Medicare Advantage, Medicaid managed care, ACA exchange plans, and most large commercial payers.

Claims data is structurally different from EHR data and often more complete. If a visit gets billed but never gets a clean EHR note, the claim is the only record. **Adding payer ingestion as a future phase (Phase 8).** myFHR's UX of unified clinical + claims timeline is the model.

CareEvolution's underlying platform is "MyDataHelps + Orchestrate" — productized for digital health builders. We're not licensing it (we own our pipeline), but its architecture is a reference: a converter API that normalizes whatever shape the source emits into a consistent FHIR resource set before it touches the patient surface.

### 4. OneRecord — alternative to 1upHealth

OneRecord (https://onerecord.com/, https://developer.onerecord.com/) is itself an aggregator API, like 1upHealth and Health Gorilla. Differentiator: their public docs lead with iOS + Android + web first-class support and a "patient portal authentication" flow (https://developer.onerecord.com/docs/patient-portal-authentication) that handles OAuth across hundreds of provider portals.

**Revision to Phase 5:** the agent currently scaffolding the 1upHealth connector is doing the right shape of work, but the vendor pick is now a three-way comparison: 1upHealth vs Health Gorilla vs OneRecord. The connector pattern is identical for all three; switching is one file. Decision factors:

- **OneRecord:** broadest cross-platform UX, includes claims data
- **1upHealth:** cheapest at scale, FHIR-first, lakehouse architecture (their selling point)
- **Health Gorilla:** TEFCA-designated QHIN, broadest clinical-network reach via the national HIE infrastructure

Recommendation pending: ship the 1upHealth scaffold now (it's the most documented dev setup), keep OneRecord as a one-week swap if Lanae's specific provider list reveals gaps. The connector interface is vendor-neutral.

### 5. Duke PillBox + Boston Children's Cardiac Risk — proof the data flows in production

Both apps are EHR-launched (the doctor opens them from inside Epic or Cerner via SMART-on-FHIR launch). They consume the same FHIR resources we will: `MedicationRequest` for PillBox, `Observation` + `Condition` for Cardiac Risk. **Validation that the federal mandate produces real, usable data in production at scale, not just on paper.** Both are in the SMART App Gallery at https://apps.smarthealthit.org/, alongside ~100 other apps that browse like a pattern library.

We are not building EHR-launched apps. We are building patient-launched. Different audience, same data shape. Their existence is the proof point that the FHIR endpoints we're calling actually return the resources we're parsing.

## Design revisions, in order

### A. Add Phase 2.5 — Android clinical records bridge

Mirrors Phase 2 (HealthKit) but for Android via Health Connect medical-records + CommonHealth Client SDK fallback. New Capacitor plugin under `android/app/src/main/java/.../AppleHealthRecords.kt` (yes, the class name is wrong; we'll name it `ClinicalRecords` and have iOS + Android both register against it). Same FHIR parser pipeline downstream. Same connector interface upstream. **Does not block Phase 2 shipping; can ship in parallel.**

### B. Reconsider Phase 5 vendor pick after the scaffolds land

The 1upHealth agent is already running. Let it finish. If after Phase 2 + 2.5 ship we find Lanae's providers all flow through Apple Health Records / Health Connect / CommonHealth, the aggregator gap is small and 1upHealth is fine. If we discover gaps (specialty practices not on any of those), revisit OneRecord vs Health Gorilla based on which network covers the gap.

### C. Add Phase 8 — Payer Patient Access API (claims + insurance)

New phase, currently unsequenced. Sources:
- Medicare Advantage Patient Access API (CMS-mandated since 2021)
- Medicaid managed care plans (per state)
- Commercial payers covered by CMS-9115-F (Cigna, UHC, Aetna, BCBS regional plans)

Each payer exposes a CARIN-flavored FHIR endpoint. Same parser, same pipeline. Different OAuth flow (insurance member auth, not provider auth). UX: a separate "Connect your insurance" tile on `/v2/connections` distinct from "Connect your provider."

### D. Browse the SMART App Gallery for patterns

Tracked, not scheduled. Over the next several sessions, when designing UX for specific surfaces (medication management, cardiac, lab trends), pull the gallery's reference implementations and adopt the FHIR profiles they use. Reduces our risk of inventing a non-standard data shape that the next aggregator can't fill.

## What I'm NOT changing

- Phase 1 (Connections page + provider directory) — the right base.
- Phase 3 (Email-ingest) — orthogonal to Apple Health / CommonHealth; covers everything that emails PDFs.
- Phase 4 (AI text/photo capture) — same; the universal-fallback path.
- Phase 6 (Notes quick-composer) — orthogonal, product surface, not data ingestion.
- Phase 7 (Browser extension) — still deferred.

## What I'm dispatching now

Two more sub-agents:
1. **Phase 2.5** — Android clinical records bridge (Health Connect medical-records + CommonHealth SDK). Branch `claude/phase-2-5-android-clinical`.
2. (Pending: I'll dispatch a Phase 8 scoping agent later, after the first wave of PRs lands and we know what providers actually flow.)

The Phase 5 (1upHealth) agent already running can keep going; if it finishes before Phase 2.5 reveals gaps, we have a working aggregator scaffold either way. The vendor pick is reversible.
