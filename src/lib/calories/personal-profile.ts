/**
 * Read the patient's structural personal data (height, age, sex)
 * from health_profile.section='personal'. Used by composition page
 * to drive computed metrics (BMI, Navy body fat, etc.).
 *
 * Falls back to safe defaults when data is missing; the UI will
 * skip metrics that need missing inputs.
 */

import { createServiceClient } from '@/lib/supabase'
import { parseProfileContent } from '@/lib/profile/parse-content'

export interface PersonalProfile {
  full_name?: string
  age?: number
  sex?: string
  blood_type?: string
  height_cm?: number
  weight_kg?: number
  location?: string
}

export async function loadPersonalProfile(): Promise<PersonalProfile> {
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('health_profile')
      .select('content')
      .eq('section', 'personal')
      .maybeSingle()
    const raw = (data as { content: unknown } | null)?.content
    if (!raw) return {}
    const parsed = parseProfileContent(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as PersonalProfile
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * Map free-form sex string to body-metrics 'female' | 'male' for the
 * formula helpers. Defaults to female when unknown to avoid throwing
 * on a profile with missing data; surfaces explain when the value
 * came from a default.
 */
export function normalizeSex(value: string | undefined): 'female' | 'male' {
  if (!value) return 'female'
  const v = value.trim().toLowerCase()
  if (v.startsWith('m')) return 'male'
  return 'female'
}
