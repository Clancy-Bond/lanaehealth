// Medication categories matching Endolog exactly

export interface MedicationCategory {
  name: string
  medications: string[]
}

export const MEDICATION_CATEGORIES: MedicationCategory[] = [
  {
    name: 'Alternative',
    medications: ['Acupuncture', 'CBD Oil', 'Heat Therapy'],
  },
  {
    name: 'Antispasmodic',
    medications: ['Buscopan', 'Dicyclomine'],
  },
  {
    name: 'Hormonal',
    medications: [
      'Aromatase Inhibitor',
      'Birth Control Pill',
      'Desogestrel',
      'Dienogest',
      'Drospirenone',
      'GnRH Agonist',
      'Hormonal IUD',
      'HRT',
      'Levonorgestrel',
      'Norethisterone',
      'Progestin',
      'Visanne',
    ],
  },
  {
    name: 'Other',
    medications: ['Anti-Inflammatory', 'Antidepressant', 'Muscle Relaxant'],
  },
  {
    name: 'Over the Counter',
    medications: ['Aspirin', 'Ibuprofen', 'Mefenamic Acid', 'Naproxen', 'Paracetamol'],
  },
  {
    name: 'PCOS Specific',
    medications: ['Clomiphene', 'Letrozole', 'Metformin', 'Spironolactone'],
  },
  {
    name: 'Prescription',
    medications: ['Codeine', 'Tramadol'],
  },
]

export const ALL_MEDICATIONS: string[] = MEDICATION_CATEGORIES.flatMap((c) => c.medications)
