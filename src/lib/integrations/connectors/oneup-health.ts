/**
 * 1upHealth Aggregator Connector (Phase 5)
 *
 * 1upHealth is a FHIR aggregator that brokers OAuth connections to hundreds
 * of EHRs through a single integration. This connector is the catch-all for
 * any provider that is not covered by Apple Health Records (Phase 2) and is
 * not on a direct SMART on FHIR connection (`fhir-portal.ts`).
 *
 * Flow:
 * 1. User clicks Connect on the v2 Connections page.
 * 2. We redirect them to 1upHealth's authorize endpoint with our client ID.
 * 3. 1upHealth runs their Connect Patient surface so the user can pick a
 *    health system and authenticate against the patient portal.
 * 4. 1upHealth redirects back to our callback with an authorization code.
 * 5. We exchange the code for an access token at the token endpoint.
 * 6. The token is good against `https://api.1up.health/r4`. We pull the
 *    same nine FHIR R4 resource types as `fhir-portal.ts`, assemble them
 *    into a single Bundle, and run the Bundle through the universal import
 *    pipeline so it lands in the canonical tables.
 *
 * Endpoint paths verified against the public 1upHealth docs:
 *   https://docs.1up.health/help-center/Content/en-US/get-started/quick-start/oauth2-access.html
 *   https://docs.1up.health/help-center/Content/en-US/connect-patient/connect-patient-api.html
 *
 * Required env vars (filled in by the operator after signing up at 1up.health):
 *   ONEUP_CLIENT_ID
 *   ONEUP_CLIENT_SECRET
 *   ONEUP_REDIRECT_URI (optional override; otherwise derived from the request origin)
 *
 * The connector is "live" the moment ONEUP_CLIENT_ID is set in the env. The
 * Connections page already auto-renders every registered connector and
 * routes Connect through `/api/integrations/oneup-health/authorize`, which
 * calls `getAuthUrl()` below.
 */

import { runImportPipeline } from '@/lib/import'
import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

// ── Endpoints ──────────────────────────────────────────────────────

const AUTH_HOST = 'https://auth.1up.health'
const API_HOST = 'https://api.1up.health'

const AUTHORIZE_URL = `${AUTH_HOST}/oauth2/authorize`
const TOKEN_URL = `${AUTH_HOST}/oauth2/token`
const FHIR_BASE_URL = `${API_HOST}/r4`

// ── Scopes ─────────────────────────────────────────────────────────

// 1upHealth defaults to `user/*.read`. We also request `patient/*.read` so
// the connection works for both user-managed flows and Connect Patient
// flows where the patient is identified by the upstream EHR.
const PATIENT_SCOPES = [
  'user/*.read',
  'patient/*.read',
  'openid',
  'offline_access',
]

// ── Resource types ────────────────────────────────────────────────

// Same nine resource types as the SMART on FHIR direct connector. Keeping
// them aligned means the FHIR parser handles both surfaces identically.
const RESOURCE_TYPES = [
  'Patient',
  'Observation',
  'Condition',
  'MedicationRequest',
  'AllergyIntolerance',
  'Immunization',
  'Procedure',
  'DiagnosticReport',
  'Encounter',
]

// ── Config ─────────────────────────────────────────────────────────

const config: IntegrationConfig = {
  id: 'oneup-health',
  name: '1upHealth (Aggregator)',
  description:
    'Connect any patient portal through 1upHealth. Hundreds of EHRs (Epic, Cerner, athenahealth, eClinicalWorks, NextGen, ModMed, Meditech, and more) covered by a single sign-in.',
  icon: '\u{1F310}',
  category: 'medical',
  authType: 'oauth2',
  oauth: {
    authorizeUrl: AUTHORIZE_URL,
    tokenUrl: TOKEN_URL,
    clientIdEnvVar: 'ONEUP_CLIENT_ID',
    clientSecretEnvVar: 'ONEUP_CLIENT_SECRET',
    scopes: PATIENT_SCOPES,
    responseType: 'code',
    grantType: 'authorization_code',
  },
  dataTypes: ['medical_records', 'labs', 'medications', 'conditions'],
  syncInterval: 1440, // Once per day
  website: 'https://1up.health',
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Resolve the redirect URI. ONEUP_REDIRECT_URI takes precedence so the
 * operator can pin the registered callback URL in the 1upHealth dashboard
 * without depending on request-time origin sniffing.
 */
function resolveRedirectUri(redirectUri: string): string {
  return process.env.ONEUP_REDIRECT_URI ?? redirectUri
}

interface OneUpTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  patient?: string
  app_user_id?: string
}

