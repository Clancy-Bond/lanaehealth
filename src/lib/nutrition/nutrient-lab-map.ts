/**
 * Nutrient x Lab Map - in-code seed linking lab tests to the relevant
 * nutrients whose intake may support lab-value improvement.
 *
 * Why in-code (not a DB table):
 *   - The mappings are clinical literature, not patient data.
 *   - Versioning via git gives us a clear audit trail and peer-review
 *     lane when a citation is updated.
 *   - Avoids an otherwise unnecessary migration (the Wave 2 plan
 *     explicitly tells us to prefer in-code seeds where feasible).
 *
 * Voice rule (non-diagnostic):
 *   - Mappings surface as "intake suggestions" not "you have X condition".
 *   - All actionable copy lives in `nutrient-lab-alerts.ts`. This module
 *     is pure data.
 *
 * Read this alongside:
 *   docs/competitive/cronometer/implementation-notes.md Feature 1
 *   src/lib/intelligence/nutrient-lab-alerts.ts
 */

/**
 * The direction a lab result needs to move in order to be "better".
 *   - below_range: lab value is below the reference low; we want it up
 *   - above_range: lab value is above the reference high; we want it down
 *   - borderline_high: value is inside-range but toward the upper bound
 *     where clinical guidance treats it as a risk flag (TSH 4.5 to 10
 *     mIU/L subclinical hypothyroidism being the canonical example)
 *   - borderline_low: inside-range but toward the lower bound
 */
export type LabDirection =
  | 'below_range'
  | 'above_range'
  | 'borderline_high'
  | 'borderline_low'

/**
 * Match strategy so we can handle the handful of synonyms Lanae's
 * dataset actually contains (for example "Ferritin" vs "FERRITIN" vs
 * "Ferritin, serum"). We match the `test_name` column on
 * `lab_results` case-insensitively against one of:
 *   - exact: trimmed lowercase equality
 *   - includes: the canonical token appears inside the test_name
 *   - regex: a case-insensitive regex (used for multi-token synonyms)
 *
 * Keep matches conservative. A false positive here would nudge Lanae
 * toward a nutrient suggestion that does not apply.
 */
export interface LabMatcher {
  kind: 'exact' | 'includes' | 'regex'
  value: string
}

export interface NutrientLabMapping {
  /**
   * Stable ID for test assertions. Format: `<lab>_<direction>`.
   * Example: 'ferritin_below_range', 'tsh_borderline_high'.
   */
  id: string
  /** Canonical lab token shown in UI (for example "Ferritin"). */
  labDisplayName: string
  /** One or more matchers against `lab_results.test_name`. */
  labMatchers: LabMatcher[]
  /** Direction that triggers the mapping. */
  direction: LabDirection
  /**
   * Optional numeric threshold overlay for borderline matching. When
   * present, the caller should treat the result as a match only when
   * the value is on the flagged side of `threshold` even if the
   * reference range does not formally flag it. This captures cases
   * like TSH 5.1 where inside-range is not enough to act on but the
   * endocrinology guidance recommends watching intake.
   */
  borderlineThreshold?: {
    comparator: 'gt' | 'lt'
    value: number
    unit: string
  }
  /**
   * The nutrients keys (matching `nutrients-list.ts` `key`) whose
   * intake is most likely to influence this lab value. Order carries
   * meaning: the first entry is the lead suggestion in UI.
   */
  nutrients: string[]
  /**
   * Plain-language clinician summary. No diagnostic claim. Must read
   * as "consider more X" not "you have condition Y".
   */
  advisory: string
  /** Peer-reviewed or guideline-level citation. */
  citation: string
}

/**
 * Seed of mappings.
 *
 * Each entry is intentionally small and cited. If you add a mapping,
 * include both a study reference and a unit-anchored threshold where
 * applicable.
 */
