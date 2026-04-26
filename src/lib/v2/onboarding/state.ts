/**
 * Onboarding state helpers.
 *
 * "Has this user finished onboarding?" is the question both the v2
 * layout middleware and the post-signup redirect need to answer.
 *
 * Source of truth: a row in health_profile with section='onboarding'
 * and content={ completedAt: ISO, version: 1 }. Reusing the existing
 * EAV table avoids a fresh migration. The completion flag is per-user
 * (RLS enforced; every read filters on user_id).
 *
 * Partial progress also lives in health_profile under per-step
 * sections ('personal', 'medications', 'allergies', 'insurance',
 * 'confirmed_diagnoses') so a user who quits halfway can resume
 * with their answers preserved.
 */
import { createServiceClient } from '@/lib/supabase'
import { parseProfileContent } from '@/lib/profile/parse-content'

export const ONBOARDING_SECTION = 'onboarding'
export const ONBOARDING_VERSION = 1

export interface OnboardingFlag {
  completedAt: string
  version: number
  /** Marker for "user explicitly skipped" vs "user finished all steps". */
  skipped?: boolean
}

/**
 * True when the user has either finished onboarding or explicitly
 * skipped. Either way, we do not redirect them back into the wizard.
 */
export async function isOnboarded(userId: string): Promise<boolean> {
  if (!userId) return false
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('health_profile')
      .select('content')
      .eq('user_id', userId)
      .eq('section', ONBOARDING_SECTION)
      .maybeSingle()
    if (error || !data) return false
    const flag = parseProfileContent(data.content) as OnboardingFlag | null
    return !!flag?.completedAt
  } catch {
    // Failure here must not trap users in an infinite redirect loop.
    // We return true so the layout falls through to /v2 and the user
    // can still use the app while we investigate the read failure.
    return true
  }
}

/**
 * Mark onboarding as completed for the given user. Called from the
 * wizard's final step and from the "Skip" link.
 */
export async function markOnboarded(
  userId: string,
  opts: { skipped?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userId) return { ok: false, error: 'userId required' }
  try {
    const sb = createServiceClient()
    const flag: OnboardingFlag = {
      completedAt: new Date().toISOString(),
      version: ONBOARDING_VERSION,
      ...(opts.skipped ? { skipped: true } : {}),
    }
    const { error } = await sb.from('health_profile').upsert(
      {
        user_id: userId,
        section: ONBOARDING_SECTION,
        content: flag,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,section' },
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

// ── Per-step writes ────────────────────────────────────────────────

export interface PersonalProfileInput {
  full_name?: string
  date_of_birth?: string
  age?: number
  sex?: string
  height_cm?: number
  weight_kg?: number
  timezone?: string
}

export async function saveOnboardingPersonal(
  userId: string,
  input: PersonalProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return saveProfileSection(userId, 'personal', input)
}

export interface MedicationItem {
  name: string
  dose?: string
  schedule?: string
}

export interface AllergyItem {
  substance: string
  reaction?: string
}

export async function saveOnboardingMedications(
  userId: string,
  meds: MedicationItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Match the existing shape consumed by permanent-core.
  return saveProfileSection(userId, 'medications', { as_needed: meds })
}

export async function saveOnboardingAllergies(
  userId: string,
  allergies: AllergyItem[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  // permanent-core reads allergies as a flat string list; we keep the
  // structured payload alongside in case future surfaces want reaction.
  return saveProfileSection(
    userId,
    'allergies',
    allergies.map((a) => (a.reaction ? `${a.substance} (${a.reaction})` : a.substance)),
  )
}

export async function saveOnboardingConditions(
  userId: string,
  conditionLabels: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Two writes: confirmed_diagnoses (the lean list permanent-core
  // injects) and a row per condition into active_problems so
  // downstream summaries pick them up.
  const sectionResult = await saveProfileSection(
    userId,
    'confirmed_diagnoses',
    conditionLabels,
  )
  if (!sectionResult.ok) return sectionResult

  if (conditionLabels.length === 0) return { ok: true }

  // The active_problems table has no `source` column (Migration 001),
  // so we tag onboarding-sourced rows by stamping a marker into the
  // notes column. Re-running the wizard wipes those rows only and
  // leaves rows added through other surfaces (e.g. the v2 doctor
  // page) untouched.
  try {
    const sb = createServiceClient()
    await sb
      .from('active_problems')
      .delete()
      .eq('user_id', userId)
      .eq('notes', ONBOARDING_SOURCE_MARKER)

    const rows = conditionLabels.map((label) => ({
      user_id: userId,
      problem: label,
      status: 'active',
      notes: ONBOARDING_SOURCE_MARKER,
    }))
    const { error } = await sb.from('active_problems').insert(rows)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

/**
 * Marker stamped into active_problems.notes so we can recognize
 * which rows came from the onboarding wizard.
 */
export const ONBOARDING_SOURCE_MARKER = 'source:onboarding'

export interface OnboardingInsuranceInput {
  planSlug: string
  memberId?: string
  notes?: string
}

export async function saveOnboardingInsurance(
  userId: string,
  input: OnboardingInsuranceInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Mirrors src/lib/api/insurance.ts but writes scoped to user_id.
  return saveProfileSection(userId, 'insurance', input)
}

// ── Internal helpers ───────────────────────────────────────────────

async function saveProfileSection(
  userId: string,
  section: string,
  content: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userId) return { ok: false, error: 'userId required' }
  try {
    const sb = createServiceClient()
    const { error } = await sb.from('health_profile').upsert(
      {
        user_id: userId,
        section,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,section' },
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
