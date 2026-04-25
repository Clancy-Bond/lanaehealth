/*
 * condition-detection contract tests.
 *
 * The detection helpers are pure and deterministic, so we can test
 * them in node without any DOM. They guard the smart-prompt logic
 * that decides whether the HIT-6 (migraine) or COMPASS-31 (POTS)
 * micro-questions should appear during a pain log.
 */
import { describe, expect, it } from 'vitest'
import {
  detectConditionFlags,
  shouldShowMigrainePrompt,
  shouldShowOrthostaticPrompt,
} from '../condition-detection'

describe('detectConditionFlags', () => {
  it('flags migraine for any migraine variant', () => {
    expect(detectConditionFlags(['Vestibular migraines']).hasMigraine).toBe(true)
    expect(detectConditionFlags(['Ocular migraines (reported history)']).hasMigraine).toBe(true)
    expect(detectConditionFlags(['Iron deficiency without anemia']).hasMigraine).toBe(false)
  })

  it('flags orthostatic for POTS / dysautonomia / syncope', () => {
    expect(detectConditionFlags(['Orthostatic intolerance / POTS-like presentation']).hasOrthostatic).toBe(true)
    expect(detectConditionFlags(['Recurrent syncope']).hasOrthostatic).toBe(true)
    expect(detectConditionFlags(['Presyncope - multiple episodes']).hasOrthostatic).toBe(true)
    expect(detectConditionFlags(['Dysautonomia']).hasOrthostatic).toBe(true)
    expect(detectConditionFlags(['Acne']).hasOrthostatic).toBe(false)
  })

  it('returns false for both flags on an empty corpus', () => {
    const flags = detectConditionFlags([])
    expect(flags.hasMigraine).toBe(false)
    expect(flags.hasOrthostatic).toBe(false)
  })
})

describe('shouldShowMigrainePrompt', () => {
  const flags = { hasMigraine: true, hasOrthostatic: false }

  it('shows when head region selected', () => {
    expect(shouldShowMigrainePrompt(flags, 'head', [])).toBe(true)
  })

  it('shows when throbbing / pressure / shooting selected', () => {
    expect(shouldShowMigrainePrompt(flags, null, ['throbbing'])).toBe(true)
    expect(shouldShowMigrainePrompt(flags, null, ['pressure'])).toBe(true)
    expect(shouldShowMigrainePrompt(flags, null, ['shooting'])).toBe(true)
  })

  it('hides for a non-migraine pattern', () => {
    expect(shouldShowMigrainePrompt(flags, 'pelvis', ['cramping'])).toBe(false)
    expect(shouldShowMigrainePrompt(flags, 'abdomen', ['burning'])).toBe(false)
  })

  it('always hides when migraine is not on the diagnosis list', () => {
    const noMigraine = { hasMigraine: false, hasOrthostatic: false }
    expect(shouldShowMigrainePrompt(noMigraine, 'head', ['throbbing'])).toBe(false)
  })
})

describe('shouldShowOrthostaticPrompt', () => {
  const flags = { hasMigraine: false, hasOrthostatic: true }

  it('shows when head, chest, or whole-body region selected', () => {
    expect(shouldShowOrthostaticPrompt(flags, 'head', [])).toBe(true)
    expect(shouldShowOrthostaticPrompt(flags, 'chest', [])).toBe(true)
    expect(shouldShowOrthostaticPrompt(flags, 'whole_body', [])).toBe(true)
  })

  it('shows when pressure / tingling / numb / throbbing selected', () => {
    expect(shouldShowOrthostaticPrompt(flags, null, ['pressure'])).toBe(true)
    expect(shouldShowOrthostaticPrompt(flags, null, ['tingling'])).toBe(true)
    expect(shouldShowOrthostaticPrompt(flags, null, ['numb'])).toBe(true)
    expect(shouldShowOrthostaticPrompt(flags, null, ['throbbing'])).toBe(true)
  })

  it('hides for a non-orthostatic pattern', () => {
    expect(shouldShowOrthostaticPrompt(flags, 'arms', ['sharp'])).toBe(false)
    expect(shouldShowOrthostaticPrompt(flags, 'legs', ['cramping'])).toBe(false)
  })

  it('always hides when orthostatic flag is false', () => {
    const noOrtho = { hasMigraine: false, hasOrthostatic: false }
    expect(shouldShowOrthostaticPrompt(noOrtho, 'whole_body', ['pressure'])).toBe(false)
  })
})
