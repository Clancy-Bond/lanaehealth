/**
 * correction-history
 *
 * Reads back correction rows from medical_narrative. Two readers:
 *
 *   getCorrectionsForRow:
 *     For the EditableValue UI - "has anyone corrected this exact
 *     value before?" Used to show a small chip on the affordance and
 *     to seed the reason textarea with prior context.
 *
 *   getRecentCorrections:
 *     For the Layer 1 permanent-core injector. Returns the last N
 *     corrections across all rows so the AI sees the most recent
 *     authoritative truth in every system prompt.
 */

import { createServiceClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CORRECTION_KIND,
  type CorrectableTable,
  type Correction,
  type CorrectionMetadata,
} from './types'

interface NarrativeRow {
  id: string
  content: string
  metadata: CorrectionMetadata | null
  created_at: string | null
}

function rowToCorrection(row: NarrativeRow): Correction | null {
  if (!row.metadata) return null
  return {
    id: row.id,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    metadata: row.metadata,
    narrative: row.content,
  }
}

export interface GetCorrectionsForRowInput {
  tableName: CorrectableTable
  rowId: string
  /** Optional - if provided, only the user's own corrections are returned. */
  userId?: string
}

export async function getCorrectionsForRow(
  input: GetCorrectionsForRowInput,
  supabase?: SupabaseClient,
): Promise<Correction[]> {
  const sb = supabase ?? createServiceClient()
  let query = sb
    .from('medical_narrative')
    .select('id, content, metadata, created_at')
    .eq('kind', CORRECTION_KIND)
    .eq('metadata->>tableName', input.tableName)
    .eq('metadata->>rowId', input.rowId)
    .order('created_at', { ascending: false })

  if (input.userId) {
    query = query.eq('user_id', input.userId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`failed to read corrections: ${error.message}`)
  }
  const rows = (data ?? []) as NarrativeRow[]
  const out: Correction[] = []
  for (const row of rows) {
    const c = rowToCorrection(row)
    if (c) out.push(c)
  }
  return out
}

export interface GetRecentCorrectionsInput {
  /** Maximum corrections to return. Defaults to 30. */
  limit?: number
  /** Lower bound on created_at (inclusive), as ISO string. */
  sinceISO?: string
  /** Optional user filter. */
  userId?: string
}

/**
 * Returns the most recent correction rows ordered by created_at
 * descending. Used by the Layer 1 permanent-core to inject
 * authoritative truths into the AI's system prompt.
 */
export async function getRecentCorrections(
  input: GetRecentCorrectionsInput = {},
  supabase?: SupabaseClient,
): Promise<Correction[]> {
  const sb = supabase ?? createServiceClient()
  const limit = input.limit ?? 30

  let query = sb
    .from('medical_narrative')
    .select('id, content, metadata, created_at')
    .eq('kind', CORRECTION_KIND)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.sinceISO) {
    query = query.gte('created_at', input.sinceISO)
  }
  if (input.userId) {
    query = query.eq('user_id', input.userId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`failed to read recent corrections: ${error.message}`)
  }
  const rows = (data ?? []) as NarrativeRow[]
  const out: Correction[] = []
  for (const row of rows) {
    const c = rowToCorrection(row)
    if (c) out.push(c)
  }
  return out
}
