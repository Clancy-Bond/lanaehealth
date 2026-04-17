/**
 * Target Resolver - merges RDA defaults, preset overrides, and user
 * overrides into the effective per-nutrient target for a patient.
 *
 * Resolution order (highest priority wins):
 *   1. user overrides (source = 'user')
 *   2. preset overrides (source = 'preset:<name>')
 *   3. RDA defaults (source = 'rda')
 *   4. fallback to nutrients-list.ts rdaDefault if DB row missing
 *
 * The resolver is a pure function over DB rows plus the canonical
 * nutrients list. It integrates with Wave 1C's endo preset by reading
 * the endo preset values from `diet-presets.ts`, not by rewriting them.
 */

import type { NutrientDefinition, PresetKey } from './nutrients-list'
import { NUTRIENTS, findNutrient } from './nutrients-list'
import { ENDO_ANTI_INFLAMMATORY_PRESET } from './diet-presets'

/**
 * A raw row from user_nutrient_targets. The DB column names are snake
 * case to match Postgres conventions. Consumers convert at the API edge.
 */
export interface NutrientTargetRow {
  patient_id: string
  nutrient: string
  target_amount: number
  target_unit: string
  source: string
  rationale: string | null
  citation: string | null
  active: boolean
}

/**
 * Resolved target used by the UI and intake rollup. Includes provenance
 * so we can show the user where the value came from and let them edit.
 */
export interface ResolvedTarget {
  nutrient: string
  displayName: string
  amount: number
  unit: string
  source: 'rda' | 'preset' | 'user' | 'fallback'
  /** The preset name when source starts with 'preset:'. */
  presetName: string | null
  rationale: string | null
  citation: string | null
}

/**
 * Resolve targets for every known nutrient. Missing DB rows fall back
 * to the canonical RDA default from nutrients-list.ts so the UI never
 * shows a blank target after a fresh migration.
 */
export function resolveAllTargets(rows: NutrientTargetRow[]): ResolvedTarget[] {
  const byNutrient = groupActiveRows(rows)
  return NUTRIENTS.map((def) => resolveOne(def, byNutrient.get(def.key) ?? []))
}

/**
 * Resolve the target for a single nutrient key. Returns the fallback
 * RDA when no DB rows exist. Returns null if the key is unknown.
 */
export function resolveTarget(
  nutrientKey: string,
  rows: NutrientTargetRow[],
): ResolvedTarget | null {
  const def = findNutrient(nutrientKey)
  if (!def) return null
  const match = rows.filter((r) => r.nutrient === nutrientKey && r.active)
  return resolveOne(def, match)
}

/**
 * Integrates a Wave 1C endo preset target into the resolver without
 * writing to the DB. Useful for a Log-page preview that honors the
 * preset before the user formally applies it via settings.
 *
 * This does NOT mutate `diet-presets.ts`. It only reads from the endo
 * preset as a reference when building a resolved target list.
 */
export function endoPresetAsRows(): NutrientTargetRow[] {
  return ENDO_ANTI_INFLAMMATORY_PRESET.targets.map((t) => ({
    patient_id: 'lanae',
    nutrient: t.nutrient,
    target_amount: t.amount,
    target_unit: t.unit,
    source: 'preset:endo',
    rationale: t.rationale,
    citation: t.citation,
    active: true,
  }))
}

// ── Internals ─────────────────────────────────────────────────────────

function groupActiveRows(
  rows: NutrientTargetRow[],
): Map<string, NutrientTargetRow[]> {
  const out = new Map<string, NutrientTargetRow[]>()
  for (const row of rows) {
    if (!row.active) continue
    const list = out.get(row.nutrient) ?? []
    list.push(row)
    out.set(row.nutrient, list)
  }
  return out
}

function resolveOne(
  def: NutrientDefinition,
  candidates: NutrientTargetRow[],
): ResolvedTarget {
  const userRow = candidates.find((r) => r.source === 'user')
  if (userRow) {
    return {
      nutrient: def.key,
      displayName: def.displayName,
      amount: Number(userRow.target_amount),
      unit: userRow.target_unit,
      source: 'user',
      presetName: null,
      rationale: userRow.rationale,
      citation: userRow.citation,
    }
  }

  const presetRow = candidates.find((r) => r.source.startsWith('preset:'))
  if (presetRow) {
    return {
      nutrient: def.key,
      displayName: def.displayName,
      amount: Number(presetRow.target_amount),
      unit: presetRow.target_unit,
      source: 'preset',
      presetName: presetRow.source.slice('preset:'.length) || null,
      rationale: presetRow.rationale,
      citation: presetRow.citation,
    }
  }

  const rdaRow = candidates.find((r) => r.source === 'rda')
  if (rdaRow) {
    return {
      nutrient: def.key,
      displayName: def.displayName,
      amount: Number(rdaRow.target_amount),
      unit: rdaRow.target_unit,
      source: 'rda',
      presetName: null,
      rationale: rdaRow.rationale,
      citation: rdaRow.citation,
    }
  }

  // Fallback when no DB rows exist for this nutrient (e.g., migration
  // not yet applied). Uses the canonical RDA from nutrients-list.ts.
  return {
    nutrient: def.key,
    displayName: def.displayName,
    amount: def.rdaDefault,
    unit: def.unit,
    source: 'fallback',
    presetName: null,
    rationale: `Default RDA from NIH ODS, used until DB seed runs.`,
    citation: def.rdaCitation,
  }
}

/**
 * Build a preset row for a known preset key. Useful for `applyPreset`
 * style endpoints that need to insert the correct rationale/citation
 * alongside the override amount. Delegates to diet-presets.ts for
 * 'endo' to keep a single source of truth.
 */
export function buildPresetRowsForPatient(
  patientId: string,
  preset: PresetKey,
): NutrientTargetRow[] {
  if (preset === 'endo') {
    return ENDO_ANTI_INFLAMMATORY_PRESET.targets.map((t) => ({
      patient_id: patientId,
      nutrient: t.nutrient,
      target_amount: t.amount,
      target_unit: t.unit,
      source: 'preset:endo',
      rationale: t.rationale,
      citation: t.citation,
      active: true,
    }))
  }

  // For other presets, read overrides from the canonical nutrients list.
  const out: NutrientTargetRow[] = []
  for (const def of NUTRIENTS) {
    const override = def.presetOverrides?.[preset]
    if (!override) continue
    out.push({
      patient_id: patientId,
      nutrient: def.key,
      target_amount: override.amount,
      target_unit: def.unit,
      source: `preset:${preset}`,
      rationale: override.rationale,
      citation: override.citation,
      active: true,
    })
  }
  return out
}
