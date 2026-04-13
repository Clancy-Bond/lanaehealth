/**
 * Apple Health Export XML Parser
 *
 * Parses the export.xml file from Apple Health's "Export All Health Data" feature.
 * The XML contains ALL health records ever synced - from Natural Cycles, MyNetDiary,
 * Apple Watch, Oura, and any other connected apps.
 *
 * Usage: Health app > Profile icon > Export All Health Data > Share ZIP > Upload here
 */

export interface DailySummary {
  date: string
  // Cycle
  basalTemp: number | null
  menstrualFlow: string | null
  cervicalMucus: string | null
  ovulationTest: string | null
  sexualActivity: boolean
  // Vitals
  heartRateAvg: number | null
  heartRateMin: number | null
  heartRateMax: number | null
  restingHR: number | null
  hrv: number | null
  bloodOxygen: number | null
  respiratoryRate: number | null
  bpSystolic: number | null
  bpDiastolic: number | null
  bloodGlucose: number | null
  vo2Max: number | null
  bodyTemp: number | null
  // Body
  weight: number | null
  bmi: number | null
  bodyFat: number | null
  height: number | null
  // Activity
  steps: number | null
  walkingDistance: number | null
  flightsClimbed: number | null
  activeEnergy: number | null
  exerciseMinutes: number | null
  // Sleep
  sleepHours: number | null
  // Nutrition
  calories: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  sugar: number | null
  sodium: number | null
  iron: number | null
  calcium: number | null
  vitaminD: number | null
  vitaminC: number | null
  caffeine: number | null
  water: number | null
}

export interface ParsedHealthData {
  dailySummaries: Map<string, DailySummary>
  recordCount: number
  dateRange: { start: string; end: string }
  sources: string[]
}

