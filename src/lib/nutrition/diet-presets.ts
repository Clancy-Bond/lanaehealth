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
  /** Unit of measure: mg, mcg, g, IU, kcal. */
  unit: string
  /** One sentence clinical rationale for this target value. */
  rationale: string
  /** Citation string. Author(s), year, journal or guideline body. */
  citation: string
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
 * Registry of available presets, keyed for lookup by `applyPreset`.
 */
const PRESETS: Record<string, DietPreset> = {
  [ENDO_ANTI_INFLAMMATORY_PRESET.key]: ENDO_ANTI_INFLAMMATORY_PRESET,
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
