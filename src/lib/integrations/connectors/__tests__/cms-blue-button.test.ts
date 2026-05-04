/**
 * Phase 8 reference connector tests.
 *
 * Verifies that the CMS Blue Button (CARIN Patient Access) connector
 * produces the right OAuth shape and that a CARIN-style payload flows
 * through `runImportPipeline` and lands as parsed records. The FHIR
 * parser at src/lib/import/parsers/fhir.ts intentionally skips
 * ExplanationOfBenefit today (see the followup doc); the test asserts
 * that the connector logs that gap as a non-fatal warning instead of
 * throwing.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { IntegrationToken } from '../../types'

const REAL_FETCH = global.fetch

beforeEach(() => {
  process.env.CMS_BLUE_BUTTON_CLIENT_ID = 'test-client-id'
  process.env.CMS_BLUE_BUTTON_CLIENT_SECRET = 'test-client-secret'
  process.env.CMS_BLUE_BUTTON_SANDBOX = 'true'
})

afterEach(() => {
  delete process.env.CMS_BLUE_BUTTON_CLIENT_ID
  delete process.env.CMS_BLUE_BUTTON_CLIENT_SECRET
  delete process.env.CMS_BLUE_BUTTON_SANDBOX
  delete process.env.CMS_BLUE_BUTTON_PKCE_CHALLENGE
  delete process.env.CMS_BLUE_BUTTON_PKCE_VERIFIER
  global.fetch = REAL_FETCH
  vi.restoreAllMocks()
})

// Stub Supabase so the audit-log insert in sync() does not try to talk
// to the real database during the test.
vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: vi.fn(async () => ({ data: null, error: null })),
    }),
  }),
}))

describe('cms-blue-button connector config', () => {
  it('registers with the hub under the expected id', async () => {
    const { default: connector } = await import('../cms-blue-button')
    expect(connector.config.id).toBe('cms-blue-button')
    expect(connector.config.category).toBe('medical')
    expect(connector.config.authType).toBe('oauth2')
  })

  it('surfaces in getAllConfigs() so the connections page renders the card', async () => {
    await import('../../registry')
    const { getAllConfigs } = await import('../../hub')
    const ids = getAllConfigs().map((c) => c.id)
    expect(ids).toContain('cms-blue-button')
  })

  it('requests CARIN read+search scopes and OpenID profile', async () => {
    const { PATIENT_SCOPES } = await import('../cms-blue-button')
    expect(PATIENT_SCOPES).toContain('patient/Patient.rs')
    expect(PATIENT_SCOPES).toContain('patient/Coverage.rs')
    expect(PATIENT_SCOPES).toContain('patient/ExplanationOfBenefit.rs')
    expect(PATIENT_SCOPES).toContain('openid')
    expect(PATIENT_SCOPES).toContain('profile')
  })

  it('points at the sandbox endpoints by default', async () => {
    const { AUTHORIZE_URL, TOKEN_URL, FHIR_BASE } = await import('../cms-blue-button')
    expect(AUTHORIZE_URL).toMatch(/sandbox\.bluebutton\.cms\.gov\/v2\/o\/authorize/)
    expect(TOKEN_URL).toMatch(/sandbox\.bluebutton\.cms\.gov\/v2\/o\/token/)
    expect(FHIR_BASE).toMatch(/sandbox\.bluebutton\.cms\.gov\/v2\/fhir/)
  })
})

describe('cms-blue-button getAuthUrl', () => {
  it('builds an authorize URL with PKCE S256 and the right query parameters', async () => {
    process.env.CMS_BLUE_BUTTON_PKCE_CHALLENGE =
      'Ds-QWGn89NeT5jpmHLPA3z3oy59hOkbA03B1QS13_CY'
    const { default: connector } = await import('../cms-blue-button')

    const url = new URL(
      connector.getAuthUrl(
        'https://lanaehealth.app/api/integrations/cms-blue-button/callback',
        'state-token-abc',
      ),
    )

    expect(url.host).toBe('sandbox.bluebutton.cms.gov')
    expect(url.pathname).toBe('/v2/o/authorize/')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('state')).toBe('state-token-abc')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe(
      'Ds-QWGn89NeT5jpmHLPA3z3oy59hOkbA03B1QS13_CY',
    )
    expect(url.searchParams.get('scope')).toContain('patient/ExplanationOfBenefit.rs')
  })
})

describe('cms-blue-button exchangeCode', () => {
  it('captures the patient_id and FHIR base URL on token metadata', async () => {
    const tokenResponse = {
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'profile patient/Patient.rs patient/ExplanationOfBenefit.rs patient/Coverage.rs',
      patient: '-20140000000001',
    }

    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify(tokenResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    const { default: connector } = await import('../cms-blue-button')
    const token = await connector.exchangeCode(
      'auth-code-123',
      'https://lanaehealth.app/api/integrations/cms-blue-button/callback',
    )

    expect(token.integration_id).toBe('cms-blue-button')
    expect(token.access_token).toBe('access-abc')
    expect(token.refresh_token).toBe('refresh-xyz')
    expect(token.metadata.patient_id).toBe('-20140000000001')
    expect(token.metadata.environment).toBe('sandbox')
    expect(token.metadata.fhir_base_url).toMatch(/v2\/fhir$/)
  })
})

describe('cms-blue-button sync', () => {
  it('flows a CARIN bundle (Patient + Coverage + EOB) through runImportPipeline', async () => {
    const patientResource = {
      resourceType: 'Patient',
      id: '-20140000000001',
      name: [{ family: 'Doe', given: ['Jane'] }],
      birthDate: '1985-04-15',
      gender: 'female',
    }

    const coverageBundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: [
        {
          resource: {
            resourceType: 'Coverage',
            id: 'part-a-2024',
            status: 'active',
            beneficiary: { reference: 'Patient/-20140000000001' },
            payor: [{ display: 'Centers for Medicare & Medicaid Services' }],
          },
        },
      ],
    }

    // CARIN ExplanationOfBenefit example, structurally faithful to
    // CMS Blue Button v2 sandbox output.
    const eobBundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      entry: [
        {
          resource: {
            resourceType: 'ExplanationOfBenefit',
            id: 'carrier--10114937820',
            status: 'active',
            type: {
              coding: [
                {
                  system: 'https://bluebutton.cms.gov/resources/codesystem/eob-type',
                  code: 'CARRIER',
                  display: 'Carrier',
                },
              ],
            },
            patient: { reference: 'Patient/-20140000000001' },
            billablePeriod: { start: '2025-09-12', end: '2025-09-12' },
            provider: { display: 'Honolulu Internal Medicine' },
            outcome: 'complete',
            diagnosis: [
              {
                sequence: 1,
                diagnosisCodeableConcept: {
                  coding: [
                    { system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'M79.10', display: 'Myalgia' },
                  ],
                },
              },
            ],
          },
        },
      ],
    }

    // Match each FHIR call by URL substring so we can assert ordering
    // and resource-type wiring.
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      let body: unknown
      if (urlStr.includes('/Patient/')) body = patientResource
      else if (urlStr.includes('/Coverage')) body = coverageBundle
      else if (urlStr.includes('/ExplanationOfBenefit')) body = eobBundle
      else body = { resourceType: 'OperationOutcome' }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
      })
    }) as unknown as typeof fetch

    const { default: connector } = await import('../cms-blue-button')

    const token: IntegrationToken = {
      id: 'token-uuid',
      integration_id: 'cms-blue-button',
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      scopes: ['patient/Patient.rs', 'patient/Coverage.rs', 'patient/ExplanationOfBenefit.rs'],
      metadata: {
        patient_id: '-20140000000001',
        environment: 'sandbox',
        fhir_base_url: 'https://sandbox.bluebutton.cms.gov/v2/fhir',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const result = await connector.sync(token, '2024-01-01', '2025-12-31')

    expect(result.integrationId).toBe('cms-blue-button')
    // The FHIR parser today does not decode ExplanationOfBenefit; the
    // connector reports that as a non-fatal warning so that operator
    // dashboards surface it without failing the whole sync.
    expect(result.errors.some((e) => e.includes('ExplanationOfBenefit'))).toBe(true)
    expect(result.dataTypes).toContain('medical_records')
    // The connector should have called all three resource queries.
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('fails gracefully when the token has no patient_id', async () => {
    const { default: connector } = await import('../cms-blue-button')

    const tokenWithoutPatient: IntegrationToken = {
      id: 'token-uuid',
      integration_id: 'cms-blue-button',
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      scopes: ['patient/Patient.rs'],
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const result = await connector.sync(tokenWithoutPatient, '2024-01-01', '2025-12-31')
    expect(result.success).toBe(false)
    expect(result.recordsSync).toBe(0)
    expect(result.errors[0]).toMatch(/patient_id/)
  })
})
