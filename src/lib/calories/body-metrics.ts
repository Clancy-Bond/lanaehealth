/**
 * Body composition + cardiometabolic computation helpers.
 *
 * Pure functions: numbers in, numbers out (with categorical bands
 * where the metric has accepted thresholds). No I/O, no side effects.
 *
 * Every formula is cited; full context lives at
 * `docs/research/comprehensive-body-metrics.md`. Tests at
 * `src/lib/calories/__tests__/body-metrics.test.ts`.
 *
 * Voice rule: category strings are factual, not judgmental. The UI
 * layer wraps each result in NC-voice copy ("what this means").
 */

// ─── Types ──────────────────────────────────────────────────────────

export type Sex = 'female' | 'male'

export type BMICategory =
  | 'Underweight'
  | 'Normal'
  | 'Overweight'
  | 'Obese class I'
  | 'Obese class II'
  | 'Obese class III'

export type BodyFatCategory =
  | 'Essential'
  | 'Athletes'
  | 'Fitness'
  | 'Acceptable'
  | 'Above acceptable'

export type WaistRiskBand = 'low' | 'increased' | 'substantially_increased'

export type WHRRiskBand = 'low' | 'moderate' | 'high'

export type WHtRCategory =
  | 'underweight'
  | 'healthy'
  | 'increased_risk'
  | 'substantially_increased_risk'

export type BPCategory =
  | 'normal'
  | 'elevated'
  | 'stage1_hypertension'
  | 'stage2_hypertension'
  | 'hypertensive_crisis'

export type GlucoseCategory = 'normal' | 'prediabetes' | 'diabetes'
export type HbA1cCategory = 'normal' | 'prediabetes' | 'diabetes'

export type HOMAIRCategory =
  | 'sensitive'
  | 'early_resistance'
  | 'significant_resistance'
  | 'severe_resistance'

export type BMDCategory = 'normal' | 'osteopenia' | 'osteoporosis'

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active'

// ─── BMI ────────────────────────────────────────────────────────────

/**
 * BMI = kg / m^2.
 *
 * Source: WHO Technical Report 894 (2000). See research doc.
 *
 * Limitation: does not distinguish lean mass from fat mass.
 */
export function calculateBMI(
  weightKg: number,
  heightCm: number,
): { bmi: number; category: BMICategory } {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('weightKg must be a positive number')
  }
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    throw new Error('heightCm must be a positive number')
  }
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  return { bmi: round1(bmi), category: bmiCategory(bmi) }
}

function bmiCategory(bmi: number): BMICategory {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Normal'
  if (bmi < 30) return 'Overweight'
  if (bmi < 35) return 'Obese class I'
  if (bmi < 40) return 'Obese class II'
  return 'Obese class III'
}

// ─── Body fat (US Navy formula) ─────────────────────────────────────

/**
 * Hodgdon and Beckett (1984) US Navy circumference formula.
 *
 * Inputs in cm. For women, all four measurements (waist, hip, neck,
 * height) are required. For men, hip is unused; abdomen takes the
 * waist slot.
 *
 * Source: Naval Health Research Center Report 84-11 (1984).
 */
export function calculateBodyFatNavy(inputs: {
  sex: Sex
  heightCm: number
  neckCm: number
  waistCm: number
  hipCm?: number // women only
}): number {
  const { sex, heightCm, neckCm, waistCm, hipCm } = inputs
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    throw new Error('heightCm must be positive')
  }
  if (!Number.isFinite(neckCm) || neckCm <= 0) {
    throw new Error('neckCm must be positive')
  }
  if (!Number.isFinite(waistCm) || waistCm <= 0) {
    throw new Error('waistCm must be positive')
  }
  if (sex === 'female') {
    if (!hipCm || !Number.isFinite(hipCm) || hipCm <= 0) {
      throw new Error('hipCm required for women')
    }
    if (waistCm + hipCm - neckCm <= 0) {
      throw new Error('Invalid measurements: waist + hip - neck must be positive')
    }
    const pct =
      163.205 * Math.log10(waistCm + hipCm - neckCm) -
      97.684 * Math.log10(heightCm) -
      78.387
    return round1(Math.max(0, pct))
  }
  // male
  if (waistCm - neckCm <= 0) {
    throw new Error('Invalid measurements: waist - neck must be positive')
  }
  const pct =
    86.010 * Math.log10(waistCm - neckCm) -
    70.041 * Math.log10(heightCm) +
    36.76
  return round1(Math.max(0, pct))
}

/**
 * ACE healthy ranges (American Council on Exercise).
 */
export function bodyFatCategory(pct: number, sex: Sex): BodyFatCategory {
  if (sex === 'female') {
    if (pct < 14) return 'Essential'
    if (pct < 21) return 'Athletes'
    if (pct < 25) return 'Fitness'
    if (pct < 32) return 'Acceptable'
    return 'Above acceptable'
  }
  // male
  if (pct < 6) return 'Essential'
  if (pct < 14) return 'Athletes'
  if (pct < 18) return 'Fitness'
  if (pct < 25) return 'Acceptable'
  return 'Above acceptable'
}

