/**
 * Headache attack data access.
 *
 * All Supabase writes for the headache_attacks table funnel through here,
 * per rule 6.4 of docs/competitive/design-decisions.md. Components should
 * never call supabase directly for this domain.
 *
 * Migration: 014_headache_attacks.sql
 * Spec: docs/competitive/headache-diary/implementation-notes.md
 */

import { supabase } from '@/lib/supabase'
import { getCurrentCycleDay } from '@/lib/cycle/current-day'

// ── Enums ──────────────────────────────────────────────────────────────

/**
 * Head zones covered by the head-zone body map. Mirrors the brief's
 * 10-zone list. Left/right zones are captured separately so menstrual-
 * migraine correlation can notice laterality patterns later.
 */
export type HeadZone =
  | 'frontal-l'
  | 'frontal-r'
  | 'frontal-c'
  | 'temporal-l'
  | 'temporal-r'
  | 'orbital-l'
  | 'orbital-r'
  | 'occipital'
  | 'vertex'
  | 'c-spine'

/**
 * ICHD-3 aura categories. Motor aura is separated because selecting it
 * surfaces a hemiplegic-migraine advisory (triptans contraindicated).
 * Reference: International Classification of Headache Disorders, 3rd ed.
 */
export type AuraCategory = 'visual' | 'sensory' | 'speech' | 'motor'

export const HEAD_ZONES: ReadonlyArray<HeadZone> = [
  'frontal-l',
  'frontal-r',
  'frontal-c',
  'temporal-l',
  'temporal-r',
  'orbital-l',
  'orbital-r',
  'occipital',
  'vertex',
  'c-spine',
]

export const AURA_CATEGORIES: ReadonlyArray<AuraCategory> = [
  'visual',
  'sensory',
  'speech',
  'motor',
]

// ── Types ──────────────────────────────────────────────────────────────

export interface HeadacheMedication {
  name: string
  dose?: string
  time_taken?: string // ISO timestamp
  effectiveness_0_10?: number
}

export interface HeadacheAttack {
  id: string
  patient_id: string
  started_at: string
  ended_at: string | null
  severity: number | null
  head_zones: HeadZone[]
  aura_categories: AuraCategory[]
  triggers: string[]
  medications_taken: HeadacheMedication[]
  medication_relief_minutes: number | null
  notes: string | null
  cycle_phase: string | null
  hit6_score: number | null
  midas_grade: string | null
  created_at: string
}

export interface HeadacheAttackInput {
  started_at?: string
  ended_at?: string | null
  severity?: number | null
  head_zones?: HeadZone[]
  aura_categories?: AuraCategory[]
  triggers?: string[]
  medications_taken?: HeadacheMedication[]
  medication_relief_minutes?: number | null
  notes?: string | null
  cycle_phase?: string | null
  hit6_score?: number | null
  midas_grade?: string | null
}

// ── Pure helpers (exported for tests) ──────────────────────────────────

/**
 * Normalize an arbitrary cycle phase value (or null) into the canonical
 * string stored in headache_attacks.cycle_phase. Accepts the CyclePhase
 * union returned by getCurrentCycleDay plus null. Returns null when no
 * menstrual history is available so the column stays NULL rather than
 * lying about the phase.
 */
export function normalizeCyclePhase(phase: string | null | undefined): string | null {
  if (!phase) return null
  const allowed = ['menstrual', 'follicular', 'ovulatory', 'luteal']
  return allowed.includes(phase) ? phase : null
}

/**
 * Evaluate whether an aura selection requires the hemiplegic-migraine
 * advisory. Exported separately so both API callers (pre-save validation)
 * and UI components (inline warning) can share the same rule.
 */
export function hasMotorAura(auraCategories: AuraCategory[] | undefined): boolean {
  if (!auraCategories) return false
  return auraCategories.includes('motor')
}

/**
 * Validate severity is within 0-10 range. Returns the clamped value or
 * null when the input is null/undefined.
 */
export function clampSeverity(severity: number | null | undefined): number | null {
  if (severity === null || severity === undefined) return null
  if (Number.isNaN(severity)) return null
  return Math.min(10, Math.max(0, Math.round(severity)))
}

// ── API surface ────────────────────────────────────────────────────────

/**
 * Start a new headache attack. Inserts a row with started_at = now()
 * (unless overridden), denormalizes the current cycle phase so later
 * correlation queries stay fast, and returns the inserted row.
 *
 * One-tap UX: call with no args from the HeadacheQuickLog button. The
 * caller can follow up with updateAttack / endAttack as the user adds
 * pain, locations, medications.
 */
