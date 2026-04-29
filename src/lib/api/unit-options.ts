/**
 * Universal unit options for the food detail portion picker.
 *
 * USDA `foodPortions` give us food-specific portions ("1 medium banana
 * = 118 g") which are EXACT for that food. But scales weigh in many
 * units, and the user shouldn't have to convert in their head:
 *
 *   - kitchen scales weigh in g / oz
 *   - postal scales weigh in oz / lb
 *   - measuring cups in fl oz / cup / tbsp / tsp / ml / L
 *   - pharmacy scales in mg
 *
 * These universal units let the user pick the unit that matches their
 * scale, type the amount IN that unit, and the system converts to
 * grams for nutrient scaling.
 *
 * Mass units (g/mg/kg/oz/lb) are EXACT conversions — chemistry doesn't
 * care what's on the scale, mass is mass.
 *
 * Volume units (ml/L/fl oz/cup/tbsp/tsp) use the water-equivalent
 * conversion (1 ml ≈ 1 g). For solid foods this is an approximation
 * because density varies (1 cup of flour ≠ 1 cup of honey). The
 * picker labels them with "≈" so the user knows they're estimates.
 *
 * Mirror of MFN frame_0050 unit chips: fl oz / ml / cup / tbsp / tsp
 * appear regardless of the food, and the user types the amount in
 * the chosen unit.
 */

export type UnitKind = 'mass' | 'volume'

export interface UnitOption {
  /** Short label rendered on the chip ("g", "fl oz", "tsp"). */
  unit: string
  kind: UnitKind
  /** Grams per 1 of this unit. Volume conversions assume water density. */
  gramsPerUnit: number
  /** True for volume units so the UI can mark them as approximate. */
  isVolume: boolean
  /** Display order on the chip strip (lower first). */
  order: number
}

export const UNIT_OPTIONS: UnitOption[] = [
  // Mass — exact conversions
  { unit: 'g', kind: 'mass', gramsPerUnit: 1, isVolume: false, order: 10 },
  { unit: 'mg', kind: 'mass', gramsPerUnit: 0.001, isVolume: false, order: 11 },
  { unit: 'kg', kind: 'mass', gramsPerUnit: 1000, isVolume: false, order: 12 },
  { unit: 'oz', kind: 'mass', gramsPerUnit: 28.3495, isVolume: false, order: 13 },
  { unit: 'lb', kind: 'mass', gramsPerUnit: 453.592, isVolume: false, order: 14 },
  // Volume — water-equivalent (approximate for non-water foods)
  { unit: 'ml', kind: 'volume', gramsPerUnit: 1, isVolume: true, order: 20 },
  { unit: 'L', kind: 'volume', gramsPerUnit: 1000, isVolume: true, order: 21 },
  { unit: 'fl oz', kind: 'volume', gramsPerUnit: 29.5735, isVolume: true, order: 22 },
  { unit: 'cup', kind: 'volume', gramsPerUnit: 240, isVolume: true, order: 23 },
  { unit: 'tbsp', kind: 'volume', gramsPerUnit: 14.7868, isVolume: true, order: 24 },
  { unit: 'tsp', kind: 'volume', gramsPerUnit: 4.92892, isVolume: true, order: 25 },
]

/** Find a unit option by its short label. Used for hydrating saved state. */
export function findUnitOption(unit: string): UnitOption | null {
  const match = UNIT_OPTIONS.find((u) => u.unit === unit)
  return match ?? null
}

/** Convert (amount, unit) to grams. */
export function unitAmountToGrams(amount: number, unit: UnitOption): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return amount * unit.gramsPerUnit
}

/** Convert grams back to (amount, unit). Useful for switching units
 *  while preserving the underlying weight: user types "100" in g, taps
 *  "oz" -> input updates to "3.53". */
export function gramsToUnitAmount(grams: number, unit: UnitOption): number {
  if (!Number.isFinite(grams) || grams <= 0 || unit.gramsPerUnit <= 0) return 0
  return grams / unit.gramsPerUnit
}
