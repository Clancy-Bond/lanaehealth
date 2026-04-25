/**
 * recordCorrection
 *
 * Two-step write:
 *   1. Insert a row into medical_narrative tagged kind='user_correction'
 *      with structured metadata. This is the "remembers forever" half:
 *      Layer 1 permanent-core reads recent correction rows on every
 *      Claude API call, so once written, the AI sees the correction in
 *      its system prompt for every future conversation.
 *   2. Best-effort update of the source row. The narrative row is the
 *      ground truth. The source-table update is a convenience so the
 *      next read of cycle_entries / oura_daily / etc. shows the new
 *      value in the UI without having to re-derive it from corrections.
 *      If the source-table update fails, the correction is still
 *      recorded; we surface a `sourceUpdateError` to the caller so the
 *      UI can warn the user.
 *
 * Zero data loss: the original_value lives forever inside metadata.
 * Even if the source row is later overwritten by an importer, the
 * correction trail is intact.
 */

import { createServiceClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CORRECTABLE_TABLES,
  CORRECTION_KIND,
  type CorrectableTable,
  type CorrectionMetadata,
  type CorrectionSource,
} from './types'

export interface RecordCorrectionInput {
  /** Authenticated Supabase Auth user id. */
  userId: string
  /** Source table name. Must be in CORRECTABLE_TABLES. */
  tableName: CorrectableTable
  /** Source row primary-key value (uuid string for most tables). */
  rowId: string
  /** Column name being corrected. */
  fieldName: string
  /** Pre-correction value. May be null (e.g. Oura missed the night). */
  originalValue: string | number | boolean | null
  /** Post-correction value. */
  correctedValue: string | number | boolean | null
  /**
   * Free-form sentence the user wrote in the reason textarea. This is
   * what the AI quotes back in future conversations, so a good reason
   * compounds for months.
   */
  reason: string
  /** Which v2 surface initiated the correction. */
  source: CorrectionSource
}

export interface RecordCorrectionResult {
  /** medical_narrative.id of the new correction row. */
  id: string
  /** ISO timestamp when the correction was recorded. */
  createdAt: string
  /**
   * If the convenience update of the source row failed, the error
   * message is returned here. The correction itself was still written.
   */
  sourceUpdateError: string | null
}

/**
 * Internal: produce the human-readable narrative string we store in
 * medical_narrative.content. The content is also injected directly into
 * the AI's permanent core, so it must read like a sentence on its own.
 */
function formatNarrative(input: RecordCorrectionInput): string {
  const orig = formatValue(input.originalValue)
  const corr = formatValue(input.correctedValue)
  return [
    `User correction (${input.source}): ${input.fieldName} on ${input.tableName} `,
    `was ${orig}, corrected to ${corr}. `,
    `Reason: ${input.reason}`,
  ].join('')
}

function formatValue(v: string | number | boolean | null): string {
  if (v === null) return '(empty)'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

/**
 * Convenience wrapper used by API routes and tests. The supabase
 * argument is optional so production code can rely on the default
 * service client and tests can inject a mock.
 */
export async function recordCorrection(
  input: RecordCorrectionInput,
  supabase?: SupabaseClient,
): Promise<RecordCorrectionResult> {
  // Validate the input early. Throwing here gives the API route a
  // clean 400 to return rather than a downstream Supabase error.
  if (!input.userId) throw new Error('userId is required')
  if (!CORRECTABLE_TABLES.includes(input.tableName)) {
    throw new Error(`tableName "${input.tableName}" is not in the correctable allowlist`)
  }
  if (!input.rowId) throw new Error('rowId is required')
  if (!input.fieldName) throw new Error('fieldName is required')
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error('reason is required (so the AI can quote it back later)')
  }

  const sb = supabase ?? createServiceClient()

  const metadata: CorrectionMetadata = {
    tableName: input.tableName,
    rowId: input.rowId,
    fieldName: input.fieldName,
    originalValue: input.originalValue,
    correctedValue: input.correctedValue,
    reason: input.reason.trim(),
    source: input.source,
  }

  const narrative = formatNarrative(input)
  const sectionTitle = `Correction: ${input.tableName}.${input.fieldName}`

  // Step 1: write the durable correction row.
  const { data: insertData, error: insertError } = await sb
    .from('medical_narrative')
    .insert({
      section_title: sectionTitle,
      content: narrative,
      kind: CORRECTION_KIND,
      metadata,
      user_id: input.userId,
    })
    .select('id, created_at')
    .single()

  if (insertError) {
    throw new Error(`failed to record correction: ${insertError.message}`)
  }
  if (!insertData) {
    throw new Error('failed to record correction: insert returned no data')
  }

  // Step 2: best-effort source-table update. The narrative row above
  // is the ground truth; this just keeps the source surface in sync
  // for the next page render. We do NOT update arbitrary tables; the
  // CORRECTABLE_TABLES allowlist gate above protected us from that.
  let sourceUpdateError: string | null = null
  try {
    const { error: updateError } = await sb
      .from(input.tableName)
      .update({ [input.fieldName]: input.correctedValue })
      .eq('id', input.rowId)
    if (updateError) {
      sourceUpdateError = updateError.message
    }
  } catch (err) {
    sourceUpdateError = err instanceof Error ? err.message : String(err)
  }

  return {
    id: insertData.id as string,
    createdAt: insertData.created_at as string,
    sourceUpdateError,
  }
}