// ─── Lean body mass / fat-free mass ─────────────────────────────────

/**
 * LBM = weight * (1 - bodyFat/100). Returns kg.
 * Source: definitional. See Heymsfield, Human Body Composition (2005).
 */
export function calculateLBM(weightKg: number, bodyFatPct: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('weightKg must be positive')
  }
  if (!Number.isFinite(bodyFatPct) || bodyFatPct < 0 || bodyFatPct >= 100) {
    throw new Error('bodyFatPct must be in [0, 100)')
  }
  return round1(weightKg * (1 - bodyFatPct / 100))
}

/**
 * Fat mass = weight * bodyFat/100. Returns kg.
 */
export function calculateFatMass(weightKg: number, bodyFatPct: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('weightKg must be positive')
  }
  if (!Number.isFinite(bodyFatPct) || bodyFatPct < 0 || bodyFatPct > 100) {
    throw new Error('bodyFatPct must be in [0, 100]')
  }
  return round1(weightKg * (bodyFatPct / 100))
}

// ─── Waist circumference ────────────────────────────────────────────

/**
 * WHO/NIH cardiovascular risk thresholds.
 * Source: WHO Expert Consultation 2008.
 */
export function waistRiskBand(waistCm: number, sex: Sex): WaistRiskBand {
  if (!Number.isFinite(waistCm) || waistCm <= 0) {
    throw new Error('waistCm must be positive')
  }
  if (sex === 'female') {
    if (waistCm >= 88) return 'substantially_increased'
    if (waistCm >= 80) return 'increased'
    return 'low'
  }
  if (waistCm >= 102) return 'substantially_increased'
  if (waistCm >= 94) return 'increased'
  return 'low'
}

// ─── WHR ────────────────────────────────────────────────────────────

/**
 * Waist-to-hip ratio. WHO 2008 cutoffs.
 */
export function calculateWHR(
  waistCm: number,
  hipCm: number,
  sex: Sex,
): { ratio: number; risk: WHRRiskBand } {
  if (!Number.isFinite(waistCm) || waistCm <= 0) {
    throw new Error('waistCm must be positive')
  }
  if (!Number.isFinite(hipCm) || hipCm <= 0) {
    throw new Error('hipCm must be positive')
  }
  const ratio = waistCm / hipCm
  let risk: WHRRiskBand
  if (sex === 'female') {
    if (ratio > 0.85) risk = 'high'
    else if (ratio > 0.80) risk = 'moderate'
    else risk = 'low'
  } else {
    if (ratio > 0.90) risk = 'high'
    else if (ratio > 0.85) risk = 'moderate'
    else risk = 'low'
  }
  return { ratio: round2(ratio), risk }
}

// ─── WHtR ───────────────────────────────────────────────────────────

/**
 * Waist-to-height ratio. Ashwell and Hsieh 2005; Browning et al. 2010.
 * "Keep your waist to less than half your height."
 */
export function calculateWHtR(
  waistCm: number,
  heightCm: number,
): { ratio: number; category: WHtRCategory } {
  if (!Number.isFinite(waistCm) || waistCm <= 0) {
    throw new Error('waistCm must be positive')
  }
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    throw new Error('heightCm must be positive')
  }
  const ratio = waistCm / heightCm
  let category: WHtRCategory
  if (ratio < 0.40) category = 'underweight'
  else if (ratio < 0.50) category = 'healthy'
  else if (ratio < 0.60) category = 'increased_risk'
  else category = 'substantially_increased_risk'
  return { ratio: round2(ratio), category }
}

// ─── BMD T-score ────────────────────────────────────────────────────

/**
 * WHO 1994 osteoporosis classification.
 */
export function bmdCategory(tScore: number): BMDCategory {
  if (!Number.isFinite(tScore)) {
    throw new Error('tScore must be a number')
  }
  if (tScore <= -2.5) return 'osteoporosis'
  if (tScore < -1.0) return 'osteopenia'
  return 'normal'
}

// ─── BMR / RMR (Mifflin-St Jeor) ────────────────────────────────────

/**
 * Mifflin-St Jeor BMR. Returns kcal/day.
 *
 * Source: Mifflin et al., AJCN 51:241-7 (1990).
 * Position: Frankenfield et al., JADA 105:775-89 (2005) confirmed
 * Mifflin-St Jeor as the most accurate of the BMR equations.
 */
export function calculateBMR(inputs: {
  sex: Sex
  weightKg: number
  heightCm: number
  ageYears: number
}): number {
  const { sex, weightKg, heightCm, ageYears } = inputs
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('weightKg must be positive')
  }
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    throw new Error('heightCm must be positive')
  }
  if (!Number.isFinite(ageYears) || ageYears < 0) {
    throw new Error('ageYears must be non-negative')
  }
  const sexOffset = sex === 'female' ? -161 : 5
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset
  return Math.round(bmr)
}

