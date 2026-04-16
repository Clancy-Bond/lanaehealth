/**
 * Pure dedupe key generation (no side effects, no Supabase import).
 *
 * Extracted from deduplicator.ts so parsers can import this without
 * triggering the Supabase client initialization on module load.
 */

import { createHash } from 'crypto'

/**
 * Create a deterministic deduplication key from record type, date, and key fields.
 * Same data from different sources should produce the same key.
 */
export function createDedupeKey(type: string, date: string, keyFields: string): string {
  const normalized = `${type}|${date}|${keyFields.toLowerCase().trim()}`
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}
