// ---------------------------------------------------------------------------
// Care Card data loader
//
// Fetches the strictly-bounded slice of patient data displayed on the
// 1-page emergency Care Card:
//   - Patient identity (name, DOB/age, sex, blood type)
//   - Top diagnoses (from health_profile.confirmed_diagnoses)
//   - Current medications + supplements
//   - Allergies
//   - Emergency notes (POTS syncope, etc.)
//
// This is deliberately a narrow scope. The same loader is used by both
// the authenticated /doctor/care-card view and the public /share/<token>
// view so they can never diverge and accidentally leak additional data.
// ---------------------------------------------------------------------------

import { createServiceClient } from '@/lib/supabase'
import { parseProfileContent } from '@/lib/profile/parse-content'

export interface CareCardData {
  patient: {
    name: string
    age: number | null
    sex: string | null
    bloodType: string | null
  }
  diagnoses: string[]
  medications: Array<{ name: string; dose?: string; frequency?: string }>
  supplements: Array<{ name: string; dose?: string }>
  allergies: string[]
  emergencyNotes: string[]
}

interface PersonalContent {
  full_name?: string
  age?: number
  sex?: string
  blood_type?: string
}

interface MedicationContent {
  as_needed?: Array<{ name: string; dose?: string; frequency?: string }>
  scheduled?: Array<{ name: string; dose?: string; frequency?: string }>
}

interface SupplementItem {
  name: string
  dose?: string
}

const MAX_DIAGNOSES = 5
const MAX_MEDICATIONS = 5
const MAX_SUPPLEMENTS = 5
const MAX_ALLERGIES = 10

export async function loadCareCardData(): Promise<CareCardData> {
  const sb = createServiceClient()
  const { data: rows, error } = await sb
    .from('health_profile')
    .select('section, content')

  if (error) {
    throw new Error(`Failed to load care card data: ${error.message}`)
  }

  const map = new Map<string, unknown>()
  for (const r of (rows as Array<{ section: string; content: unknown }>) ?? []) {
    map.set(r.section, parseProfileContent(r.content))
  }

  const personal = (map.get('personal') as PersonalContent | undefined) ?? {}
  const diagnoses = (map.get('confirmed_diagnoses') as string[] | undefined) ?? []
  const meds = (map.get('medications') as MedicationContent | undefined) ?? {}
  const supps = (map.get('supplements') as SupplementItem[] | undefined) ?? []
  const allergies = (map.get('allergies') as string[] | undefined) ?? []
  const emergency = (map.get('emergency_notes') as string[] | undefined) ?? []

  const allMeds = [
    ...(meds.scheduled ?? []),
    ...(meds.as_needed ?? []),
  ]

  return {
    patient: {
      name: personal.full_name ?? 'Patient',
      age: typeof personal.age === 'number' ? personal.age : null,
      sex: personal.sex ?? null,
      bloodType: personal.blood_type ?? null,
    },
    diagnoses: diagnoses.slice(0, MAX_DIAGNOSES),
    medications: allMeds.slice(0, MAX_MEDICATIONS).map((m) => ({
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
    })),
    supplements: supps.slice(0, MAX_SUPPLEMENTS).map((s) => ({
      name: s.name,
      dose: s.dose,
    })),
    allergies: allergies.slice(0, MAX_ALLERGIES),
    emergencyNotes: emergency,
  }
}
