/**
 * Universal Import Engine -- Deduplication
 *
 * Creates deterministic dedup keys and checks against existing data.
 * Strategy: type + date + key fields hash. Newer wins, higher confidence wins.
 */

import { createHash } from 'crypto'
import type { CanonicalRecord } from './types'

/**
 * Create a deterministic deduplication key from record type, date, and key fields.
 * Same data from different sources should produce the same key.
 */
export function createDedupeKey(type: string, date: string, keyFields: string): string {
  const normalized = `${type}|${date}|${keyFields.toLowerCase().trim()}`
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

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
