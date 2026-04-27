/**
 * FDA % Daily Value reference targets for an adult 2,000 kcal diet.
 *
 * Source: FDA Reference Daily Intakes (RDI) and Daily Reference Values
 * (DRV) per 21 CFR 101.9(c)(8)(iv) and the 2016 nutrition-facts label
 * update. These are the same numbers MyNetDiary's "% Food Label Daily
 * Value" column uses, which is why we anchor to them rather than
 * Lanae's personalized targets in `nutrient_targets`. Personal goals
 * live elsewhere in the app; this file is for the FDA-style table.
 *
 * Trans Fat has no DV per the FDA (line is informational only).
 *
 * Centralized here so MyNutrientsTable, future analysis surfaces, and
 * doctor-mode reports all reference one source of truth.
 */

export const FDA_DAILY_VALUES = {
  fat: 78, // g
  satFat: 20, // g
  // Trans fat: no DV (omit from the %DV column entirely)
  cholesterol: 300, // mg
  sodium: 2300, // mg
  carbs: 275, // g
  fiber: 28, // g
  sugar: 50, // g - "Added Sugars" per FDA; we approximate to total
  protein: 50, // g
  vitaminD: 20, // mcg
  calcium: 1300, // mg
  iron: 18, // mg
  potassium: 4700, // mg
  vitaminC: 90, // mg
  vitaminB12: 2.4, // mcg
  magnesium: 420, // mg
  zinc: 11, // mg
  folate: 400, // mcg DFE
  omega3: 1100, // mg (FDA Adequate Intake; not a strict DV)
} as const

export type FdaNutrientKey = keyof typeof FDA_DAILY_VALUES

/**
 * Render `pct` as a percent string for the table. Returns `--` when
 * the input is null/undefined or non-finite, mirroring MFN's behavior
 * for foods that USDA does not have data for. Negative values clamp
 * to 0; values above 999% clamp to "999+%" so the column never
 * grows wider than two characters worth.
 */
export function formatPctDV(
  value: number | null | undefined,
  key: FdaNutrientKey,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--'
  const target = FDA_DAILY_VALUES[key]
  if (!target) return '--'
  const raw = (value / target) * 100
  if (raw < 0) return '0%'
  if (raw >= 1000) return '999+%'
  return `${Math.round(raw)}%`
}

/**
 * Render a nutrient amount with unit. Returns '--' when null/undefined.
 * `digits` controls trailing precision (default 1). Uses tabular-nums
 * presentation downstream so columns line up.
 */
export function formatAmount(
  value: number | null | undefined,
  unit: 'g' | 'mg' | 'mcg',
  digits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--'
  const n = digits === 0 ? Math.round(value) : Number(value.toFixed(digits))
  return `${n}${unit}`
}
