// ---------------------------------------------------------------------------
// privacy-prefs api helpers (Wave 2e F10)
//
// Thin wrapper around the `privacy_prefs` table (migration 025). Three
// independent toggles scoped to a single patient (default 'lanae'):
//
//   - allow_claude_context:      Hard gate on the context assembler.
//     When false, assembleDynamicContext() short-circuits and returns
//     an empty context. No permanent core, no summaries, no retrieval,
//     no KB. See src/lib/context/assembler.ts.
//   - allow_correlation_analysis: Reserved for the correlation engine.
//   - retain_history_beyond_2y:   Reserved for the retention sweep.
//
// All three default to true so the app behaves identically to
// pre-migration behavior until the user explicitly opts out.
//
// Every read/write here hits the service client. Safe to call from
// server components and server-side API routes.
// ---------------------------------------------------------------------------

import { createServiceClient } from '@/lib/supabase'

// --- types -----------------------------------------------------------------

export interface PrivacyPrefs {
  patient_id: string
  allow_claude_context: boolean
  allow_correlation_analysis: boolean
  retain_history_beyond_2y: boolean
  updated_at: string
}

export interface PrivacyPrefsUpdate {
  allow_claude_context?: boolean
  allow_correlation_analysis?: boolean
  retain_history_beyond_2y?: boolean
}

// --- constants -------------------------------------------------------------

/**
 * Legacy single-tenant default. New callers should pass a real auth.user.id
 * via getPrivacyPrefs(userId) so each user's gates are independent. The
 * default is kept ONLY so the migration window doesn't break tools that
 * still pass no argument; once every caller threads userId through, the
 * default + the no-arg overload should be removed.
 */
export const DEFAULT_PATIENT_ID = 'lanae'

/**
 * Returned when the table is missing (migration not yet applied) or the
 * row is absent for some reason. Preserves pre-migration behavior: all
 * gates open. This is the SAFE default for a new install but the
 * INSECURE default once the user has expressed a preference, so callers
 * that mutate data should always read first and verify the row exists.
 */
export const DEFAULT_PREFS: PrivacyPrefs = {
  patient_id: DEFAULT_PATIENT_ID,
  allow_claude_context: true,
  allow_correlation_analysis: true,
  retain_history_beyond_2y: true,
  updated_at: new Date(0).toISOString(),
}

// --- read ------------------------------------------------------------------

/**
 * Load the privacy prefs row for a patient.
 *
 * If the table does not exist (migration not applied) OR the row is
 * missing (e.g. a brand-new patient) the function returns the in-memory
 * DEFAULT_PREFS. This is deliberate: the assembler needs to keep working
 * before the migration has run in production. The migration itself
 * seeds the 'lanae' row so post-migration the fallback is cosmetic only.
 *
 * Errors from the database are LOGGED but NOT thrown, so a transient
 * Supabase hiccup never bricks the context pipeline. In that case the
 * function errs on the side of allowing the call to proceed with a full
 * context (DEFAULT_PREFS), matching the conservative "fail open to
 * preserve app usefulness" philosophy used elsewhere in the codebase.
 * Callers who need stricter semantics should read the row directly.
 */
export async function getPrivacyPrefs(
  patientId: string = DEFAULT_PATIENT_ID,
): Promise<PrivacyPrefs> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('privacy_prefs')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle()

    if (error) {
      console.error('privacy-prefs: read error (falling back to defaults):', error.message)
      return { ...DEFAULT_PREFS, patient_id: patientId }
    }
    if (!data) return { ...DEFAULT_PREFS, patient_id: patientId }

    return data as PrivacyPrefs
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('privacy-prefs: unexpected read error (falling back to defaults):', msg)
    return { ...DEFAULT_PREFS, patient_id: patientId }
  }
}

// --- write -----------------------------------------------------------------

/**
 * Upsert prefs for a patient.
 *
 * The caller passes only the fields it wants to change; the rest are
 * preserved via a read-modify-write. updated_at is set server-side.
 *
 * Authentication: this helper does NOT enforce auth. It must only be
 * called from an authenticated API route. See src/app/settings/privacy
 * and src/app/api/privacy-prefs/route.ts (if added) for the guard.
 */
export async function updatePrivacyPrefs(
  update: PrivacyPrefsUpdate,
  patientId: string = DEFAULT_PATIENT_ID,
): Promise<PrivacyPrefs> {
  // Validate: reject non-boolean values so a typo in the client
  // doesn't accidentally coerce "false" (string) to truthy.
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined && typeof value !== 'boolean') {
      throw new Error(
        `privacy-prefs: ${key} must be boolean, got ${typeof value}`,
      )
    }
  }

  const supabase = createServiceClient()
  const existing = await getPrivacyPrefs(patientId)

  const merged = {
    patient_id: patientId,
    allow_claude_context:
      update.allow_claude_context ?? existing.allow_claude_context,
    allow_correlation_analysis:
      update.allow_correlation_analysis ?? existing.allow_correlation_analysis,
    retain_history_beyond_2y:
      update.retain_history_beyond_2y ?? existing.retain_history_beyond_2y,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('privacy_prefs')
    .upsert(merged, { onConflict: 'patient_id' })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update privacy prefs: ${error.message}`)
  }

  return data as PrivacyPrefs
}
