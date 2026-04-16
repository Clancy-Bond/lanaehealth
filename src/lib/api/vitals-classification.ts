/**
 * Vitals Classification System
 *
 * AHA blood pressure categories, heart rate zones,
 * and multi-vital outlier detection.
 */

export type BPCategory = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis'

export interface BPClassification {
  category: BPCategory
  label: string
  color: string
  description: string
}

/**
 * Classify blood pressure per 2025 AHA/ACC guidelines.
 */
export function classifyBP(systolic: number, diastolic: number): BPClassification {
  if (systolic > 180 || diastolic > 120) {
    return {
      category: 'crisis',
      label: 'Hypertensive Crisis',
      color: '#B71C1C',
      description: 'Seek immediate medical attention',
    }
  }
  if (systolic >= 140 || diastolic >= 90) {
    return {
      category: 'stage2',
      label: 'Stage 2 Hypertension',
      color: '#C62828',
      description: 'Likely needs medication + lifestyle changes',
    }
  }
  if (systolic >= 130 || diastolic >= 80) {
    return {
      category: 'stage1',
      label: 'Stage 1 Hypertension',
      color: '#E65100',
      description: 'Lifestyle changes recommended, medication may be needed',
    }
  }
  if (systolic >= 120 && diastolic < 80) {
    return {
      category: 'elevated',
      label: 'Elevated',
      color: '#F57F17',
      description: 'Risk of developing high blood pressure',
    }
  }
  return {
    category: 'normal',
    label: 'Normal',
    color: 'var(--accent-sage)',
    description: 'Healthy blood pressure',
  }
}

/**
 * Classify heart rate for a resting measurement.
 */
export function classifyRestingHR(bpm: number): {
  label: string
  color: string
  zone: 'bradycardia' | 'athletic' | 'normal' | 'elevated' | 'tachycardia'
} {
  if (bpm < 50) return { label: 'Bradycardia', color: '#1565C0', zone: 'bradycardia' }
  if (bpm < 60) return { label: 'Athletic', color: 'var(--accent-sage)', zone: 'athletic' }
  if (bpm <= 100) return { label: 'Normal', color: 'var(--accent-sage)', zone: 'normal' }
  if (bpm <= 120) return { label: 'Elevated', color: '#F57F17', zone: 'elevated' }
  return { label: 'Tachycardia', color: '#C62828', zone: 'tachycardia' }
}

/**
 * Classify orthostatic HR change for POTS assessment.
 */
export function classifyOrthostatic(delta: number): {
  label: string
  color: string
  meetsPOTS: boolean
} {
  if (delta >= 40) return { label: 'Significant (40+ bpm)', color: '#B71C1C', meetsPOTS: true }
  if (delta >= 30) return { label: 'POTS Threshold (30+ bpm)', color: '#C62828', meetsPOTS: true }
  if (delta >= 20) return { label: 'Elevated (20-29 bpm)', color: '#E65100', meetsPOTS: false }
  if (delta >= 10) return { label: 'Mild (10-19 bpm)', color: '#F57F17', meetsPOTS: false }
  return { label: 'Normal (<10 bpm)', color: 'var(--accent-sage)', meetsPOTS: false }
}

/**
 * Multi-vital outlier detection (Apple Health Vitals-style).
 * When 2+ metrics deviate from personal baseline, something may be off.
 */
export function detectMultiVitalOutlier(current: {
  hr?: number | null
  hrv?: number | null
  temp?: number | null
  spo2?: number | null
  respiratoryRate?: number | null
}, baselines: {
  hr?: { mean: number; std: number }
  hrv?: { mean: number; std: number }
  temp?: { mean: number; std: number }
  spo2?: { mean: number; std: number }
  respiratoryRate?: { mean: number; std: number }
}): {
  isOutlier: boolean
  deviatingMetrics: string[]
  severity: 'none' | 'mild' | 'moderate' | 'significant'
} {
  const deviating: string[] = []

  function check(name: string, value: number | null | undefined, baseline?: { mean: number; std: number }) {
    if (value === null || value === undefined || !baseline) return
    const zScore = Math.abs((value - baseline.mean) / (baseline.std || 1))
    if (zScore > 2) deviating.push(name)
  }

  check('Heart Rate', current.hr, baselines.hr)
  check('HRV', current.hrv, baselines.hrv)
  check('Temperature', current.temp, baselines.temp)
  check('SpO2', current.spo2, baselines.spo2)
  check('Respiratory Rate', current.respiratoryRate, baselines.respiratoryRate)

  const count = deviating.length
  let severity: 'none' | 'mild' | 'moderate' | 'significant' = 'none'
  if (count >= 3) severity = 'significant'
  else if (count >= 2) severity = 'moderate'
  else if (count >= 1) severity = 'mild'

  return {
    isOutlier: count >= 2,
    deviatingMetrics: deviating,
    severity,
  }
}