/**
 * RMR is treated as identical to BMR for non-medical use; documented
 * difference is roughly 5% in laboratory measurements.
 */
export function calculateRMR(inputs: {
  sex: Sex
  weightKg: number
  heightCm: number
  ageYears: number
}): number {
  return calculateBMR(inputs)
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
}

/**
 * TDEE = BMR * activity factor.
 * Source: Harris-Benedict (1919) factors; McArdle et al. (2014) confirm.
 */
export function calculateTDEE(bmr: number, level: ActivityLevel): number {
  if (!Number.isFinite(bmr) || bmr <= 0) {
    throw new Error('bmr must be positive')
  }
  const factor = ACTIVITY_FACTORS[level]
  if (!factor) throw new Error(`Unknown activity level: ${level}`)
  return Math.round(bmr * factor)
}

// ─── Blood pressure derivatives ─────────────────────────────────────

/**
 * Mean Arterial Pressure (MAP).
 * MAP = DBP + (SBP - DBP) / 3.
 * Source: Sesso et al., Hypertension 36:801-7 (2000).
 */
export function calculateMAP(systolic: number, diastolic: number): number {
  if (!Number.isFinite(systolic) || systolic <= 0) {
    throw new Error('systolic must be positive')
  }
  if (!Number.isFinite(diastolic) || diastolic <= 0) {
    throw new Error('diastolic must be positive')
  }
  if (systolic < diastolic) {
    throw new Error('systolic must be >= diastolic')
  }
  return Math.round(diastolic + (systolic - diastolic) / 3)
}

/**
 * Pulse pressure = SBP - DBP.
 * Source: Franklin et al., Circulation 100:354-60 (1999).
 */
export function calculatePulsePressure(
  systolic: number,
  diastolic: number,
): number {
  if (!Number.isFinite(systolic) || systolic <= 0) {
    throw new Error('systolic must be positive')
  }
  if (!Number.isFinite(diastolic) || diastolic <= 0) {
    throw new Error('diastolic must be positive')
  }
  return Math.round(systolic - diastolic)
}

/**
 * 2017 ACC/AHA blood pressure category.
 */
export function bpCategory(systolic: number, diastolic: number): BPCategory {
  if (systolic >= 180 || diastolic >= 120) return 'hypertensive_crisis'
  if (systolic >= 140 || diastolic >= 90) return 'stage2_hypertension'
  if (systolic >= 130 || diastolic >= 80) return 'stage1_hypertension'
  if (systolic >= 120 && diastolic < 80) return 'elevated'
  return 'normal'
}

// ─── Metabolic ──────────────────────────────────────────────────────

/**
 * Fasting glucose category. ADA 2024 standards.
 * Input: mg/dL.
 */
export function fastingGlucoseCategory(mgPerDl: number): GlucoseCategory {
  if (!Number.isFinite(mgPerDl) || mgPerDl <= 0) {
    throw new Error('mgPerDl must be positive')
  }
  if (mgPerDl >= 126) return 'diabetes'
  if (mgPerDl >= 100) return 'prediabetes'
  return 'normal'
}

/**
 * HbA1c category. ADA 2024 standards.
 * Input: percentage (e.g. 5.4 not 0.054).
 */
export function hba1cCategory(pct: number): HbA1cCategory {
  if (!Number.isFinite(pct) || pct <= 0) {
    throw new Error('pct must be positive')
  }
  if (pct >= 6.5) return 'diabetes'
  if (pct >= 5.7) return 'prediabetes'
  return 'normal'
}

/**
 * HOMA-IR = (insulin uIU/mL * glucose mg/dL) / 405.
 * Source: Matthews et al., Diabetologia 28:412-9 (1985).
 */
export function calculateHOMAIR(
  fastingInsulinUIUmL: number,
  fastingGlucoseMgDl: number,
): { value: number; category: HOMAIRCategory } {
  if (!Number.isFinite(fastingInsulinUIUmL) || fastingInsulinUIUmL <= 0) {
    throw new Error('fastingInsulinUIUmL must be positive')
  }
  if (!Number.isFinite(fastingGlucoseMgDl) || fastingGlucoseMgDl <= 0) {
    throw new Error('fastingGlucoseMgDl must be positive')
  }
  const value = (fastingInsulinUIUmL * fastingGlucoseMgDl) / 405
  let category: HOMAIRCategory
  if (value >= 3.0) category = 'severe_resistance'
  else if (value >= 2.0) category = 'significant_resistance'
  else if (value >= 1.0) category = 'early_resistance'
  else category = 'sensitive'
  return { value: round2(value), category }
}

// ─── Helpers ────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
