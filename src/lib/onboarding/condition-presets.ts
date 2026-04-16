/**
 * Condition Presets for Onboarding
 *
 * Maps chronic conditions to recommended log sections and custom trackables.
 * Section IDs correspond to the sections rendered in LogCarousel.
 */

export interface ConditionPreset {
  id: string
  name: string
  icon: string // emoji
  description: string
  recommended_sections: string[] // matches section IDs in LogCarousel
  custom_trackables: Array<{
    name: string
    category: 'symptom' | 'factor' | 'activity' | 'supplement' | 'other'
    input_type: 'toggle' | 'scale_5' | 'scale_10' | 'number' | 'text'
    icon: string
  }>
}

export const CONDITION_PRESETS: ConditionPreset[] = [
  {
    id: 'endometriosis',
    name: 'Endometriosis',
    icon: '\u{1F33A}',
    description: 'Track pain patterns, bloating, cycle, and food triggers',
    recommended_sections: [
      'pain',
      'bloating',
      'cycle',
      'bowel',
      'food',
      'fatigue',
      'mood',
    ],
    custom_trackables: [],
  },
  {
    id: 'pots',
    name: 'POTS / Dysautonomia',
    icon: '\u{1F493}',
    description: 'Monitor heart rate, dizziness, hydration, and standing tolerance',
    recommended_sections: ['fatigue'],
    custom_trackables: [
      {
        name: 'Heart Rate',
        category: 'symptom',
        input_type: 'number',
        icon: '\u{1F493}',
      },
      {
        name: 'Dizziness',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{1F4AB}',
      },
      {
        name: 'Salt Intake',
        category: 'factor',
        input_type: 'scale_5',
        icon: '\u{1F9C2}',
      },
      {
        name: 'Water Intake',
        category: 'factor',
        input_type: 'number',
        icon: '\u{1F4A7}',
      },
      {
        name: 'Standing Tolerance',
        category: 'symptom',
        input_type: 'scale_10',
        icon: '\u{1F9CD}',
      },
    ],
  },
  {
    id: 'eds',
    name: 'EDS / Hypermobility',
    icon: '\u{1F9B4}',
    description: 'Track joint pain, subluxations, fatigue, and pain patterns',
    recommended_sections: ['fatigue', 'pain'],
    custom_trackables: [
      {
        name: 'Joint Pain',
        category: 'symptom',
        input_type: 'scale_10',
        icon: '\u{1F9B4}',
      },
      {
        name: 'Subluxations',
        category: 'symptom',
        input_type: 'number',
        icon: '\u{26A0}\uFE0F',
      },
    ],
  },
  {
    id: 'fibromyalgia',
    name: 'Fibromyalgia',
    icon: '\u{1F49C}',
    description: 'Pain mapping, fatigue, sleep quality, and brain fog tracking',
    recommended_sections: ['pain', 'fatigue', 'sleep'],
    custom_trackables: [
      {
        name: 'Brain Fog',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{1F32B}\uFE0F',
      },
      {
        name: 'Weather Sensitivity',
        category: 'factor',
        input_type: 'scale_5',
        icon: '\u{26C5}',
      },
    ],
  },
  {
    id: 'ibs',
    name: 'IBS',
    icon: '\u{1F4A8}',
    description: 'Bowel patterns, bloating, food triggers, and stress levels',
    recommended_sections: ['bowel', 'bloating', 'food', 'stress'],
    custom_trackables: [],
  },
  {
    id: 'pcos',
    name: 'PCOS',
    icon: '\u{1F33C}',
    description: 'Cycle regularity, mood patterns, acne, and hair changes',
    recommended_sections: ['cycle', 'mood'],
    custom_trackables: [
      {
        name: 'Acne',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{1FA79}',
      },
      {
        name: 'Hair Loss',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{1F4C9}',
      },
    ],
  },
  {
    id: 'me_cfs',
    name: 'Chronic Fatigue (ME/CFS)',
    icon: '\u{1F50B}',
    description: 'Energy envelope, post-exertional malaise, and activity pacing',
    recommended_sections: ['sleep', 'fatigue'],
    custom_trackables: [
      {
        name: 'Energy Envelope',
        category: 'factor',
        input_type: 'scale_10',
        icon: '\u{1F50B}',
      },
      {
        name: 'PEM (Post-Exertional Malaise)',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{26A1}',
      },
      {
        name: 'Activity Pacing',
        category: 'activity',
        input_type: 'scale_5',
        icon: '\u{23F3}',
      },
    ],
  },
  {
    id: 'migraine',
    name: 'Migraine',
    icon: '\u{1FA78}',
    description: 'Pain intensity, aura, light sensitivity, and nausea tracking',
    recommended_sections: ['pain'],
    custom_trackables: [
      {
        name: 'Aura',
        category: 'symptom',
        input_type: 'toggle',
        icon: '\u{2728}',
      },
      {
        name: 'Light Sensitivity',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{2600}\uFE0F',
      },
      {
        name: 'Nausea',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{1F922}',
      },
    ],
  },
  {
    id: 'anxiety_depression',
    name: 'Anxiety / Depression',
    icon: '\u{1F49A}',
    description: 'Mood tracking, worry levels, sleep patterns, and gratitude',
    recommended_sections: ['mood', 'sleep', 'gratitude'],
    custom_trackables: [
      {
        name: 'Worry Level',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{1F630}',
      },
      {
        name: 'Avoidance Behaviors',
        category: 'symptom',
        input_type: 'scale_5',
        icon: '\u{1F6AB}',
      },
    ],
  },
  {
    id: 'general_wellness',
    name: 'General Wellness',
    icon: '\u{1F331}',
    description: 'Balanced tracking for mood, sleep, food, and exercise',
    recommended_sections: ['mood', 'sleep', 'food'],
    custom_trackables: [
      {
        name: 'Water Intake',
        category: 'factor',
        input_type: 'number',
        icon: '\u{1F4A7}',
      },
      {
        name: 'Exercise',
        category: 'activity',
        input_type: 'scale_5',
        icon: '\u{1F3C3}',
      },
    ],
  },
]

/**
 * Onboarding goal options
 */
export interface OnboardingGoal {
  id: string
  label: string
  icon: string
}

export const ONBOARDING_GOALS: OnboardingGoal[] = [
  { id: 'pain_management', label: 'Pain management', icon: '\u{1F3AF}' },
  { id: 'period_tracking', label: 'Period tracking', icon: '\u{1F319}' },
  { id: 'food_triggers', label: 'Food trigger discovery', icon: '\u{1F50D}' },
  { id: 'sleep_optimization', label: 'Sleep optimization', icon: '\u{1F634}' },
  { id: 'medication_tracking', label: 'Medication tracking', icon: '\u{1F48A}' },
  { id: 'doctor_prep', label: 'Doctor visit prep', icon: '\u{1FA7A}' },
  { id: 'mental_health', label: 'Mental health tracking', icon: '\u{1F9E0}' },
]
