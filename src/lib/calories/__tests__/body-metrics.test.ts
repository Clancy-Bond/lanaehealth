/**
 * Body-metrics computation tests.
 *
 * Reference values cross-checked against the published sources cited
 * in `docs/research/comprehensive-body-metrics.md`:
 *   - WHO BMI categories
 *   - US Navy body-fat formula (Hodgdon and Beckett 1984)
 *   - WHO 2008 waist + WHR cutoffs
 *   - Ashwell and Hsieh 2005 WHtR bands
 *   - Mifflin-St Jeor 1990
 *   - ADA 2024 glucose / HbA1c
 *   - Matthews et al. 1985 HOMA-IR
 *   - 2017 ACC/AHA BP categories
 *   - WHO 1994 BMD T-score
 */

import { describe, expect, it } from 'vitest'
import {
  bmdCategory,
  bodyFatCategory,
  bpCategory,
  calculateBMI,
  calculateBMR,
  calculateBodyFatNavy,
  calculateFatMass,
  calculateHOMAIR,
  calculateLBM,
  calculateMAP,
  calculatePulsePressure,
  calculateRMR,
  calculateTDEE,
  calculateWHR,
  calculateWHtR,
  fastingGlucoseCategory,
  hba1cCategory,
  waistRiskBand,
} from '../body-metrics'

describe('calculateBMI', () => {
  it('classifies a normal-weight reference subject (70 kg, 175 cm)', () => {
    const r = calculateBMI(70, 175)
    expect(r.bmi).toBe(22.9)
    expect(r.category).toBe('Normal')
  })

  it('classifies underweight (<18.5)', () => {
    const r = calculateBMI(45, 170)
    expect(r.category).toBe('Underweight')
  })

  it('classifies overweight (25-29.9)', () => {
    const r = calculateBMI(80, 175)
    expect(r.category).toBe('Overweight')
  })

  it('classifies obese class I (30-34.9)', () => {
    const r = calculateBMI(95, 175)
    expect(r.category).toBe('Obese class I')
  })

  it('classifies obese class II (35-39.9)', () => {
    const r = calculateBMI(110, 175)
    expect(r.category).toBe('Obese class II')
  })

  it('classifies obese class III (>=40)', () => {
    const r = calculateBMI(125, 175)
    expect(r.category).toBe('Obese class III')
  })

  it('respects threshold boundary at 18.5 (normal, not underweight)', () => {
    // 18.5 -> normal per WHO inclusive lower bound on Normal
    const heightM = 1.7
    const weight = 18.5 * heightM * heightM
    const r = calculateBMI(weight, 170)
    expect(r.category).toBe('Normal')
  })

  it('throws on bad inputs', () => {
    expect(() => calculateBMI(0, 170)).toThrow()
    expect(() => calculateBMI(70, 0)).toThrow()
    expect(() => calculateBMI(NaN, 170)).toThrow()
  })
})

describe('calculateBodyFatNavy', () => {
  it('computes a known female result matching Navy formula reference', () => {
    // 165cm, neck 32, waist 75, hip 95.
    // 163.205*log10(75+95-32) - 97.684*log10(165) - 78.387
    // = 163.205*log10(138) - 97.684*log10(165) - 78.387
    // = 349.1 - 216.6 - 78.4 = 54.1
    // (Round to nearest 0.1.)
    const pct = calculateBodyFatNavy({
      sex: 'female',
      heightCm: 165,
      neckCm: 32,
      waistCm: 75,
      hipCm: 95,
    })
    expect(pct).toBeCloseTo(54.1, 0)
  })

  it('computes a fit female reference (lower body fat band)', () => {
    // 170cm, neck 30, waist 65, hip 90: tighter waist
    // 163.205*log10(125) - 97.684*log10(170) - 78.387
    // = 342.0 - 218.4 - 78.4 = ~45
    const pct = calculateBodyFatNavy({
      sex: 'female',
      heightCm: 170,
      neckCm: 30,
      waistCm: 65,
      hipCm: 90,
    })
    expect(pct).toBeLessThan(50)
    expect(pct).toBeGreaterThan(35)
  })

  it('computes a known male result', () => {
    // 180cm, neck 38, waist 85.
    // 86.010*log10(85-38) - 70.041*log10(180) + 36.76
    // = 86.010*log10(47) - 70.041*log10(180) + 36.76
    // = 144.0 - 158.0 + 36.76 = ~22.7
    const pct = calculateBodyFatNavy({
      sex: 'male',
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
    })
    expect(pct).toBeGreaterThan(15)
    expect(pct).toBeLessThan(30)
  })

  it('throws when waist + hip - neck not positive (women)', () => {
    expect(() =>
      calculateBodyFatNavy({
        sex: 'female',
        heightCm: 165,
        neckCm: 200,
        waistCm: 50,
        hipCm: 50,
      }),
    ).toThrow()
  })

  it('throws when hip is missing for women', () => {
    expect(() =>
      calculateBodyFatNavy({
        sex: 'female',
        heightCm: 165,
        neckCm: 32,
        waistCm: 75,
      }),
    ).toThrow()
  })
})