export const NUTRIENT_LAB_MAPPINGS: readonly NutrientLabMapping[] = [
  // ── Iron / ferritin ────────────────────────────────────────────────
  {
    id: 'ferritin_below_range',
    labDisplayName: 'Ferritin',
    labMatchers: [
      { kind: 'includes', value: 'ferritin' },
    ],
    direction: 'below_range',
    nutrients: ['iron', 'vitamin_c'],
    advisory:
      'Iron stores below reference often correlate with heavy menstrual loss. Pair iron-rich foods with vitamin C to improve absorption of non-heme iron.',
    citation:
      'Short and Domagalski 2013, American Family Physician; ACOG Clinical Guidance on Iron Supplementation',
  },
  {
    id: 'hemoglobin_below_range',
    labDisplayName: 'Hemoglobin',
    labMatchers: [
      { kind: 'regex', value: '^(hgb|hemoglobin)\\b' },
    ],
    direction: 'below_range',
    nutrients: ['iron', 'vitamin_b12', 'folate'],
    advisory:
      'Hemoglobin below reference suggests the body may need more building blocks for red blood cells. Iron, B12, and folate each feed a separate step of that process.',
    citation:
      'WHO 2011 Haemoglobin Concentrations for the Diagnosis of Anaemia',
  },

  // ── Thyroid ────────────────────────────────────────────────────────
  {
    id: 'tsh_borderline_high',
    labDisplayName: 'TSH',
    labMatchers: [
      { kind: 'exact', value: 'tsh' },
      { kind: 'includes', value: 'thyroid stimulating hormone' },
    ],
    direction: 'borderline_high',
    borderlineThreshold: {
      comparator: 'gt',
      value: 4.0,
      unit: 'mIU/L',
    },
    nutrients: ['selenium', 'iodine'],
    advisory:
      'TSH near the upper end of the reference range sometimes benefits from selenium and iodine adequacy, both of which are cofactors for thyroid hormone production.',
    citation:
      'Gartner et al. 2002, Journal of Clinical Endocrinology (selenium and TPO antibodies); NIH ODS Iodine Fact Sheet',
  },

  // ── Cardiovascular / lipids ────────────────────────────────────────
  {
    id: 'total_cholesterol_above_range',
    labDisplayName: 'Total Cholesterol',
    labMatchers: [
      { kind: 'regex', value: '^(total[ _-]?cholesterol|cholesterol,? total)' },
    ],
    direction: 'above_range',
    nutrients: ['fiber', 'omega_3'],
    advisory:
      'Soluble fiber and omega-3 fats are consistently associated with improved lipid panels in dietary trials.',
    citation:
      'Brown et al. 1999, American Journal of Clinical Nutrition (soluble fiber meta-analysis); Mozaffarian and Wu 2011, JACC (omega-3 and cardiovascular risk)',
  },
  {
    id: 'ldl_above_range',
    labDisplayName: 'LDL Cholesterol',
    labMatchers: [
      { kind: 'regex', value: '^ldl(\\b|[-_ ])' },
      { kind: 'includes', value: 'low density lipoprotein' },
    ],
    direction: 'above_range',
    nutrients: ['fiber', 'omega_3'],
    advisory:
      'LDL trending above reference often responds to soluble fiber intake and to replacing saturated fat with omega-3 sources.',
    citation:
      'Brown et al. 1999, American Journal of Clinical Nutrition',
  },
  {
    id: 'hdl_below_range',
    labDisplayName: 'HDL Cholesterol',
    labMatchers: [
      { kind: 'regex', value: '^hdl(\\b|[-_ ])' },
      { kind: 'includes', value: 'high density lipoprotein' },
    ],
    direction: 'below_range',
    nutrients: ['omega_3'],
    advisory:
      'HDL below reference has been associated with lower omega-3 and mono-unsaturated fat intake in observational data.',
    citation:
      'Mozaffarian and Wu 2011, JACC',
  },
  {
    id: 'triglycerides_above_range',
    labDisplayName: 'Triglycerides',
    labMatchers: [
      { kind: 'includes', value: 'triglyceride' },
    ],
    direction: 'above_range',
    nutrients: ['omega_3', 'fiber'],
    advisory:
      'Elevated triglycerides frequently improve with EPA plus DHA omega-3 intake of 2 to 4 g/day and with a modest reduction in refined carbohydrate load.',
    citation:
      'Skulas-Ray et al. 2019, Circulation (AHA Omega-3 Science Advisory)',
  },

  // ── Vitamin D ──────────────────────────────────────────────────────
  {
    id: 'vitamin_d_below_range',
    labDisplayName: '25-OH Vitamin D',
    labMatchers: [
      { kind: 'regex', value: '25[\\s-]?oh' },
      { kind: 'includes', value: 'vitamin d' },
    ],
    direction: 'below_range',
    nutrients: ['vitamin_d'],
    advisory:
      'Serum 25-OH-D under the reference range frequently improves with dietary vitamin D intake (fatty fish, fortified dairy alternatives) and sun exposure. Endometriosis patients test low at above-average rates.',
    citation:
      'Endocrine Society 2011 Clinical Practice Guidelines for Vitamin D',
  },

  // ── Glucose / metabolic ────────────────────────────────────────────
  {
    id: 'hba1c_above_range',
    labDisplayName: 'HbA1c',
    labMatchers: [
      { kind: 'regex', value: 'hb[ ]?a1c' },
      { kind: 'includes', value: 'hemoglobin a1c' },
    ],
    direction: 'above_range',
    nutrients: ['fiber', 'magnesium'],
    advisory:
      'HbA1c trending above reference often responds to increased soluble fiber and to adequate magnesium, both linked to improved insulin sensitivity.',
    citation:
      'Reynolds et al. 2020, PLoS Medicine (dietary fiber and HbA1c); Barbagallo and Dominguez 2015, World Journal of Diabetes (magnesium and insulin resistance)',
  },

  // ── B12 / folate direct ────────────────────────────────────────────
  {
    id: 'b12_below_range',
    labDisplayName: 'Vitamin B12',
    labMatchers: [
      { kind: 'regex', value: '(b[- ]?12|cobalamin)' },
    ],
    direction: 'below_range',
    nutrients: ['vitamin_b12'],
    advisory:
      'Low serum B12 is a direct intake signal, especially on plant-forward eating patterns where B12-fortified foods or supplementation are often needed.',
    citation:
      'NIH ODS Vitamin B12 Fact Sheet',
  },
  {
    id: 'folate_below_range',
    labDisplayName: 'Folate',
    labMatchers: [
      { kind: 'includes', value: 'folate' },
      { kind: 'includes', value: 'folic acid' },
    ],
    direction: 'below_range',
    nutrients: ['folate'],
    advisory:
      'Low folate often maps directly to intake. Leafy greens, legumes, and fortified grains are reliable food sources.',
    citation:
      'NIH ODS Folate Fact Sheet',
  },
] as const

