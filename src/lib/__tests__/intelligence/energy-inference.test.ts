// ---------------------------------------------------------------------------
// Energy Mode Inference -- tests
//
// Pure-function tests for inferEnergyMode(). Each test asserts on the exact
// mode returned and that the rationale cites the real numbers that drove
// the decision. Non-shaming voice is verified by confirming banned phrases
// do not appear in rationales.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import {
  inferEnergyMode,
  MINIMAL_READINESS_THRESHOLD,
  GENTLE_READINESS_THRESHOLD,
  MINIMAL_PAIN_THRESHOLD,
  GENTLE_PAIN_THRESHOLD,
  MINIMAL_SLEEP_HOURS_THRESHOLD,
} from '@/lib/intelligence/energy-inference'

// Banned phrases per docs/plans/2026-04-16-non-shaming-voice-rule.md.
const BANNED_PHRASES = [
  'streak',
  'missed',
  'forgot',
  'failed',
  'off-track',
  'off track',
  'slipped',
  'behind',
  'broken',
  'should have',
  'must',
  'you need to',
]

function expectNoBannedPhrases(text: string) {
  const lower = text.toLowerCase()
  for (const phrase of BANNED_PHRASES) {
    expect(lower.includes(phrase)).toBe(false)
  }
}

describe('inferEnergyMode -- minimal ladder', () => {
  it('returns minimal when readiness is below threshold', () => {
    const result = inferEnergyMode({
      readinessScore: MINIMAL_READINESS_THRESHOLD - 1,
      cyclePhase: null,
      yesterdayPain: null,
      sleepHours: null,
    })
    expect(result.mode).toBe('minimal')
    expect(result.rationale).toContain(String(MINIMAL_READINESS_THRESHOLD - 1))
    expect(result.usedFallback).toBe(false)
    expectNoBannedPhrases(result.rationale)
  })

  it('returns minimal when yesterday pain >= threshold', () => {
    const result = inferEnergyMode({
      readinessScore: 80,
      cyclePhase: 'follicular',
      yesterdayPain: MINIMAL_PAIN_THRESHOLD + 1,
      sleepHours: 7,
    })
    expect(result.mode).toBe('minimal')
    expect(result.rationale).toContain(String(MINIMAL_PAIN_THRESHOLD + 1))
    expectNoBannedPhrases(result.rationale)
  })

  it('returns minimal when sleep is below threshold', () => {
    const result = inferEnergyMode({
      readinessScore: 80,
      cyclePhase: 'follicular',
      yesterdayPain: 2,
      sleepHours: MINIMAL_SLEEP_HOURS_THRESHOLD - 0.8,
    })
    expect(result.mode).toBe('minimal')
    // Sleep is formatted to one decimal.
    expect(result.rationale).toMatch(/sleep [0-9]+\.[0-9]h/)
    expectNoBannedPhrases(result.rationale)
  })

  it('returns minimal when userFlagFlare is true regardless of other signals', () => {
    const result = inferEnergyMode({
      readinessScore: 95,
      cyclePhase: 'follicular',
      yesterdayPain: 0,
      sleepHours: 9,
      userFlagFlare: true,
    })
    expect(result.mode).toBe('minimal')
    expect(result.signals).toContain('user flare')
    expectNoBannedPhrases(result.rationale)
  })
})

describe('inferEnergyMode -- gentle ladder', () => {
  it('returns gentle on borderline readiness (50-69)', () => {
    const result = inferEnergyMode({
      readinessScore: 60,
      cyclePhase: null,
      yesterdayPain: null,
      sleepHours: null,
    })
    expect(result.mode).toBe('gentle')
    expect(result.rationale).toContain('60')
    expectNoBannedPhrases(result.rationale)
  })

  it('returns gentle during luteal phase even with healthy readiness', () => {
    const result = inferEnergyMode({
      readinessScore: 80,
      cyclePhase: 'luteal',
      yesterdayPain: null,
      sleepHours: null,
    })
    expect(result.mode).toBe('gentle')
    expect(result.rationale.toLowerCase()).toContain('luteal')
    expectNoBannedPhrases(result.rationale)
  })

  it('returns gentle during menstrual phase', () => {
    const result = inferEnergyMode({
      readinessScore: 80,
      cyclePhase: 'menstrual',
      yesterdayPain: 2,
      sleepHours: 8,
    })
    expect(result.mode).toBe('gentle')
    expect(result.rationale.toLowerCase()).toContain('menstrual')
  })

  it('returns gentle when yesterday pain is mid-range (4-6)', () => {
    const result = inferEnergyMode({
      readinessScore: 80,
      cyclePhase: 'follicular',
      yesterdayPain: GENTLE_PAIN_THRESHOLD + 1,
      sleepHours: 8,
    })
    expect(result.mode).toBe('gentle')
    expect(result.rationale).toContain(String(GENTLE_PAIN_THRESHOLD + 1))
  })
})

describe('inferEnergyMode -- full ladder', () => {
  it('returns full with healthy readiness, healthy phase, low pain', () => {
    const result = inferEnergyMode({
      readinessScore: GENTLE_READINESS_THRESHOLD + 5,
      cyclePhase: 'follicular',
      yesterdayPain: 1,
      sleepHours: 8,
    })
    expect(result.mode).toBe('full')
    expect(result.rationale).toContain(String(GENTLE_READINESS_THRESHOLD + 5))
    expect(result.usedFallback).toBe(false)
  })

  it('returns full without a pain signal when readiness is high', () => {
    const result = inferEnergyMode({
      readinessScore: 82,
      cyclePhase: 'ovulatory',
      yesterdayPain: null,
      sleepHours: 7,
    })
    expect(result.mode).toBe('full')
    expect(result.rationale).toContain('82')
  })
})

describe('inferEnergyMode -- fallback', () => {
  it('flags usedFallback when every signal is missing', () => {
    const result = inferEnergyMode({
      readinessScore: null,
      cyclePhase: null,
      yesterdayPain: null,
      sleepHours: null,
    })
    expect(result.mode).toBe('full')
    expect(result.usedFallback).toBe(true)
    expect(result.signals).toEqual([])
    expectNoBannedPhrases(result.rationale)
  })
})

describe('inferEnergyMode -- voice audit', () => {
  it('never uses streak / missed / failed / shame phrases across all ladders', () => {
    // Exercise one example per outcome and verify banned phrases are absent.
    const samples = [
      inferEnergyMode({
        readinessScore: 40,
        cyclePhase: 'luteal',
        yesterdayPain: 8,
        sleepHours: 4,
      }),
      inferEnergyMode({
        readinessScore: 60,
        cyclePhase: 'menstrual',
        yesterdayPain: 5,
        sleepHours: 7,
      }),
      inferEnergyMode({
        readinessScore: 85,
        cyclePhase: 'follicular',
        yesterdayPain: 1,
        sleepHours: 8,
      }),
      inferEnergyMode({
        readinessScore: null,
        cyclePhase: null,
        yesterdayPain: null,
        sleepHours: null,
      }),
    ]
    for (const s of samples) {
      expectNoBannedPhrases(s.rationale)
    }
  })
})