interface FhirBundleEntry {
  resource?: { resourceType?: string; id?: string }
  fullUrl?: string
}

interface FhirBundleResponse {
  resourceType: 'Bundle'
  entry?: FhirBundleEntry[]
  link?: Array<{ relation?: string; url?: string }>
}

/**
 * Fetch all entries for a single FHIR resource type, following next-page
 * links. Returns the entries; the caller composes them into one Bundle.
 */
async function fetchAllEntries(
  resourceType: string,
  accessToken: string,
  patientId: string | null,
): Promise<{ entries: FhirBundleEntry[]; error: string | null }> {
  const params = new URLSearchParams({ _count: '100' })
  // Patient resource itself does not need the patient filter.
  if (resourceType !== 'Patient' && patientId) {
    params.set('patient', patientId)
  }
  let nextUrl: string | null = `${FHIR_BASE_URL}/${resourceType}?${params.toString()}`
  const collected: FhirBundleEntry[] = []
  // Hard cap on pagination to prevent runaway loops.
  let pages = 0
  const PAGE_CAP = 50

  while (nextUrl && pages < PAGE_CAP) {
    pages++
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json',
      },
    })

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          entries: collected,
          error: `${resourceType}: access denied (${res.status})`,
        }
      }
      // Skip resources the user has not granted (404 / 410 / 5xx are surfaced
      // as warnings rather than failing the whole sync).
      return { entries: collected, error: `${resourceType}: HTTP ${res.status}` }
    }

    const bundle = (await res.json()) as FhirBundleResponse
    if (Array.isArray(bundle.entry)) {
      collected.push(...bundle.entry)
    }
    const next = bundle.link?.find((l) => l.relation === 'next')?.url
    nextUrl = next ?? null
  }

  return { entries: collected, error: null }
}

/**
 * Pull the canonical Patient ID from the bearer token's /Patient endpoint.
 * 1upHealth returns a Bundle of the patient(s) the token grants access to.
 */
async function discoverPatientId(accessToken: string, hint: string | null): Promise<string | null> {
  if (hint) return hint
  const res = await fetch(`${FHIR_BASE_URL}/Patient`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    },
  })
  if (!res.ok) return null
  const bundle = (await res.json()) as FhirBundleResponse
  const first = bundle.entry?.[0]?.resource
  return first?.id ?? null
}

// ── Connector ──────────────────────────────────────────────────────

