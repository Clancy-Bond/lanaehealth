# Phase 2 Handoff: HealthKit Clinical Records (`HKClinicalRecord`)

> **For Claude:** This is a handoff brief, not an implementation plan. Read it, then invoke `superpowers:writing-plans` to produce the bite-sized plan, then execute.

**Status:** Phase 1 (Connections UI) is shipped in PR #164. Phase 2 unlocks the data automation. This is the single biggest user-visible win in the medical-data-aggregation design.

**The mandate:** when Lanae taps "Add Account" once per provider in iPhone's Health app, every lab, condition, medication, allergy, immunization, procedure, and vital from that provider lands in this app's database within 24 hours, with no further action.

---

## What Apple gives us (the leverage)

iOS Health Records aggregates from 12,000+ healthcare institutions on Apple's directory (Epic, Cerner/Oracle, athenahealth, eClinicalWorks, ModMed, Greenway, Allscripts, Meditech, NextGen, etc.). Apple handles SMART-on-FHIR auth, per-vendor OAuth, periodic refresh, and FHIR-compliant data normalization. We do not register as an Epic developer. We do not chase Cerner. We read from HealthKit and pipe Apple's already-fetched FHIR JSON straight into the parser pipeline that already exists at `src/lib/import/parsers/fhir.ts`.

The eight `HKClinicalTypeIdentifier` values we want:

```swift
HKClinicalTypeIdentifier.allergyRecord
HKClinicalTypeIdentifier.conditionRecord
HKClinicalTypeIdentifier.immunizationRecord
HKClinicalTypeIdentifier.labResultRecord
HKClinicalTypeIdentifier.medicationRecord
HKClinicalTypeIdentifier.procedureRecord
HKClinicalTypeIdentifier.vitalSignRecord
HKClinicalTypeIdentifier.coverageRecord  // insurance / coverage data
```

Each `HKClinicalRecord` sample carries an `HKFHIRResource` via `record.fhirResource` whose `data: Data` field holds the original FHIR R4 JSON Apple downloaded from the provider's API. That `Data` is exactly what `runImportPipeline()` already accepts (we just need to UTF-8 decode it and pass `mimeType: 'application/fhir+json'`).

## What's in the repo today

