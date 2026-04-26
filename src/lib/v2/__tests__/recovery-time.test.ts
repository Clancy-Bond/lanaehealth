import { describe, expect, it } from 'vitest'
import { computeRecoveryTime } from '@/lib/v2/recovery-time'

describe('computeRecoveryTime', () => {
  it('returns zeros and flat trajectory for empty input', () => {
    const result = computeRecoveryTime({ readinessScores: [], baselineScore: 75 })
    expect(result).toEqual({
      lastDip: 0,
      daysToRecovery: 0,
      currentTrajectory: 'flat',
    })
  })

  it('treats all-null scores as no readings', () => {
    const result = computeRecoveryTime({
      readinessScores: [
        { date: '2026-04-20', score: null },
        { date: '2026-04-21', score: null },
        { date: '2026-04-22', score: null },
      ],
      baselineScore: 75,
    })
    expect(result.lastDip).toBe(0)
    expect(result.daysToRecovery).toBe(0)
    expect(result.currentTrajectory).toBe('flat')
  })

  it('reports recovered when no reading dips below baseline', () => {
    const result = computeRecoveryTime({
      readinessScores: [
        { date: '2026-04-20', score: 78 },
        { date: '2026-04-21', score: 80 },
        { date: '2026-04-22', score: 82 },
      ],
      baselineScore: 75,
    })
    expect(result.lastDip).toBe(0)
    expect(result.daysToRecovery).toBe(0)
    expect(result.currentTrajectory).toBe('recovered')
  })

  it('counts days from dip to first return to baseline', () => {
    const result = computeRecoveryTime({
      readinessScores: [
        { date: '2026-04-18', score: 80 },
        { date: '2026-04-19', score: 55 }, // dip on day 1 (index 1)
        { date: '2026-04-20', score: 60 },
        { date: '2026-04-21', score: 70 },
        { date: '2026-04-22', score: 76 }, // back at baseline on day 4 (index 4), 3 days after dip
      ],
      baselineScore: 75,
    })
    expect(result.lastDip).toBe(55)
    expect(result.daysToRecovery).toBe(3)
    expect(result.currentTrajectory).toBe('recovered')
  })

  it('reports recovering when latest reading is below baseline but rising', () => {
    const result = computeRecoveryTime({
      readinessScores: [
        { date: '2026-04-17', score: 80 },
        { date: '2026-04-18', score: 50 }, // dip
        { date: '2026-04-19', score: 55 },
        { date: '2026-04-20', score: 60 },
        { date: '2026-04-21', score: 65 },
        { date: '2026-04-22', score: 70 },
        { date: '2026-04-23', score: 72 },
      ],
      baselineScore: 75,
    })
    expect(result.lastDip).toBe(50)
    expect(result.daysToRecovery).toBe(0) // not yet hit baseline
    expect(result.currentTrajectory).toBe('recovering')
  })

  it('reports flat when stuck below baseline with no upward slope', () => {
    const result = computeRecoveryTime({
      readinessScores: [
        { date: '2026-04-17', score: 80 },
        { date: '2026-04-18', score: 50 },
        { date: '2026-04-19', score: 50 },
        { date: '2026-04-20', score: 51 },
        { date: '2026-04-21', score: 50 },
        { date: '2026-04-22', score: 49 },
        { date: '2026-04-23', score: 50 },
      ],
      baselineScore: 75,
    })
    expect(result.lastDip).toBe(49)
    expect(result.daysToRecovery).toBe(0)
    expect(result.currentTrajectory).toBe('flat')
  })

  it('counts calendar days through gaps in nightly data', () => {
    // Simulates two missing nights between the dip and recovery.
    const result = computeRecoveryTime({
      readinessScores: [
        { date: '2026-04-15', score: 80 },
        { date: '2026-04-16', score: 50 }, // dip
        { date: '2026-04-17', score: null },
        { date: '2026-04-18', score: null },
        { date: '2026-04-19', score: 78 }, // recovered 3 calendar days later
      ],
      baselineScore: 75,
    })
    expect(result.lastDip).toBe(50)
    expect(result.daysToRecovery).toBe(3)
    expect(result.currentTrajectory).toBe('recovered')
  })

  it('handles latest equal to baseline as recovered', () => {
    const result = computeRecoveryTime({
      readinessScores: [
        { date: '2026-04-20', score: 60 },
        { date: '2026-04-21', score: 70 },
        { date: '2026-04-22', score: 75 }, // exactly baseline
      ],
      baselineScore: 75,
    })
    expect(result.lastDip).toBe(60)
    expect(result.daysToRecovery).toBe(2)
    expect(result.currentTrajectory).toBe('recovered')
  })

  it('returns zeros when baselineScore is not finite', () => {
    const result = computeRecoveryTime({
      readinessScores: [
        { date: '2026-04-20', score: 60 },
        { date: '2026-04-21', score: 70 },
      ],
      baselineScore: NaN,
    })
    expect(result).toEqual({
      lastDip: 0,
      daysToRecovery: 0,
      currentTrajectory: 'flat',
    })
  })
})
