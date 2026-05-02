// Regression tests for safe-error helpers.
//
// safeErrorMessage must return the underlying message in dev (so engineers
// can debug) and a generic fallback in production (so the prod responses
// never leak Postgres column names, Supabase table names, or stack traces).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { safeErrorMessage, safeErrorBody, safeErrorResponse } from '../safe-error'
import { UnauthorizedError } from '../require-user'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV
})

describe('safeErrorMessage', () => {
  it('returns the underlying message in non-production', () => {
    process.env.NODE_ENV = 'test'
    expect(safeErrorMessage(new Error('column foo does not exist'))).toBe(
      'column foo does not exist',
    )
  })

  it('returns the fallback in production', () => {
    process.env.NODE_ENV = 'production'
    expect(safeErrorMessage(new Error('column foo does not exist'), 'ohno')).toBe(
      'ohno',
    )
  })

  it('handles non-Error throws (string, object, undefined) without leaking', () => {
    process.env.NODE_ENV = 'production'
    expect(safeErrorMessage('boom')).toBe('internal_error')
    expect(safeErrorMessage({ secret: 'x' })).toBe('internal_error')
    expect(safeErrorMessage(undefined)).toBe('internal_error')
  })
})

describe('safeErrorBody', () => {
  it('attaches an optional code field', () => {
    process.env.NODE_ENV = 'production'
    expect(safeErrorBody(new Error('x'), { code: 'PG23' })).toEqual({
      error: 'internal_error',
      code: 'PG23',
    })
  })
})

describe('safeErrorResponse', () => {
  it('maps UnauthorizedError to a 401 JSON response', async () => {
    process.env.NODE_ENV = 'production'
    const res = safeErrorResponse(new UnauthorizedError())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('maps any other error to a sanitized 500', async () => {
    process.env.NODE_ENV = 'production'
    const res = safeErrorResponse(new Error('column foo does not exist'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('internal_error')
    expect(body.error).not.toContain('column')
  })
})
