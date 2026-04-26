/**
 * Unit tests for the passkey helpers.
 *
 * We mock @simplewebauthn/server so the tests do not actually verify
 * real WebAuthn responses (that's the browser's job at runtime). The
 * focus here is on:
 *   - Reading the env into rpName / rpID / origin.
 *   - Persisting and validating challenges.
 *   - Looking up credentials by id.
 *   - Updating counter + last_used_at on success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}))
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = mocks

vi.mock('@simplewebauthn/server', () => mocks)

import {
  base64ToBytes,
  bytesToBase64,
  buildAuthenticationOptions,
  buildRegistrationOptions,
  readPasskeyEnv,
  verifyAndStoreRegistration,
  verifyAuthentication,
} from '../passkey'

interface FakeRow {
  id: string
  user_id: string | null
  session_id: string | null
  kind?: string
  challenge?: string
  expires_at?: string
}

function makeClient(initial: {
  passkey_credentials?: unknown[]
  passkey_challenges?: FakeRow[]
}) {
  const credentials = (initial.passkey_credentials ?? []) as Array<Record<string, unknown>>
  const challenges = (initial.passkey_challenges ?? []) as FakeRow[]
  const updates: Record<string, Array<Record<string, unknown>>> = {}
  const inserts: Record<string, Array<Record<string, unknown>>> = {}
  const deletes: Record<string, Array<Record<string, unknown>>> = {}

  function from(table: string) {
    return {
      select(_cols?: string) {
        const rows = table === 'passkey_credentials' ? credentials : challenges
        let filtered = [...rows]
        const builder = {
          eq(col: string, val: unknown) {
            filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === val)
            return builder
          },
          single() {
            return Promise.resolve({ data: filtered[0] ?? null, error: null })
          },
          order() {
            return builder
          },
          limit() {
            return builder
          },
          then(resolve: (v: { data: unknown[]; error: null }) => void) {
            resolve({ data: filtered, error: null })
          },
        }
        return builder as unknown as {
          eq: (col: string, val: unknown) => typeof builder
          single: () => Promise<{ data: unknown; error: null }>
          then: (cb: (v: { data: unknown[]; error: null }) => void) => void
        }
      },
      insert(values: Record<string, unknown> | Record<string, unknown>[]) {
        inserts[table] = inserts[table] ?? []
        const arr = Array.isArray(values) ? values : [values]
        for (const v of arr) inserts[table].push(v)
        const id = `id-${inserts[table].length}`
        const inserted = { ...arr[0], id }
        if (table === 'passkey_challenges') {
          challenges.push(inserted as FakeRow)
        } else if (table === 'passkey_credentials') {
          credentials.push(inserted)
        }
        return {
          select() {
            return {
              single() {
                return Promise.resolve({ data: { id }, error: null })
              },
            }
          },
        }
      },
      update(values: Record<string, unknown>) {
        updates[table] = updates[table] ?? []
        updates[table].push(values)
        return {
          eq() {
            return Promise.resolve({ error: null })
          },
        }
      },
      delete() {
        deletes[table] = deletes[table] ?? []
        return {
          eq() {
            return Promise.resolve({ error: null })
          },
        }
      },
    }
  }
  return {
    from,
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => ({
          data: { user: { id, email: 'lanae@example.com' } },
          error: null,
        })),
      },
    },
    _state: { credentials, challenges, inserts, updates, deletes },
  }
}

describe('readPasskeyEnv', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('falls back to localhost when NEXT_PUBLIC_APP_URL is missing', () => {
    expect(readPasskeyEnv()).toEqual({
      rpName: 'LanaeHealth',
      rpID: 'localhost',
      origin: 'http://localhost:3005',
    })
  })

  it('parses production app url', () => {
    expect(readPasskeyEnv('https://lanaehealth.vercel.app')).toEqual({
      rpName: 'LanaeHealth',
      rpID: 'lanaehealth.vercel.app',
      origin: 'https://lanaehealth.vercel.app',
    })
  })
})

describe('bytesToBase64 + base64ToBytes', () => {
  it('roundtrips bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 250, 251, 252])
    const b64 = bytesToBase64(bytes)
    expect(typeof b64).toBe('string')
    const back = base64ToBytes(b64)
    expect(Array.from(back)).toEqual(Array.from(bytes))
  })
})

describe('buildRegistrationOptions', () => {
  beforeEach(() => {
    generateRegistrationOptions.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds options + persists a challenge', async () => {
    generateRegistrationOptions.mockResolvedValue({ challenge: 'C1', rp: { name: 'LH' } })
    const client = makeClient({})
    const result = await buildRegistrationOptions({
      userId: 'u1',
      userEmail: 'a@b.com',
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client shape narrows enough for the tests
      client,
    })
    expect(result.options.challenge).toBe('C1')
    expect(result.challengeId).toMatch(/^id-/)
    expect(client._state.inserts.passkey_challenges?.[0]?.kind).toBe('register')
    expect(client._state.inserts.passkey_challenges?.[0]?.user_id).toBe('u1')
  })

  it('passes existing credentials as excludeCredentials', async () => {
    generateRegistrationOptions.mockResolvedValue({ challenge: 'X', rp: { name: 'LH' } })
    const client = makeClient({
      passkey_credentials: [
        { user_id: 'u1', credential_id: 'cred-1', transports: ['internal'] },
        { user_id: 'u1', credential_id: 'cred-2', transports: [] },
      ],
    })
    await buildRegistrationOptions({
      userId: 'u1',
      userEmail: null,
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client
      client,
    })
    const args = generateRegistrationOptions.mock.calls[0][0]
    expect(args.excludeCredentials).toEqual([
      { id: 'cred-1', transports: ['internal'] },
      { id: 'cred-2', transports: undefined },
    ])
  })
})

describe('verifyAndStoreRegistration', () => {
  beforeEach(() => {
    verifyRegistrationResponse.mockReset()
  })

  it('rejects when challenge is missing', async () => {
    const client = makeClient({})
    const result = await verifyAndStoreRegistration({
      userId: 'u1',
      challengeId: 'nope',
      response: {} as never,
      deviceName: 'x',
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client
      client,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('challenge expired or not found')
  })

  it('rejects when challenge belongs to a different user', async () => {
    const client = makeClient({
      passkey_challenges: [
        {
          id: 'c1',
          user_id: 'someone-else',
          session_id: null,
          kind: 'register',
          challenge: 'X',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    })
    const result = await verifyAndStoreRegistration({
      userId: 'u1',
      challengeId: 'c1',
      response: {} as never,
      deviceName: 'x',
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client
      client,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('challenge does not belong to user')
  })

  it('rejects when challenge has expired', async () => {
    const client = makeClient({
      passkey_challenges: [
        {
          id: 'c1',
          user_id: 'u1',
          session_id: null,
          kind: 'register',
          challenge: 'X',
          expires_at: new Date(Date.now() - 1).toISOString(),
        },
      ],
    })
    const result = await verifyAndStoreRegistration({
      userId: 'u1',
      challengeId: 'c1',
      response: {} as never,
      deviceName: 'x',
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client
      client,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('challenge expired')
  })

  it('persists the credential when verification succeeds', async () => {
    verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credentialBackedUp: true,
        credential: {
          id: 'cred-new',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
        },
      },
    })
    const client = makeClient({
      passkey_challenges: [
        {
          id: 'c1',
          user_id: 'u1',
          session_id: null,
          kind: 'register',
          challenge: 'X',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    })
    const result = await verifyAndStoreRegistration({
      userId: 'u1',
      challengeId: 'c1',
      response: {} as never,
      deviceName: 'iPhone',
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client
      client,
    })
    expect(result.ok).toBe(true)
    expect(result.credentialId).toBe('cred-new')
    expect(client._state.inserts.passkey_credentials?.[0]).toMatchObject({
      user_id: 'u1',
      credential_id: 'cred-new',
      device_name: 'iPhone',
      backup_eligible: true,
      backup_state: true,
    })
  })
})

describe('buildAuthenticationOptions', () => {
  it('persists an authenticate-kind challenge keyed by session_id', async () => {
    generateAuthenticationOptions.mockResolvedValue({ challenge: 'AUTH' })
    const client = makeClient({})
    const result = await buildAuthenticationOptions({
      sessionId: 'session-1',
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client
      client,
    })
    expect(result.options.challenge).toBe('AUTH')
    expect(client._state.inserts.passkey_challenges?.[0]?.kind).toBe('authenticate')
    expect(client._state.inserts.passkey_challenges?.[0]?.session_id).toBe('session-1')
  })
})

describe('verifyAuthentication', () => {
  beforeEach(() => {
    verifyAuthenticationResponse.mockReset()
  })

  it('rejects when the assertion does not match a known credential', async () => {
    const client = makeClient({
      passkey_challenges: [
        {
          id: 'c1',
          user_id: null,
          session_id: 'session-1',
          kind: 'authenticate',
          challenge: 'X',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    })
    const result = await verifyAuthentication({
      sessionId: 'session-1',
      challengeId: 'c1',
      response: { id: 'unknown' } as never,
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client
      client,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('no credential matches this device')
  })

  it('returns the user id and updates counter on success', async () => {
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 7 },
    })
    const pubB64 = bytesToBase64(new Uint8Array([9, 9, 9]))
    const client = makeClient({
      passkey_credentials: [
        {
          id: 'r1',
          user_id: 'u1',
          credential_id: 'cred-1',
          public_key: pubB64,
          counter: 0,
          transports: ['internal'],
        },
      ],
      passkey_challenges: [
        {
          id: 'c1',
          user_id: null,
          session_id: 'session-1',
          kind: 'authenticate',
          challenge: 'X',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    })
    const result = await verifyAuthentication({
      sessionId: 'session-1',
      challengeId: 'c1',
      response: { id: 'cred-1' } as never,
      env: { rpName: 'LH', rpID: 'localhost', origin: 'http://localhost:3005' },
      // @ts-expect-error fake client
      client,
    })
    expect(result.ok).toBe(true)
    expect(result.userId).toBe('u1')
    expect(result.email).toBe('lanae@example.com')
    expect(client._state.updates.passkey_credentials?.[0]).toMatchObject({ counter: 7 })
  })
})
