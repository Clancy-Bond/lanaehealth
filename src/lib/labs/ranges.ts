/**
 * Canonical reference ranges for common lab tests.
 *
 * Used as a fallback when lab_results.reference_range_low/high are missing.
 * Values are adult female ranges (Lanae is 24F) and are sourced from
 * standard US reference labs (Quest, LabCorp, Mayo) cross-checked against
 * the MDCalc / UpToDate normal ranges. These are NOT diagnostic targets
 * and should NEVER be treated as a substitute for a clinician's
 * interpretation of a specific assay's range.
 *
 * If a test has multiple common units (e.g. Ferritin ng/mL vs ug/L, which
 * are numerically identical), list them all. Matching is by normalized
 * test name + unit.
 */

export interface CanonicalRange {
  test_name: string
  unit: string
  low: number | null
  high: number | null
  /** Source string shown in UI; e.g. "Quest adult female". */
  source: string
}

/**
 * Normalize a test name for case-insensitive matching.
 * Trims whitespace, lowercases, collapses internal runs of spaces.
 */
export function normalizeTestName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Normalize a unit string for matching. Accepts null/undefined.
 */
export function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return ''
  return unit.trim().toLowerCase().replace(/\s+/g, '')
}

// ── Canonical adult-female reference ranges ─────────────────────────
//
// When ref_low/ref_high are absent on a lab_results row, we look up by
// (normalized test_name, normalized unit). If unit is missing, the first
// row for that test name wins.

const CANONICAL_RANGES: CanonicalRange[] = [
  // Iron / anemia panel
  { test_name: 'ferritin', unit: 'ng/mL', low: 13, high: 150, source: 'Quest adult female' },
  { test_name: 'ferritin', unit: 'ug/L', low: 13, high: 150, source: 'Quest adult female' },
  { test_name: 'iron', unit: 'ug/dL', low: 35, high: 145, source: 'Quest adult female' },
  { test_name: 'tibc', unit: 'ug/dL', low: 250, high: 450, source: 'Quest adult' },
  { test_name: 'transferrin saturation', unit: '%', low: 15, high: 50, source: 'Quest adult female' },

  // CBC
  { test_name: 'hemoglobin', unit: 'g/dL', low: 12.0, high: 15.5, source: 'Mayo adult female' },
  { test_name: 'hematocrit', unit: '%', low: 35.5, high: 44.9, source: 'Mayo adult female' },
  { test_name: 'rbc', unit: 'M/uL', low: 3.92, high: 5.13, source: 'Mayo adult female' },
  { test_name: 'wbc', unit: 'K/uL', low: 3.4, high: 10.8, source: 'Mayo adult' },
  { test_name: 'platelets', unit: 'K/uL', low: 150, high: 400, source: 'Mayo adult' },
  { test_name: 'mcv', unit: 'fL', low: 80, high: 100, source: 'Mayo adult' },
  { test_name: 'mch', unit: 'pg', low: 27, high: 33, source: 'Mayo adult' },
  { test_name: 'mchc', unit: 'g/dL', low: 32, high: 36, source: 'Mayo adult' },

  // Vitamins
  { test_name: 'vitamin d', unit: 'ng/mL', low: 30, high: 100, source: 'Endocrine Society' },
  { test_name: 'vitamin d, 25-hydroxy', unit: 'ng/mL', low: 30, high: 100, source: 'Endocrine Society' },
  { test_name: 'vitamin b12', unit: 'pg/mL', low: 232, high: 1245, source: 'Quest adult' },
  { test_name: 'folate', unit: 'ng/mL', low: 3.0, high: 20.0, source: 'Quest adult' },

  // Thyroid
  { test_name: 'tsh', unit: 'uIU/mL', low: 0.4, high: 4.5, source: 'AACE / ATA' },
  { test_name: 'tsh', unit: 'mIU/L', low: 0.4, high: 4.5, source: 'AACE / ATA' },
  { test_name: 'free t4', unit: 'ng/dL', low: 0.8, high: 1.8, source: 'Quest adult' },
  { test_name: 'free t3', unit: 'pg/mL', low: 2.3, high: 4.2, source: 'Quest adult' },

  // Inflammation
  { test_name: 'hs-crp', unit: 'mg/L', low: null, high: 3.0, source: 'AHA cardiovascular' },
  { test_name: 'crp', unit: 'mg/L', low: null, high: 10.0, source: 'Quest adult' },
  { test_name: 'esr', unit: 'mm/hr', low: null, high: 20, source: 'Mayo adult female' },

  // Lipids
  { test_name: 'total cholesterol', unit: 'mg/dL', low: null, high: 200, source: 'NCEP ATP III' },
  { test_name: 'ldl', unit: 'mg/dL', low: null, high: 100, source: 'NCEP ATP III' },
  { test_name: 'hdl', unit: 'mg/dL', low: 50, high: null, source: 'NCEP ATP III adult female' },
  { test_name: 'triglycerides', unit: 'mg/dL', low: null, high: 150, source: 'NCEP ATP III' },

  // Metabolic
  { test_name: 'glucose', unit: 'mg/dL', low: 70, high: 99, source: 'ADA fasting' },
  { test_name: 'hba1c', unit: '%', low: null, high: 5.7, source: 'ADA non-diabetic' },
  { test_name: 'insulin', unit: 'uIU/mL', low: 2.6, high: 24.9, source: 'Quest fasting adult' },
  { test_name: 'creatinine', unit: 'mg/dL', low: 0.59, high: 1.04, source: 'Mayo adult female' },
  { test_name: 'bun', unit: 'mg/dL', low: 6, high: 20, source: 'Mayo adult' },
  { test_name: 'egfr', unit: 'mL/min/1.73m2', low: 60, high: null, source: 'KDIGO' },

  // Liver
  { test_name: 'alt', unit: 'U/L', low: 7, high: 35, source: 'AASLD adult female' },
  { test_name: 'ast', unit: 'U/L', low: 10, high: 30, source: 'AASLD adult female' },
  { test_name: 'alp', unit: 'U/L', low: 35, high: 104, source: 'Mayo adult' },
  { test_name: 'bilirubin', unit: 'mg/dL', low: 0.1, high: 1.2, source: 'Mayo adult' },
  { test_name: 'total bilirubin', unit: 'mg/dL', low: 0.1, high: 1.2, source: 'Mayo adult' },

  // Coagulation
  { test_name: 'pt', unit: 'sec', low: 9.4, high: 12.5, source: 'Mayo adult' },
  { test_name: 'inr', unit: '', low: 0.9, high: 1.1, source: 'Mayo non-anticoag' },
  { test_name: 'aptt', unit: 'sec', low: 25, high: 35, source: 'Mayo adult' },
  { test_name: 'fibrinogen', unit: 'mg/dL', low: 200, high: 400, source: 'Mayo adult' },
]