// Map HealthKit type identifiers to our summary fields
const QUANTITY_TYPE_MAP: Record<string, { field: keyof DailySummary; agg: 'sum' | 'avg' | 'last' }> = {
  'HKQuantityTypeIdentifierBasalBodyTemperature': { field: 'basalTemp', agg: 'avg' },
  'HKQuantityTypeIdentifierBodyTemperature': { field: 'bodyTemp', agg: 'avg' },
  'HKQuantityTypeIdentifierHeartRate': { field: 'heartRateAvg', agg: 'avg' },
  'HKQuantityTypeIdentifierRestingHeartRate': { field: 'restingHR', agg: 'avg' },
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': { field: 'hrv', agg: 'avg' },
  'HKQuantityTypeIdentifierOxygenSaturation': { field: 'bloodOxygen', agg: 'avg' },
  'HKQuantityTypeIdentifierRespiratoryRate': { field: 'respiratoryRate', agg: 'avg' },
  'HKQuantityTypeIdentifierBloodPressureSystolic': { field: 'bpSystolic', agg: 'avg' },
  'HKQuantityTypeIdentifierBloodPressureDiastolic': { field: 'bpDiastolic', agg: 'avg' },
  'HKQuantityTypeIdentifierBloodGlucose': { field: 'bloodGlucose', agg: 'avg' },
  'HKQuantityTypeIdentifierVO2Max': { field: 'vo2Max', agg: 'avg' },
  'HKQuantityTypeIdentifierBodyMass': { field: 'weight', agg: 'last' },
  'HKQuantityTypeIdentifierBodyMassIndex': { field: 'bmi', agg: 'last' },
  'HKQuantityTypeIdentifierBodyFatPercentage': { field: 'bodyFat', agg: 'last' },
  'HKQuantityTypeIdentifierHeight': { field: 'height', agg: 'last' },
  'HKQuantityTypeIdentifierStepCount': { field: 'steps', agg: 'sum' },
  'HKQuantityTypeIdentifierDistanceWalkingRunning': { field: 'walkingDistance', agg: 'sum' },
  'HKQuantityTypeIdentifierFlightsClimbed': { field: 'flightsClimbed', agg: 'sum' },
  'HKQuantityTypeIdentifierActiveEnergyBurned': { field: 'activeEnergy', agg: 'sum' },
  'HKQuantityTypeIdentifierAppleExerciseTime': { field: 'exerciseMinutes', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryEnergyConsumed': { field: 'calories', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryProtein': { field: 'protein', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryFatTotal': { field: 'fat', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryCarbohydrates': { field: 'carbs', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryFiber': { field: 'fiber', agg: 'sum' },
  'HKQuantityTypeIdentifierDietarySugar': { field: 'sugar', agg: 'sum' },
  'HKQuantityTypeIdentifierDietarySodium': { field: 'sodium', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryIron': { field: 'iron', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryCalcium': { field: 'calcium', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryVitaminD': { field: 'vitaminD', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryVitaminC': { field: 'vitaminC', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryCaffeine': { field: 'caffeine', agg: 'sum' },
  'HKQuantityTypeIdentifierDietaryWater': { field: 'water', agg: 'sum' },
}

const CATEGORY_TYPE_MAP: Record<string, keyof DailySummary> = {
  'HKCategoryTypeIdentifierMenstrualFlow': 'menstrualFlow',
  'HKCategoryTypeIdentifierCervicalMucusQuality': 'cervicalMucus',
  'HKCategoryTypeIdentifierOvulationTestResult': 'ovulationTest',
  'HKCategoryTypeIdentifierSexualActivity': 'sexualActivity',
}

function createEmptySummary(date: string): DailySummary {
  return {
    date,
    basalTemp: null, menstrualFlow: null, cervicalMucus: null,
    ovulationTest: null, sexualActivity: false,
    heartRateAvg: null, heartRateMin: null, heartRateMax: null,
    restingHR: null, hrv: null, bloodOxygen: null, respiratoryRate: null,
    bpSystolic: null, bpDiastolic: null, bloodGlucose: null, vo2Max: null,
    bodyTemp: null,
    weight: null, bmi: null, bodyFat: null, height: null,
    steps: null, walkingDistance: null, flightsClimbed: null,
    activeEnergy: null, exerciseMinutes: null,
    sleepHours: null,
    calories: null, protein: null, fat: null, carbs: null,
    fiber: null, sugar: null, sodium: null, iron: null,
    calcium: null, vitaminD: null, vitaminC: null, caffeine: null, water: null,
  }
}

/**
 * Parse Apple Health export XML into daily summaries.
 * Uses streaming regex since the XML can be 100MB+.
 */
export function parseAppleHealthXml(xmlText: string): ParsedHealthData {
  const dailySummaries = new Map<string, DailySummary>()
  const sources = new Set<string>()
  const avgCounts = new Map<string, Map<string, number>>()
  let minDate = '9999-99-99'
  let maxDate = '0000-00-00'
  let recordCount = 0

  // Parse <Record> elements via regex (much faster than DOM for large files)
  const recordRegex = /<Record\s+([^>]+)\/>/g
  let match: RegExpExecArray | null

  while ((match = recordRegex.exec(xmlText)) !== null) {
    const attrs = match[1]
    const type = extractAttr(attrs, 'type')
    const value = extractAttr(attrs, 'value')
    const startDate = extractAttr(attrs, 'startDate')
    const sourceName = extractAttr(attrs, 'sourceName')

    if (!type || !startDate) continue
    recordCount++

    if (sourceName) sources.add(sourceName)

    const date = startDate.substring(0, 10)
    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date

    if (!dailySummaries.has(date)) {
      dailySummaries.set(date, createEmptySummary(date))
    }
    const summary = dailySummaries.get(date)!

    // Quantity types
    const qMap = QUANTITY_TYPE_MAP[type]
    if (qMap && value) {
      const numVal = parseFloat(value)
      if (!isNaN(numVal)) {
        const field = qMap.field
        const current = summary[field] as number | null

        if (qMap.agg === 'sum') {
          (summary as unknown as Record<string, unknown>)[field] = (current || 0) + numVal
        } else if (qMap.agg === 'last') {
          (summary as unknown as Record<string, unknown>)[field] = numVal
        } else if (qMap.agg === 'avg') {
          if (!avgCounts.has(date)) avgCounts.set(date, new Map())
          const counts = avgCounts.get(date)!
          const n = counts.get(field as string) || 0
          counts.set(field as string, n + 1)
          if (current === null) {
            (summary as unknown as Record<string, unknown>)[field] = numVal
          } else {
            (summary as unknown as Record<string, unknown>)[field] = (current * n + numVal) / (n + 1)
          }
        }

        // Track HR min/max separately
        if (type === 'HKQuantityTypeIdentifierHeartRate') {
          if (summary.heartRateMin === null || numVal < summary.heartRateMin) summary.heartRateMin = numVal
          if (summary.heartRateMax === null || numVal > summary.heartRateMax) summary.heartRateMax = numVal
        }
      }
    }

    // Category types
    const catField = CATEGORY_TYPE_MAP[type]
    if (catField) {
      if (catField === 'sexualActivity') {
        (summary as unknown as Record<string, unknown>)[catField] = true
      } else if (value) {
        (summary as unknown as Record<string, unknown>)[catField] = mapCategoryValue(type, value)
      }
    }

    // Sleep analysis
    if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      const endDate = extractAttr(attrs, 'endDate')
      if (endDate && value !== '0') {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        if (hours > 0 && hours < 24) {
          summary.sleepHours = (summary.sleepHours || 0) + hours
        }
      }
    }
  }

  // Round all numeric values
  for (const summary of dailySummaries.values()) {
    for (const key of Object.keys(summary) as (keyof DailySummary)[]) {
      const val = summary[key]
      if (typeof val === 'number') {
        (summary as unknown as Record<string, unknown>)[key] = Math.round(val * 100) / 100
      }
    }
  }

  return {
    dailySummaries,
    recordCount,
    dateRange: { start: minDate, end: maxDate },
    sources: Array.from(sources),
  }
}

function extractAttr(attrString: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`)
  const m = regex.exec(attrString)
  return m ? m[1] : null
}

function mapCategoryValue(type: string, value: string): string {
  const v = parseInt(value, 10)
  if (type === 'HKCategoryTypeIdentifierMenstrualFlow') {
    return ({ 1: 'unspecified', 2: 'light', 3: 'medium', 4: 'heavy', 5: 'none' } as Record<number, string>)[v] || value
  }
  if (type === 'HKCategoryTypeIdentifierCervicalMucusQuality') {
    return ({ 1: 'dry', 2: 'sticky', 3: 'creamy', 4: 'watery', 5: 'egg_white' } as Record<number, string>)[v] || value
  }
  if (type === 'HKCategoryTypeIdentifierOvulationTestResult') {
    return ({ 1: 'negative', 2: 'positive', 3: 'indeterminate' } as Record<number, string>)[v] || value
  }
  return value
}
