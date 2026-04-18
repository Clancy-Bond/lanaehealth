/**
 * Unit tests for src/lib/api/symptom-conditions.ts.
 *
 * Focus:
 *   - normalizeConfidence: only 'inferred' passes through, everything else
 *     collapses to 'explicit'.
 *   - tagSymptomWithConditions: replace-set semantics - deletes existing
 *     rows for the symptom, then inserts the new de-duplicated set. Empty
 *     input short-circuits to [] without hitting insert.
 *
 * These exist because SymptomPillRow + SymptomPills both depend on the
 * replace-set contract when the user toggles chips on and off rapidly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- fake supabase plumbing -----------------------------------------------

interface InsertRow {
  symptom_id: string
  condition_id: string
  confidence: string
}

const state: {
  deletedSymptomIds: string[]
  insertedRows: InsertRow[][]
  forceDeleteError: boolean
  forceInsertError: boolean
} = {
  deletedSymptomIds: [],
  insertedRows: [],
  forceDeleteError: false,
  forceInsertError: false,
}

function resetState() {
  state.deletedSymptomIds = []
  state.insertedRows = []
  state.forceDeleteError = false
  state.forceInsertError = false
}

vi.mock('@/lib/supabase', () => {
  const buildDelete = () => ({
    eq: async (_col: string, value: string) => {
      if (state.forceDeleteError) {
        return { error: { message: 'delete failed' } }
      }
      state.deletedSymptomIds.push(value)
      return { error: null }
    },
  })
  const buildInsert = (rows: InsertRow[]) => ({
    select: async () => {
      if (state.forceInsertError) {
        return { data: null, error: { message: 'insert failed' } }
      }
      state.insertedRows.push(rows)
      return {
        data: rows.map((r, i) => ({
          id: `row-${state.insertedRows.length}-${i}`,
          symptom_id: r.symptom_id,
          condition_id: r.condition_id,
          confidence: r.confidence,
          tagged_at: new Date().toISOString(),
        })),
        error: null,
      }
    },
  })
  return {
    supabase: {
      from: () => ({
        delete: () => buildDelete(),
        insert: (rows: InsertRow[]) => buildInsert(rows),
      }),
    },
  }
})

describe('symptom-conditions', () => {
  beforeEach(resetState)

  describe('normalizeConfidence', () => {
    it('passes through the inferred literal', async () => {
      const { normalizeConfidence } = await import('../symptom-conditions')
      expect(normalizeConfidence('inferred')).toBe('inferred')
    })

    it('coerces every other value to explicit', async () => {
      const { normalizeConfidence } = await import('../symptom-conditions')
      expect(normalizeConfidence('explicit')).toBe('explicit')
      expect(normalizeConfidence('unknown')).toBe('explicit')
      expect(normalizeConfidence('')).toBe('explicit')
      expect(normalizeConfidence(null)).toBe('explicit')
      expect(normalizeConfidence(undefined)).toBe('explicit')
    })
  })

  describe('tagSymptomWithConditions', () => {
    it('deletes existing rows then inserts the new set', async () => {
      const { tagSymptomWithConditions } = await import('../symptom-conditions')
      await tagSymptomWithConditions('symptom-1', ['cond-a', 'cond-b'])
      expect(state.deletedSymptomIds).toEqual(['symptom-1'])
      expect(state.insertedRows).toHaveLength(1)
      expect(state.insertedRows[0]).toEqual([
        { symptom_id: 'symptom-1', condition_id: 'cond-a', confidence: 'explicit' },
        { symptom_id: 'symptom-1', condition_id: 'cond-b', confidence: 'explicit' },
      ])
    })

    it('de-duplicates condition ids before inserting', async () => {
      const { tagSymptomWithConditions } = await import('../symptom-conditions')
      await tagSymptomWithConditions('symptom-2', ['cond-a', 'cond-a', 'cond-b', ''])
      expect(state.insertedRows[0]).toEqual([
        { symptom_id: 'symptom-2', condition_id: 'cond-a', confidence: 'explicit' },
        { symptom_id: 'symptom-2', condition_id: 'cond-b', confidence: 'explicit' },
      ])
    })

    it('short-circuits on empty input after deleting', async () => {
      const { tagSymptomWithConditions } = await import('../symptom-conditions')
      const result = await tagSymptomWithConditions('symptom-3', [])
      // Delete still runs so the replace-set semantics hold.
      expect(state.deletedSymptomIds).toEqual(['symptom-3'])
      // But no insert round-trip.
      expect(state.insertedRows).toHaveLength(0)
      expect(result).toEqual([])
    })

    it('surfaces the supabase error message when delete fails', async () => {
      state.forceDeleteError = true
      const { tagSymptomWithConditions } = await import('../symptom-conditions')
      await expect(
        tagSymptomWithConditions('symptom-4', ['cond-a'])
      ).rejects.toThrow(/Failed to clear symptom tags: delete failed/)
      // Delete failed, so no insert attempted.
      expect(state.insertedRows).toHaveLength(0)
    })

    it('surfaces the supabase error message when insert fails', async () => {
      state.forceInsertError = true
      const { tagSymptomWithConditions } = await import('../symptom-conditions')
      await expect(
        tagSymptomWithConditions('symptom-5', ['cond-a'])
      ).rejects.toThrow(/Failed to tag symptom with conditions: insert failed/)
    })

    it('accepts a custom confidence value', async () => {
      const { tagSymptomWithConditions } = await import('../symptom-conditions')
      await tagSymptomWithConditions('symptom-6', ['cond-a'], 'inferred')
      expect(state.insertedRows[0]).toEqual([
        { symptom_id: 'symptom-6', condition_id: 'cond-a', confidence: 'inferred' },
      ])
    })
  })
})
