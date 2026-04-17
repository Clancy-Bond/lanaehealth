/**
 * Tests for cover-line.ts -- Natural Cycles cover-line + biphasic shift.
 *
 * References: Scherwitzl 2015 (PMID 25592280), Scherwitzl 2017 (PMC5669828),
 * FDA DEN170052.
 */
import { describe, it, expect } from 'vitest'
import {
  computeCoverLine,
  detectBiphasicShift,
  subtractDaysRounded,
  COVER_LINE_MIN_OFFSET_C,
  COVER_LINE_MAX_OFFSET_C,
  SUSTAINED_ELEVATED_DAYS,
  LH_TO_BBT_DELAY_DAYS,
  TARGET_BASELINE_READINGS,
  type TempReading,
} from '../../intelligence/cycle-engine/cover-line'

function mkRead(
  date: string,
  temperature: number | null,
  excluded = false
): TempReading {
  return { date, temperature, excluded, excludedReason: excluded ? 'test' : undefined }
}

describe('computeCoverLine', () => {
  it('returns null when fewer than 3 valid readings exist', () => {
    const reads: TempReading[] = [
      mkRead('2026-03-01', 36.3),
      mkRead('2026-03-02', null),
    ]
    expect(computeCoverLine(reads)).toBeNull()
  })

  it('computes baseline from the first N usable reads (default target = 5)', () => {
    const reads: TempReading[] = [
      mkRead('2026-03-01', 36.2),
      mkRead('2026-03-02', 36.25),
      mkRead('2026-03-03', 36.3),
      mkRead('2026-03-04', 36.22),
      mkRead('2026-03-05', 36.28),
      mkRead('2026-03-06', 36.55), // outside the baseline window
    ]
    const result = computeCoverLine(reads)
    expect(result).not.toBeNull()
    expect(result!.baselineDaysUsed).toBe(TARGET_BASELINE_READINGS)
    // mean of first 5: 36.250
    expect(result!.baselineMeanC).toBeCloseTo(36.25, 2)
    // max of first 5: 36.30
    expect(result!.baselineMaxC).toBeCloseTo(36.3, 2)
    // cover line = max + min offset (0.05)
    expect(result!.coverLineC).toBeCloseTo(36.35, 2)
  })

  it('skips excluded and null readings when building the baseline', () => {
    const reads: TempReading[] = [
      mkRead('2026-03-01', 36.2),
      mkRead('2026-03-02', null),
      mkRead('2026-03-03', 36.3, true), // excluded
      mkRead('2026-03-04', 36.22),
      mkRead('2026-03-05', 36.28),
      mkRead('2026-03-06', 36.24),
      mkRead('2026-03-07', 36.25),
    ]
    const result = computeCoverLine(reads)
    expect(result).not.toBeNull()
    // Should pull from dates Mar 1, 4, 5, 6, 7 (skipping null + excluded)
    expect(result!.baselineDaysUsed).toBe(5)
    expect(result!.baselineMaxC).toBeCloseTo(36.28, 2)
  })

  it('clamps the offset between 0.05 and 0.10 C per Scherwitzl 2015', () => {
    const reads: TempReading[] = [
      mkRead('2026-03-01', 36.3),
      mkRead('2026-03-02', 36.3),
      mkRead('2026-03-03', 36.3),
      mkRead('2026-03-04', 36.3),
    ]
    const low = computeCoverLine(reads, 0.01)
    expect(low!.offsetUsedC).toBe(COVER_LINE_MIN_OFFSET_C)

    const high = computeCoverLine(reads, 0.5)
    expect(high!.offsetUsedC).toBe(COVER_LINE_MAX_OFFSET_C)

    const mid = computeCoverLine(reads, 0.07)
    expect(mid!.offsetUsedC).toBe(0.07)
  })
})

describe('detectBiphasicShift', () => {
  it('confirms a shift when three consecutive reads exceed the cover line', () => {
    const reads: TempReading[] = [
      mkRead('2026-03-01', 36.2),
      mkRead('2026-03-02', 36.25),
      mkRead('2026-03-03', 36.3),
      mkRead('2026-03-04', 36.22),
      mkRead('2026-03-05', 36.28),
      // Shift begins day 6
      mkRead('2026-03-06', 36.5),
      mkRead('2026-03-07', 36.55),
      mkRead('2026-03-08', 36.52),
    ]
    const cover = computeCoverLine(reads)!
    const shift = detectBiphasicShift(reads, cover)
    expect(shift.confirmed).toBe(true)
    expect(shift.firstElevatedDate).toBe('2026-03-06')
    expect(shift.elevatedRun).toBeGreaterThanOrEqual(SUSTAINED_ELEVATED_DAYS)
    // Empirical LH-to-BBT delay is 1.9 days (Scherwitzl 2015).
    // We round, so ovulation = Mar 6 - 2 = Mar 4.
    expect(shift.estimatedOvulationDate).toBe('2026-03-04')
  })

  it('does not confirm when only two consecutive reads are elevated', () => {
    const reads: TempReading[] = [
      mkRead('2026-03-01', 36.2),
      mkRead('2026-03-02', 36.25),
      mkRead('2026-03-03', 36.3),
      mkRead('2026-03-04', 36.22),
      mkRead('2026-03-05', 36.28),
      mkRead('2026-03-06', 36.5),
      mkRead('2026-03-07', 36.55),
      mkRead('2026-03-08', 36.3), // breaks the streak
      mkRead('2026-03-09', 36.5),
    ]
    const cover = computeCoverLine(reads)!
    const shift = detectBiphasicShift(reads, cover)
    expect(shift.confirmed).toBe(false)
  })

  it('treats excluded readings as non-elevated (streak breaks on exclusion)', () => {
    const reads: TempReading[] = [
      mkRead('2026-03-01', 36.2),
      mkRead('2026-03-02', 36.25),
      mkRead('2026-03-03', 36.3),
      mkRead('2026-03-04', 36.22),
      mkRead('2026-03-05', 36.28),
      mkRead('2026-03-06', 36.5),
      mkRead('2026-03-07', 36.55, true), // excluded (fever etc.)
      mkRead('2026-03-08', 36.55),
    ]
    const cover = computeCoverLine(reads)!
    const shift = detectBiphasicShift(reads, cover)
    expect(shift.confirmed).toBe(false)
  })

  it('handles all-baseline cycle (no shift) gracefully', () => {
    const reads: TempReading[] = []
    for (let i = 1; i <= 28; i++) {
      const day = i.toString().padStart(2, '0')
      reads.push(mkRead(`2026-03-${day}`, 36.3))
    }
    const cover = computeCoverLine(reads)!
    const shift = detectBiphasicShift(reads, cover)
    expect(shift.confirmed).toBe(false)
    expect(shift.firstElevatedDate).toBeNull()
    expect(shift.estimatedOvulationDate).toBeNull()
  })
})

describe('subtractDaysRounded', () => {
  it('rounds the 1.9 day delay to 2 days per Scherwitzl 2015 empirical mean', () => {
    expect(subtractDaysRounded('2026-03-15', LH_TO_BBT_DELAY_DAYS)).toBe('2026-03-13')
  })

  it('handles month boundaries', () => {
    expect(subtractDaysRounded('2026-03-01', 2)).toBe('2026-02-27')
  })
})
