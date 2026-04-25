import { describe, it, expect } from 'vitest'
import { generateCycleMessages, type MessageGenerationInputs } from '@/lib/cycle/messages'
import type { CycleContext } from '@/lib/cycle/load-cycle-context'

function ctxFixture(overrides: Partial<CycleContext> = {}): CycleContext {
  return {
    today: '2026-04-24',
    current: {
      day: 14,
      phase: 'ovulatory',
      lastPeriodStart: '2026-04-11',
      isUnusuallyLong: false,
    } as CycleContext['current'],
    stats: {
      completedCycles: [],
      currentCycle: null,
      meanCycleLength: 28,
      sdCycleLength: 1,
      shortestCycle: 27,
      longestCycle: 30,
      meanPeriodLength: 5,
      sdPeriodLength: 0.5,
      regularity: 'regular',
      sampleSize: 3,
    },
    periodPrediction: {
      status: 'projected',
      predictedDate: '2026-05-09',
      rangeStart: '2026-05-07',
      rangeEnd: '2026-05-11',
      daysUntil: 15,
      daysOverdue: 0,
      confidence: 'high',
      caveat: '',
    },
    fertilePrediction: {
      status: 'in_window',
      rangeStart: '2026-04-22',
      rangeEnd: '2026-04-25',
      daysUntilWindow: 0,
      daysUntilCloses: 1,
      confidence: 'high',
      caveat: '',
    },
    bbtLog: { entries: [] } as CycleContext['bbtLog'],
    confirmedOvulation: false,
    bbtReadings: [],
    coverLine: {
      baseline: null,
      sampleSize: 0,
      confidence: 'low',
      sd: 0,
      value: null,
      kind: 'none',
      readings: 0,
    } as unknown as CycleContext['coverLine'],
    ovulation: {
      ovulationDate: null,
      source: 'none',
      confidence: 'low',
      bbtShiftDetected: false,
      lhPositiveDetected: false,
      isAnovulatoryCandidate: false,
      rationale: '',
    } as unknown as CycleContext['ovulation'],
    ncFertilityColorToday: null,
    ncOvulationStatusToday: null,
    ...overrides,
  }
}

function inputs(overrides: Partial<MessageGenerationInputs> = {}): MessageGenerationInputs {
  return {
    ctx: ctxFixture(),
    today: '2026-04-24',
    wakeTimeMinutes: 7 * 60 + 30,
    nowMinutes: 12 * 60,
    bbtLoggedToday: false,
    periodLoggedToday: false,
    lastInsightSampleSize: 0,
    ...overrides,
  }
}

describe('generateCycleMessages', () => {
  it('emits a morning_temp_reminder when wake has passed and BBT is unlogged', () => {
    const messages = generateCycleMessages(inputs())
    const m = messages.find((x) => x.kind === 'morning_temp_reminder')
    expect(m).toBeTruthy()
    expect(m!.dedupeKey).toBe('morning_temp:2026-04-24')
    expect(m!.title).toMatch(/morning temperature/)
  })

  it('does not emit morning_temp before the user has woken up', () => {
    const messages = generateCycleMessages(inputs({ nowMinutes: 6 * 60 }))
    expect(messages.find((m) => m.kind === 'morning_temp_reminder')).toBeUndefined()
  })

  it('does not emit morning_temp when BBT is already logged', () => {
    const messages = generateCycleMessages(inputs({ bbtLoggedToday: true }))
    expect(messages.find((m) => m.kind === 'morning_temp_reminder')).toBeUndefined()
  })

  it('emits fertile_window_approaching when the window is 2-3 days out', () => {
    const ctx = ctxFixture({
      fertilePrediction: {
        status: 'out_window',
        rangeStart: '2026-04-26',
        rangeEnd: '2026-04-30',
        daysUntilWindow: 2,
        daysUntilCloses: null,
        confidence: 'medium',
        caveat: '',
      },
    })
    const messages = generateCycleMessages(inputs({ ctx }))
    const m = messages.find((x) => x.kind === 'fertile_window_approaching')
    expect(m).toBeTruthy()
    expect(m!.body).toMatch(/2 days/)
  })

  it('does not emit fertile_window_approaching when already in the window', () => {
    const messages = generateCycleMessages(inputs())
    expect(
      messages.find((m) => m.kind === 'fertile_window_approaching'),
    ).toBeUndefined()
  })

  it('emits period_start_predicted inside the predicted range when no period is logged', () => {
    const ctx = ctxFixture({
      periodPrediction: {
        status: 'projected',
        predictedDate: '2026-04-24',
        rangeStart: '2026-04-22',
        rangeEnd: '2026-04-26',
        daysUntil: 0,
        daysOverdue: 0,
        confidence: 'medium',
        caveat: '',
      },
    })
    const messages = generateCycleMessages(inputs({ ctx }))
    expect(messages.find((m) => m.kind === 'period_start_predicted')).toBeTruthy()
  })

  it('does not emit period_start_predicted when a period is logged today', () => {
    const ctx = ctxFixture({
      periodPrediction: {
        status: 'projected',
        predictedDate: '2026-04-24',
        rangeStart: '2026-04-22',
        rangeEnd: '2026-04-26',
        daysUntil: 0,
        daysOverdue: 0,
        confidence: 'medium',
        caveat: '',
      },
    })
    const messages = generateCycleMessages(inputs({ ctx, periodLoggedToday: true }))
    expect(
      messages.find((m) => m.kind === 'period_start_predicted'),
    ).toBeUndefined()
  })

  it('emits cycle_insight_ready when sampleSize advances past lastInsightSampleSize', () => {
    const ctx = ctxFixture({
      stats: { ...ctxFixture().stats, sampleSize: 4 },
    })
    const messages = generateCycleMessages(inputs({ ctx, lastInsightSampleSize: 3 }))
    const m = messages.find((x) => x.kind === 'cycle_insight_ready')
    expect(m).toBeTruthy()
    expect(m!.dedupeKey).toBe('insight_ready:4')
    expect(m!.body).toMatch(/4 completed cycles/)
  })

  it('does not emit cycle_insight_ready when sampleSize has not advanced', () => {
    const ctx = ctxFixture({
      stats: { ...ctxFixture().stats, sampleSize: 3 },
    })
    const messages = generateCycleMessages(inputs({ ctx, lastInsightSampleSize: 3 }))
    expect(messages.find((m) => m.kind === 'cycle_insight_ready')).toBeUndefined()
  })

  it('uses NC voice (no em-dashes, no alarm)', () => {
    const messages = generateCycleMessages(inputs())
    for (const m of messages) {
      expect(m.title).not.toMatch(/—|–/)
      expect(m.body).not.toMatch(/—|–/)
      expect(m.body.toUpperCase()).not.toBe(m.body) // not all caps
    }
  })

  it('every message carries a stable dedupeKey scoped by date or sampleSize', () => {
    const ctx = ctxFixture({
      stats: { ...ctxFixture().stats, sampleSize: 4 },
      periodPrediction: {
        status: 'projected',
        predictedDate: '2026-04-24',
        rangeStart: '2026-04-22',
        rangeEnd: '2026-04-26',
        daysUntil: 0,
        daysOverdue: 0,
        confidence: 'medium',
        caveat: '',
      },
    })
    const messages = generateCycleMessages(
      inputs({ ctx, lastInsightSampleSize: 3 }),
    )
    for (const m of messages) {
      expect(m.dedupeKey).toMatch(/(2026-04-24|insight_ready:\d+)/)
    }
  })
})
