/**
 * Nutrient Targets API
 *
 * Read + write access to the user_nutrient_targets table (migration 017).
 * All writes go through this module. Components must not call supabase
 * directly for this table.
 *
 * Source resolution is delegated to
 * `src/lib/nutrition/target-resolver.ts`. This module is pure DB I/O.
 */

import { supabase, createServiceClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NutrientTargetRow } from '@/lib/nutrition/target-resolver'
import { resolveAllTargets } from '@/lib/nutrition/target-resolver'
import { NUTRIENTS } from '@/lib/nutrition/nutrients-list'
import type { ResolvedTarget } from '@/lib/nutrition/target-resolver'

const DEFAULT_PATIENT_ID = 'lanae'

/**
 * Inject a client for testing. Tests can pass a fake SupabaseClient
 * to avoid network. Production callers pass nothing and get the real
 * anon client. Service-role writes explicitly use
 * `createServiceClient()`.
 */
export interface ClientDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: SupabaseClient<any>
}

function readClient(deps?: ClientDeps): SupabaseClient {
  return deps?.client ?? supabase
}

function writeClient(deps?: ClientDeps): SupabaseClient {
  return deps?.client ?? createServiceClient()
}

/**
 * Fetch every active target row for a patient. Sorted by nutrient
 * declaration order from nutrients-list.ts so UIs render consistently.
 */
export async function listTargets(
  patientId: string = DEFAULT_PATIENT_ID,
  deps?: ClientDeps,
): Promise<NutrientTargetRow[]> {
  const sb = readClient(deps)
  const { data, error } = await sb
    .from('user_nutrient_targets')
    .select('*')
    .eq('patient_id', patientId)
    .eq('active', true)

  if (error) throw new Error(`Failed to fetch nutrient targets: ${error.message}`)

  const rows = (data ?? []) as NutrientTargetRow[]
  return sortByDeclarationOrder(rows)
}

/**
 * Fetch and resolve targets in one pass. Returns one ResolvedTarget per
 * known nutrient in the canonical list, filling in fallback RDAs when a
 * DB row is missing.
 */
export async function getResolvedTargets(
  patientId: string = DEFAULT_PATIENT_ID,
  deps?: ClientDeps,
): Promise<ResolvedTarget[]> {
  const rows = await listTargets(patientId, deps)
  return resolveAllTargets(rows)
}

/**
 * Upsert a single user override. The source is forced to 'user' so
 * this path cannot accidentally overwrite RDA or preset rows' provenance.
 * UNIQUE(patient_id, nutrient) means a second call replaces the value.
 */
export async function upsertUserOverride(
  input: {
    patientId?: string
    nutrient: string
    targetAmount: number
    targetUnit: string
    rationale?: string | null
    citation?: string | null
  },
  deps?: ClientDeps,
): Promise<NutrientTargetRow> {
  const patient = input.patientId ?? DEFAULT_PATIENT_ID

  // Guard: the nutrient key must exist in our canonical list. This is
  // intentional rather than lenient. If a UI ever writes an unknown key,
  // we want to surface the bug immediately, not silently persist it.
  if (!NUTRIENTS.some((n) => n.key === input.nutrient)) {
    throw new Error(`Unknown nutrient key: ${input.nutrient}`)
  }
  if (!Number.isFinite(input.targetAmount) || input.targetAmount < 0) {
    throw new Error(
      `target_amount must be a non-negative finite number (got ${input.targetAmount})`,
    )
  }

  const sb = writeClient(deps)
  const { data, error } = await sb
    .from('user_nutrient_targets')
    .upsert(
      {
        patient_id: patient,
        nutrient: input.nutrient,
        target_amount: input.targetAmount,
        target_unit: input.targetUnit,
        source: 'user',
        rationale: input.rationale ?? null,
        citation: input.citation ?? null,
        active: true,
      },
      { onConflict: 'patient_id,nutrient' },
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to upsert nutrient target: ${error.message}`)
  return data as NutrientTargetRow
}

/**
 * Bulk insert a set of preset rows. Used when applying an endo / POTS
 * / thyroid / iron-deficiency preset. UNIQUE constraint means re-apply
 * replaces prior preset or RDA values for the same nutrient; user
 * overrides are only replaced when the caller opts in via `force`.
 */
export async function upsertPresetRows(
  rows: NutrientTargetRow[],
  options?: { force?: boolean },
  deps?: ClientDeps,
): Promise<NutrientTargetRow[]> {
  if (rows.length === 0) return []

  const sb = writeClient(deps)

  let toWrite = rows
  if (!options?.force) {
    // Preserve existing user overrides: drop preset writes for nutrients
    // that already have source='user'. This keeps clinician-applied
    // values from being silently replaced on preset re-apply.
    const patientIds = Array.from(new Set(rows.map((r) => r.patient_id)))
    const nutrients = Array.from(new Set(rows.map((r) => r.nutrient)))
    const { data: existing, error } = await sb
      .from('user_nutrient_targets')
      .select('patient_id,nutrient,source,active')
      .in('patient_id', patientIds)
      .in('nutrient', nutrients)
    if (error) throw new Error(`Failed to read existing rows: ${error.message}`)
    const protectedKeys = new Set(
      (existing ?? [])
        .filter((r) => r.active && r.source === 'user')
        .map((r) => `${r.patient_id}::${r.nutrient}`),
    )
    toWrite = rows.filter(
      (r) => !protectedKeys.has(`${r.patient_id}::${r.nutrient}`),
    )
  }

  if (toWrite.length === 0) return []

  const { data, error } = await sb
    .from('user_nutrient_targets')
    .upsert(toWrite, { onConflict: 'patient_id,nutrient' })
    .select()
  if (error) throw new Error(`Failed to upsert preset rows: ${error.message}`)
  return (data ?? []) as NutrientTargetRow[]
}

/**
 * Deactivate a single target. Soft-delete via `active=false` so we keep
 * an audit trail of clinician edits. Hard delete is intentionally not
 * exposed from this module.
 */
export async function deactivateTarget(
  input: { patientId?: string; nutrient: string },
  deps?: ClientDeps,
): Promise<void> {
  const patient = input.patientId ?? DEFAULT_PATIENT_ID
  const sb = writeClient(deps)
  const { error } = await sb
    .from('user_nutrient_targets')
    .update({ active: false })
    .eq('patient_id', patient)
    .eq('nutrient', input.nutrient)
  if (error) throw new Error(`Failed to deactivate target: ${error.message}`)
}

// ── helpers ───────────────────────────────────────────────────────────

function sortByDeclarationOrder(
  rows: NutrientTargetRow[],
): NutrientTargetRow[] {
  const order = new Map<string, number>()
  NUTRIENTS.forEach((n, i) => order.set(n.key, i))
  return [...rows].sort((a, b) => {
    const ai = order.get(a.nutrient) ?? 999
    const bi = order.get(b.nutrient) ?? 999
    return ai - bi
  })
}
