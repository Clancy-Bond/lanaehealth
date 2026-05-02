// Regression tests for the placeholder requireUser() helper.
// Once Track A's canonical helper lands at src/lib/auth/require-user.ts,
// these tests should migrate to cover that implementation.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requireUser, UnauthorizedError } from '../require-user'

const KEYS = ['LANAEHEALTH_AUTH_DISABLED', 'APP_ACCESS_TOKEN'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = {}
  for (const k of KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function reqWith(headers: Record<string, string> = {}): Request {
  return new Request('https://x.test/api/anything', { headers })
}

describe('requireUser', () => {
  it('throws UnauthorizedError when no auth signal is present', async () => {
    await expect(requireUser(reqWith())).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('admits a request with a Supabase auth-token cookie', async () => {
    const u = await requireUser(reqWith({ cookie: 'sb-abc-auth-token=eyJ...' }))
    expect(u).toEqual({ id: 'lanae' })
  })

  it('admits a chunked Supabase auth-token cookie', async () => {
    const u = await requireUser(reqWith({ cookie: 'sb-abc-auth-token.0=part1; sb-abc-auth-token.1=part2' }))
    expect(u).toEqual({ id: 'lanae' })
  })

  it('rejects an unrelated sb-* cookie', async () => {
    await expect(requireUser(reqWith({ cookie: 'sb-something=v' }))).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('admits a matching Bearer token when APP_ACCESS_TOKEN is set', async () => {
    process.env.APP_ACCESS_TOKEN = 'secret-1234'
    const u = await requireUser(reqWith({ authorization: 'Bearer secret-1234' }))
    expect(u).toEqual({ id: 'lanae' })
  })

  it('rejects a Bearer token mismatch', async () => {
    process.env.APP_ACCESS_TOKEN = 'secret-1234'
    await expect(requireUser(reqWith({ authorization: 'Bearer wrong' }))).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('rejects a Bearer token when APP_ACCESS_TOKEN is unset (no implicit accept)', async () => {
    await expect(requireUser(reqWith({ authorization: 'Bearer anything' }))).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('LANAEHEALTH_AUTH_DISABLED=1 short-circuits to a default user', async () => {
    process.env.LANAEHEALTH_AUTH_DISABLED = '1'
    const u = await requireUser(reqWith())
    expect(u).toEqual({ id: 'lanae' })
  })
})