describe('bodyFatCategory', () => {
  it('classifies a fit female (22%)', () => {
    expect(bodyFatCategory(22, 'female')).toBe('Fitness')
  })

  it('classifies a fit male (12%)', () => {
    expect(bodyFatCategory(12, 'male')).toBe('Athletes')
  })

  it('classifies above acceptable for female 35%', () => {
    expect(bodyFatCategory(35, 'female')).toBe('Above acceptable')
  })

  it('classifies above acceptable for male 30%', () => {
    expect(bodyFatCategory(30, 'male')).toBe('Above acceptable')
  })
})

describe('calculateLBM and calculateFatMass', () => {
  it('computes lean body mass', () => {
    expect(calculateLBM(80, 25)).toBe(60)
  })

  it('computes fat mass', () => {
    expect(calculateFatMass(80, 25)).toBe(20)
  })

  it('rejects body fat >= 100', () => {
    expect(() => calculateLBM(80, 100)).toThrow()
  })
})

describe('waistRiskBand', () => {
  it('classifies female low (<80)', () => {
    expect(waistRiskBand(75, 'female')).toBe('low')
  })

  it('classifies female increased (80-87)', () => {
    expect(waistRiskBand(82, 'female')).toBe('increased')
  })

  it('classifies female substantially increased (>=88)', () => {
    expect(waistRiskBand(90, 'female')).toBe('substantially_increased')
  })

  it('classifies male substantially increased (>=102)', () => {
    expect(waistRiskBand(105, 'male')).toBe('substantially_increased')
  })
})

describe('calculateWHR', () => {
  it('computes ratio + low risk for female 0.75', () => {
    const r = calculateWHR(75, 100, 'female')
    expect(r.ratio).toBe(0.75)
    expect(r.risk).toBe('low')
  })

  it('flags high risk for female >0.85', () => {
    const r = calculateWHR(86, 100, 'female')
    expect(r.risk).toBe('high')
  })

  it('flags moderate for female 0.81-0.85', () => {
    const r = calculateWHR(83, 100, 'female')
    expect(r.risk).toBe('moderate')
  })

  it('flags high for male >0.90', () => {
    const r = calculateWHR(95, 100, 'male')
    expect(r.risk).toBe('high')
  })
})

describe('calculateWHtR', () => {
  it('healthy band at ratio 0.45', () => {
    const r = calculateWHtR(76.5, 170)
    expect(r.ratio).toBe(0.45)
    expect(r.category).toBe('healthy')
  })

  it('increased risk at ratio 0.50-0.59', () => {
    const r = calculateWHtR(90, 170)
    expect(r.category).toBe('increased_risk')
  })

  it('substantially increased at ratio >=0.60', () => {
    const r = calculateWHtR(110, 170)
    expect(r.category).toBe('substantially_increased_risk')
  })

  it('underweight band at <0.40', () => {
    const r = calculateWHtR(60, 170)
    expect(r.category).toBe('underweight')
  })
})

