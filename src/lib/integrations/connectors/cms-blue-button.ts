/**
 * CMS Blue Button 2.0 Connector (CARIN Patient Access API)
 *
 * Phase 8 reference connector for the payer Patient Access lane.
 *
 * The CMS-9115-F final rule mandates that payers expose member-authorized
 * FHIR R4 APIs that surface adjudicated claims. CMS Blue Button is the
 * federal Medicare implementation and the canonical reference: every
 * commercial CARIN-flavored patient-access API uses the same shape, just
 * with different OAuth URLs. Once Blue Button works, UnitedHealthcare,
 * Cigna, Aetna, HMSA, etc. are each a one-file copy.
 *
 * What this returns is structurally different from the EHR Patient
 * Access API at `fhir-portal.ts`:
 *   - EHR FHIR returns Observation, Condition, MedicationRequest, etc.
 *     (what the doctor wrote in the chart).
 *   - Payer FHIR returns ExplanationOfBenefit, Coverage, Patient
 *     (what insurance was billed for, going back years).
 *
 * Both lanes flow through the same FHIR parser and the same import
 * pipeline. CARIN profiles extend FHIR R4 with payer-specific fields
 * but are still valid FHIR R4 Bundles.
 *
 * Status: SCAFFOLD. The OAuth URLs, scopes, and FHIR base URL are
 * production-correct (see docs/plans/2026-05-03-phase-8-payer-claims-scoping.md
 * for sources). Going live requires:
 *   1. CMS Blue Button developer signup
 *   2. Sandbox app registration -> CLIENT_ID + CLIENT_SECRET
 *   3. Privacy policy + terms of service public URLs
 *   4. Production access review (1-3 weeks per CMS)
 *
 * The EOB resources that come back are NOT yet handled by the FHIR
 * parser at src/lib/import/parsers/fhir.ts (it cases on Observation,
 * Condition, etc. and skips ExplanationOfBenefit). The follow-up doc
 * docs/plans/2026-05-03-phase-8-followup-eob-parser.md covers the
 * parser work needed before this connector saves real records.
 */

import { runImportPipeline } from '@/lib/import'
import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

// ── Environment ────────────────────────────────────────────────────

const IS_SANDBOX = process.env.CMS_BLUE_BUTTON_SANDBOX !== 'false'

// CMS Blue Button v2 endpoints. Source:
// https://bluebutton.cms.gov/api-documentation/authorization/
// https://bluebutton.cms.gov/api-documentation/calling-the-api/
const SANDBOX_AUTHORIZE_URL = 'https://sandbox.bluebutton.cms.gov/v2/o/authorize/'
const SANDBOX_TOKEN_URL = 'https://sandbox.bluebutton.cms.gov/v2/o/token/'
const SANDBOX_FHIR_BASE = 'https://sandbox.bluebutton.cms.gov/v2/fhir'
const SANDBOX_USERINFO_URL = 'https://sandbox.bluebutton.cms.gov/v2/connect/userinfo'

const PRODUCTION_AUTHORIZE_URL = 'https://api.bluebutton.cms.gov/v2/o/authorize/'
const PRODUCTION_TOKEN_URL = 'https://api.bluebutton.cms.gov/v2/o/token/'
const PRODUCTION_FHIR_BASE = 'https://api.bluebutton.cms.gov/v2/fhir'
const PRODUCTION_USERINFO_URL = 'https://api.bluebutton.cms.gov/v2/connect/userinfo'

const AUTHORIZE_URL = IS_SANDBOX ? SANDBOX_AUTHORIZE_URL : PRODUCTION_AUTHORIZE_URL
const TOKEN_URL = IS_SANDBOX ? SANDBOX_TOKEN_URL : PRODUCTION_TOKEN_URL
const FHIR_BASE = IS_SANDBOX ? SANDBOX_FHIR_BASE : PRODUCTION_FHIR_BASE
const USERINFO_URL = IS_SANDBOX ? SANDBOX_USERINFO_URL : PRODUCTION_USERINFO_URL

// CMS Blue Button uses HL7 SMART scopes. The .rs suffix is read+search.
// Source: https://bluebutton.cms.gov/api-documentation/authorization/#scopes
const PATIENT_SCOPES = [
  'openid',
  'profile',
  'patient/Patient.rs',
  'patient/Coverage.rs',
  'patient/ExplanationOfBenefit.rs',
]

// ── Config ─────────────────────────────────────────────────────────

