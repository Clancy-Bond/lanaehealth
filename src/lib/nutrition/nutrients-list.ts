/**
 * Nutrients List - canonical registry of the 25 priority nutrients.
 *
 * Every nutrient tracked in LanaeHealth has:
 *   - a stable `key` used for database writes and preset lookups
 *   - a human `displayName` for UI
 *   - a `unit` of measure (g, mg, mcg, IU, kcal)
 *   - an adult-female RDA default from NIH ODS
 *   - preset overrides that later waves can apply (endo, pots, thyroid,
 *     iron-deficiency). These are PREPPED ONLY. The endo preset surfaces
 *     via Wave 1C's `diet-presets.ts` to avoid duplication. Other presets
 *     are reserved placeholders for Wave 2b.
 *
 * RDA citations: https://ods.od.nih.gov/factsheets/list-all/ fact sheets
 * for adult females 19-30 years unless noted otherwise.
 *
 * Ref: docs/competitive/cronometer/implementation-notes.md Feature 1.
 */

export type NutrientUnit = 'g' | 'mg' | 'mcg' | 'IU' | 'kcal'

export type PresetKey =
  | 'endo'
  | 'pots'
  | 'thyroid'
  | 'iron_deficiency'

export interface NutrientPresetOverride {
  /** Target amount override in the nutrient's own unit. */
  amount: number
  /** One sentence clinical rationale shown in UI. */
  rationale: string
  /** Source citation for the override value. */
  citation: string
}

export interface NutrientDefinition {
  /** Canonical key used for DB writes and lookups. */
  key: string
  /** Display label for UI. */
  displayName: string
  /** Unit of measure. */
  unit: NutrientUnit
  /** NIH ODS default RDA for adult female 19-30. */
  rdaDefault: number
  /** Short citation for the RDA default. */
  rdaCitation: string
  /** Whether to surface in the default Log-page rollup card. */
  priority: boolean
  /** Preset overrides. Only keys present here are intended for that preset. */
  presetOverrides?: Partial<Record<PresetKey, NutrientPresetOverride>>
}

/**
 * The 25 priority nutrients. Order matters for UI display: macros first,
 * then high-impact micros, then secondary micros.
 *
 * Do NOT mutate this array at runtime. Treat as readonly.
 */