export async function startAttack(
  input: HeadacheAttackInput = {}
): Promise<HeadacheAttack> {
  const started_at = input.started_at ?? new Date().toISOString()

  // Denormalize cycle phase at write time. Read-only query to cycle_entries
  // and nc_imported via the canonical helper. If it fails (missing data),
  // fall back to null rather than blocking the attack log.
  let cyclePhase = input.cycle_phase ?? null
  if (cyclePhase === null) {
    try {
      const today = started_at.slice(0, 10)
      const current = await getCurrentCycleDay(today)
      cyclePhase = normalizeCyclePhase(current.phase)
    } catch {
      cyclePhase = null
    }
  }

  const row = {
    started_at,
    ended_at: input.ended_at ?? null,
    severity: clampSeverity(input.severity),
    head_zones: input.head_zones ?? [],
    aura_categories: input.aura_categories ?? [],
    triggers: input.triggers ?? [],
    medications_taken: input.medications_taken ?? [],
    medication_relief_minutes: input.medication_relief_minutes ?? null,
    notes: input.notes ?? null,
    cycle_phase: cyclePhase,
    hit6_score: input.hit6_score ?? null,
    midas_grade: input.midas_grade ?? null,
  }

  const { data, error } = await supabase
    .from('headache_attacks')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`Failed to start headache attack: ${error.message}`)
  return data as HeadacheAttack
}

/**
 * Update an in-progress or completed attack. Only the supplied fields are
 * changed. Severity is clamped to the 0-10 range.
 */
export async function updateAttack(
  id: string,
  fields: HeadacheAttackInput
): Promise<HeadacheAttack> {
  const patch: Record<string, unknown> = {}

  if (fields.started_at !== undefined) patch.started_at = fields.started_at
  if (fields.ended_at !== undefined) patch.ended_at = fields.ended_at
  if (fields.severity !== undefined) patch.severity = clampSeverity(fields.severity)
  if (fields.head_zones !== undefined) patch.head_zones = fields.head_zones
  if (fields.aura_categories !== undefined) patch.aura_categories = fields.aura_categories
  if (fields.triggers !== undefined) patch.triggers = fields.triggers
  if (fields.medications_taken !== undefined) patch.medications_taken = fields.medications_taken
  if (fields.medication_relief_minutes !== undefined) {
    patch.medication_relief_minutes = fields.medication_relief_minutes
  }
  if (fields.notes !== undefined) patch.notes = fields.notes
  if (fields.cycle_phase !== undefined) patch.cycle_phase = fields.cycle_phase
  if (fields.hit6_score !== undefined) patch.hit6_score = fields.hit6_score
  if (fields.midas_grade !== undefined) patch.midas_grade = fields.midas_grade

  const { data, error } = await supabase
    .from('headache_attacks')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update headache attack: ${error.message}`)
  return data as HeadacheAttack
}

/**
 * Mark an attack as ended. Sets ended_at to now() unless overridden.
 */
export async function endAttack(
  id: string,
  endedAt?: string
): Promise<HeadacheAttack> {
  return updateAttack(id, { ended_at: endedAt ?? new Date().toISOString() })
}

/**
 * Get the currently-open attack (started_at set, ended_at null) for the
 * given patient. Returns null when no attack is in progress.
 */
export async function getActiveAttack(
  patientId: string = 'lanae'
): Promise<HeadacheAttack | null> {
  const { data, error } = await supabase
    .from('headache_attacks')
    .select('*')
    .eq('patient_id', patientId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch active attack: ${error.message}`)
  return (data ?? null) as HeadacheAttack | null
}

/**
 * Fetch headache attacks for a patient over a window. Default window is
 * the last 90 days, which matches HIT-6 and MIDAS 90-day recall periods.
 */
export async function getAttacks(
  options: {
    patientId?: string
    since?: string
    until?: string
    limit?: number
  } = {}
): Promise<HeadacheAttack[]> {
  const patientId = options.patientId ?? 'lanae'
  const until = options.until ?? new Date().toISOString()
  const since =
    options.since ??
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const limit = options.limit ?? 500

  const { data, error } = await supabase
    .from('headache_attacks')
    .select('*')
    .eq('patient_id', patientId)
    .gte('started_at', since)
    .lte('started_at', until)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch headache attacks: ${error.message}`)
  return (data ?? []) as HeadacheAttack[]
}

/**
 * Delete a headache attack. Intended for user-initiated corrections, e.g.
 * a mis-tapped "Start attack" button. Permanent; there is no soft delete.
 */
export async function deleteAttack(id: string): Promise<void> {
  const { error } = await supabase
    .from('headache_attacks')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete headache attack: ${error.message}`)
}
