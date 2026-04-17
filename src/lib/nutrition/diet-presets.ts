/**
 * Diet Presets - bundled micronutrient target sets with clinical citations.
 *
 * Each preset is a static bundle of nutrient targets that a clinician or
 * patient can apply to override the default RDAs used across the app. The
 * endo anti-inflammatory preset is the first of these, purpose-built for
 * patients with endometriosis, heavy menstrual bleeding, and the
 * inflammatory load that commonly accompanies both.
 *
 * Copy rule: all surfaces read "target" or "suggested intake" and cite a
 * source. Never frame a preset as a prescription or diagnostic protocol.
 *
 * Source: docs/competitive/cronometer/implementation-notes.md Feature 2.
 */

export interface NutrientTarget {
  /** Canonical nutrient key matching user_nutrient_targets.nutrient_key. */
  nutrient: string
  /** Human readable display name for the nutrient. */
  displayName: string
  /** Numeric target amount. */
  amount: number
  /** Unit of measure: mg, mcg, g, IU, kcal, mL. */
  unit: string
  /** One sentence clinical rationale for this target value. */
  rationale: string
  /** Citation string. Author(s), year, journal or guideline body. */
  citation: string
  /**
   * Conflict resolution policy when multiple presets set the same nutrient.
   * Optional: defaults to 'intake' when omitted.
   */
  policy?: 'intake' | 'threshold'
}

export interface DietPreset {
  /** Stable key used for lookup and database writes. */
  key: string
  /** Display name shown in the UI picker. */
  displayName: string
  /** Short description for the UI card body. */
  description: string
  /** Ordered list of per-nutrient targets in this preset. */
  targets: NutrientTarget[]
}

/**
 * Intake style vs threshold style nutrients.
 *
 * - intake: a daily amount to *reach* (sodium, fluids, iron, fiber, omega-3).
 *   When two presets both set an intake-style value, the composer uses the
 *   MAX so a patient on both endo and POTS still hits the higher POTS sodium
 *   floor.
 * - threshold: an upper cap or ceiling (cholesterol, added sugar, saturated
 *   fat). When two presets both set a threshold value, the composer uses
 *   LAST-WINS so the most recently applied preset sets the cap.
 *
 * The default policy is 'intake' because almost every nutrient in the
 * registry is an intake-style target.
 */
export type PresetPolicy = 'intake' | 'threshold'

/**
 * Endometriosis / anti-inflammatory preset.
 *
 * Elevated iron, vitamin D, selenium, omega-3, and fiber targets, each with a
 * direct clinical citation. Designed for patients with heavy menstrual blood
 * loss, low 25-OH-D trend, borderline TSH, and elevated cholesterol.
 */
export const ENDO_ANTI_INFLAMMATORY_PRESET: DietPreset = {
  key: 'endo_anti_inflammatory',
  displayName: 'Endometriosis / Anti-Inflammatory Protocol',
  description:
    'Elevated iron, vitamin D, selenium, omega-3, and fiber targets for endometriosis with heavy bleeding. Anti-inflammatory emphasis.',
  targets: [
    {
      nutrient: 'iron',
      displayName: 'Iron',
      amount: 27,
      unit: 'mg',
      rationale:
        'Elevated from the 18 mg baseline RDA to 27 mg to offset heavy menstrual blood loss common in endometriosis.',
      citation: 'ACOG Clinical Guidance on Iron Supplementation',
    },
    {
      nutrient: 'vitamin_d',
      displayName: 'Vitamin D',
      amount: 2000,
      unit: 'IU',
      rationale:
        'Target raised to 2000 IU because endometriosis patients frequently test below 30 ng/mL on 25-OH-D.',
      citation: 'Endocrine Society 2011 Clinical Practice Guidelines for Vitamin D',
    },
    {
      nutrient: 'selenium',
      displayName: 'Selenium',
      amount: 200,
      unit: 'mcg',
      rationale:
        'Selenium at 200 mcg was associated with reduced endometriotic lesion activity and thyroid support.',
      citation: 'Mier-Cabrera et al. 2009, Human Reproduction',
    },
    {
      nutrient: 'omega_3',
      displayName: 'Omega-3 (EPA + DHA)',
      amount: 2,
      unit: 'g',
      rationale:
        'Higher omega-3 intake correlated with reduced endometriosis incidence via anti-inflammatory pathways.',
      citation: 'Missmer et al. 2010, Human Reproduction',
    },
    {
      nutrient: 'fiber',
      displayName: 'Fiber',
      amount: 35,
      unit: 'g',
      rationale:
        'Elevated to 35 g to support estrogen clearance and gut microbiome diversity relevant in endometriosis.',
      citation: 'USDA 2020-2025 Dietary Guidelines for Americans',
    },
  ],
}