const oneUpHealthConnector: Connector = {
  config,

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: resolveRedirectUri(redirectUri),
      scope: config.oauth!.scopes.join(' '),
      state,
    })
    return `${AUTHORIZE_URL}?${params.toString()}`
  },

  async exchangeCode(code: string, redirectUri: string): Promise<IntegrationToken> {
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: resolveRedirectUri(redirectUri),
      }),
    })

    if (!res.ok) {
      throw new Error(`1upHealth token exchange failed: ${await res.text()}`)
    }

    const data = (await res.json()) as OneUpTokenResponse
    const now = new Date()

    // Try to resolve the patient ID up front so the first sync does not
    // need an extra round-trip. If it fails (patient not yet selected by
    // the user, multi-patient scope), the sync method will resolve it.
    const patientId = await discoverPatientId(data.access_token, data.patient ?? null)

    return {
      id: crypto.randomUUID(),
      integration_id: 'oneup-health',
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      expires_at: new Date(now.getTime() + (data.expires_in ?? 3600) * 1000).toISOString(),
      scopes: config.oauth!.scopes,
      metadata: {
        patient_id: patientId,
        app_user_id: data.app_user_id ?? null,
        scope: data.scope ?? config.oauth!.scopes.join(' '),
        fhir_base_url: FHIR_BASE_URL,
      },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
  },

  async refreshToken(token: IntegrationToken): Promise<IntegrationToken> {
    if (!token.refresh_token) throw new Error('1upHealth token has no refresh_token')

    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const clientSecret = process.env[config.oauth!.clientSecretEnvVar] ?? ''

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!res.ok) {
      throw new Error(`1upHealth token refresh failed: ${await res.text()}`)
    }

    const data = (await res.json()) as OneUpTokenResponse
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

    // Resolve the Patient ID from token metadata if available, otherwise
    // discover it via /Patient. The metadata branch is the hot path.
    const knownPatient = (token.metadata.patient_id as string | null) ?? null
    const patientId = await discoverPatientId(token.access_token, knownPatient)

    if (!patientId) {
      return {
        integrationId: 'oneup-health',
        success: false,
        recordsSync: 0,
        dateRange: null,
        dataTypes: [],
        errors: [
          'Could not resolve patient ID from 1upHealth. The user may not have completed Connect Patient yet.',
        ],
        duration: Date.now() - syncStart.getTime(),
        syncedAt: new Date().toISOString(),
      }
    }

    // Pull every resource type in parallel. Each call paginates internally.
    const allEntries: FhirBundleEntry[] = []
    for (const resourceType of RESOURCE_TYPES) {
      try {
        const { entries, error } = await fetchAllEntries(
          resourceType,
          token.access_token,
          resourceType === 'Patient' ? null : patientId,
        )
        if (entries.length > 0) {
          allEntries.push(...entries)
        }
        if (error) errors.push(error)
      } catch (e) {
        errors.push(`${resourceType}: ${e instanceof Error ? e.message : 'fetch failed'}`)
      }
    }

    if (allEntries.length === 0) {
      return {
        integrationId: 'oneup-health',
        success: errors.length === 0,
        recordsSync: 0,
        dateRange: null,
        dataTypes: ['medical_records'],
        errors,
        duration: Date.now() - syncStart.getTime(),
        syncedAt: new Date().toISOString(),
      }
    }

    // Compose into a single Bundle and run through the universal pipeline.
    const combinedBundle = JSON.stringify({
      resourceType: 'Bundle',
      type: 'searchset',
      entry: allEntries,
    })

    const importResult = await runImportPipeline({
      content: combinedBundle,
      fileName: `oneup_health_sync_${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/fhir+json',
    })

    const totalRecords = importResult.parseResult.records.length
    const dateRange = importResult.parseResult.metadata.dateRange ?? null

    // Log the import so the user can see provenance in their import history.
    const sb = createServiceClient()
    await sb.from('import_history').insert({
      format: 'fhir-bundle',
      file_name: '1upHealth Sync',
      source_app: '1upHealth',
      records_imported: totalRecords,
      records_by_type: importResult.parseResult.metadata.byType,
      date_range_start: dateRange?.earliest ?? null,
      date_range_end: dateRange?.latest ?? null,
      warnings: importResult.parseResult.warnings,
      errors: importResult.parseResult.errors,
    })

    return {
      integrationId: 'oneup-health',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: dateRange ? { start: dateRange.earliest, end: dateRange.latest } : null,
      dataTypes: ['medical_records', 'labs', 'medications', 'conditions'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(): Promise<void> {
    // 1upHealth does not currently expose a public token revocation endpoint
    // for Patient Connect. The hub deletes the token row, which is sufficient
    // because we no longer hold a valid access token after that.
  },
}

export default oneUpHealthConnector
export { AUTHORIZE_URL, TOKEN_URL, FHIR_BASE_URL, RESOURCE_TYPES, PATIENT_SCOPES }
