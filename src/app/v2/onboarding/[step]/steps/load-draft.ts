/**
 * Pre-fill helpers for the onboarding wizard.
 *
 * If a user bounced halfway through and came back, we want the form
 * to remember what they typed. Each step writes to its own
 * health_profile section as the user advances; this loader reads
 * those sections back.
 *
 * All reads are scoped by user_id. A read failure returns the empty
 * shape so the wizard never blocks on a transient DB hiccup.
 */
import { createServiceClient } from '@/lib/supabase'
import { parseProfileContent } from '@/lib/profile/parse-content'

export interface OnboardingDraft {
  personal: PersonalDraft | null
  conditions: string[]
  medications: MedicationDraft[]
  allergies: AllergyDraft[]
  insurance: InsuranceDraft | null
}

export interface PersonalDraft {
  full_name?: string
  date_of_birth?: string
  age?: number
  sex?: string
  height_cm?: number
  weight_kg?: number
  timezone?: string
}

export interface MedicationDraft {
  name: string
  dose?: string
  schedule?: string
}

export interface AllergyDraft {
  substance: string
  reaction?: string
}

export interface InsuranceDraft {
  planSlug: string
  memberId?: string
  notes?: string
}

const SECTIONS_TO_LOAD = [
  'personal',
  'medications',
  'allergies',
  'confirmed_diagnoses',
  'insurance',
] as const

export async function loadOnboardingDraft(userId: string): Promise<OnboardingDraft> {
  const empty: OnboardingDraft = {
    personal: null,
    conditions: [],
    medications: [],
    allergies: [],
    insurance: null,
  }
  if (!userId) return empty
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('health_profile')
      .select('section, content')
      .eq('user_id', userId)
      .in('section', SECTIONS_TO_LOAD as readonly string[])
    if (error || !data) return empty

    const draft = { ...empty }
    for (const row of data as { section: string; content: unknown }[]) {
      const parsed = parseProfileContent(row.content)
      switch (row.section) {
        case 'personal':
          if (parsed && typeof parsed === 'object') {
            draft.personal = parsed as PersonalDraft
          }
          break
        case 'medications': {
          // Stored as { as_needed: [...] } per permanent-core's shape.
          const asNeeded = (parsed as { as_needed?: unknown })?.as_needed
          if (Array.isArray(asNeeded)) {
            draft.medications = asNeeded
              .filter((m): m is MedicationDraft => typeof m === 'object' && m !== null && 'name' in m)
              .map((m) => ({ ...m }))
          }
          break
        }
        case 'allergies': {
          // Stored as a string list (permanent-core shape). We split
          // any "(reaction)" back into the structured form for the UI.
          if (Array.isArray(parsed)) {
            draft.allergies = (parsed as unknown[])
              .filter((s): s is string => typeof s === 'string')
              .map((s) => {
                const m = /^(.+?)\s*\((.*)\)\s*$/.exec(s)
                return m ? { substance: m[1], reaction: m[2] } : { substance: s }
              })
          }
          break
        }
        case 'confirmed_diagnoses':
          if (Array.isArray(parsed)) {
            draft.conditions = (parsed as unknown[]).filter((s): s is string => typeof s === 'string')
          }
          break
        case 'insurance':
          if (parsed && typeof parsed === 'object' && 'planSlug' in parsed) {
            draft.insurance = parsed as InsuranceDraft
          }
          break
      }
    }
    return draft
  } catch {
    return empty
  }
}
