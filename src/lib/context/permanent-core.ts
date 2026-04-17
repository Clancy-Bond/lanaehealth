/**
 * Layer 1: Permanent Core Generator
 *
 * Dynamically assembles the ~1,200-token patient context document
 * from live database queries. This goes into EVERY Claude API call,
 * so it must be lean but complete.
 *
 * Design principle: "The most reliable memory is a database table."
 */

import { createServiceClient } from '@/lib/supabase'
import type { PermanentCore } from '@/lib/types'
import { parseProfileContent } from '@/lib/profile/parse-content'

// ── Interfaces for raw DB rows ──────────────────────────────────────

interface HealthProfileRow {
  section: string
  content: unknown // JSONB - shape varies by section
}

interface ActiveProblemRow {
  problem: string
  status: string
  onset_date: string | null
  latest_data: string | null
}

interface TimelineEventRow {
  event_date: string
  title: string
  significance: string
}

// ── Personal section shape ──────────────────────────────────────────

interface PersonalContent {
  full_name: string
  age: number
  sex: string
  blood_type: string
  height_cm: number
  weight_kg: number
  location: string
}

// ── Medication section shape ────────────────────────────────────────

interface MedicationContent {
  as_needed?: Array<{ name: string }>
}

// ── Supplement shape ────────────────────────────────────────────────

interface SupplementItem {
  name: string
  dose?: string
}

// ── Helpers ─────────────────────────────────────────────────────────

function profileMap(rows: HealthProfileRow[]): Map<string, unknown> {
  const m = new Map<string, unknown>()
  // parseProfileContent handles both shapes that exist in the DB: raw jsonb
  // objects (written by importers) and JSON-stringified strings (written by
  // the old PUT /api/profile handler before W2.6). See
  // src/lib/profile/parse-content.ts.
  for (const r of rows) m.set(r.section, parseProfileContent(r.content))
  return m
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + '...'
}

// ── Main: generatePermanentCore ─────────────────────────────────────

export async function generatePermanentCore(): Promise<string> {
  const sb = createServiceClient()

  // Run ALL queries in parallel
  const [
    hpResult,
    apResult,
    tlResult,
    ouraCount,
    ncCount,
    foodCount,
    labCount,
    imgCount,
  ] = await Promise.all([
    // health_profile - all sections
    sb.from('health_profile').select('section, content'),

    // active_problems - unresolved only, most recently updated first
    sb.from('active_problems')
      .select('problem, status, onset_date, latest_data')
      .neq('status', 'resolved')
      .order('updated_at', { ascending: false }),

    // medical_timeline - important/critical, most recent first, limit 15
    sb.from('medical_timeline')
      .select('event_date, title, significance')
      .in('significance', ['important', 'critical'])
      .order('event_date', { ascending: false })
      .limit(15),

    // Counts only
    sb.from('oura_daily').select('*', { count: 'exact', head: true }),
    sb.from('nc_imported').select('*', { count: 'exact', head: true }),
    sb.from('food_entries').select('*', { count: 'exact', head: true }),
    sb.from('lab_results').select('*', { count: 'exact', head: true }),
    sb.from('imaging_studies').select('*', { count: 'exact', head: true }),
  ])

  // Throw on query errors
  if (hpResult.error) throw new Error(`health_profile: ${hpResult.error.message}`)
  if (apResult.error) throw new Error(`active_problems: ${apResult.error.message}`)
  if (tlResult.error) throw new Error(`medical_timeline: ${tlResult.error.message}`)

  // Build lookup map for health_profile sections
  const hp = profileMap(hpResult.data as HealthProfileRow[])

  // Extract structured sections
  const personal = hp.get('personal') as PersonalContent | undefined
  const diagnoses = hp.get('confirmed_diagnoses') as string[] | undefined
  const suspected = hp.get('suspected_conditions') as string[] | undefined
  const meds = hp.get('medications') as MedicationContent | undefined
  const supps = hp.get('supplements') as SupplementItem[] | undefined
  const allergies = hp.get('allergies') as string[] | undefined
  const family = hp.get('family_history') as string[] | undefined

  // Active problems
  const problems = (apResult.data ?? []) as ActiveProblemRow[]

  // Timeline events
  const events = (tlResult.data ?? []) as TimelineEventRow[]

  // Counts (default to 0 if query errored)
  const ouraDays = ouraCount.count ?? 0
  const ncDays = ncCount.count ?? 0
  const foodEntries = foodCount.count ?? 0
  const labResults = labCount.count ?? 0
  const imagingStudies = imgCount.count ?? 0

  // ── Assemble the document ───────────────────────────────────────

  const lines: string[] = []

  // Header
  lines.push(`PATIENT: ${personal?.full_name ?? 'Unknown'}`)
  lines.push(`AGE: ${personal?.age ?? '?'}${personal?.sex?.charAt(0) ?? ''} | BLOOD TYPE: ${personal?.blood_type ?? '?'}`)
  lines.push(`HEIGHT: ${personal?.height_cm ?? '?'}cm | WEIGHT: ${personal?.weight_kg ?? '?'}kg | LOCATION: ${personal?.location ?? '?'}`)
  lines.push('')

  // Confirmed diagnoses
  if (diagnoses && diagnoses.length > 0) {
    lines.push('CONFIRMED DIAGNOSES:')
    for (const d of diagnoses) {
      lines.push(`- ${d}`)
    }
    lines.push('')
  }

  // Suspected conditions
  if (suspected && suspected.length > 0) {
    lines.push('SUSPECTED/UNDER INVESTIGATION:')
    for (const s of suspected) {
      lines.push(`- ${s}`)
    }
    lines.push('')
  }

  // Medications (as-needed names only, keep it lean)
  const medNames = meds?.as_needed?.map(m => m.name) ?? []
  lines.push(`CURRENT MEDICATIONS: ${medNames.length > 0 ? medNames.join(', ') + ' (as needed)' : 'None documented'}`)

  // Supplements (name + dose, single line)
  const suppList = supps?.map(s => {
    const nameOnly = s.name.replace(/\s*\([^)]*\)/g, '') // strip parentheticals for brevity
    return s.dose ? `${nameOnly} ${s.dose}` : nameOnly
  }) ?? []
  lines.push(`SUPPLEMENTS: ${suppList.length > 0 ? suppList.join(', ') : 'None documented'}`)

  // Allergies
  lines.push(`ALLERGIES: ${allergies && allergies.length > 0 ? allergies.join(', ') : 'None documented'}`)

  // Family history (condensed)
  if (family && family.length > 0) {
    const condensed = family.map(f => {
      // Shorten to key info
      if (f.length > 80) return truncate(f, 80)
      return f
    }).join('; ')
    lines.push(`FAMILY HISTORY: ${condensed}`)
  }

  lines.push('')

  // Active problems
  if (problems.length > 0) {
    lines.push('ACTIVE PROBLEMS (unresolved):')
    for (let i = 0; i < problems.length; i++) {
      const p = problems[i]
      const detail = p.latest_data ? ` - ${truncate(p.latest_data, 120)}` : ''
      lines.push(`${i + 1}. ${p.problem} [${p.status}]${detail}`)
    }
    lines.push('')
  }

  // Key events
  if (events.length > 0) {
    lines.push('KEY EVENTS (most recent first):')
    for (const e of events) {
      lines.push(`- ${e.event_date}: ${truncate(e.title, 100)}`)
    }
    lines.push('')
  }

  // Data availability
  lines.push(`DATA AVAILABLE: ${ouraDays} days Oura Ring, ${ncDays} days Natural Cycles, ${foodEntries} food entries, ${labResults} lab results, ${imagingStudies} imaging studies`)

  return lines.join('\n')
}

