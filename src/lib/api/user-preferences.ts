/**
 * User Preferences API
 *
 * Manages the modular feature system: which modules are enabled,
 * user archetype, conditions, connected apps, section ordering.
 *
 * Four archetypes:
 * - aggregator: data hub only, keeps existing apps
 * - power_tracker: uses everything natively
 * - condition_manager: condition-specific preset
 * - health_curious: guided, progressive disclosure
 */

import { createServiceClient } from '@/lib/supabase'

export type UserArchetype = 'aggregator' | 'power_tracker' | 'condition_manager' | 'health_curious'

export type FeatureModule =
  | 'symptoms'
  | 'nutrition'
  | 'cycle'
  | 'mood'
  | 'sleep'
  | 'fitness'
  | 'medications'
  | 'labs'
  | 'vitals'
  | 'gratitude'
  | 'clinical_scales'
  | 'weather'

export interface UserPreferences {
  id: string
  userArchetype: UserArchetype | null
  enabledModules: FeatureModule[]
  conditions: string[]
  connectedApps: string[]
  logSectionOrder: string[]
  hiddenSections: string[]
  /** Ordered list of home widget ids. Widgets not listed fall through to defaults. */
  homeWidgetOrder: string[]
  /** Home widget ids the user has hidden. */
  hiddenHomeWidgets: string[]
  onboardingCompletedAt: string | null
}

// ── Module Definitions ─────────────────────────────────────────────

export interface ModuleDefinition {
  id: FeatureModule
  name: string
  description: string
  icon: string
  supportsNative: boolean        // Has native tracking UI
  supportsImport: boolean        // Can import from other apps
  importSources: string[]        // Apps that can import into this module
  defaultEnabled: boolean        // Enabled by default for new users
  logCard: string | null         // Component name for the log carousel
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: 'symptoms',
    name: 'Symptom Tracking',
    description: 'Track pain, digestive issues, fatigue, and 30+ symptoms',
    icon: '\u{1F915}',
    supportsNative: true,
    supportsImport: true,
    importSources: ['Bearable', 'Flaredown', 'CareClinic'],
    defaultEnabled: true,
    logCard: 'SymptomPills',
  },
  {
    id: 'nutrition',
    name: 'Calorie & Nutrition',
    description: 'Track meals, macros, micronutrients, and food triggers',
    icon: '\u{1F34E}',
    supportsNative: true,
    supportsImport: true,
    importSources: ['MyNetDiary', 'MyFitnessPal', 'Cronometer', 'MacroFactor'],
    defaultEnabled: true,
    logCard: 'FoodSearchAutocomplete',
  },
  {
    id: 'cycle',
    name: 'Period & Cycle',
    description: 'Track menstrual cycle, fertility signals, and cycle symptoms',
    icon: '\u{1F319}',
    supportsNative: true,
    supportsImport: true,
    importSources: ['Natural Cycles', 'Flo', 'Clue', 'Stardust'],
    defaultEnabled: true,
    logCard: 'CycleCard',
  },
  {
    id: 'mood',
    name: 'Mood & Emotions',
    description: '5-point mood scale with emotion tags',
    icon: '\u{1F60A}',
    supportsNative: true,
    supportsImport: true,
    importSources: ['Daylio', 'Bearable'],
    defaultEnabled: true,
    logCard: 'MoodCard',
  },
  {
    id: 'sleep',
    name: 'Sleep',
    description: 'Sleep quality, duration, interruptions, and detailed staging',
    icon: '\u{1F634}',
    supportsNative: true,
    supportsImport: true,
    importSources: ['Oura', 'WHOOP', 'Garmin', 'Apple Watch', 'Sleep Cycle'],
    defaultEnabled: true,
    logCard: 'SleepDetailCard',
  },
  {
    id: 'fitness',
    name: 'Fitness & Activity',
    description: 'Workouts, exercise, steps, and activity tracking',
    icon: '\u{1F3C3}',
    supportsNative: true,
    supportsImport: true,
    importSources: ['Strava', 'Strong', 'Fitbod', 'Garmin', 'Apple Watch'],
    defaultEnabled: false,
    logCard: null,
  },
  {
    id: 'medications',
    name: 'Medications',
    description: 'Medication tracking, reminders, and adherence',
    icon: '\u{1F48A}',
    supportsNative: true,
    supportsImport: true,
    importSources: ['Medisafe', 'CareClinic', 'Apple Health'],
    defaultEnabled: true,
    logCard: 'MedicationEntry',
  },
  {
    id: 'labs',
    name: 'Lab Results',
    description: 'Lab test results from any source',
    icon: '\u{1F9EA}',
    supportsNative: false,
    supportsImport: true,
    importSources: ['Patient Portal', 'PDF/Photo', 'C-CDA', 'FHIR'],
    defaultEnabled: true,
    logCard: null,
  },
  {
    id: 'vitals',
    name: 'Vitals',
    description: 'Blood pressure, glucose, weight, temperature',
    icon: '\u{1FA7A}',
    supportsNative: true,
    supportsImport: true,
    importSources: ['Withings', 'Dexcom', 'Omron', 'Apple Health'],
    defaultEnabled: false,
    logCard: 'CoreVitalsCard',
  },
  {
    id: 'gratitude',
    name: 'Gratitude & Wins',
    description: 'Daily wins and gratitude journaling',
    icon: '\u{2728}',
    supportsNative: true,
    supportsImport: false,
    importSources: [],
    defaultEnabled: false,
    logCard: 'GratitudeCard',
  },
  {
    id: 'clinical_scales',
    name: 'Clinical Scales',
    description: 'PHQ-9 (depression), GAD-7 (anxiety), validated questionnaires',
    icon: '\u{1F4CA}',
    supportsNative: true,
    supportsImport: false,
    importSources: [],
    defaultEnabled: false,
    logCard: 'ClinicalScaleCard',
  },
  {
    id: 'weather',
    name: 'Weather Correlation',
    description: 'Auto-tracked barometric pressure, temperature, humidity',
    icon: '\u{26C5}',
    supportsNative: false,
    supportsImport: false,
    importSources: [],
    defaultEnabled: true,
    logCard: null,
  },
]

