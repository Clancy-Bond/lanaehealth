/**
 * Universal Import Engine -- Deduplication
 *
 * Creates deterministic dedup keys and checks against existing data.
 * Strategy: type + date + key fields hash. Newer wins, higher confidence wins.
 */

import { createServiceClient } from '@/lib/supabase'
import type { CanonicalRecord } from './types'
import { createDedupeKey } from './dedupe-key'

export { createDedupeKey }

/**
 * Remove duplicate records within a set of imported records.
 * When duplicates found: keep the one with higher confidence.
 */
export function deduplicateRecords(records: CanonicalRecord[]): {
  unique: CanonicalRecord[]
  duplicateCount: number
} {
  const seen = new Map<string, CanonicalRecord>()

  for (const record of records) {
    const existing = seen.get(record.dedupeKey)
    if (!existing || record.confidence > existing.confidence) {
      seen.set(record.dedupeKey, record)
    }
  }

  return {
    unique: Array.from(seen.values()),
    duplicateCount: records.length - seen.size,
  }
}

/**
 * Check records against existing data in Supabase.
 * Returns only records that don't already exist in the database.
 * Checks by type + date + key identifying fields.
 */
export async function filterExistingRecords(records: CanonicalRecord[]): Promise<{
  newRecords: CanonicalRecord[]
  existingCount: number
}> {
  if (records.length === 0) return { newRecords: [], existingCount: 0 }

  const sb = createServiceClient()
  const newRecords: CanonicalRecord[] = []
  let existingCount = 0

  for (const record of records) {
    let exists = false

    try {
      switch (record.type) {
        case 'lab_result': {
          const data = record.data as unknown as Record<string, unknown>
          const { data: existing } = await sb
            .from('lab_results')
            .select('id')
            .eq('date', record.date)
            .eq('test_name', data.testName as string)
            .limit(1)
            .maybeSingle()
          exists = !!existing
          break
        }
        case 'condition': {
          const data = record.data as unknown as Record<string, unknown>
          const { data: existing } = await sb
            .from('active_problems')
            .select('id')
            .eq('name', data.name as string)
            .limit(1)
            .maybeSingle()
          exists = !!existing
          break
        }
        case 'appointment': {
          const data = record.data as unknown as Record<string, unknown>
          const { data: existing } = await sb
            .from('appointments')
            .select('id')
            .eq('date', record.date)
            .eq('doctor_name', data.doctorName as string)
            .limit(1)
            .maybeSingle()
          exists = !!existing
          break
        }
        case 'medication': {
          const data = record.data as unknown as Record<string, unknown>
          const { data: existing } = await sb
            .from('medical_timeline')
            .select('id')
            .eq('event_date', record.date)
            .ilike('title', `%${data.name as string}%`)
            .limit(1)
            .maybeSingle()
          exists = !!existing
          break
        }
        // For types without specific tables, check medical_timeline
        default: {
          const { data: existing } = await sb
            .from('medical_timeline')
            .select('id')
            .eq('event_date', record.date)
            .ilike('title', `%${record.type}%`)
            .limit(1)
            .maybeSingle()
          exists = !!existing
        }
      }
    } catch {
      // If check fails, assume it's new (safer to import than to skip)
      exists = false
    }

    if (exists) {
      existingCount++
    } else {
      newRecords.push(record)
    }
  }

  return { newRecords, existingCount }
}
