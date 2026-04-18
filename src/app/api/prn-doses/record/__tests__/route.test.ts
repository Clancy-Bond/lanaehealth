// ---------------------------------------------------------------------------
// Tests for POST /api/prn-doses/record (Wave 2e F7).
//
// The route is a thin validator + adapter over lib/api/prn-doses.ts
// recordPrnDose(). We mock that module entirely so these tests stay
// fast and never touch Supabase. The important behaviors:
//   - 400 on missing / empty medicationName
//   - 400 on non-numeric pollDelayMinutes
//   - 400 on invalid JSON body
//   - 200 OK on a valid minimal payload, with the row echoed back
//   - 200 OK on a full payload, forwarding trimmed strings + numbers
//   - 500 when recordPrnDose throws a generic DB error
//   - 400 when recordPrnDose throws a helper-level validation error
//     (e.g. "recordPrnDose: invalid doseTime ...")
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Collect recordPrnDose invocations so assertions can inspect them.
const calls: Array<Record<string, unknown>> = []
let impl: (input: Record<string, unknown>) => Promise<unknown> = async (input) => ({
  id: 'row-1',
  medication_name: input.medicationName,
})

vi.mock('@/lib/api/prn-doses', () => ({
  recordPrnDose: vi.fn(async (input: Record<string, unknown>) => {
    calls.push(input)
    return impl(input)
  }),
}))

import { POST } from '@/app/api/prn-doses/record/route'

beforeEach(() => {
  calls.length = 0
  impl = async (input) => ({ id: 'row-1', medication_name: input.medicationName })
})

function req(body: unknown): Request {
  return new Request('http://localhost/api/prn-doses/record', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/prn-doses/record', () => {
  it('rejects invalid JSON with 400', async () => {
    const res = await POST(req('not json {'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/invalid json/i)
    expect(calls).toHaveLength(0)
  })

  it('rejects missing medicationName with 400', async () => {
    const res = await POST(req({ doseTime: new Date().toISOString() }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/medicationName is required/i)
    expect(calls).toHaveLength(0)
  })

  it('rejects blank medicationName with 400', async () => {
    const res = await POST(req({ medicationName: '   ' }))
    expect(res.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('rejects non-numeric pollDelayMinutes with 400', async () => {
    const res = await POST(req({
      medicationName: 'Tylenol',
      pollDelayMinutes: 'soon',
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/pollDelayMinutes/i)
    expect(calls).toHaveLength(0)
  })

  it('accepts a minimal valid payload', async () => {
    const res = await POST(req({ medicationName: 'Tylenol' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.row.medication_name).toBe('Tylenol')
    expect(calls).toHaveLength(1)
    expect(calls[0].medicationName).toBe('Tylenol')
  })

  it('forwards dose amount + unit + time + reason to the helper', async () => {
    const doseTime = '2026-04-17T12:00:00.000Z'
    const res = await POST(req({
      medicationName: 'Ibuprofen',
      doseAmount: 400,
      doseUnit: 'mg',
      doseTime,
      reason: 'headache',
    }))
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      medicationName: 'Ibuprofen',
      doseAmount: 400,
      doseUnit: 'mg',
      doseTime,
      reason: 'headache',
    })
  })

  it('accepts pollDelayMinutes = 0 (poll disabled)', async () => {
    const res = await POST(req({
      medicationName: 'Tylenol',
      pollDelayMinutes: 0,
    }))
    expect(res.status).toBe(200)
    expect(calls[0].pollDelayMinutes).toBe(0)
  })

  it('returns 400 when helper throws a validation error', async () => {
    impl = async () => {
      throw new Error("recordPrnDose: invalid doseTime 'garbage'")
    }
    const res = await POST(req({
      medicationName: 'Tylenol',
      doseTime: 'garbage',
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/invalid doseTime/)
  })

  it('returns 500 when helper throws a generic DB error', async () => {
    impl = async () => {
      throw new Error('Failed to record PRN dose: rls denied')
    }
    const res = await POST(req({ medicationName: 'Tylenol' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/rls denied/i)
  })

  it('coerces empty optional strings to null', async () => {
    const res = await POST(req({
      medicationName: 'Tylenol',
      doseUnit: '',
      reason: '   ',
    }))
    expect(res.status).toBe(200)
    expect(calls[0].doseUnit).toBeNull()
    expect(calls[0].reason).toBeNull()
  })
})
