# Phase 5 Aggregator Handoff: 1upHealth Connector

**Date:** 2026-04-29
**Status:** Connector code shipped. Awaiting operator action: sign up at 1up.health, sign BAA, fill env vars.
**Author:** Claude (autonomous run)
**Scope:** Operator runbook for activating the 1upHealth aggregator connector (Phase 5 of the medical-data-aggregation plan).

---

## Why this connector exists

1upHealth is a FHIR aggregator that brokers OAuth connections to hundreds of EHRs through a single integration. Phase 2 (Apple Health Records via `HKClinicalRecord`) covers most US providers, and Phase 4 (direct SMART on FHIR via `fhir-portal.ts`) covers the few we want to register against directly. 1upHealth is the catch-all for everything else: web users on desktop, providers Apple's directory does not cover, future Android users, and any portal that exposes FHIR but is not on our short list of SMART direct integrations. One sign-up. One BAA. One token. Hundreds of providers covered.

## What is already in the codebase

- `src/lib/integrations/connectors/oneup-health.ts` is the connector implementation. It builds the authorize URL, exchanges the auth code for a token, refreshes the token, and runs a sync that fetches nine FHIR R4 resource types, composes them into one Bundle, and pipes the Bundle through `runImportPipeline()`.
- `src/lib/integrations/registry.ts` registers the connector. The hub picks it up automatically.
- `src/lib/integrations/types.ts` adds `'oneup-health'` to the `IntegrationId` union.
- `src/lib/integrations/connectors/__tests__/oneup-health.test.ts` covers the auth URL, the token exchange, the sync (including the patient ID discovery branch), and the fail-closed path when no patient can be resolved.

The `/v2/connections` UI auto-renders every registered connector. The Connect button there already points at `/api/integrations/oneup-health/authorize`, which already calls `getAuthUrl()` on the connector. **No UI change is required to light this connector up.** The moment the env vars are set, the tile becomes functional.

## Endpoints used (verified against the public 1upHealth docs)

| Purpose | URL |
|---|---|
| Authorize (user redirect) | `https://auth.1up.health/oauth2/authorize` |
| Token exchange / refresh | `https://auth.1up.health/oauth2/token` |
| FHIR R4 base | `https://api.1up.health/r4` |

Source of record: `https://docs.1up.health/help-center/Content/en-US/get-started/quick-start/oauth2-access.html`. Re-verify before going live; 1upHealth has been moving products around (Patient Connect was scheduled for sunset on 2026-09-30 according to their help center). If Patient Connect has been replaced by a successor product the operator should re-read the docs and patch the URLs in `connectors/oneup-health.ts` before activating.

## Operator action items, in order

1. **Sign up** at https://1up.health and create a developer account. Verify the contact email and confirm access to the developer console.
2. **Sign their BAA.** Patient FHIR data is PHI; the BAA must be in place before any production traffic. Their team will send a DocuSign or equivalent. Allow a business day.
3. **Create an application** in the 1upHealth developer console. Configure:
   - App name: "LanaeHealth"
   - App type: Patient Access (or whatever the current equivalent is, post-Patient-Connect-sunset)
   - Redirect URI: `https://lanaehealth.app/api/integrations/oneup-health/callback` (or the Vercel preview URL when testing)
   - Scopes: `user/*.read patient/*.read openid offline_access`
4. **Copy the client ID and client secret** into Vercel env vars (Project Settings -> Environment Variables):
   - `ONEUP_CLIENT_ID` (Production + Preview)
   - `ONEUP_CLIENT_SECRET` (Production + Preview)
5. **Set `ONEUP_REDIRECT_URI`** in Vercel env vars to the production callback URL: `https://lanaehealth.app/api/integrations/oneup-health/callback`. This pins the registered redirect so it does not accidentally pick up a preview origin during testing.
6. **Redeploy.** Vercel auto-deploys on the next push, or run `vercel --prod`.
7. **Verify the tile is live.** Open `/v2/connections` in production. The "1upHealth (Aggregator)" tile should be present with a Connect button. Click it; you should be redirected to `https://auth.1up.health/oauth2/authorize?...`.
8. **End-to-end smoke test.** Connect a sandbox patient (1upHealth provides a sandbox health system). Confirm the callback returns successfully, that `integration_tokens` has a row for `oneup-health` in Supabase, and that running `/api/integrations/oneup-health/sync` returns a non-zero `recordsSync` and writes a row into `import_history`.

## What the user sees once it is live

On the `/v2/connections` page, a tile titled "1upHealth (Aggregator)" with the description: *"Connect any patient portal through 1upHealth. Hundreds of EHRs (Epic, Cerner, athenahealth, eClinicalWorks, NextGen, ModMed, Meditech, and more) covered by a single sign-in."*

Tapping Connect redirects to 1upHealth's authorization surface. The user picks their health system, signs in with their patient portal credentials, and is redirected back to LanaeHealth. From that point on, the daily sync runs every 24 hours (the `syncInterval` value in the config) and pulls every available record into the canonical tables via the universal import pipeline.

## What the connector does not do

- It does not handle 1upHealth's "Bulk Data" / `$everything` operation. Each resource type is fetched separately and paginated. If volume becomes a problem we can switch to bulk export.
- It does not implement explicit token revocation on disconnect because 1upHealth does not expose a public revocation endpoint for the Patient Connect flow. The hub deletes the token row, which is sufficient.
- It does not sync wearables / non-clinical data. 1upHealth has those endpoints; we already have direct connectors for Oura, Whoop, Garmin, etc., so we route through the dedicated connector instead.

## Testing notes

The test suite at `src/lib/integrations/connectors/__tests__/oneup-health.test.ts` mocks `fetch`, the import pipeline, and the Supabase client. It covers:

- The authorize URL is correctly anchored at `https://auth.1up.health/oauth2/authorize` and carries the client ID, redirect URI, scope, and state.
- `ONEUP_REDIRECT_URI` overrides the request-time redirect.
- Sync fetches every configured resource type, composes one Bundle, calls the pipeline once, and writes one `import_history` row.
- When token metadata has no patient ID, sync falls back to the `/Patient` discovery call.
- When no patient ID can be resolved, sync returns a failure with a useful error and never calls the import pipeline.

Run with `npx vitest run src/lib/integrations/connectors/__tests__/oneup-health.test.ts`.

## Known-unknown: 1upHealth Patient Connect sunset

The 1upHealth help center notes that Patient Connect is being discontinued on 2026-09-30. The OAuth flow used by this connector is the one Patient Connect uses; the documented endpoints will continue to work for in-flight contracts, but we should confirm with 1upHealth's account team during BAA negotiation that the post-sunset Patient Access surface uses the same OAuth shape (or update the connector if it does not).

## Where this fits in the bigger plan

This connector closes Phase 5 of `docs/plans/2026-04-29-medical-data-aggregation-design.md`. With Phases 1 (v2 Connections page), 2 (HKClinicalRecord bridge), 3 (Email-ingest), 4 (AI text/photo), and 5 (this document) all in place, the user has every realistic ingestion path from any provider feeding into the same canonical pipeline. Phase 6 (in-app symptom capture) and Phase 7 (browser extension) remain.
