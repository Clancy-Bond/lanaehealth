/**
 * 1upHealth connector tests.
 *
 * Mocks the 1upHealth REST API and the import pipeline to verify:
 *   - getAuthUrl points at https://auth.1up.health/oauth2/authorize and
 *     carries the client ID, redirect URI, scopes, and state.
 *   - sync() pulls every configured FHIR resource type, composes them
 *     into one Bundle, and pipes the Bundle through runImportPipeline.
 *   - import_history gets a row with the right provenance fields.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const importPipelineCalls: Array<{ content: string | Buffer; fileName?: string; mimeType?: string }> = []
const importHistoryInserts: Array<Record<string, unknown>> = []

vi.mock('@/lib/import', () => ({
  runImportPipeline: vi.fn(async (input: { content: string | Buffer; fileName?: string; mimeType?: string }) => {
    importPipelineCalls.push(input)
    const parsed = JSON.parse(typeof input.content === 'string' ? input.content : input.content.toString('utf-8'))
    return {
      detection: { format: 'fhir-bundle' as const, confidence: 1, source: 'mock' },
      parseResult: {
        records: (parsed.entry ?? []).map((entry: { resource?: { resourceType?: string; id?: string } }, i: number) => ({
          id: `mock-${i}`,
          type: 'lab-result' as const,
          confidence: 0.99,
          data: { rawType: entry.resource?.resourceType ?? 'unknown' },
          source: { name: '1upHealth', importedAt: new Date().toISOString() },
        })),
        warnings: [],
        errors: [],
        metadata: {
          totalExtracted: parsed.entry?.length ?? 0,
          byType: { 'lab-result': parsed.entry?.length ?? 0 },
          dateRange: { earliest: '2026-04-01', latest: '2026-04-29' },
          sourceName: '1upHealth',
        },
      },
    }
  }),
}))

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      insert: (payload: Record<string, unknown>) => {
        if (table === 'import_history') importHistoryInserts.push(payload)
        return Promise.resolve({ data: null, error: null })
      },
    }),
  }),
  supabase: {},
}))

// ── Fetch mock ─────────────────────────────────────────────────────

interface MockResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

function makeJsonResponse(body: unknown, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

// ── Suite ──────────────────────────────────────────────────────────

import oneUpHealthConnector, {
  AUTHORIZE_URL,
  TOKEN_URL,
  FHIR_BASE_URL,
  RESOURCE_TYPES,
} from '../oneup-health'
import type { IntegrationToken } from '../../types'

const fetchMock = vi.fn()

beforeEach(() => {
  importPipelineCalls.length = 0
  importHistoryInserts.length = 0
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
  process.env.ONEUP_CLIENT_ID = 'test-client-id'
  process.env.ONEUP_CLIENT_SECRET = 'test-client-secret'
  delete process.env.ONEUP_REDIRECT_URI
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.ONEUP_CLIENT_ID
  delete process.env.ONEUP_CLIENT_SECRET
  delete process.env.ONEUP_REDIRECT_URI
})

describe('oneUpHealthConnector.getAuthUrl', () => {
  it('builds an authorize URL pointed at auth.1up.health with client id, redirect, scope, state', () => {
    const url = oneUpHealthConnector.getAuthUrl(
      'https://lanaehealth.app/api/integrations/oneup-health/callback',
      'state-abc',
    )

    expect(url.startsWith(AUTHORIZE_URL)).toBe(true)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://lanaehealth.app/api/integrations/oneup-health/callback',
    )
    expect(parsed.searchParams.get('state')).toBe('state-abc')
    const scope = parsed.searchParams.get('scope') ?? ''
    expect(scope).toContain('user/*.read')
    expect(scope).toContain('patient/*.read')
    expect(scope).toContain('offline_access')
  })

  it('honors ONEUP_REDIRECT_URI override when set', () => {
    process.env.ONEUP_REDIRECT_URI = 'https://prod.lanaehealth.app/cb'
    const url = oneUpHealthConnector.getAuthUrl('https://localhost/cb', 'state-1')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://prod.lanaehealth.app/cb')
  })
})

describe('oneUpHealthConnector.sync', () => {
  const baseToken: IntegrationToken = {
    id: 'tok-1',
    integration_id: 'oneup-health',
    access_token: 'live-access-token',
    refresh_token: 'live-refresh-token',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scopes: ['user/*.read', 'patient/*.read', 'openid', 'offline_access'],
    metadata: { patient_id: 'patient-123', fhir_base_url: FHIR_BASE_URL },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  it('fetches every resource type, composes one Bundle, runs the import pipeline', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      // Verify every URL is anchored at the documented FHIR base.
      if (!url.startsWith(FHIR_BASE_URL)) {
        throw new Error(`unexpected fetch URL: ${url}`)
      }
      // Each resource returns one fake entry; no pagination.
      const u = new URL(url)
      const resourceType = u.pathname.split('/').pop() ?? ''
      return makeJsonResponse({
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          {
            resource: { resourceType, id: `${resourceType}-1` },
          },
        ],
      })
    })

    const result = await oneUpHealthConnector.sync(baseToken, '2026-04-01', '2026-04-29')

    // One fetch per RESOURCE_TYPE, no pagination.
    expect(fetchMock).toHaveBeenCalledTimes(RESOURCE_TYPES.length)

    // The pipeline got called exactly once with a single Bundle.
    expect(importPipelineCalls).toHaveLength(1)
    const pipelineInput = importPipelineCalls[0]
    expect(pipelineInput.mimeType).toBe('application/fhir+json')
    expect(pipelineInput.fileName).toMatch(/^oneup_health_sync_\d{4}-\d{2}-\d{2}\.json$/)

    const bundle = JSON.parse(typeof pipelineInput.content === 'string' ? pipelineInput.content : pipelineInput.content.toString('utf-8'))
    expect(bundle.resourceType).toBe('Bundle')
    expect(bundle.type).toBe('searchset')
    expect(bundle.entry).toHaveLength(RESOURCE_TYPES.length)

    // The Bundle carries one resource of each expected type.
    const typesInBundle = bundle.entry.map((e: { resource?: { resourceType?: string } }) => e.resource?.resourceType).sort()
    expect(typesInBundle).toEqual([...RESOURCE_TYPES].sort())

    // import_history got a provenance row.
    expect(importHistoryInserts).toHaveLength(1)
    expect(importHistoryInserts[0]).toMatchObject({
      format: 'fhir-bundle',
      file_name: '1upHealth Sync',
      source_app: '1upHealth',
      records_imported: RESOURCE_TYPES.length,
    })

    // SyncResult shape.
    expect(result.integrationId).toBe('oneup-health')
    expect(result.success).toBe(true)
    expect(result.recordsSync).toBe(RESOURCE_TYPES.length)
    expect(result.dateRange).toEqual({ start: '2026-04-01', end: '2026-04-29' })
    expect(result.dataTypes).toContain('medical_records')
    expect(result.errors).toEqual([])
  })

  it('discovers patient ID from /Patient when token metadata has none', async () => {
    const tokenNoPatient: IntegrationToken = {
      ...baseToken,
      metadata: { fhir_base_url: FHIR_BASE_URL },
    }

    fetchMock.mockImplementation(async (url: string) => {
      const u = new URL(url)
      if (u.pathname === '/r4/Patient' && !u.searchParams.has('patient')) {
        // The discovery call.
        return makeJsonResponse({
          resourceType: 'Bundle',
          entry: [{ resource: { resourceType: 'Patient', id: 'discovered-pid' } }],
        })
      }
      // Subsequent resource fetches.
      const resourceType = u.pathname.split('/').pop() ?? ''
      return makeJsonResponse({
        resourceType: 'Bundle',
        entry: [{ resource: { resourceType, id: `${resourceType}-1` } }],
      })
    })

    const result = await oneUpHealthConnector.sync(tokenNoPatient, '2026-04-01', '2026-04-29')

    // The first fetch was the discovery call.
    expect(fetchMock.mock.calls[0][0]).toBe(`${FHIR_BASE_URL}/Patient`)
    expect(result.success).toBe(true)
    expect(result.recordsSync).toBeGreaterThan(0)

    // After discovery, every non-Patient resource fetch carried `patient=discovered-pid`.
    const nonPatientCalls = fetchMock.mock.calls
      .map(([u]) => new URL(u as string))
      .filter((u) => u.pathname !== '/r4/Patient' || u.searchParams.has('patient'))
    for (const u of nonPatientCalls) {
      if (u.pathname.endsWith('/Patient') && !u.searchParams.has('patient')) continue
      // Patient-resource fetch (the type) does not require the patient param.
      if (u.pathname.endsWith('/Patient')) continue
      expect(u.searchParams.get('patient')).toBe('discovered-pid')
    }
  })

  it('returns failure with no pipeline call when the patient cannot be resolved', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse({ resourceType: 'Bundle', entry: [] }))

    const result = await oneUpHealthConnector.sync(
      { ...baseToken, metadata: { fhir_base_url: FHIR_BASE_URL } },
      '2026-04-01',
      '2026-04-29',
    )

    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain('Could not resolve patient ID')
    expect(importPipelineCalls).toHaveLength(0)
    expect(importHistoryInserts).toHaveLength(0)
  })
})

describe('oneUpHealthConnector.exchangeCode', () => {
  it('hits auth.1up.health/oauth2/token with grant_type=authorization_code and stores patient + scope in metadata', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === TOKEN_URL) {
        const body = init?.body
        const params = new URLSearchParams(body as string)
        expect(params.get('grant_type')).toBe('authorization_code')
        expect(params.get('code')).toBe('auth-code-xyz')
        expect(params.get('client_id')).toBe('test-client-id')
        expect(params.get('client_secret')).toBe('test-client-secret')
        return makeJsonResponse({
          access_token: 'fresh-access',
          refresh_token: 'fresh-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'user/*.read patient/*.read openid offline_access',
          patient: 'pid-from-token',
        })
      }
      // Patient discovery after exchange.
      return makeJsonResponse({
        resourceType: 'Bundle',
        entry: [{ resource: { resourceType: 'Patient', id: 'pid-from-token' } }],
      })
    })

    const tok = await oneUpHealthConnector.exchangeCode(
      'auth-code-xyz',
      'https://lanaehealth.app/api/integrations/oneup-health/callback',
    )

    expect(tok.integration_id).toBe('oneup-health')
    expect(tok.access_token).toBe('fresh-access')
    expect(tok.refresh_token).toBe('fresh-refresh')
    expect(tok.metadata.patient_id).toBe('pid-from-token')
    expect(tok.metadata.fhir_base_url).toBe(FHIR_BASE_URL)
  })
})
