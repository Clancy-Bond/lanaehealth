// ---------------------------------------------------------------------------
// setEnergyMode / setRestDay -- tests
//
// Mocked-Supabase tests that verify the two helpers:
//   1. scope updates to the provided log id (no accidental blanket updates)
//   2. write ONLY the column(s) they are responsible for (defensive against
//      a future refactor accidentally nulling adjacent fields)
//   3. bubble Supabase errors up as Error instances
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Call {
  table: string
  updatePayload: Record<string, unknown>
  eqColumn: string | null
  eqValue: unknown
}

const capture: { last: Call | null; error: unknown } = {
  last: null,
  error: null,
}

vi.mock('@/lib/supabase', () => {
  const buildQuery = (tableName: string) => ({
    update: (payload: Record<string, unknown>) => {
      capture.last = {
        table: tableName,
        updatePayload: payload,
        eqColumn: null,
        eqValue: undefined,
      }
      return {
        eq: (col: string, val: unknown) => {
          capture.last!.eqColumn = col
          capture.last!.eqValue = val
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: capture.error
                    ? null
                    : {
                        id: val,
                        date: '2026-04-17',
                        ...payload,
                      },
                  error: capture.error,
                }),
            }),
          }
        },
      }
    },
  })
  return {
    supabase: { from: (tableName: string) => buildQuery(tableName) },
    createServiceClient: () => ({ from: (tableName: string) => buildQuery(tableName) }),
  }
})

import { setEnergyMode, setRestDay } from '@/lib/api/logs'

beforeEach(() => {
  capture.last = null
  capture.error = null
})

describe('setEnergyMode', () => {
  it('updates only energy_mode + updated_at on the matching log id', async () => {
    await setEnergyMode('log-abc', 'gentle')
    expect(capture.last).not.toBeNull()
    expect(capture.last!.table).toBe('daily_logs')
    expect(capture.last!.eqColumn).toBe('id')
    expect(capture.last!.eqValue).toBe('log-abc')
    expect(capture.last!.updatePayload.energy_mode).toBe('gentle')
    // No stray columns should be in the update payload.
    const keys = Object.keys(capture.last!.updatePayload).sort()
    expect(keys).toEqual(['energy_mode', 'updated_at'])
  })

  it('can set mode to null', async () => {
    await setEnergyMode('log-abc', null)
    expect(capture.last!.updatePayload.energy_mode).toBeNull()
  })

  it('throws a clear Error on Supabase failure', async () => {
    capture.error = { message: 'permission denied' }
    await expect(setEnergyMode('log-abc', 'minimal')).rejects.toThrow(
      /Failed to set energy mode/
    )
  })
})

describe('setRestDay', () => {
  it('updates only rest_day + updated_at on the matching log id', async () => {
    await setRestDay('log-xyz', true)
    expect(capture.last!.eqColumn).toBe('id')
    expect(capture.last!.eqValue).toBe('log-xyz')
    expect(capture.last!.updatePayload.rest_day).toBe(true)
    const keys = Object.keys(capture.last!.updatePayload).sort()
    expect(keys).toEqual(['rest_day', 'updated_at'])
  })

  it('can clear rest_day back to false (positive log, then undo)', async () => {
    await setRestDay('log-xyz', false)
    expect(capture.last!.updatePayload.rest_day).toBe(false)
  })

  it('throws a clear Error on Supabase failure', async () => {
    capture.error = { message: 'permission denied' }
    await expect(setRestDay('log-xyz', true)).rejects.toThrow(
      /Failed to set rest day/
    )
  })
})
