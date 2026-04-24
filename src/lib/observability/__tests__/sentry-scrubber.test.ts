import type { ErrorEvent } from '@sentry/core'
import { describe, expect, it } from 'vitest'

import { sentryBeforeSend } from '../sentry-scrubber'

// ErrorEvent has a discriminator `type: undefined` for error events (vs.
// `type: 'transaction'` for tracing events). Tests construct minimal event
// shapes; the helper applies the discriminator.
function makeEvent(partial: Record<string, unknown>): ErrorEvent {
  return { type: undefined, ...partial } as ErrorEvent
}

describe('sentryBeforeSend PHI scrubber', () => {
  it('redacts known PHI field names in event.extra', () => {
    const event = {
      extra: {
        medication: 'lyrica 75mg',
        diagnosis: 'fibromyalgia',
        innocent_field: 'keep me',
        nested: { pain_level: 8, food: 'salmon' },
      },
    }
    const out = sentryBeforeSend(makeEvent(event), {} as never)
    expect(out).not.toBeNull()
    expect(out?.extra?.medication).toBe('[REDACTED]')
    expect(out?.extra?.diagnosis).toBe('[REDACTED]')
    expect(out?.extra?.innocent_field).toBe('keep me')
    const nested = out?.extra?.nested as Record<string, unknown>
    expect(nested.pain_level).toBe('[REDACTED]')
    expect(nested.food).toBe('[REDACTED]')
  })

  it('drops request body and cookies entirely', () => {
    const event = {
      request: {
        url: 'https://example.com/api/log',
        data: { whatever: 'payload' },
        cookies: { session: 'abc' },
        headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
        query_string: 'medication=lyrica',
      },
    }
    const out = sentryBeforeSend(makeEvent(event), {} as never)
    expect(out?.request?.data).toBe('[REDACTED]')
    expect(out?.request?.cookies).toBeUndefined()
    expect(out?.request?.query_string).toBeUndefined()
    const headers = out?.request?.headers as Record<string, string>
    expect(headers.authorization).toBe('[REDACTED]')
    expect(headers['content-type']).toBe('application/json')
  })

  it('redacts user identity to a generic patient marker', () => {
    const event = { user: { id: 'lanae-real-id', email: 'lanae@example.com' } }
    const out = sentryBeforeSend(makeEvent(event), {} as never)
    expect(out?.user?.id).toBe('patient')
    expect((out?.user as Record<string, unknown>)?.email).toBeUndefined()
  })

  it('case-insensitive matches and substring matches', () => {
    const event = {
      extra: {
        Current_Medications: 'list of meds',
        SymptomDetails: 'should redact',
      },
    }
    const out = sentryBeforeSend(makeEvent(event), {} as never)
    expect(out?.extra?.Current_Medications).toBe('[REDACTED]')
    expect(out?.extra?.SymptomDetails).toBe('[REDACTED]')
  })

  it('passes through events with no PHI fields', () => {
    const event = { extra: { a: 1, b: 'text', c: [1, 2, 3] } }
    const out = sentryBeforeSend(makeEvent(event), {} as never)
    expect(out?.extra).toEqual({ a: 1, b: 'text', c: [1, 2, 3] })
  })
})
