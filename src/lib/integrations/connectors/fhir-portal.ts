/**
 * SMART on FHIR Patient Portal Connector
 *
 * Connects to any FHIR-compliant patient portal (Epic MyChart, Cerner,
 * Athenahealth, etc.) using the SMART on FHIR authorization framework.
 *
 * The 21st Century Cures Act mandates all US healthcare providers offer
 * FHIR R4 APIs for patient data access. This connector implements the
 * SMART App Launch Framework (OAuth 2.0 + FHIR scopes).
 *
 * Flow:
 * 1. User provides their portal's FHIR base URL (or selects from known list)
 * 2. We discover the auth endpoints from .well-known/smart-configuration
 * 3. User authorizes via their portal
 * 4. We fetch their medical records as FHIR resources
 * 5. Records are parsed by the FHIR parser in the import engine
 */

import { runImportPipeline } from '@/lib/import'
import { createServiceClient } from '@/lib/supabase'
import type { Connector, IntegrationConfig, IntegrationToken, SyncResult } from '../types'

// ── Known FHIR Endpoints ───────────────────────────────────────────

export interface FhirEndpoint {
  name: string
  fhirBaseUrl: string
  description: string
}

const KNOWN_PORTALS: FhirEndpoint[] = [
  {
    name: 'Epic MyChart (Production)',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    description: 'Epic MyChart -- largest US EHR (280M+ patients)',
  },
  {
    name: 'Cerner/Oracle Health',
    fhirBaseUrl: 'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
    description: 'Cerner/Oracle Health -- second largest US EHR',
  },
  {
    name: 'Epic Sandbox (Testing)',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    description: 'Epic sandbox for development testing',
  },
]

// ── SMART Discovery ────────────────────────────────────────────────

interface SmartConfiguration {
  authorization_endpoint: string
  token_endpoint: string
  capabilities: string[]
  scopes_supported?: string[]
}

async function discoverSmartConfig(fhirBaseUrl: string): Promise<SmartConfiguration> {
  // Try .well-known/smart-configuration first (preferred)
  const wellKnownUrl = `${fhirBaseUrl}/.well-known/smart-configuration`
  let res = await fetch(wellKnownUrl)

  if (!res.ok) {
    // Fallback: try metadata endpoint
    const metadataUrl = `${fhirBaseUrl}/metadata`
    res = await fetch(metadataUrl, {
      headers: { Accept: 'application/fhir+json' },
    })

    if (!res.ok) {
      throw new Error(`Cannot discover SMART endpoints at ${fhirBaseUrl}`)
    }

    // Parse CapabilityStatement for OAuth URLs
    const capability = await res.json()
    const security = capability.rest?.[0]?.security
    const oauthExt = security?.extension?.find(
      (e: { url: string }) => e.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris'
    )

    if (!oauthExt) throw new Error('No SMART OAuth configuration found')

    const getUri = (name: string) =>
      oauthExt.extension?.find((e: { url: string }) => e.url === name)?.valueUri

    return {
      authorization_endpoint: getUri('authorize') ?? '',
      token_endpoint: getUri('token') ?? '',
      capabilities: [],
    }
  }

  return res.json()
}

// ── Config ─────────────────────────────────────────────────────────

const PATIENT_SCOPES = [
  'patient/Patient.read',
  'patient/Observation.read',
  'patient/Condition.read',
  'patient/MedicationRequest.read',
  'patient/AllergyIntolerance.read',
  'patient/Immunization.read',
  'patient/Procedure.read',
  'patient/DiagnosticReport.read',
  'patient/Encounter.read',
  'launch/patient',
  'openid',
  'fhirUser',
  'offline_access',
]

const config: IntegrationConfig = {
  id: 'fhir-portal',
  name: 'Patient Portal (FHIR)',
  description: 'Connect to your hospital/clinic patient portal via SMART on FHIR',
  icon: '\u{1F3E5}',
  category: 'medical',
  authType: 'smart_fhir',
  oauth: {
    authorizeUrl: '', // Discovered per-portal
    tokenUrl: '',     // Discovered per-portal
    clientIdEnvVar: 'FHIR_CLIENT_ID',
    clientSecretEnvVar: 'FHIR_CLIENT_SECRET',
    scopes: PATIENT_SCOPES,
    responseType: 'code',
    grantType: 'authorization_code',
    pkce: true,
  },
  dataTypes: ['medical_records', 'labs', 'medications', 'conditions'],
  syncInterval: 1440, // Once per day
  website: '',
}

// ── FHIR Resource Fetching ─────────────────────────────────────────

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

async function fetchFhirBundle(
  fhirBaseUrl: string,
  accessToken: string,
  resourceType: string,
  patientId: string,
): Promise<unknown> {
  const url = `${fhirBaseUrl}/${resourceType}?patient=${patientId}&_count=100`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    },
  })

  if (!res.ok) {
    if (res.status === 403 || res.status === 401) {
      throw new Error(`Access denied for ${resourceType}. May need re-authorization.`)
    }
    return null // Skip resources we can't access
  }

  return res.json()
}