export const NUTRIENTS: readonly NutrientDefinition[] = [
  // ── Macros ──────────────────────────────────────────────────────────
  {
    key: 'protein',
    displayName: 'Protein',
    unit: 'g',
    rdaDefault: 46,
    rdaCitation: 'NIH ODS DRI, adult female 19-30',
    priority: true,
  },
  {
    key: 'carbs',
    displayName: 'Carbs',
    unit: 'g',
    rdaDefault: 130,
    rdaCitation: 'IOM 2005 DRI, adult minimum',
    priority: true,
  },
  {
    key: 'fat',
    displayName: 'Fat',
    unit: 'g',
    rdaDefault: 65,
    rdaCitation: 'USDA 2020-2025 Dietary Guidelines, 20-35% of 2000 kcal',
    priority: true,
  },
  {
    key: 'fiber',
    displayName: 'Fiber',
    unit: 'g',
    rdaDefault: 25,
    rdaCitation: 'USDA 2020-2025 Dietary Guidelines, adult female',
    priority: true,
    presetOverrides: {
      endo: {
        amount: 35,
        rationale:
          'Elevated to 35 g to support estrogen clearance and gut microbiome diversity in endometriosis.',
        citation: 'USDA 2020-2025 Dietary Guidelines for Americans',
      },
    },
  },

  // ── High-impact micros (endo / POTS / iron-deficiency focus) ────────
  {
    key: 'iron',
    displayName: 'Iron',
    unit: 'mg',
    rdaDefault: 18,
    rdaCitation: 'NIH ODS Iron RDA, adult female 19-50',
    priority: true,
    presetOverrides: {
      endo: {
        amount: 27,
        rationale:
          'Elevated from the 18 mg baseline RDA to 27 mg to offset heavy menstrual blood loss common in endometriosis.',
        citation: 'ACOG Clinical Guidance on Iron Supplementation',
      },
      iron_deficiency: {
        amount: 60,
        rationale:
          'Iron repletion dosing for iron-deficiency anemia, per hematology guidance.',
        citation: 'Short and Domagalski 2013, American Family Physician',
      },
    },
  },
  {
    key: 'vitamin_d',
    displayName: 'Vitamin D',
    unit: 'IU',
    rdaDefault: 600,
    rdaCitation: 'NIH ODS Vitamin D RDA, adult 19-70',
    priority: true,
    presetOverrides: {
      endo: {
        amount: 2000,
        rationale:
          'Target raised to 2000 IU because endometriosis patients frequently test below 30 ng/mL on 25-OH-D.',
        citation: 'Endocrine Society 2011 Clinical Practice Guidelines for Vitamin D',
      },
      thyroid: {
        amount: 2000,
        rationale:
          'Low vitamin D correlates with autoimmune thyroid disease; target 2000 IU maintenance.',
        citation: 'Kim 2017, Journal of Thyroid Research',
      },
    },
  },
  {
    key: 'vitamin_b12',
    displayName: 'Vitamin B12',
    unit: 'mcg',
    rdaDefault: 2.4,
    rdaCitation: 'NIH ODS B12 RDA, adult',
    priority: true,
  },
  {
    key: 'folate',
    displayName: 'Folate',
    unit: 'mcg',
    rdaDefault: 400,
    rdaCitation: 'NIH ODS Folate RDA, adult',
    priority: true,
  },
  {
    key: 'calcium',
    displayName: 'Calcium',
    unit: 'mg',
    rdaDefault: 1000,
    rdaCitation: 'NIH ODS Calcium RDA, adult female 19-50',
    priority: true,
  },
  {
    key: 'magnesium',
    displayName: 'Magnesium',
    unit: 'mg',
    rdaDefault: 310,
    rdaCitation: 'NIH ODS Magnesium RDA, adult female 19-30',
    priority: true,
    presetOverrides: {
      endo: {
        amount: 400,
        rationale:
          'Elevated to 400 mg to support menstrual cramping relief and lipid metabolism.',
        citation: 'Mauskop and Varughese 2012, Journal of Neural Transmission',
      },
      pots: {
        amount: 400,
        rationale:
          'Elevated magnesium may support vascular tone in POTS; target 400 mg.',
        citation: 'Shibao et al. 2018, Autonomic Neuroscience',
      },
    },
  },
  {
    key: 'selenium',
    displayName: 'Selenium',
    unit: 'mcg',
    rdaDefault: 55,
    rdaCitation: 'NIH ODS Selenium RDA, adult',
    priority: true,
    presetOverrides: {
      endo: {
        amount: 200,
        rationale:
          'Selenium at 200 mcg was associated with reduced endometriotic lesion activity and thyroid support.',
        citation: 'Mier-Cabrera et al. 2009, Human Reproduction',
      },
      thyroid: {
        amount: 200,
        rationale:
          'Selenium supplementation at 200 mcg reduced TPO antibodies in Hashimotos cohorts.',
        citation: 'Gartner et al. 2002, Journal of Clinical Endocrinology',
      },
    },
  },
  {
    key: 'zinc',
    displayName: 'Zinc',
    unit: 'mg',
    rdaDefault: 8,
    rdaCitation: 'NIH ODS Zinc RDA, adult female',
    priority: true,
  },
  {
    key: 'vitamin_c',
    displayName: 'Vitamin C',
    unit: 'mg',
    rdaDefault: 75,
    rdaCitation: 'NIH ODS Vitamin C RDA, adult female',
    priority: true,
    presetOverrides: {
      iron_deficiency: {
        amount: 120,
        rationale:
          'Elevated vitamin C pairing enhances non-heme iron absorption during repletion.',
        citation: 'Hallberg et al. 1989, American Journal of Clinical Nutrition',
      },
    },
  },

  // ── Secondary micros ────────────────────────────────────────────────
  {
    key: 'vitamin_a',
    displayName: 'Vitamin A',
    unit: 'mcg',
    rdaDefault: 700,
    rdaCitation: 'NIH ODS Vitamin A RDA (RAE), adult female',
    priority: false,
  },
  {
    key: 'vitamin_e',
    displayName: 'Vitamin E',
    unit: 'mg',
    rdaDefault: 15,
    rdaCitation: 'NIH ODS Vitamin E RDA, adult',
    priority: false,
  },
  {
    key: 'vitamin_k',
    displayName: 'Vitamin K',
    unit: 'mcg',
    rdaDefault: 90,
    rdaCitation: 'NIH ODS Vitamin K AI, adult female',
    priority: false,
  },
  {
    key: 'omega_3',
    displayName: 'Omega-3 (EPA + DHA)',
    unit: 'g',
    rdaDefault: 1.1,
    rdaCitation: 'NIH ODS Omega-3 AI (ALA), adult female',
    priority: true,
    presetOverrides: {
      endo: {
        amount: 2,
        rationale:
          'Higher omega-3 intake correlated with reduced endometriosis incidence via anti-inflammatory pathways.',
        citation: 'Missmer et al. 2010, Human Reproduction',
      },
    },
  },
  {
    key: 'potassium',
    displayName: 'Potassium',
    unit: 'mg',
    rdaDefault: 2600,
    rdaCitation: 'NIH ODS Potassium AI, adult female',
    priority: true,
    presetOverrides: {
      pots: {
        amount: 3500,
        rationale:
          'Elevated potassium supports plasma volume expansion alongside sodium in POTS.',
        citation: 'Raj 2013, Indian Pacing and Electrophysiology Journal',
      },
    },
  },
  {
    key: 'sodium',
    displayName: 'Sodium',
    unit: 'mg',
    rdaDefault: 1500,
    rdaCitation: 'NIH ODS Sodium AI, adult',
    priority: true,
    presetOverrides: {
      pots: {
        amount: 8000,
        rationale:
          'High sodium (8-10 g/day) is a cornerstone non-pharmacologic treatment in POTS to expand plasma volume.',
        citation: 'Raj 2013, Indian Pacing and Electrophysiology Journal',
      },
    },
  },
  {
    key: 'copper',
    displayName: 'Copper',
    unit: 'mcg',
    rdaDefault: 900,
    rdaCitation: 'NIH ODS Copper RDA, adult',
    priority: false,
  },
  {
    key: 'manganese',
    displayName: 'Manganese',
    unit: 'mg',
    rdaDefault: 1.8,
    rdaCitation: 'NIH ODS Manganese AI, adult female',
    priority: false,
  },
  {
    key: 'iodine',
    displayName: 'Iodine',
    unit: 'mcg',
    rdaDefault: 150,
    rdaCitation: 'NIH ODS Iodine RDA, adult',
    priority: false,
    presetOverrides: {
      thyroid: {
        amount: 150,
        rationale:
          'Adequate iodine intake supports thyroid hormone synthesis; do not exceed UL of 1100 mcg.',
        citation: 'NIH ODS Iodine fact sheet',
      },
    },
  },
  {
    key: 'choline',
    displayName: 'Choline',
    unit: 'mg',
    rdaDefault: 425,
    rdaCitation: 'NIH ODS Choline AI, adult female',
    priority: false,
  },
  {
    key: 'chromium',
    displayName: 'Chromium',
    unit: 'mcg',
    rdaDefault: 25,
    rdaCitation: 'NIH ODS Chromium AI, adult female 19-50',
    priority: false,
  },
  {
    key: 'molybdenum',
    displayName: 'Molybdenum',
    unit: 'mcg',
    rdaDefault: 45,
    rdaCitation: 'NIH ODS Molybdenum RDA, adult',
    priority: false,
  },
] as const

/**
 * Lookup a nutrient definition by key. Returns null when unknown.
 */
export function findNutrient(key: string): NutrientDefinition | null {
  return NUTRIENTS.find((n) => n.key === key) ?? null
}

/**
 * Return only the nutrients marked `priority`, in declaration order.
 */
export function getPriorityNutrients(): NutrientDefinition[] {
  return NUTRIENTS.filter((n) => n.priority)
}

/**
 * Return the preset override for a nutrient, if one exists.
 * Endo preset values here match `ENDO_ANTI_INFLAMMATORY_PRESET` in
 * `src/lib/nutrition/diet-presets.ts` (Wave 1C). Source of truth for
 * endo stays with diet-presets.ts; this list integrates with it.
 */
export function getPresetOverride(
  nutrientKey: string,
  preset: PresetKey,
): NutrientPresetOverride | null {
  const def = findNutrient(nutrientKey)
  return def?.presetOverrides?.[preset] ?? null
}

/**
 * Total number of tracked nutrients. Exported so callers can assert
 * against the canonical count without importing the full array.
 */
export const NUTRIENT_COUNT = NUTRIENTS.length