// ── Structured variant ──────────────────────────────────────────────

export async function getPermanentCoreStructured(): Promise<PermanentCore> {
  const sb = createServiceClient()

  const [hpResult, apResult, tlResult, ouraCount, ncCount, foodCount, labCount, imgCount] =
    await Promise.all([
      sb.from('health_profile').select('section, content'),
      sb.from('active_problems')
        .select('problem, status, onset_date, latest_data')
        .neq('status', 'resolved')
        .order('updated_at', { ascending: false }),
      sb.from('medical_timeline')
        .select('event_date, title, significance')
        .in('significance', ['important', 'critical'])
        .order('event_date', { ascending: false })
        .limit(15),
      sb.from('oura_daily').select('*', { count: 'exact', head: true }),
      sb.from('nc_imported').select('*', { count: 'exact', head: true }),
      sb.from('food_entries').select('*', { count: 'exact', head: true }),
      sb.from('lab_results').select('*', { count: 'exact', head: true }),
      sb.from('imaging_studies').select('*', { count: 'exact', head: true }),
    ])

  if (hpResult.error) throw new Error(`health_profile: ${hpResult.error.message}`)
  if (apResult.error) throw new Error(`active_problems: ${apResult.error.message}`)
  if (tlResult.error) throw new Error(`medical_timeline: ${tlResult.error.message}`)

  const hp = profileMap(hpResult.data as HealthProfileRow[])

  const personal = hp.get('personal') as PersonalContent | undefined
  const diagnoses = hp.get('confirmed_diagnoses') as string[] | undefined
  const suspected = hp.get('suspected_conditions') as string[] | undefined
  const meds = hp.get('medications') as MedicationContent | undefined
  const supps = hp.get('supplements') as SupplementItem[] | undefined
  const allergies = hp.get('allergies') as string[] | undefined
  const family = hp.get('family_history') as string[] | undefined
  const problems = (apResult.data ?? []) as ActiveProblemRow[]
  const events = (tlResult.data ?? []) as TimelineEventRow[]

  return {
    patient: {
      name: personal?.full_name ?? 'Unknown',
      age: personal?.age ?? 0,
      sex: personal?.sex ?? 'Unknown',
      blood_type: personal?.blood_type ?? 'Unknown',
      height_cm: personal?.height_cm ?? 0,
      weight_kg: personal?.weight_kg ?? 0,
      location: personal?.location ?? 'Unknown',
    },
    confirmed_diagnoses: diagnoses ?? [],
    suspected_conditions: suspected ?? [],
    current_medications: meds?.as_needed?.map(m => m.name) ?? [],
    supplements: supps?.map(s => s.name) ?? [],
    allergies: allergies ?? [],
    family_history: family ?? [],
    active_problems: problems.map(p => ({
      problem: p.problem,
      status: p.status,
      onset: p.onset_date ?? 'Unknown',
      latest_data: p.latest_data ?? '',
    })),
    key_events: events.map(e => ({
      date: e.event_date,
      event: e.title,
      significance: e.significance,
    })),
    data_availability: {
      oura_days: ouraCount.count ?? 0,
      nc_days: ncCount.count ?? 0,
      food_entries: foodCount.count ?? 0,
      lab_results: labCount.count ?? 0,
      imaging_studies: imgCount.count ?? 0,
    },
  }
}
