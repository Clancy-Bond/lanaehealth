# Merge Plan: Medical Data Aggregation Phases

**Date:** 2026-05-03
**Status:** 7 PRs landing concurrently across phases. This doc is the order to merge them, the conflicts to expect, and the human gates.

## The PRs in flight

| PR | Phase | Branch | Status | Code-shippable |
|---|---|---|---|---|
| #164 | 1 | `claude/medical-data-aggregation` | Open, contains design doc + Connections page + Oahu provider directory + prior-art revisions + this merge plan | Yes |
| #168 | 5 | `claude/phase-5-aggregator` | Open, 1upHealth connector scaffold | Yes (live needs vendor signup) |
| TBD | 2 | `claude/phase-2-healthkit-clinical` | Agent running | Yes (live needs Apple App Store review) |
| TBD | 3 | `claude/phase-3-email-ingest` | Agent running | Yes (live needs Mailgun + DNS) |
| TBD | 4 | `claude/phase-4-quick-capture` | Agent running | Yes |
| TBD | 6 | `claude/phase-6-notes-quick-composer` | Agent running | Yes |
| TBD | 2.5 | `claude/phase-2-5-android-clinical` | Agent running | Yes (live needs Google Play submission) |
| TBD | 5b | `claude/phase-5b-onerecord` | Agent running | Yes (live needs OneRecord signup) |

## Recommended merge order

The order minimizes rebases and isolates platform-specific risk.

1. **PR #164** — Phase 1 + design + Oahu directory + this plan. Foundation for everything else; merging it first means later PRs see the new `/v2/connections` route, the `provider-directory.ts`, and the design docs.

2. **PR #168 (Phase 5: 1upHealth)** + **Phase 5b (OneRecord)** — both are pure-additive: new files under `src/lib/integrations/connectors/`, registry entries, type-union additions. Merge in either order. They will conflict on `src/lib/integrations/registry.ts` (both append a `registerConnector(...)` line) and on `src/lib/integrations/types.ts` (both add to the `IntegrationId` union). Resolution: keep both lines, both unions. 30 seconds each.

3. **Phase 4 (Quick capture)** — pure-additive new route at `/v2/import/quick` plus a small modification to `ConnectionsClient.tsx` (adds a tile). Will conflict with Phase 3's `ConnectionsClient.tsx` modification. **Merge Phase 4 before Phase 3** because Phase 3's diff is a swap (placeholder card → real card) that's more contained.

4. **Phase 3 (Email-ingest)** — modifies `ConnectionsClient.tsx` to swap the "Coming soon" email-forwarding placeholder for a real `EmailIngestCard`. Adds a migration. Adds new API route under `/api/inbound-email/`. The `ConnectionsClient.tsx` conflict with Phase 4 is small (Phase 4's tile addition is in a different region; Phase 3's swap targets the placeholder card literally). Resolve by hand.

5. **Phase 6 (Notes quick-composer)** — touches `src/v2/components/notes/`, `src/app/v2/today/page.tsx`, possibly `src/app/v2/page.tsx`. **No overlap** with any other phase. Merge any time.

6. **Phase 2 (iOS HealthKit)** — touches `ios/`, `capacitor.config.ts`, registers a new connector. Conflict with Phase 5 + 5b on `registry.ts` and `types.ts` (same union, same registry list). 30-second resolution.

7. **Phase 2.5 (Android)** — touches `android/`, mirrors Phase 2's connector registration. **Phase 2 and Phase 2.5 may collide on connector ID:** Phase 2 registers `apple-health-records`; Phase 2.5 registers `clinical-records` (cross-platform). The Phase 2.5 brief tells the agent to consolidate by adopting `clinical-records` for both platforms if Phase 2 lands first. **At merge time, normalize the connector id to `clinical-records`** so iOS + Android present as one source in the UI. The Apple-vs-Health-Connect-vs-CommonHealth detail is invisible to the user; they see "Apple Health Records / Health Connect" as one tile.

## Expected conflicts and resolutions

### `src/lib/integrations/registry.ts`

Every connector PR appends a `registerConnector(xConnector)` call and an import. Conflicts are pure additions to the same list. Resolution: take all lines, sort imports alphabetically.

### `src/lib/integrations/types.ts`

Every connector PR adds a new string literal to the `IntegrationId` union. Pure additions. Resolution: union all values.

### `src/app/v2/connections/_components/ConnectionsClient.tsx`