const config: IntegrationConfig = {
  id: 'cms-blue-button',
  name: 'Medicare (Blue Button)',
  description:
    'Your Medicare claims and coverage history. Different from your doctor\'s chart, this shows everything billed to Medicare.',
  icon: '\u{1F3DB}\u{FE0F}',
  category: 'medical',
  authType: 'oauth2',
  oauth: {
    authorizeUrl: AUTHORIZE_URL,
    tokenUrl: TOKEN_URL,
    clientIdEnvVar: 'CMS_BLUE_BUTTON_CLIENT_ID',
    clientSecretEnvVar: 'CMS_BLUE_BUTTON_CLIENT_SECRET',
    scopes: PATIENT_SCOPES,
    responseType: 'code',
    grantType: 'authorization_code',
    pkce: true,
  },
  // CARIN BB surfaces claims; we map those into appointments + procedures
  // downstream once the FHIR parser handles ExplanationOfBenefit. For
  // now this dataTypes list is what the connector card advertises.
  dataTypes: ['medical_records'],
  syncInterval: 1440, // Once per day
  website: 'https://bluebutton.cms.gov/',
}

// ── FHIR Resource Fetching ─────────────────────────────────────────

// CARIN BB Patient Access surfaces three resource types per
// https://bluebutton.cms.gov/api-documentation/calling-the-api/. EOB is
// the meat; Patient and Coverage anchor the bundle.
const RESOURCE_TYPES: Array<{ type: string; query: (patientId: string) => string }> = [
  { type: 'Patient', query: (id) => `Patient/${encodeURIComponent(id)}` },
  { type: 'Coverage', query: (id) => `Coverage?beneficiary=${encodeURIComponent(id)}` },
  { type: 'ExplanationOfBenefit', query: (id) => `ExplanationOfBenefit?patient=${encodeURIComponent(id)}&_count=100` },
]

interface FhirBundle {
  resourceType: 'Bundle'
  entry?: Array<{ resource?: Record<string, unknown>; fullUrl?: string }>
}

interface FhirResource {
  resourceType?: string
  [key: string]: unknown
}

async function fetchFhir(path: string, accessToken: string): Promise<FhirBundle | FhirResource | null> {
  const url = `${FHIR_BASE}/${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    },
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Blue Button access denied for ${path}. Re-authorize or refresh token.`)
    }
    return null
  }

  return res.json() as Promise<FhirBundle | FhirResource>
}

// ── PKCE Helper ────────────────────────────────────────────────────

/**
 * Build a CMS Blue Button authorize URL. PKCE is required by Blue
 * Button v2 (S256). The caller is responsible for generating, storing,
 * and later submitting the matching code_verifier.
 */