/**
 * Look up a canonical reference range by test name + unit.
 * Unit match is preferred; if no exact unit match is found, falls back
 * to the first range for that test name. Returns null if nothing matches.
 */
export function lookupCanonicalRange(
  testName: string,
  unit: string | null | undefined,
): CanonicalRange | null {
  const normName = normalizeTestName(testName)
  const normUnit = normalizeUnit(unit)

  const byName = CANONICAL_RANGES.filter(
    (r) => normalizeTestName(r.test_name) === normName,
  )
  if (byName.length === 0) return null

  // Prefer unit match when caller gave a unit
  if (normUnit) {
    const byUnit = byName.find((r) => normalizeUnit(r.unit) === normUnit)
    if (byUnit) return byUnit
  }

  return byName[0]
}

/**
 * Resolve the effective reference range for a lab row.
 * Prefers the row's own ref_low/ref_high when at least one bound is present.
 * Falls back to the canonical list by (test_name, unit).
 */
export function resolveRefRange(
  testName: string,
  unit: string | null | undefined,
  refLow: number | null | undefined,
  refHigh: number | null | undefined,
): { low: number | null; high: number | null; source: 'row' | 'canonical' | 'none' } {
  const hasRowRange =
    (refLow !== null && refLow !== undefined) ||
    (refHigh !== null && refHigh !== undefined)
  if (hasRowRange) {
    return {
      low: refLow ?? null,
      high: refHigh ?? null,
      source: 'row',
    }
  }

  const canonical = lookupCanonicalRange(testName, unit)
  if (canonical) {
    return { low: canonical.low, high: canonical.high, source: 'canonical' }
  }

  return { low: null, high: null, source: 'none' }
}

/**
 * Compute a flag for a value relative to a resolved reference range.
 * Returns 'low' | 'high' | 'normal' | null (null = no range available).
 */
export function flagForValue(
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
): 'low' | 'high' | 'normal' | null {
  if (value === null || Number.isNaN(value)) return null
  if (refLow === null && refHigh === null) return null
  if (refLow !== null && value < refLow) return 'low'
  if (refHigh !== null && value > refHigh) return 'high'
  return 'normal'
}

export const __testing__ = {
  CANONICAL_RANGES,
}