/**
 * POTS (Postural Orthostatic Tachycardia Syndrome) preset.
 *
 * Non-pharmacologic first-line therapy for POTS centers on plasma volume
 * expansion. Vanderbilt's Autonomic Dysfunction Center protocol recommends
 * 3 L/day fluid intake paired with 5000 mg/day sodium. Potassium 4700 mg
 * follows the American Heart Association adequate intake for adults and
 * supports the sodium-potassium balance during plasma expansion.
 *
 * Lanae's clinical profile makes this preset directly applicable: standing
 * pulse 106 bpm at her April 13 2026 PCP visit, a +58 bpm jump from her
 * 48 bpm resting heart rate, consistent with orthostatic intolerance.
 *
 * Note: the 'fluids' entry uses mL as its unit because the app's hydration
 * tracking (HydrationRow, HKQuantityTypeIdentifierDietaryWater) is mL-based.
 * Fluids is tracked as a separate intake stream and is not a member of the
 * 25-nutrient registry used for user_nutrient_targets. The preset still
 * carries it so UI surfaces can show the full POTS protocol in one place.
 */
export const POTS_PRESET: DietPreset = {
  key: 'pots',
  displayName: 'POTS Protocol',
  description:
    'High sodium and fluid intake plus potassium balance for plasma volume expansion in postural orthostatic tachycardia syndrome.',
  targets: [
    {
      nutrient: 'sodium',
      displayName: 'Sodium',
      amount: 5000,
      unit: 'mg',
      rationale:
        'Elevated sodium intake expands plasma volume and reduces orthostatic tachycardia. Vanderbilt protocol targets 5000 mg per day as a starting point, with titration up to 10000 mg per day under physician guidance.',
      citation: 'Vanderbilt Autonomic Dysfunction Center POTS Patient Guide',
      policy: 'intake',
    },
    {
      nutrient: 'fluids',
      displayName: 'Fluids',
      amount: 3000,
      unit: 'mL',
      rationale:
        'Fluid intake of 3 L per day supports the sodium-driven plasma volume expansion that reduces standing tachycardia in POTS.',
      citation: 'Vanderbilt Autonomic Dysfunction Center POTS Patient Guide',
      policy: 'intake',
    },
    {
      nutrient: 'potassium',
      displayName: 'Potassium',
      amount: 4700,
      unit: 'mg',
      rationale:
        'Potassium at the AHA adequate-intake level supports the sodium-potassium balance while the POTS patient expands plasma volume, and offsets potassium loss from high sodium intake.',
      citation: 'American Heart Association Potassium Adequate Intake, adult',
      policy: 'intake',
    },
  ],
}

/**
 * Registry of available presets, keyed for lookup by `applyPreset`.
 */
const PRESETS: Record<string, DietPreset> = {
  [ENDO_ANTI_INFLAMMATORY_PRESET.key]: ENDO_ANTI_INFLAMMATORY_PRESET,
  [POTS_PRESET.key]: POTS_PRESET,
}

/**
 * Return the full preset bundle for a given preset key. Throws a descriptive
 * error if the key is not registered. Consumers can wrap this for UI display.
 */
export function applyPreset(presetName: string): DietPreset {
  const preset = PRESETS[presetName]
  if (!preset) {
    throw new Error(`Unknown diet preset: ${presetName}`)
  }
  return preset
}

/**
 * List all registered preset keys. Useful for UI pickers.
 */
export function listPresetKeys(): string[] {
  return Object.keys(PRESETS)
}