function buildAuthorizeUrl(args: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    scope: PATIENT_SCOPES.join(' '),
    state: args.state,
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

// ── Connector Implementation ───────────────────────────────────────

const cmsBlueButtonConnector: Connector = {
  config,

  /**
   * Build the Blue Button authorize URL. Note: PKCE is required by
   * Blue Button v2 but the Connector interface signature is shared
   * across providers; we degrade gracefully here when no challenge is
   * supplied so the API route can still produce a usable URL during
   * scaffold time. The /authorize route in api/integrations supplies
   * a real code_challenge in production.
   */
  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    // The OAuth manager passes a state token; PKCE verifier+challenge
    // are stored alongside it in a signed cookie by the authorize
    // route. For the bare-bones invocation we emit a placeholder
    // challenge so callers without PKCE plumbing still get a URL with
    // the right shape. Real callers (the API route) override this.
    const codeChallenge = (process.env.CMS_BLUE_BUTTON_PKCE_CHALLENGE ?? state).slice(0, 128)
    return buildAuthorizeUrl({ clientId, redirectUri, state, codeChallenge })
  },

  async exchangeCode(code: string, redirectUri: string): Promise<IntegrationToken> {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''
    const codeVerifier = process.env.CMS_BLUE_BUTTON_PKCE_VERIFIER ?? ''

    // Blue Button accepts client credentials via HTTP Basic auth or
    // form parameters. Basic auth is the documented happy path.
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    })
    if (codeVerifier) body.set('code_verifier', codeVerifier)

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Blue Button token exchange failed: ${err}`)
    }

    const data = await res.json()
    const now = new Date()

    // patient_id arrives in the token response payload as the FHIR
    // patient resource id. We persist it on the token metadata so sync
    // can build resource queries without a UserInfo round-trip.
    const patientId =
      typeof data.patient === 'string' ? data.patient
        : typeof data.patient_id === 'string' ? data.patient_id
          : null

    return {
      id: crypto.randomUUID(),
      integration_id: 'cms-blue-button',
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 3600) * 1000).toISOString(),
      scopes: PATIENT_SCOPES,
      metadata: {
        patient_id: patientId,
        environment: IS_SANDBOX ? 'sandbox' : 'production',
        fhir_base_url: FHIR_BASE,
        userinfo_url: USERINFO_URL,
      },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async refreshToken(token: IntegrationToken): Promise<IntegrationToken> {
    if (!token.refresh_token) {
      throw new Error(
        'Blue Button refresh token missing. The 1-hour access tier does not return refresh tokens; ' +
        'request the 13-month tier in the production access application.',
      )
    }

    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      }),
    })

    if (!res.ok) throw new Error('Blue Button token refresh failed')
    const data = await res.json()
    const now = new Date()

    return {
      ...token,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? token.refresh_token,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async sync(token: IntegrationToken, _startDate: string, _endDate: string): Promise<SyncResult> {
    const syncStart = new Date()
    const errors: string[] = []
    const allEntries: Array<{ resource: Record<string, unknown> }> = []

    const patientId = (token.metadata.patient_id as string | undefined) ?? null

    if (!patientId) {
      return {
        integrationId: 'cms-blue-button',
        success: false,
        recordsSync: 0,
        dateRange: null,
        dataTypes: [],
        errors: [
          'Blue Button token missing patient_id in metadata. Re-run the OAuth flow; the patient id ' +
          'arrives in the token response after the 13-month consent.',
        ],
        duration: Date.now() - syncStart.getTime(),
        syncedAt: new Date().toISOString(),
      }
    }

    for (const { type, query } of RESOURCE_TYPES) {
      try {
        const result = await fetchFhir(query(patientId), token.access_token)
        if (!result) continue

        // Patient returns a single resource; Coverage and EOB return a
        // searchset Bundle. Normalize to entries.
        if ((result as FhirBundle).resourceType === 'Bundle') {
          const entries = ((result as FhirBundle).entry ?? []).filter((e) => e.resource)
          for (const entry of entries) {
            allEntries.push({ resource: entry.resource as Record<string, unknown> })
          }
        } else if ((result as FhirResource).resourceType) {
          allEntries.push({ resource: result as Record<string, unknown> })
        }
      } catch (e) {
        errors.push(`${type}: ${e instanceof Error ? e.message : 'Failed'}`)
      }
    }

    if (allEntries.length === 0) {
      return {
        integrationId: 'cms-blue-button',
        success: errors.length === 0,
        recordsSync: 0,
        dateRange: null,
        dataTypes: ['medical_records'],
        errors,
        duration: Date.now() - syncStart.getTime(),
        syncedAt: new Date().toISOString(),
      }
    }

    // Pipe through the universal import pipeline. The FHIR parser
    // handles Patient + Observation + Condition + MedicationRequest +
    // Procedure + Encounter + DiagnosticReport + AllergyIntolerance +
    // Immunization. ExplanationOfBenefit is silently skipped today;
    // the follow-up doc covers the parser extension required to
    // surface claims as appointments + procedures + medications.
    const combinedBundle = JSON.stringify({
      resourceType: 'Bundle',
      type: 'searchset',
      entry: allEntries,
    })

    const importResult = await runImportPipeline({
      content: combinedBundle,
      fileName: `cms_blue_button_sync_${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/fhir+json',
    })

    const totalRecords = importResult.parseResult.records.length
    const skippedEob = allEntries.filter(
      (e) => (e.resource as { resourceType?: string }).resourceType === 'ExplanationOfBenefit',
    ).length

    if (skippedEob > 0) {
      errors.push(
        `Blue Button returned ${skippedEob} ExplanationOfBenefit resource(s); the FHIR parser does ` +
        `not yet decode CARIN claims. Tracked in docs/plans/2026-05-03-phase-8-followup-eob-parser.md.`,
      )
    }

    // Log the import session so the connector card can render its
    // most-recent-activity summary. Mirrors fhir-portal.ts.
    const sb = createServiceClient()
    try {
      await sb.from('import_history').insert({
        format: 'fhir-bundle',
        file_name: 'CMS Blue Button Sync',
        source_app: 'CMS Blue Button',
        records_imported: totalRecords,
        records_by_type: importResult.parseResult.metadata.byType,
        date_range_start: importResult.parseResult.metadata.dateRange?.earliest ?? null,
        date_range_end: importResult.parseResult.metadata.dateRange?.latest ?? null,
        warnings: importResult.parseResult.warnings,
        errors: importResult.parseResult.errors,
      })
    } catch {
      // import_history is best-effort. Sync still counts as successful
      // when the parser produced records but the audit log insert
      // failed.
    }

    return {
      integrationId: 'cms-blue-button',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: importResult.parseResult.metadata.dateRange
        ? {
            start: importResult.parseResult.metadata.dateRange.earliest,
            end: importResult.parseResult.metadata.dateRange.latest,
          }
        : null,
      dataTypes: ['medical_records'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(_token: IntegrationToken): Promise<void> {
    // Blue Button does not document a token revocation endpoint as of
    // v2. Deleting the row from integration_tokens is sufficient on
    // our side; CMS will let the access token expire naturally.
  },
}

export default cmsBlueButtonConnector
export {
  AUTHORIZE_URL,
  TOKEN_URL,
  FHIR_BASE,
  USERINFO_URL,
  PATIENT_SCOPES,
  buildAuthorizeUrl,
}
