import { describe, it, expect } from 'vitest'
import {
  clampStep,
  reduceTour,
  CYCLE_TOUR_STEPS,
  type TourState,
} from '@/v2/components/CoachmarkTour'

describe('clampStep', () => {
  it('clamps below zero to zero', () => {
    expect(clampStep(-5, 7)).toBe(0)
  })
  it('clamps above max to last index', () => {
    expect(clampStep(99, 7)).toBe(6)
  })
  it('floors fractional inputs', () => {
    expect(clampStep(2.7, 7)).toBe(2)
  })
  it('handles total of zero by returning zero', () => {
    expect(clampStep(3, 0)).toBe(0)
  })
})

describe('reduceTour', () => {
  const total = CYCLE_TOUR_STEPS.length
  const start: TourState = { step: 0, open: true, finished: false, dismissed: false }

  it('advance moves to next step', () => {
    const next = reduceTour(start, { type: 'advance' }, total)
    expect(next.step).toBe(1)
    expect(next.open).toBe(true)
  })

  it('advance from final step closes and marks finished', () => {
    const final: TourState = { ...start, step: total - 1 }
    const next = reduceTour(final, { type: 'advance' }, total)
    expect(next.open).toBe(false)
    expect(next.finished).toBe(true)
    expect(next.dismissed).toBe(false)
  })

  it('skip closes and marks dismissed (not finished)', () => {
    const next = reduceTour(start, { type: 'skip' }, total)
    expect(next.open).toBe(false)
    expect(next.finished).toBe(false)
    expect(next.dismissed).toBe(true)
  })

  it('reset returns a fresh open state at step 0 by default', () => {
    const dismissed: TourState = { step: 4, open: false, finished: false, dismissed: true }
    const next = reduceTour(dismissed, { type: 'reset' }, total)
    expect(next.open).toBe(true)
    expect(next.dismissed).toBe(false)
    expect(next.step).toBe(0)
  })

  it('reset honours the explicit step argument', () => {
    const dismissed: TourState = { step: 0, open: false, finished: true, dismissed: false }
    const next = reduceTour(dismissed, { type: 'reset', to: 3 }, total)
    expect(next.step).toBe(3)
    expect(next.finished).toBe(false)
  })
})

describe('CYCLE_TOUR_STEPS', () => {
  it('has exactly 7 steps mirroring NC tutorial', () => {
    expect(CYCLE_TOUR_STEPS.length).toBe(7)
  })

  it('every step has an id, target, title, and body', () => {
    for (const step of CYCLE_TOUR_STEPS) {
      expect(step.id).toBeTruthy()
      expect(step.title).toBeTruthy()
      expect(step.body).toBeTruthy()
    }
  })

  it('uses NC voice (no em-dashes, kind tone)', () => {
    for (const step of CYCLE_TOUR_STEPS) {
      expect(step.title).not.toMatch(/—|–/)
      expect(step.body).not.toMatch(/—|–/)
    }
  })
})
