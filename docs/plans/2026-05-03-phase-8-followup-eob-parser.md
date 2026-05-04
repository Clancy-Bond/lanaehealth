# Phase 8 Followup: ExplanationOfBenefit parser extension

**Date:** 2026-05-03
**Status:** Followup. Required before Phase 8 connectors save claims data into canonical tables.
**Locked file:** `src/lib/import/parsers/fhir.ts` is in the import lockbox; this work needs a foundation request.

---

## Why this exists

The Phase 8 connectors (CMS Blue Button, UHC, Cigna, Aetna, HMSA) pull CARIN-profile FHIR R4 Bundles. The `ExplanationOfBenefit` resource is the meat of those bundles: every adjudicated claim, with provider, date, diagnosis codes, procedure codes, billed amount, paid amount, place of service, type of bill.

Today the parser at `src/lib/import/parsers/fhir.ts` does not case on `ExplanationOfBenefit`. The router silently returns `null` and the records vanish. The connector at `src/lib/integrations/connectors/cms-blue-button.ts` already detects this and logs a warning per sync ("Blue Button returned N ExplanationOfBenefit resource(s); the FHIR parser does not yet decode CARIN claims"), but the records do not land.

This doc is the spec for the parser extension. It is **not** a request to do the work in the same PR as the Phase 8 connector scaffold; the import directory is locked and a foundation request is required.

## What needs to ship

### 1. New canonical record type and data shape

Add to `src/lib/import/types.ts`:

```ts
export type CanonicalRecordType =
  | ...existing types...
  | 'claim'

export interface ClaimData {
  // Anchor fields
  claimType: 'professional' | 'institutional' | 'pharmacy' | 'oral' | 'vision' | 'other'
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error'
  serviceDateStart: string                  // ISO date
  serviceDateEnd: string | null

  // Provider + place of service
  billingProvider: string | null
  servicingProvider: string | null
  placeOfService: string | null              // CMS POS code or display
  facility: string | null

  // Coding
  primaryDiagnosis: string | null            // ICD-10 display text
  primaryDiagnosisCode: string | null        // ICD-10 code
  diagnosisCodes: string[]                   // Other ICD-10 codes
  procedureCodes: string[]                   // CPT / HCPCS codes
  drgCode: string | null                     // Inpatient DRG if any

  // Money
  billedAmount: number | null
  paidAmount: number | null
  patientResponsibility: number | null
  currency: string | null

  // Provenance
  payerName: string | null                   // "Medicare", "UnitedHealthcare", etc.
  claimNumber: string | null                 // Adjudicated claim id from the payer
  carinProfile: string | null                // The CARIN profile URL declared on the resource
}

export type CanonicalRecordData =
  | ...existing union members...
  | ClaimData
```

### 2. Parser case in `parseResource()`

Add to `src/lib/import/parsers/fhir.ts`:

```ts
case 'ExplanationOfBenefit': return parseExplanationOfBenefit(resource, source)
```

And implement `parseExplanationOfBenefit(resource, source)` that pulls the fields listed above. Reference: the CARIN BB IG at https://hl7.org/fhir/us/carin-bb/ defines five `ExplanationOfBenefit` profiles (`-Inpatient-Institutional`, `-Outpatient-Institutional`, `-Professional-NonClinician`, `-Pharmacy`, `-Oral`). The discriminator is in `meta.profile[0]`; pick a `claimType` based on the URL segment.

Important shape notes from the CARIN spec:

- `type.coding[0].code` carries CMS internal codes (e.g. `CARRIER`, `INPATIENT`, `OUTPATIENT`, `HHA`, `HOSPICE`, `PDE`)
- `billablePeriod.start` / `billablePeriod.end` is the service date span
- `diagnosis[].diagnosisCodeableConcept.coding[]` carries ICD-10 with `system: http://hl7.org/fhir/sid/icd-10-cm`
- `procedure[].procedureCodeableConcept.coding[]` carries ICD-10-PCS or CPT
- `item[].productOrService.coding[]` carries CPT/HCPCS for line items
- `total[]` is an array; total `submitted` and total `payment` are common
- `provider.display` and `provider.reference` for billing provider

### 3. Optional: derived appointment + procedure records

Each `ExplanationOfBenefit` in CARIN BB roughly corresponds to one encounter. Beyond the raw `claim` record we may also want to emit derived `appointment` and `procedure` records so the existing `/v2/doctor` brief surfaces them without a UI rebuild. Decision pending; do whichever yields a cleaner Doctor Mode footer first.

### 4. Dedupe key

Use `createDedupeKey('claim', serviceDateStart, payerName + '|' + claimNumber)`. Claim numbers are unique within payer, and adjudicated claims do not change after acceptance, so this is stable.

### 5. Database

Either add a `claims` table or reuse `appointments` with a discriminator column. Recommend `claims` table to keep clinical encounters and billing records cleanly separated; the Doctor Mode brief joins them.

### 6. Connector update (after parser ships)

Once the parser handles EOB, remove the warning emission from `cms-blue-button.ts`. The connector's existing `runImportPipeline` call will then surface `claim` records like any other.

## Why split the work this way

- The parser is in `src/lib/import/`, which is in the foundation lockbox.
- The connector is in `src/lib/integrations/connectors/`, which is freely editable.
- Splitting the PRs lets the connector land now, accumulate raw EOB JSON in `import_history`, and surface to operators that the data is arriving while the parser PR is being reviewed.
- When the parser PR lands, no connector change is needed; the next sync just starts producing canonical records.

## Tests to add with the parser

- A unit test that parses a CARIN `ExplanationOfBenefit-Professional-NonClinician` example bundle (fixtures from https://hl7.org/fhir/us/carin-bb/STU2.2/Examples.html) and asserts every field on `ClaimData` round-trips.
- A pipeline-level test that pumps the same fixture through `runImportPipeline` and asserts the resulting `CanonicalRecord[]` includes a `claim` record with the expected dedupe key.
- A regression test against the existing connector test ensuring it stops emitting the EOB-not-yet-parsed warning once the parser handles the resource.

## Estimate

Half a day for the parser, half a day for the canonical record extension, half a day for tests. The scope is well-bounded because the CARIN profile is small (five sub-profiles, all of which share the same anchor fields).
