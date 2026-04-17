/**
 * Tests for signal-fusion.ts -- the multi-signal extension layered over
 * NC's BBT algorithm. References: Goodale 2019 (DOI 10.2196/13404),
 * Shilaih 2017 (DOI 10.1038/s41598-017-01433-9).
 */
import { describe, it, expect } from 'vitest'
import {
  fuseSignals,
  isHrvLutealPattern,
  isRhrLutealRise,
  WEIGHT_BBT_SHIFT,
  WEIGHT_LH_SURGE,
  WEIGHT_HRV,
  WEIGHT_RHR,
  RHR_LUTEAL_RISE_BPM,
  MIN_MULTI_SIGNAL_CONFIDENCE,
} from '../../intelligence/cycle-engine/signal-fusion'

describe('weight constants sum to 1.00', () => {
  it('total weight is 1.00 (BBT 0.5 + LH 0.25 + HRV 0.15 + RHR 0.10)', () => {
    const total = WEIGHT_BBT_SHIFT + WEIGHT_LH_SURGE + WEIGHT_HRV + WEIGHT_RHR
    expect(total).toBeCloseTo(1.0, 5)
  })
})

describe('fuseSignals', () => {
  it('returns full confidence (1.0) when all four signals agree', () => {
    const result = fuseSignals({
      bbtShiftConfirmed: true,
      lhSurgeDetected: true,
      follicularHrvMean: 40,
      lutealHrvMean: 45,
      follicularRhrMean: 55,
      lutealRhrMean: 60,
    })
    expect(result.confidence).toBeCloseTo(1.0, 3)
    expect(result.signalsUsed).toEqual(['bbt_shift', 'lh_surge', 'hrv', 'rhr'])
    expect(result.multiSignalOvulatory).toBe(true)
  })

  it('returns BBT-only weight when only BBT confirms', () => {
    const result = fuseSignals({
      bbtShiftConfirmed: true,
      lhSurgeDetected: false,
      follicularHrvMean: null,
      lutealHrvMean: null,
      follicularRhrMean: null,
      lutealRhrMean: null,
    })
    expect(result.confidence).toBe(WEIGHT_BBT_SHIFT)
    expect(result.signalsUsed).toEqual(['bbt_shift'])
    expect(result.multiSignalOvulatory).toBe(true)
  })

  it('marks cycle as ovulatory when BBT fails but LH + HRV + RHR pass (multi-signal path)', () => {
    const result = fuseSignals({
      bbtShiftConfirmed: false,
      lhSurgeDetected: true,
      follicularHrvMean: 40,
      lutealHrvMean: 45,
      follicularRhrMean: 55,
      lutealRhrMean: 60,
    })
    // 0.25 + 0.15 + 0.10 = 0.50
    expect(result.confidence).toBeCloseTo(0.5, 3)
    expect(result.multiSignalOvulatory).toBe(true)
  })

  it('does not flag ovulatory when only low-weight signals are present', () => {
    const result = fuseSignals({
      bbtShiftConfirmed: false,
      lhSurgeDetected: false,
      follicularHrvMean: 40,
      lutealHrvMean: 42, // passes HRV criterion
      follicularRhrMean: null,
      lutealRhrMean: null,
    })
    // HRV alone = 0.15, below MIN_MULTI_SIGNAL_CONFIDENCE (0.35)
    expect(result.confidence).toBe(WEIGHT_HRV)
    expect(result.multiSignalOvulatory).toBe(false)
  })

  it('populates breakdown entries for all four signals regardless of contribution', () => {
    const result = fuseSignals({
      bbtShiftConfirmed: false,
      lhSurgeDetected: false,
      follicularHrvMean: null,
      lutealHrvMean: null,
      follicularRhrMean: null,
      lutealRhrMean: null,
    })
    expect(result.breakdown).toHaveLength(4)
    const keys = result.breakdown.map((b) => b.key)
    expect(keys).toEqual(['bbt_shift', 'lh_surge', 'hrv', 'rhr'])
    for (const entry of result.breakdown) {
      expect(entry.detail.length).toBeGreaterThan(0)
    }
  })

  it('confidence floor is 0.00 when no signals fire', () => {
    const result = fuseSignals({
      bbtShiftConfirmed: false,
      lhSurgeDetected: false,
      follicularHrvMean: null,
      lutealHrvMean: null,
      follicularRhrMean: null,
      lutealRhrMean: null,
    })
    expect(result.confidence).toBe(0)
    expect(result.signalsUsed).toEqual([])
    expect(result.multiSignalOvulatory).toBe(false)
  })

  it('MIN_MULTI_SIGNAL_CONFIDENCE is strict enough to reject single-signal false positives', () => {
    expect(MIN_MULTI_SIGNAL_CONFIDENCE).toBeGreaterThan(WEIGHT_HRV)
    expect(MIN_MULTI_SIGNAL_CONFIDENCE).toBeGreaterThan(WEIGHT_RHR)
    expect(MIN_MULTI_SIGNAL_CONFIDENCE).toBeLessThan(WEIGHT_LH_SURGE + WEIGHT_HRV + WEIGHT_RHR)
  })
})

describe('isHrvLutealPattern (Goodale 2019)', () => {
  it('returns true when luteal HRV >= follicular HRV', () => {
    expect(
      isHrvLutealPattern({
        bbtShiftConfirmed: false,
        lhSurgeDetected: false,
        follicularHrvMean: 40,
        lutealHrvMean: 45,
        follicularRhrMean: null,
        lutealRhrMean: null,
      })
    ).toBe(true)
  })

  it('returns false when either window is missing', () => {
    expect(
      isHrvLutealPattern({
        bbtShiftConfirmed: false,
        lhSurgeDetected: false,
        follicularHrvMean: null,
        lutealHrvMean: 45,
        follicularRhrMean: null,
        lutealRhrMean: null,
      })
    ).toBe(false)
  })

  it('returns false when luteal HRV is below follicular HRV', () => {
    expect(
      isHrvLutealPattern({
        bbtShiftConfirmed: false,
        lhSurgeDetected: false,
        follicularHrvMean: 50,
        lutealHrvMean: 40,
        follicularRhrMean: null,
        lutealRhrMean: null,
      })
    ).toBe(false)
  })
})

describe('isRhrLutealRise (Shilaih 2017)', () => {
  it('returns true when luteal RHR exceeds follicular by >=3 bpm', () => {
    expect(
      isRhrLutealRise({
        bbtShiftConfirmed: false,
        lhSurgeDetected: false,
        follicularHrvMean: null,
        lutealHrvMean: null,
        follicularRhrMean: 55,
        lutealRhrMean: 58,
      })
    ).toBe(true)
  })

  it('returns false when the rise is below RHR_LUTEAL_RISE_BPM', () => {
    expect(
      isRhrLutealRise({
        bbtShiftConfirmed: false,
        lhSurgeDetected: false,
        follicularHrvMean: null,
        lutealHrvMean: null,
        follicularRhrMean: 55,
        lutealRhrMean: 57,
      })
    ).toBe(false)
  })

  it('requires both windows to have data', () => {
    expect(
      isRhrLutealRise({
        bbtShiftConfirmed: false,
        lhSurgeDetected: false,
        follicularHrvMean: null,
        lutealHrvMean: null,
        follicularRhrMean: null,
        lutealRhrMean: 60,
      })
    ).toBe(false)
    expect(RHR_LUTEAL_RISE_BPM).toBe(3)
  })
})
