/**
 * Map HealthKit JSON samples (the wire format the iOS app sends to
 * /api/healthkit/sync) into the DailySummary array shape the existing
 * apple-health mapper consumes.
 *
 * Why this adapter exists:
 *   - The Apple Health *export* path (one-time CSV upload) parses
 *     XML on the server.
 *   - The Capacitor HealthKit *plugin* path (live sync from the iPhone)
 *     gets typed JSON HKSamples on-device and POSTs them.
 *   - Both targets land in the same domain rows (cycle_entries,
 *     biometrics, oura_daily-style fields, etc.) via apple-health/mapper.ts.
 *   - This module is the JSON -> DailySummary[] adapter so we reuse
 *     the canonical mapper instead of duplicating it.
 *
 * Aggregation rules per identifier:
 *   - HeartRate: avg over the day, plus min/max
 *   - RestingHeartRate: avg over the day (Apple usually emits 1 / day)
 *   - HeartRateVariabilitySDNN: avg over the day
 *   - BodyMass: last reading of the day (most recent weigh-in wins)
 *   - BodyTemperature: last reading of the day (BBT recorded once)
 *   - BodyMassIndex: last reading of the day
 *   - BloodPressureSystolic / Diastolic: avg over the day
 *   - StepCount: sum over the day
 *   - ActiveEnergyBurned: sum over the day
 *   - MenstrualFlow (category): pick the highest severity that day
 *     (heavy > medium > light > spotting > none)
 *   - SleepAnalysis (category): map to total minutes "asleep" per day
 */
import type { DailySummary } from '@/lib/importers/apple-health'
import type {
  HealthKitSample,
  HealthKitQuantitySample,
  HealthKitCategorySample,
} from '@/lib/capacitor/runtime'

function emptySummary(date: string): DailySummary {
  return {
    date,
    basalTemp: null,
    menstrualFlow: null,
    cervicalMucus: null,
    ovulationTest: null,
    sexualActivity: false,
    heartRateAvg: null,
    heartRateMin: null,
    heartRateMax: null,
    restingHR: null,
    hrv: null,
    bloodOxygen: null,
    respiratoryRate: null,
    bpSystolic: null,
    bpDiastolic: null,
    bloodGlucose: null,
    vo2Max: null,
    bodyTemp: null,
    weight: null,
    bmi: null,
    bodyFat: null,
    height: null,
    steps: null,
    walkingDistance: null,
    flightsClimbed: null,
    activeEnergy: null,
    exerciseMinutes: null,
    sleepHours: null,
    calories: null,
    protein: null,
    fat: null,
    carbs: null,
    fiber: null,
    sugar: null,
    sodium: null,
    iron: null,
    calcium: null,
    vitaminD: null,
    vitaminC: null,
    caffeine: null,
    water: null,
  }
}

const FLOW_RANK: Record<string, number> = {
  none: 0,
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
}

function isQuantity(s: HealthKitSample): s is HealthKitQuantitySample {
  return 'value' in s && typeof (s as HealthKitQuantitySample).value === 'number'
}

function isCategory(s: HealthKitSample): s is HealthKitCategorySample {
  return 'code' in s && typeof (s as HealthKitCategorySample).code === 'number'
}

/** YYYY-MM-DD slice in UTC. Caller is responsible for sending samples
 *  whose `start` already accounts for the user's local-day intent. */
function isoDate(t: string): string {
  return t.slice(0, 10)
}

interface DayAccumulator {
  date: string
  // For mean / sum we need running totals + counts.
  hrSum: number
  hrCount: number
  hrMin: number | null
  hrMax: number | null
  rhrSum: number
  rhrCount: number
  hrvSum: number
  hrvCount: number
  bpSysSum: number
  bpSysCount: number
  bpDiaSum: number
  bpDiaCount: number
  steps: number
  activeEnergy: number
  weightLast: number | null
  weightLastTs: string | null
  tempLast: number | null
  tempLastTs: string | null
  bmiLast: number | null
  bmiLastTs: string | null
  flowMaxRank: number
  flowMaxLabel: string | null
  asleepMin: number
}

function emptyAcc(date: string): DayAccumulator {
  return {
    date,
    hrSum: 0,
    hrCount: 0,
    hrMin: null,
    hrMax: null,
    rhrSum: 0,
    rhrCount: 0,
    hrvSum: 0,
    hrvCount: 0,
    bpSysSum: 0,
    bpSysCount: 0,
    bpDiaSum: 0,
    bpDiaCount: 0,
    steps: 0,
    activeEnergy: 0,
    weightLast: null,
    weightLastTs: null,
    tempLast: null,
    tempLastTs: null,
    bmiLast: null,
    bmiLastTs: null,
    flowMaxRank: 0,
    flowMaxLabel: null,
    asleepMin: 0,
  }
}