| File | Purpose | Phase 2 touch needed? |
|---|---|---|
| `src/lib/import/parsers/fhir.ts` | FHIR R4 parser, takes the JSON Apple gives us | No — already complete |
| `src/lib/import/index.ts` (`runImportPipeline`) | Format detection → parse → normalize → dedupe → save | No |
| `src/v2/components/healthkit/HealthKitSyncCard.tsx` | Existing UI for non-clinical HealthKit (vitals, sleep, activity) | Yes — extend or duplicate the pattern for clinical types |
| `capacitor-health` (npm) | Wraps non-clinical HealthKit. Does NOT expose `HKClinicalRecord`. | Yes — fork or sidecar |
| `ios/App/App/Info.plist` (or wherever Capacitor's iOS target lives) | Needs `NSHealthClinicalHealthRecordsShareUsageDescription` | Yes |
| Xcode capabilities | Needs "Clinical Health Records" checkbox enabled | Yes (one-time) |
| `src/lib/integrations/connectors/` | Where the new connector registers | Yes — new file `apple-health-records.ts` |
| `src/lib/integrations/registry.ts` | Wire-up | Yes — add one import + register call |
| `src/app/v2/connections/page.tsx` | Surface the new connector | No code change — it auto-renders from the registry |

## Two implementation paths (pick one in the plan)

### Path A — fork `capacitor-health`

Pros: stays inside the existing plugin's API style; one dependency to update. Cons: ongoing upstream-merge burden; the upstream maintainer may accept a PR but it's not a fast loop.

The diff in the fork is roughly: new method `requestClinicalAuthorization(types: string[])` and `queryClinicalRecords({type, since, limit})`. Both delegate to `HKHealthStore.execute()` with `HKSampleQuery` for the requested clinical type, then map each `HKClinicalRecord` to a serializable record with `fhirResource.data` decoded as a UTF-8 string in a `fhirJson` field.

### Path B — sidecar Capacitor plugin

A small (~200-300 lines of Swift) custom plugin under `ios/App/Plugins/AppleHealthRecords/`. Same JS/TS API surface as the fork, but lives in our repo. No upstream merge to chase.

**Recommend Path B** for the plan: lower coordination cost, stays under our control. The Capacitor 6 plugin scaffold is one `swift package`, one `Plugin.swift` with `@objc` methods, one `Plugin.m` with `CAP_PLUGIN_METHOD` macros, and one TypeScript wrapper. Apple's sample code in `developer.apple.com/documentation/HealthKit/accessing-a-user-s-clinical-records` is directly transferable.

## End-to-end flow when shipped

```
[iPhone Health app]
  user taps "Add Account" → picks Queen's MyChart from directory
  Apple negotiates SMART-on-FHIR OAuth → records sync into HealthKit

[our app, on next foreground or scheduled background sync]
  Capacitor plugin: requestClinicalAuthorization([allergy, condition, ...])
  → user sees Apple's clinical-types permission sheet (read-only)
  → user grants
  Capacitor plugin: queryClinicalRecords({ type: 'labResultRecord', since: lastSync })
  → returns Array<{ id, type, date, fhirJson }>

[for each record]
  POST /api/import/universal/
    body: { content: fhirJson, fileName: `apple_health_${type}_${id}.json`,
            mimeType: 'application/fhir+json' }
  → runImportPipeline → fhir.ts parser → normalizer → dedupe → save
  → also writes import_history row with source_app: 'Apple Health Records · {provider}'

[in v2 UI]
  /v2/connections shows "Apple Health Records · last synced 12m ago"
  /v2/doctor's CompletenessFooterCard reflects the new completeness pct
```

## Risks worth surfacing in the plan

1. **App Store review.** Apple is strict about Clinical Health Records access. We need:
   - A clear `NSHealthClinicalHealthRecordsShareUsageDescription` ("LanaeHealth reads your medical records so you can review labs, medications, and visit summaries from every provider in one place. Records stay on this device until you choose to sync them.")
   - The app's privacy policy explicitly covering clinical record handling
   - An obvious user-facing benefit (Doctor Mode brief). The brief at `/v2/doctor` is exactly that.
2. **Capacitor packaging.** The Capacitor iOS shell is at `capacitor.config.ts` + `ios/` (per the existing `@capacitor/ios` dependency). The plugin needs to be registered in the iOS target's `Podfile` or via SPM, and the JS-side TypeScript wrapper must be importable as `@/lib/native/apple-health-records` or similar.
3. **Background fetch.** iOS does not let third-party apps poll HealthKit on a fixed schedule. We get `HKObserverQuery` (push notification when new clinical samples land) plus `HKAnchoredObjectQuery` (incremental "what's new since this anchor"). The sync should run on app foreground and on observer-fired wake events.
4. **HIPAA stance.** Clinical records that flow off-device (e.g. into our Supabase) are PHI. The user must consent to that off-device sync. Today's app architecture stores everything in Supabase already — but Phase 2 is the moment to surface a clear "your records will be stored on our servers; you can delete at any time" consent panel before first sync.
5. **Per-provider visibility.** A user might add 5 providers in Apple Health. Our v2 connections UI shows "Apple Health Records" as a single source. The Phase 2 plan should consider whether the UI breaks that down ("Apple Health · Queen's", "Apple Health · Adventist") or stays consolidated. **Recommendation: consolidated for Phase 2; per-provider breakdown in Phase 5 alongside the provider directory.**

## Acceptance criteria for Phase 2

- [ ] iOS native plugin compiles and runs in a Capacitor build
- [ ] `Info.plist` carries `NSHealthClinicalHealthRecordsShareUsageDescription`
- [ ] Xcode capability "Clinical Health Records" enabled
- [ ] On a real iPhone (not simulator — clinical types need the simulator's sample data, but real devices are required for App Store submission), the user sees the clinical-types permission sheet on first sync
- [ ] After permission grant, all eight clinical types pull their records and write to our database
- [ ] `/v2/connections` shows the Apple Health Records card with a real "synced N min ago" timestamp
- [ ] `/v2/doctor`'s `CompletenessFooterCard` reflects the new ingestion (e.g. "Apple Health Records: 100%")
- [ ] E2E: a unit test for the FHIR JSON-to-record path (no real device needed, just feed Apple's sample fixture into `runImportPipeline`)

## What I would do first in the next session

1. Invoke `superpowers:brainstorming` only if the human signals product-level questions (e.g. "should this run in the background or only on foreground"). Otherwise:
2. Invoke `superpowers:writing-plans` and write the bite-sized plan in `docs/plans/YYYY-MM-DD-phase-2-healthkit-clinical.md`.
3. Start Path B: scaffold the Capacitor plugin under `ios/App/Plugins/AppleHealthRecords/`.
4. Wire the JS-side connector at `src/lib/integrations/connectors/apple-health-records.ts` + register in `src/lib/integrations/registry.ts`.
5. Connect the existing v2 Connections card UX to the new connector's `getAuthUrl` / `sync` methods (the connector interface auto-routes through the existing API endpoints).
6. Test against Xcode's clinical-records sample data in the simulator before building on a physical device.

## Reference

- Apple docs: https://developer.apple.com/documentation/healthkit/accessing-health-records
- Apple sample: https://developer.apple.com/documentation/HealthKit/accessing-a-user-s-clinical-records
- HKClinicalRecord: https://developer.apple.com/documentation/healthkit/hkclinicalrecord
- USCDI v3 (the FHIR data set every provider must expose): https://isp.healthit.gov/united-states-core-data-interoperability-uscdi
- Apple Health Records institutions directory: https://institutions.healthrecords.apple.com/
- Cures Act enforcement timeline (Feb 2026): https://www.hklaw.com/en/insights/publications/2026/02/the-wait-is-over-information-blocking-enforcement-is-officially-here

## What's NOT in Phase 2

- Email-ingest (Phase 3)
- Aggregator (Phase 5) — the cross-vendor catch-all for users not on iOS
- Provider directory UI (Phase 7) — the "search for your hospital" experience
- Browser extension (deferred indefinitely)

Phase 2 is iOS clinical records only. Keep scope tight.
