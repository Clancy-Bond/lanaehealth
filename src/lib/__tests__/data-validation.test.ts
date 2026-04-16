// ---------------------------------------------------------------------------
// Data Validation Layer -- tests
// ---------------------------------------------------------------------------

import {
  validateHeartRate,
  validateHRV,
  validatePainScore,
  validateSpO2,
  detectSuddenJump,
  computeCompleteness,
} from '@/lib/intelligence/data-validation'

// ===========================================================================
// validateHeartRate
// ===========================================================================

describe('validateHeartRate', () => {
  it('accepts a normal heart rate', () => {
    const result = validateHeartRate(72)
    expect(result.valid).toBe(true)
    expect(result.flag).toBeUndefined()
  })

  it('flags too-low heart rate as out_of_range', () => {
    const result = validateHeartRate(20)
    expect(result.valid).toBe(false)
    expect(result.flag).toBeDefined()
    expect(result.flag!.flag_type).toBe('out_of_range')
    expect(result.flag!.severity).toBe('warning')
  })

  it('flags too-high heart rate as out_of_range', () => {
    const result = validateHeartRate(250)
    expect(result.valid).toBe(false)
    expect(result.flag).toBeDefined()
    expect(result.flag!.flag_type).toBe('out_of_range')
    expect(result.flag!.severity).toBe('warning')
  })

  it('flags zero heart rate as impossible_value', () => {
    const result = validateHeartRate(0)
    expect(result.valid).toBe(false)
    expect(result.flag).toBeDefined()
    expect(result.flag!.flag_type).toBe('impossible_value')
    expect(result.flag!.severity).toBe('error')
  })
})

// ===========================================================================
// validateHRV
// ===========================================================================

describe('validateHRV', () => {
  it('accepts a normal HRV', () => {
    const result = validateHRV(50)
    expect(result.valid).toBe(true)
    expect(result.flag).toBeUndefined()
  })

  it('flags zero HRV as impossible_value', () => {
    const result = validateHRV(0)
    expect(result.valid).toBe(false)
    expect(result.flag).toBeDefined()
    expect(result.flag!.flag_type).toBe('impossible_value')
    expect(result.flag!.severity).toBe('error')
  })
})

// ===========================================================================
// validatePainScore
// ===========================================================================

describe('validatePainScore', () => {
  it('accepts a valid pain score', () => {
    const result = validatePainScore(5)
    expect(result.valid).toBe(true)
    expect(result.flag).toBeUndefined()
  })

  it('flags negative pain score as out_of_range', () => {
    const result = validatePainScore(-1)
    expect(result.valid).toBe(false)
    expect(result.flag).toBeDefined()
    expect(result.flag!.flag_type).toBe('out_of_range')
    expect(result.flag!.severity).toBe('warning')
  })

  it('flags pain score over 10 as out_of_range', () => {
    const result = validatePainScore(11)
    expect(result.valid).toBe(false)
    expect(result.flag).toBeDefined()
    expect(result.flag!.flag_type).toBe('out_of_range')
    expect(result.flag!.severity).toBe('warning')
  })
})

// ===========================================================================
// validateSpO2
// ===========================================================================

describe('validateSpO2', () => {
  it('accepts a normal SpO2', () => {
    const result = validateSpO2(98)
    expect(result.valid).toBe(true)
    expect(result.flag).toBeUndefined()
  })

  it('flags too-low SpO2 as out_of_range', () => {
    const result = validateSpO2(75)
    expect(result.valid).toBe(false)
    expect(result.flag).toBeDefined()
    expect(result.flag!.flag_type).toBe('out_of_range')
    expect(result.flag!.severity).toBe('warning')
  })
})

// ===========================================================================
// detectSuddenJump
// ===========================================================================

describe('detectSuddenJump', () => {
  it('detects a sudden jump', () => {
    const result = detectSuddenJump([50, 52, 48, 51, 50, 120], 3)
    expect(result.isJump).toBe(true)
    expect(result.standardDeviations).toBeDefined()
    expect(result.standardDeviations!).toBeGreaterThan(3)
  })

  it('does not false-positive on gradual increase', () => {
    const result = detectSuddenJump([50, 52, 55, 58, 61, 65], 3)
    expect(result.isJump).toBe(false)
  })

  it('handles fewer than 3 values', () => {
    const result = detectSuddenJump([50, 120])
    expect(result.isJump).toBe(false)
    expect(result.standardDeviations).toBeUndefined()
  })
})

// ===========================================================================
// computeCompleteness
// ===========================================================================

describe('computeCompleteness', () => {
  it('returns 100% for full data', () => {
    expect(computeCompleteness(30, 30)).toBe(100)
  })

  it('returns 50% for half data', () => {
    expect(computeCompleteness(15, 30)).toBe(50)
  })

  it('returns 0% for no data', () => {
    expect(computeCompleteness(0, 30)).toBe(0)
  })
})