// ── Condition Presets ───────────────────────────────────────────────

export interface ConditionPreset {
  condition: string
  enabledModules: FeatureModule[]
  description: string
}

export const CONDITION_PRESETS: ConditionPreset[] = [
  {
    condition: 'Endometriosis',
    enabledModules: ['symptoms', 'cycle', 'nutrition', 'mood', 'sleep', 'medications', 'labs', 'vitals', 'clinical_scales', 'weather'],
    description: 'Pain, cycle, food triggers, fatigue, mood, clinical scales',
  },
  {
    condition: 'POTS / Dysautonomia',
    enabledModules: ['symptoms', 'vitals', 'sleep', 'fitness', 'medications', 'labs', 'weather'],
    description: 'Heart rate, BP, orthostatic tests, salt/water, activity tolerance',
  },
  {
    condition: 'EDS / Hypermobility',
    enabledModules: ['symptoms', 'fitness', 'sleep', 'medications', 'mood'],
    description: 'Joint pain, subluxations, fatigue, activity tracking',
  },
  {
    condition: 'Fibromyalgia',
    enabledModules: ['symptoms', 'sleep', 'mood', 'weather', 'medications', 'clinical_scales'],
    description: 'Pain map, fatigue, sleep quality, weather sensitivity',
  },
  {
    condition: 'IBS',
    enabledModules: ['symptoms', 'nutrition', 'mood', 'medications'],
    description: 'Bowel symptoms, food triggers (FODMAP), stress correlation',
  },
  {
    condition: 'PCOS',
    enabledModules: ['cycle', 'nutrition', 'mood', 'vitals', 'labs', 'medications'],
    description: 'Cycle tracking, weight, hormones, skin, hair',
  },
  {
    condition: 'Migraine',
    enabledModules: ['symptoms', 'weather', 'nutrition', 'sleep', 'medications', 'mood'],
    description: 'Headache tracking, weather triggers, food triggers, sleep patterns',
  },
  {
    condition: 'Anxiety / Depression',
    enabledModules: ['mood', 'clinical_scales', 'sleep', 'medications', 'gratitude', 'fitness'],
    description: 'PHQ-9/GAD-7, mood, sleep, medications, gratitude journaling',
  },
]

// ── Archetype Defaults ─────────────────────────────────────────────

export function getDefaultModulesForArchetype(archetype: UserArchetype): FeatureModule[] {
  switch (archetype) {
    case 'aggregator':
      return ['labs', 'medications'] // Minimal native -- they import everything
    case 'power_tracker':
      return MODULE_DEFINITIONS.filter(m => m.defaultEnabled).map(m => m.id) // All defaults
    case 'condition_manager':
      return ['symptoms', 'medications', 'labs'] // Condition preset will add more
    case 'health_curious':
      return ['mood', 'sleep'] // Start simple, add over time
  }
}

// ── Database Operations ────────────────────────────────────────────

export async function getPreferences(): Promise<UserPreferences | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('user_preferences')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    userArchetype: data.user_archetype,
    enabledModules: data.enabled_modules ?? [],
    conditions: data.conditions ?? [],
    connectedApps: data.connected_apps ?? [],
    logSectionOrder: data.log_section_order ?? [],
    hiddenSections: data.hidden_sections ?? [],
    homeWidgetOrder: data.home_widget_order ?? [],
    hiddenHomeWidgets: data.hidden_home_widgets ?? [],
    onboardingCompletedAt: data.onboarding_completed_at,
  }
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  const sb = createServiceClient()
  await sb.from('user_preferences').upsert({
    id: prefs.id ?? crypto.randomUUID(),
    user_archetype: prefs.userArchetype,
    enabled_modules: prefs.enabledModules,
    conditions: prefs.conditions,
    connected_apps: prefs.connectedApps,
    log_section_order: prefs.logSectionOrder,
    hidden_sections: prefs.hiddenSections,
    home_widget_order: prefs.homeWidgetOrder,
    hidden_home_widgets: prefs.hiddenHomeWidgets,
    onboarding_completed_at: prefs.onboardingCompletedAt,
    updated_at: new Date().toISOString(),
  })
}

export async function isModuleEnabled(moduleId: FeatureModule): Promise<boolean> {
  const prefs = await getPreferences()
  if (!prefs) return MODULE_DEFINITIONS.find(m => m.id === moduleId)?.defaultEnabled ?? false
  return prefs.enabledModules.includes(moduleId)
}

export async function toggleModule(moduleId: FeatureModule, enabled: boolean): Promise<void> {
  const prefs = await getPreferences()
  const current = prefs?.enabledModules ?? MODULE_DEFINITIONS.filter(m => m.defaultEnabled).map(m => m.id)

  const updated = enabled
    ? [...new Set([...current, moduleId])]
    : current.filter(m => m !== moduleId)

  await savePreferences({
    ...prefs,
    enabledModules: updated,
  })
}