describe('bmdCategory', () => {
  it('normal at T >= -1.0', () => {
    expect(bmdCategory(-0.5)).toBe('normal')
  })
  it('osteopenia between -2.5 and -1.0', () => {
    expect(bmdCategory(-2.0)).toBe('osteopenia')
  })
  it('osteoporosis at T <= -2.5', () => {
    expect(bmdCategory(-2.5)).toBe('osteoporosis')
    expect(bmdCategory(-3.0)).toBe('osteoporosis')
  })
})

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('computes female reference (60kg, 165cm, 30y) -> 1320 kcal', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    const bmr = calculateBMR({
      sex: 'female',
      weightKg: 60,
      heightCm: 165,
      ageYears: 30,
    })
    expect(bmr).toBe(1320)
  })

  it('computes male reference (80kg, 180cm, 30y) -> 1780 kcal', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const bmr = calculateBMR({
      sex: 'male',
      weightKg: 80,
      heightCm: 180,
      ageYears: 30,
    })
    expect(bmr).toBe(1780)
  })

  it('RMR matches BMR (we treat as identical for non-medical use)', () => {
    const inputs = {
      sex: 'female' as const,
      weightKg: 60,
      heightCm: 165,
      ageYears: 30,
    }
    expect(calculateRMR(inputs)).toBe(calculateBMR(inputs))
  })
})

describe('calculateTDEE', () => {
  it('applies sedentary 1.2 factor', () => {
    expect(calculateTDEE(1500, 'sedentary')).toBe(1800)
  })

  it('applies very_active 1.725 factor', () => {
    expect(calculateTDEE(1500, 'very_active')).toBe(Math.round(1500 * 1.725))
  })
})

describe('calculateMAP and calculatePulsePressure', () => {
  it('MAP for 120/80 = 93', () => {
    expect(calculateMAP(120, 80)).toBe(93)
  })

  it('Pulse pressure for 120/80 = 40', () => {
    expect(calculatePulsePressure(120, 80)).toBe(40)
  })

  it('MAP rejects systolic < diastolic', () => {
    expect(() => calculateMAP(80, 120)).toThrow()
  })
})

describe('bpCategory', () => {
  it('normal 110/70', () => {
    expect(bpCategory(110, 70)).toBe('normal')
  })
  it('elevated 125/75', () => {
    expect(bpCategory(125, 75)).toBe('elevated')
  })
  it('stage 1 hypertension 135/85', () => {
    expect(bpCategory(135, 85)).toBe('stage1_hypertension')
  })
  it('stage 2 hypertension 145/95', () => {
    expect(bpCategory(145, 95)).toBe('stage2_hypertension')
  })
  it('hypertensive crisis 185/125', () => {
    expect(bpCategory(185, 125)).toBe('hypertensive_crisis')
  })
})

describe('fastingGlucoseCategory', () => {
  it('normal at 90 mg/dL', () => {
    expect(fastingGlucoseCategory(90)).toBe('normal')
  })
  it('prediabetes at 110 mg/dL', () => {
    expect(fastingGlucoseCategory(110)).toBe('prediabetes')
  })
  it('diabetes at 130 mg/dL', () => {
    expect(fastingGlucoseCategory(130)).toBe('diabetes')
  })
})

describe('hba1cCategory', () => {
  it('normal at 5.0%', () => {
    expect(hba1cCategory(5.0)).toBe('normal')
  })
  it('prediabetes at 6.0%', () => {
    expect(hba1cCategory(6.0)).toBe('prediabetes')
  })
  it('diabetes at 7.0%', () => {
    expect(hba1cCategory(7.0)).toBe('diabetes')
  })
})

describe('calculateHOMAIR', () => {
  it('sensitive at insulin 5, glucose 80 -> 0.99', () => {
    const r = calculateHOMAIR(5, 80)
    expect(r.value).toBeCloseTo(0.99, 1)
    expect(r.category).toBe('sensitive')
  })

  it('early resistance at insulin 7, glucose 95', () => {
    const r = calculateHOMAIR(7, 95)
    expect(r.category).toBe('early_resistance')
  })

  it('significant resistance at insulin 12, glucose 90', () => {
    const r = calculateHOMAIR(12, 90)
    expect(r.value).toBeCloseTo(2.67, 1)
    expect(r.category).toBe('significant_resistance')
  })

  it('severe resistance at insulin 20, glucose 100', () => {
    const r = calculateHOMAIR(20, 100)
    expect(r.value).toBeCloseTo(4.94, 1)
    expect(r.category).toBe('severe_resistance')
  })
})
