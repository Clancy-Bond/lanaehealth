/**
 * Conditions catalog for onboarding step 3.
 *
 * 50+ common conditions grouped by system. Used by the searchable
 * multi-select on /v2/onboarding/3. Adding a new condition is a
 * one-line append; no migration. Free-text "Other" entries land in
 * the same active_problems table with category='other'.
 *
 * Voice rule: condition labels are clinical names, not euphemisms.
 * "Endometriosis" not "painful periods". Patients searching for
 * what they were told in clinic should find a match.
 */

export interface ConditionOption {
  /** Stored slug, kept stable so analytics can track adoption. */
  slug: string
  /** Display label shown in the picker. */
  label: string
  /** Category lets us group the picker visually. */
  category:
    | 'cardiovascular'
    | 'endocrine'
    | 'neurological'
    | 'gi'
    | 'reproductive'
    | 'connective_tissue'
    | 'autoimmune'
    | 'psychiatric'
    | 'pain'
    | 'metabolic'
    | 'sleep'
    | 'other'
}

export const CONDITIONS_CATALOG: ConditionOption[] = [
  // Cardiovascular / autonomic
  { slug: 'pots', label: 'POTS', category: 'cardiovascular' },
  { slug: 'orthostatic_hypotension', label: 'Orthostatic hypotension', category: 'cardiovascular' },
  { slug: 'dysautonomia', label: 'Dysautonomia', category: 'cardiovascular' },
  { slug: 'hypertension', label: 'Hypertension', category: 'cardiovascular' },
  { slug: 'mvp', label: 'Mitral valve prolapse', category: 'cardiovascular' },

  // Connective tissue
  { slug: 'eds_hypermobile', label: 'Ehlers-Danlos (hypermobile)', category: 'connective_tissue' },
  { slug: 'eds_classical', label: 'Ehlers-Danlos (classical)', category: 'connective_tissue' },
  { slug: 'hsd', label: 'Hypermobility spectrum disorder', category: 'connective_tissue' },
  { slug: 'marfan', label: 'Marfan syndrome', category: 'connective_tissue' },

  // Mast cell / allergic
  { slug: 'mcas', label: 'MCAS (mast cell activation)', category: 'autoimmune' },
  { slug: 'allergies_seasonal', label: 'Seasonal allergies', category: 'autoimmune' },
  { slug: 'food_allergies', label: 'Food allergies', category: 'autoimmune' },

  // Autoimmune / inflammatory
  { slug: 'hashimotos', label: "Hashimoto's thyroiditis", category: 'autoimmune' },
  { slug: 'graves', label: "Graves' disease", category: 'autoimmune' },
  { slug: 'lupus', label: 'Lupus', category: 'autoimmune' },
  { slug: 'rheumatoid_arthritis', label: 'Rheumatoid arthritis', category: 'autoimmune' },
  { slug: 'celiac', label: 'Celiac disease', category: 'autoimmune' },
  { slug: 'crohns', label: "Crohn's disease", category: 'gi' },
  { slug: 'ulcerative_colitis', label: 'Ulcerative colitis', category: 'gi' },
  { slug: 'sjogrens', label: "Sjögren's syndrome", category: 'autoimmune' },

  // Endocrine / metabolic
  { slug: 'hypothyroid', label: 'Hypothyroid', category: 'endocrine' },
  { slug: 'hyperthyroid', label: 'Hyperthyroid', category: 'endocrine' },
  { slug: 'pcos', label: 'PCOS', category: 'reproductive' },
  { slug: 'diabetes_type1', label: 'Type 1 diabetes', category: 'endocrine' },
  { slug: 'diabetes_type2', label: 'Type 2 diabetes', category: 'endocrine' },
  { slug: 'prediabetes', label: 'Prediabetes', category: 'endocrine' },
  { slug: 'insulin_resistance', label: 'Insulin resistance', category: 'metabolic' },
  { slug: 'adrenal_insufficiency', label: 'Adrenal insufficiency', category: 'endocrine' },

  // Neurological / pain
  { slug: 'migraine', label: 'Migraine', category: 'neurological' },
  { slug: 'tension_headache', label: 'Tension headache', category: 'neurological' },
  { slug: 'cluster_headache', label: 'Cluster headache', category: 'neurological' },
  { slug: 'fibromyalgia', label: 'Fibromyalgia', category: 'pain' },
  { slug: 'cfs_me', label: 'ME/CFS', category: 'pain' },
  { slug: 'long_covid', label: 'Long COVID', category: 'pain' },
  { slug: 'epilepsy', label: 'Epilepsy', category: 'neurological' },
  { slug: 'multiple_sclerosis', label: 'Multiple sclerosis', category: 'neurological' },
  { slug: 'concussion_post', label: 'Post-concussion syndrome', category: 'neurological' },

  // GI
  { slug: 'ibs', label: 'IBS', category: 'gi' },
  { slug: 'gerd', label: 'GERD / acid reflux', category: 'gi' },
  { slug: 'gastroparesis', label: 'Gastroparesis', category: 'gi' },
  { slug: 'sibo', label: 'SIBO', category: 'gi' },

  // Reproductive
  { slug: 'endometriosis', label: 'Endometriosis', category: 'reproductive' },
  { slug: 'adenomyosis', label: 'Adenomyosis', category: 'reproductive' },
  { slug: 'pmdd', label: 'PMDD', category: 'reproductive' },
  { slug: 'fibroids', label: 'Uterine fibroids', category: 'reproductive' },

  // Psychiatric
  { slug: 'anxiety', label: 'Anxiety', category: 'psychiatric' },
  { slug: 'depression', label: 'Depression', category: 'psychiatric' },
  { slug: 'adhd', label: 'ADHD', category: 'psychiatric' },
  { slug: 'autism', label: 'Autism spectrum', category: 'psychiatric' },
  { slug: 'ocd', label: 'OCD', category: 'psychiatric' },
  { slug: 'ptsd', label: 'PTSD', category: 'psychiatric' },
  { slug: 'bipolar', label: 'Bipolar disorder', category: 'psychiatric' },

  // Sleep
  { slug: 'sleep_apnea', label: 'Sleep apnea', category: 'sleep' },
  { slug: 'insomnia', label: 'Insomnia', category: 'sleep' },
  { slug: 'narcolepsy', label: 'Narcolepsy', category: 'sleep' },
  { slug: 'restless_legs', label: 'Restless legs', category: 'sleep' },

  // Metabolic / weight
  { slug: 'obesity', label: 'Obesity', category: 'metabolic' },
  { slug: 'metabolic_syndrome', label: 'Metabolic syndrome', category: 'metabolic' },
]

export const CATEGORY_LABELS: Record<ConditionOption['category'], string> = {
  cardiovascular: 'Cardiovascular',
  endocrine: 'Endocrine',
  neurological: 'Neurological',
  gi: 'GI',
  reproductive: 'Reproductive',
  connective_tissue: 'Connective tissue',
  autoimmune: 'Autoimmune / inflammatory',
  psychiatric: 'Mental health',
  pain: 'Pain / fatigue',
  metabolic: 'Metabolic',
  sleep: 'Sleep',
  other: 'Other',
}

/**
 * Filter the catalog by free-text query. Case-insensitive substring
 * match against the label. Empty query returns the full catalog.
 */
export function searchConditions(query: string): ConditionOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return CONDITIONS_CATALOG
  return CONDITIONS_CATALOG.filter((c) => c.label.toLowerCase().includes(q))
}
