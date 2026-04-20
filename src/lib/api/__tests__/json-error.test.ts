// Locks in the production-vs-dev behavior of jsonError / safeMessage.
// The helper is the lever we pull to stop DB error messages (Postgres
// hints, column names, etc.) from leaking to the browser in prod.

import { describe, it, expect, afterEach } from 'vitest'
import { jsonError, safeMessage } from '../json-error'

const ORIGINAL_ENV = process.env.NODE_ENV

function setNodeEnv(value: string) {
  // Assign via bracket access. Node 24 exposes NODE_ENV as a non-
  // configurable property, so `Object.defineProperty` throws; direct
  // assignment is fine.
  ;(process.env as Record<string, string>).NODE_ENV = value
}

afterEach(() => {
  setNodeEnv(ORIGINAL_ENV ?? 'test')
})

describe('safeMessage', () => {
  it('returns the real message outside production', () => {
    setNodeEnv('development')
    expect(safeMessage(new Error('column "x" does not exist'))).toBe(
      'column "x" does not exist',
    )
  })

  it('returns the generic fallback in production', () => {
    setNodeEnv('production')
    expect(safeMessage(new Error('column "x" does not exist'))).toBe(
      'Internal error.',
    )
  })

  it('uses the custom fallback when provided', () => {
    setNodeEnv('production')
    expect(safeMessage(new Error('rls denied'), 'Update failed.')).toBe(
      'Update failed.',
    )
  })
})

describe('jsonError', () => {
  it('returns JSON with a generic message in production', async () => {
    setNodeEnv('production')
    const res = jsonError(500, 'db_update_failed', new Error('relation foo missing'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'Internal error.', code: 'db_update_failed' })
  })

  it('returns the raw dev message outside production', async () => {
    setNodeEnv('development')
    const res = jsonError(500, 'db_update_failed', new Error('relation foo missing'))
    const body = await res.json()
    expect(body.error).toBe('relation foo missing')
    expect(body.code).toBe('db_update_failed')
  })

  it('maps status to a sensible default message without err', async () => {
    setNodeEnv('production')
    const res = jsonError(400, 'bad_body')
    const body = await res.json()
    expect(body).toEqual({ error: 'Bad request.', code: 'bad_body' })
  })
})