function applyQuantity(acc: DayAccumulator, s: HealthKitQuantitySample): void {
  switch (s.identifier) {
    case 'HKQuantityTypeIdentifierHeartRate':
      acc.hrSum += s.value
      acc.hrCount += 1
      acc.hrMin = acc.hrMin == null ? s.value : Math.min(acc.hrMin, s.value)
      acc.hrMax = acc.hrMax == null ? s.value : Math.max(acc.hrMax, s.value)
      break
    case 'HKQuantityTypeIdentifierRestingHeartRate':
      acc.rhrSum += s.value
      acc.rhrCount += 1
      break
    case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
      acc.hrvSum += s.value
      acc.hrvCount += 1
      break
    case 'HKQuantityTypeIdentifierBloodPressureSystolic':
      acc.bpSysSum += s.value
      acc.bpSysCount += 1
      break
    case 'HKQuantityTypeIdentifierBloodPressureDiastolic':
      acc.bpDiaSum += s.value
      acc.bpDiaCount += 1
      break
    case 'HKQuantityTypeIdentifierStepCount':
      acc.steps += s.value
      break
    case 'HKQuantityTypeIdentifierActiveEnergyBurned':
      acc.activeEnergy += s.value
      break
    case 'HKQuantityTypeIdentifierBodyMass':
      if (acc.weightLastTs == null || s.start > acc.weightLastTs) {
        acc.weightLast = s.value
        acc.weightLastTs = s.start
      }
      break
    case 'HKQuantityTypeIdentifierBodyTemperature':
      if (acc.tempLastTs == null || s.start > acc.tempLastTs) {
        acc.tempLast = s.value
        acc.tempLastTs = s.start
      }
      break
    case 'HKQuantityTypeIdentifierBodyMassIndex':
      if (acc.bmiLastTs == null || s.start > acc.bmiLastTs) {
        acc.bmiLast = s.value
        acc.bmiLastTs = s.start
      }
      break
    default:
      break
  }
}

function applyCategory(acc: DayAccumulator, s: HealthKitCategorySample): void {
  if (s.identifier === 'HKCategoryTypeIdentifierMenstrualFlow') {
    const label = s.valueText.toLowerCase()
    const rank = FLOW_RANK[label] ?? 0
    if (rank >= acc.flowMaxRank) {
      acc.flowMaxRank = rank
      acc.flowMaxLabel = label === 'none' ? null : label
    }
  } else if (s.identifier === 'HKCategoryTypeIdentifierIntermenstrualBleeding') {
    // Treat as spotting unless the flow has already promoted to a stronger label.
    if (acc.flowMaxRank < FLOW_RANK.spotting) {
      acc.flowMaxRank = FLOW_RANK.spotting
      acc.flowMaxLabel = 'spotting'
    }
  } else if (s.identifier === 'HKCategoryTypeIdentifierSleepAnalysis') {
    // Apple's "asleep" categories are codes 1, 3, 4, 5 (asleep, core,
    // deep, REM). 0 = inBed, 2 = awake. We sum minutes for any
    // "asleep-ish" code so the daily total reflects time spent asleep.
    const ASLEEP_CODES = new Set([1, 3, 4, 5])
    if (ASLEEP_CODES.has(s.code)) {
      const dur =
        (Date.parse(s.end) - Date.parse(s.start)) / 60_000
      if (Number.isFinite(dur) && dur > 0) acc.asleepMin += dur
    }
  }
}

function finalize(acc: DayAccumulator): DailySummary {
  const summary = emptySummary(acc.date)
  if (acc.hrCount > 0) {
    summary.heartRateAvg = round1(acc.hrSum / acc.hrCount)
    summary.heartRateMin = acc.hrMin
    summary.heartRateMax = acc.hrMax
  }
  if (acc.rhrCount > 0) summary.restingHR = round1(acc.rhrSum / acc.rhrCount)
  if (acc.hrvCount > 0) summary.hrv = round1(acc.hrvSum / acc.hrvCount)
  if (acc.bpSysCount > 0) summary.bpSystolic = Math.round(acc.bpSysSum / acc.bpSysCount)
  if (acc.bpDiaCount > 0) summary.bpDiastolic = Math.round(acc.bpDiaSum / acc.bpDiaCount)
  if (acc.steps > 0) summary.steps = Math.round(acc.steps)
  if (acc.activeEnergy > 0) summary.activeEnergy = Math.round(acc.activeEnergy)
  if (acc.weightLast != null) summary.weight = round1(acc.weightLast)
  if (acc.tempLast != null) {
    summary.bodyTemp = round2(acc.tempLast)
    // BBT field tracks the same value for now; cycle code is the
    // primary consumer and looks at bodyTemp.
    summary.basalTemp = round2(acc.tempLast)
  }
  if (acc.bmiLast != null) summary.bmi = round1(acc.bmiLast)
  if (acc.flowMaxLabel != null) summary.menstrualFlow = acc.flowMaxLabel
  if (acc.asleepMin > 0) summary.sleepHours = round1(acc.asleepMin / 60)
  return summary
}

/**
 * Group an array of HKSamples by ISO date and produce one DailySummary
 * per date that had data. Output is sorted ascending by date.
 */
export function samplesToDailySummaries(samples: HealthKitSample[]): DailySummary[] {
  const byDate = new Map<string, DayAccumulator>()
  for (const s of samples) {
    const date = isoDate(s.start)
    let acc = byDate.get(date)
    if (!acc) {
      acc = emptyAcc(date)
      byDate.set(date, acc)
    }
    if (isQuantity(s)) applyQuantity(acc, s)
    else if (isCategory(s)) applyCategory(acc, s)
  }
  return Array.from(byDate.values())
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(finalize)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
