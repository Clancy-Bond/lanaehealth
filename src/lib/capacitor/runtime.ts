/**
 * Capacitor runtime detection + typed health bridge.
 *
 * The same web build runs in three environments:
 *   1. Regular browsers (desktop Safari, mobile Safari from
 *      lanaehealth.vercel.app) — no Capacitor, no HealthKit.
 *   2. Capacitor iOS WebView (Lanae's iPhone via the native shell)
 *      — Capacitor present, HealthKit available.
 *   3. Capacitor Android WebView (future) — Capacitor present,
 *      Google Health Connect available.
 *
 * Components that want platform-specific behavior call
 * `getCapacitorRuntime()` and branch on the returned shape. When
 * Capacitor is absent the helpers all return the safe no-op
 * variant so the same code path renders / runs in a regular
 * browser without crashing.
 */

export type CapacitorPlatform = 'ios' | 'android' | 'web'

export interface CapacitorRuntime {
  /** True when the app is running inside a Capacitor native shell. */
  isNative: boolean
  /** Native platform when isNative=true; 'web' otherwise. */
  platform: CapacitorPlatform
}

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean
    getPlatform?: () => CapacitorPlatform
  }
}

/**
 * Inspect the current execution context. Pure read; safe to call from
 * server components (returns the web default since `window` is undefined).
 */
export function getCapacitorRuntime(): CapacitorRuntime {
  if (typeof window === 'undefined') {
    return { isNative: false, platform: 'web' }
  }
  const cap = (window as unknown as CapacitorWindow).Capacitor
  if (!cap) return { isNative: false, platform: 'web' }
  const isNative = typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : false
  const platform =
    typeof cap.getPlatform === 'function' ? cap.getPlatform() : ('web' as CapacitorPlatform)
  return { isNative, platform }
}

/**
 * Convenience: returns true when running on iOS via the Capacitor
 * shell (so HealthKit calls are available). Returns false in every
 * other environment, including the regular mobile Safari that loads
 * the same lanaehealth.vercel.app URL.
 */
export function isHealthKitAvailable(): boolean {
  const r = getCapacitorRuntime()
  return r.isNative && r.platform === 'ios'
}

// ── HealthKit type identifiers ─────────────────────────────────────

/**
 * The HealthKit identifiers the app reads on first iteration. We
 * deliberately keep this list small and grow it as Lanae's surfaces
 * actually consume the new fields. Each identifier maps to a domain
 * row written by /api/healthkit/sync via the apple-health mapper.
 */
export const HEALTHKIT_READ_TYPES = [
  // Cycle / period
  'HKCategoryTypeIdentifierMenstrualFlow',
  'HKCategoryTypeIdentifierIntermenstrualBleeding',
  'HKCategoryTypeIdentifierOvulationTestResult',
  // Body metrics
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyTemperature',
  'HKQuantityTypeIdentifierBodyMassIndex',
  // Cardiovascular
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierBloodPressureSystolic',
  'HKQuantityTypeIdentifierBloodPressureDiastolic',
  // Sleep (mostly redundant with Oura but useful when she is not wearing the ring)
  'HKCategoryTypeIdentifierSleepAnalysis',
  // Activity
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
] as const

export type HealthKitTypeIdentifier = (typeof HEALTHKIT_READ_TYPES)[number]

/**
 * Wire shape posted to /api/healthkit/sync. The Capacitor side
 * collects HKSamples for each requested identifier, normalizes them
 * to this shape, and POSTs in batches.
 *
 * Times are ISO 8601 in the device's local timezone (with offset).
 * Numeric values use the SI / clinical unit per identifier:
 *   BodyMass -> kg
 *   BodyTemperature -> °C
 *   HeartRate -> bpm
 *   BloodPressureSystolic / Diastolic -> mmHg
 *   StepCount -> count
 *   ActiveEnergyBurned -> kcal
 *   HeartRateVariabilitySDNN -> ms
 *
 * Category samples (menstrual flow, sleep) carry the value in `code`
 * (the HKCategoryValue* integer) and `valueText` (a friendly label
 * derived on-device).
 */
export interface HealthKitQuantitySample {
  identifier: HealthKitTypeIdentifier
  start: string
  end: string
  /** Numeric value in the canonical unit for this identifier. */
  value: number
  /** Source app + device for traceability ("Apple Watch", "Oura"). */
  sourceName?: string | null
}

export interface HealthKitCategorySample {
  identifier: HealthKitTypeIdentifier
  start: string
  end: string
  /** HKCategoryValue integer (e.g. menstrualFlow.medium = 3). */
  code: number
  /** Friendly label ("medium", "asleepREM"). */
  valueText: string
  sourceName?: string | null
}

export type HealthKitSample = HealthKitQuantitySample | HealthKitCategorySample

export interface HealthKitSyncPayload {
  /** Local-frame ISO date YYYY-MM-DD this batch covers. */
  syncedForDate: string
  /** Time of capture for replay debugging. */
  capturedAt: string
  /** All samples in this batch; the server bins by date. */
  samples: HealthKitSample[]
}
