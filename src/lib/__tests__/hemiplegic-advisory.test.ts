/**
 * Tests for src/lib/clinical-advisories/hemiplegic-migraine.ts.
 *
 * These tests lock down the advisory copy against drift. The voice rule
 * (docs/plans/2026-04-16-non-shaming-voice-rule.md) requires the body to
 * say "If first time or lasts 24h, contact your doctor" and forbids
 * diagnostic phrasing like "you may have hemiplegic migraine".
 *
 * Spec: docs/plans/2026-04-17-wave-2b-briefs.md brief A2.
 * Clinical reference: ICHD-3 criterion 1.2.3.
 */

import { describe, it, expect } from 'vitest'
import {
  HEMIPLEGIC_ADVISORY,
  HEMIPLEGIC_CONTEXT,
  HEMIPLEGIC_CTA_HREF,
  HEMIPLEGIC_CTA_TEXT,
  HEMIPLEGIC_HEADLINE,
  HEMIPLEGIC_RED_FLAGS,
  HEMIPLEGIC_RISK_FACTORS,
  getHemiplegicAdvisory,
  isNonDiagnostic,
} from '@/lib/clinical-advisories/hemiplegic-migraine'

describe('HEMIPLEGIC_ADVISORY copy', () => {
  it('uses the required non-shaming phrasing from the brief', () => {
    expect(HEMIPLEGIC_ADVISORY).toBe(
      'Motor weakness during a headache can indicate hemiplegic migraine. If this is the first time or symptoms last over 24 hours, contact your doctor.',
    )
  })

  it('does not include diagnostic "you may have" framing', () => {
    expect(HEMIPLEGIC_ADVISORY.toLowerCase()).not.toContain('you may have')
    expect(HEMIPLEGIC_ADVISORY.toLowerCase()).not.toContain('you have hemiplegic')
    expect(HEMIPLEGIC_ADVISORY.toLowerCase()).not.toContain('diagnosed')
  })

  it('includes the 24-hour follow-up trigger required by the voice rule', () => {
    expect(HEMIPLEGIC_ADVISORY).toMatch(/24 hours?/)
    expect(HEMIPLEGIC_ADVISORY).toMatch(/first time/i)
    expect(HEMIPLEGIC_ADVISORY).toMatch(/contact your doctor/i)
  })

  it('does not use any em dashes', () => {
    // Em dash banned per repo-wide rule in CLAUDE.md.
    expect(HEMIPLEGIC_ADVISORY).not.toContain('\u2014')
    expect(HEMIPLEGIC_HEADLINE).not.toContain('\u2014')
    expect(HEMIPLEGIC_CONTEXT).not.toContain('\u2014')
  })
})

describe('isNonDiagnostic', () => {
  it('returns true for the approved advisory copy', () => {
    expect(isNonDiagnostic(HEMIPLEGIC_ADVISORY)).toBe(true)
    expect(isNonDiagnostic(HEMIPLEGIC_HEADLINE)).toBe(true)
    expect(isNonDiagnostic(HEMIPLEGIC_CONTEXT)).toBe(true)
  })

  it('flags diagnostic "you have" and "you may have" phrasing', () => {
    expect(
      isNonDiagnostic('You may have hemiplegic migraine.'),
    ).toBe(false)
    expect(isNonDiagnostic('You have hemiplegic migraine.')).toBe(false)
    expect(
      isNonDiagnostic('You probably have hemiplegic migraine.'),
    ).toBe(false)
  })

  it('flags diagnosis claims', () => {
    expect(
      isNonDiagnostic('This means you are diagnosed with migraine.'),
    ).toBe(false)
    expect(
      isNonDiagnostic('You suffer from hemiplegic migraine.'),
    ).toBe(false)
  })

  it('allows neutral informational language', () => {
    expect(
      isNonDiagnostic(
        'Motor weakness during a headache can be informational; please discuss with your doctor.',
      ),
    ).toBe(true)
  })
})

describe('getHemiplegicAdvisory', () => {
  it('returns a complete advisory payload by default', () => {
    const advisory = getHemiplegicAdvisory()
    expect(advisory.headline).toBe(HEMIPLEGIC_HEADLINE)
    expect(advisory.body).toBe(HEMIPLEGIC_ADVISORY)
    expect(advisory.context).toBe(HEMIPLEGIC_CONTEXT)
    expect(advisory.cta.text).toBe(HEMIPLEGIC_CTA_TEXT)
    expect(advisory.cta.href).toBe(HEMIPLEGIC_CTA_HREF)
    expect(advisory.riskFactors).toEqual(HEMIPLEGIC_RISK_FACTORS)
    expect(advisory.redFlags).toEqual(HEMIPLEGIC_RED_FLAGS)
    expect(advisory.urgent).toBe(false)
  })

  it('points the CTA at the appointments scheduler', () => {
    const advisory = getHemiplegicAdvisory()
    expect(advisory.cta.href).toBe('/doctor/appointments')
  })

  it('marks the advisory urgent when this is the first time', () => {
    const advisory = getHemiplegicAdvisory({ firstTime: true })
    expect(advisory.urgent).toBe(true)
  })

  it('marks the advisory urgent when symptoms last 24 hours or more', () => {
    expect(getHemiplegicAdvisory({ durationHours: 24 }).urgent).toBe(true)
    expect(getHemiplegicAdvisory({ durationHours: 48 }).urgent).toBe(true)
  })

  it('stays non-urgent for durations under 24 hours', () => {
    expect(getHemiplegicAdvisory({ durationHours: 0 }).urgent).toBe(false)
    expect(getHemiplegicAdvisory({ durationHours: 23 }).urgent).toBe(false)
  })

  it('keeps risk factors and red flags as readonly arrays with content', () => {
    const advisory = getHemiplegicAdvisory()
    expect(advisory.riskFactors.length).toBeGreaterThanOrEqual(3)
    expect(advisory.redFlags.length).toBeGreaterThanOrEqual(3)
    // Spot-check that none of the factors use diagnostic phrasing.
    for (const factor of advisory.riskFactors) {
      expect(isNonDiagnostic(factor)).toBe(true)
    }
    for (const flag of advisory.redFlags) {
      expect(isNonDiagnostic(flag)).toBe(true)
    }
  })
})
