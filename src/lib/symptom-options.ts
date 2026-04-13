import type { SymptomCategory } from './types'

export const SYMPTOM_OPTIONS: Record<SymptomCategory, string[]> = {
  digestive: [
    'Bloating',
    'Constipation',
    'Diarrhea',
    'Nausea/Vomiting',
    'Painful Bowel Movements',
    'Rectal Bleeding',
  ],
  menstrual: [
    'Heavy Bleeding',
    'Infertility',
    'Irregular Periods',
    'Painful Intercourse',
    'Spotting',
  ],
  mental: [
    'Anxiety',
    'Brain Fog',
    'Depression',
    'Insomnia',
    'Mood Swings',
  ],
  physical: [
    'Acne',
    'Back Pain',
    'Dizziness',
    'Fatigue',
    'Hair Loss',
    'Headache',
    'Hot Flashes',
    'Leg Pain',
    'Migraine',
    'Weight Gain',
  ],
  urinary: [
    'Frequent Urination',
  ],
}

export const CATEGORY_LABELS: Record<SymptomCategory, string> = {
  digestive: 'Digestive',
  menstrual: 'Menstrual & Reproductive',
  mental: 'Mental & Cognitive',
  physical: 'Physical & Skin',
  urinary: 'Urinary',
}

export const CATEGORY_ORDER: SymptomCategory[] = [
  'digestive',
  'menstrual',
  'mental',
  'physical',
  'urinary',
]