// ── Connector Implementation ───────────────────────────────────────

const fhirPortalConnector: Connector = {
  config,

  getAuthUrl(redirectUri: string, state: string): string {
    // This is called after SMART discovery, so the URLs should be in state metadata
    // The actual auth URL is set dynamically based on the portal chosen
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: PATIENT_SCOPES.join(' '),
      state,
      aud: '', // Set to the FHIR base URL at runtime
    })
    return `?${params.toString()}`
  },

  async exchangeCode(code: string, redirectUri: string): Promise<IntegrationToken> {
    // Token endpoint comes from SMART discovery
    // This will be called by the OAuth callback route with the discovered token URL
    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''

    // The token URL is stored in the state/session during the auth flow
    // For now, throw -- the actual exchange happens in the API route
    throw new Error(
      'FHIR token exchange must be handled by the API route with discovered token URL. ' +
      'Use /api/integrations/fhir-portal/callback instead.'
    )
  },

  async refreshToken(token: IntegrationToken): Promise<IntegrationToken> {
    if (!token.refresh_token) throw new Error('No refresh token')

    const tokenUrl = token.metadata.token_endpoint as string
    if (!tokenUrl) throw new Error('No token endpoint in metadata')

    const clientId = process.env[config.oauth!.clientIdEnvVar] ?? ''

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: clientId,
      }),
    })

    if (!res.ok) throw new Error('FHIR token refresh failed')
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
    let totalRecords = 0

    const fhirBaseUrl = token.metadata.fhir_base_url as string
    const patientId = token.metadata.patient_id as string

    if (!fhirBaseUrl || !patientId) {
      return {
        integrationId: 'fhir-portal',
        success: false,
        recordsSync: 0,
        dateRange: null,
        dataTypes: [],
        errors: ['Missing FHIR base URL or patient ID in token metadata'],
        duration: 0,
        syncedAt: new Date().toISOString(),
      }
    }

    // Fetch all resource types and combine into a single Bundle
    const allEntries: unknown[] = []

    for (const resourceType of RESOURCE_TYPES) {
      try {
        const bundle = await fetchFhirBundle(fhirBaseUrl, token.access_token, resourceType, patientId)
        if (bundle && typeof bundle === 'object' && 'entry' in (bundle as Record<string, unknown>)) {
          const entries = (bundle as { entry?: unknown[] }).entry ?? []
          allEntries.push(...entries)
        }
      } catch (e) {
        errors.push(`${resourceType}: ${e instanceof Error ? e.message : 'Failed'}`)
      }
    }

    if (allEntries.length === 0) {
      return {
        integrationId: 'fhir-portal',
        success: errors.length === 0,
        recordsSync: 0,
        dateRange: null,
        dataTypes: ['medical_records'],
        errors,
        duration: Date.now() - syncStart.getTime(),
        syncedAt: new Date().toISOString(),
      }
    }

    // Create a combined Bundle and run through the import pipeline
    const combinedBundle = JSON.stringify({
      resourceType: 'Bundle',
      type: 'searchset',
      entry: allEntries,
    })

    const importResult = await runImportPipeline({
      content: combinedBundle,
      fileName: `fhir_portal_sync_${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/fhir+json',
    })

    // The import pipeline handles parsing -- now save via the universal import confirm flow
    totalRecords = importResult.parseResult.records.length

    // Log the import
    const sb = createServiceClient()
    await sb.from('import_history').insert({
      format: 'fhir-bundle',
      file_name: `FHIR Portal Sync`,
      source_app: token.metadata.portal_name as string ?? 'Patient Portal',
      records_imported: totalRecords,
      records_by_type: importResult.parseResult.metadata.byType,
      date_range_start: importResult.parseResult.metadata.dateRange?.earliest,
      date_range_end: importResult.parseResult.metadata.dateRange?.latest,
      warnings: importResult.parseResult.warnings,
      errors: importResult.parseResult.errors,
    })

    return {
      integrationId: 'fhir-portal',
      success: errors.length === 0,
      recordsSync: totalRecords,
      dateRange: importResult.parseResult.metadata.dateRange
        ? { start: importResult.parseResult.metadata.dateRange.earliest, end: importResult.parseResult.metadata.dateRange.latest }
        : null,
      dataTypes: ['medical_records', 'labs', 'medications', 'conditions'],
      errors,
      duration: Date.now() - syncStart.getTime(),
      syncedAt: new Date().toISOString(),
    }
  },

  async disconnect(): Promise<void> {
    // FHIR portal tokens are just deleted from our side
  },
}

export default fhirPortalConnector
export { discoverSmartConfig, KNOWN_PORTALS }