/**
 * Count of registered mappings. Tests assert this to guard against
 * accidental deletion when editing the list.
 */
export const NUTRIENT_LAB_MAPPING_COUNT = NUTRIENT_LAB_MAPPINGS.length

/**
 * Normalize a test_name for matcher comparison. Kept small and
 * deterministic so tests can exercise the exact lowercase/strip rules.
 */
export function normalizeTestName(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Return true if a given lab test_name matches any of the mapping's
 * matchers.
 */
export function labNameMatches(
  testName: string | null | undefined,
  matchers: readonly LabMatcher[],
): boolean {
  const norm = normalizeTestName(testName)
  if (!norm) return false
  for (const m of matchers) {
    if (m.kind === 'exact' && norm === m.value.toLowerCase()) return true
    if (m.kind === 'includes' && norm.includes(m.value.toLowerCase())) return true
    if (m.kind === 'regex') {
      const re = new RegExp(m.value, 'i')
      if (re.test(norm)) return true
    }
  }
  return false
}

/**
 * Find all mappings whose labMatchers hit a given test_name. A single
 * test_name can produce multiple mappings (for example a lipid panel
 * may surface both total cholesterol and a separate LDL row).
 */
export function findMappingsForTestName(
  testName: string | null | undefined,
): NutrientLabMapping[] {
  return NUTRIENT_LAB_MAPPINGS.filter((m) => labNameMatches(testName, m.labMatchers))
}