- Phase 1 (PR #164) added `<ProviderSearch />` and a "Coming soon" email-forwarding placeholder card.
- Phase 3 swaps that placeholder for `<EmailIngestCard />`.
- Phase 4 adds a quick-capture tile near the file-upload card.

Resolution sequence after PR #164 merges:
1. Apply Phase 4's tile addition (additive, near the file-upload tile).
2. Apply Phase 3's swap (replaces the placeholder with the real card).

If both PRs branched from main BEFORE PR #164 merged (likely), they will not have `<ProviderSearch />` or the email placeholder in their copies. Their diffs will reapply against the post-#164 file. Re-run the E2E test in each PR after the merge to confirm visual integrity.

### iOS connector id consolidation (Phase 2 ↔ Phase 2.5)

If Phase 2 ships an `apple-health-records` connector and Phase 2.5 ships a `clinical-records` connector, the Connections UI will show two cards for the same conceptual source. The merger flattens this:

- Rename Phase 2's connector to `clinical-records` and have it implement both platforms via runtime branching in `src/lib/native/clinical-records.ts` (Phase 2.5 has already scaffolded this branching).
- Single registry entry; iOS and Android dispatch to the right native plugin via `Capacitor.getPlatform()`.
- Provider directory's `appleHealthRecordsName` field stays — the search hint text reads "Apple Health Records" on iOS and "Health Connect / CommonHealth" on Android. UI conditional, not data conditional.

## Human-action gates (the doors I cannot walk through)

These must be done by you before each phase goes live. Listed in order of impact:

### iOS (Phase 2)
1. Run `npx cap sync ios` after merging.
2. In Xcode → target → Signing & Capabilities, enable "Clinical Health Records".
3. Confirm `Info.plist` has `NSHealthClinicalHealthRecordsShareUsageDescription`.
4. Build to a real iPhone (Apple's clinical-records sample data only works in simulator; real provider data needs a real device).
5. Submit to App Store with privacy policy + clinical-records justification copy. **Apple review for clinical-records apps takes 1-3 weeks.**

### Android (Phase 2.5)
1. Run `npx cap sync android`.
2. Paste the AndroidManifest.xml additions from the PR body (medical-data permissions + CommonHealth authorization activity).
3. Paste the Gradle dependency for the CommonHealth Client SDK.
4. Open Android Studio, build to a real Android 14+ device (Health Connect medical-records is Android 14+). Lower Android: CommonHealth fallback.
5. Submit to Google Play. Faster review than Apple but still requires the medical-data-handling justification.

### Email-ingest (Phase 3)
1. Sign up at Mailgun.
2. Sign Mailgun's BAA.
3. Pick the inbound domain (e.g. `import.lanaehealth.app`); add MX records pointing at `mxa.mailgun.org` priority 10 and `mxb.mailgun.org` priority 10 in DNS.
4. Configure a Mailgun Route in their dashboard pointing to `https://lanaehealth.app/api/inbound-email/mailgun` (your prod URL).
5. Set Vercel env vars: `MAILGUN_WEBHOOK_SIGNING_KEY`, `INBOUND_EMAIL_DOMAIN`.

### 1upHealth (Phase 5) — pending sunset decision
1upHealth's Patient Connect product is scheduled for sunset 2026-09-30. Decision needed: commit to OneRecord (Phase 5b) instead, or use 1upHealth until sunset and migrate. Recommend deferring 1upHealth signup until the sunset surface is clarified during BAA negotiation — but the connector code is shipped either way.

### OneRecord (Phase 5b)
1. Sign up at OneRecord developer portal.
2. Sign their BAA.
3. Create a developer app, register the redirect URI `https://lanaehealth.app/api/integrations/onerecord/callback`.
4. Set Vercel env vars: `ONERECORD_CLIENT_ID`, `ONERECORD_CLIENT_SECRET`, `ONERECORD_REDIRECT_URI`.

## What ships even with no human action

Phase 4 (Quick capture) and Phase 6 (Notes quick-composer) are end-to-end shippable today. They use existing infrastructure: the universal-import endpoint and the existing notes data layer. Merge them and they work in production immediately, no signups, no env vars, no DNS.

## Test strategy at merge

After each merge, run:

```
PLAYWRIGHT_BASE_URL=http://localhost:3005 \
  NEXT_PUBLIC_SUPABASE_URL=... \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  npx playwright test --project=mobile-chrome
```

This catches regressions across the v2 surface. Watch for the doctor overflow contract (`tests/e2e/v2-doctor.spec.ts`) and the connections contract (`tests/e2e/v2-connections.spec.ts`) — both pin invariants that all later PRs must respect.

The pre-push hook runs `tsc --noEmit` automatically. Don't bypass it.

## Phase 7 and Phase 8 (not yet dispatched)

- **Phase 7 (Browser extension):** still deferred. High maintenance, low ROI relative to Apple Health Records + Health Connect + email-ingest already covering 95%+ of providers.
- **Phase 8 (Payer Patient Access API / claims):** scoping happens after the first wave merges. The CARIN profile + per-payer OAuth flows are different enough from provider FHIR to warrant their own brief. Tracked.

## What this plan does NOT cover

- Dependency updates or version bumps in `package.json` that an agent might have introduced (Capacitor plugins, OAuth libraries). Inspect the diff at merge time.
- Changes to `CLAUDE.md` rules — none expected; if any agent touched it, that's a foundation change and should have been a `FOUNDATION-REQUEST.md` instead.
- Vercel deployment configuration. Each PR auto-deploys to a Vercel preview when pushed; production deploy happens on merge to main.
