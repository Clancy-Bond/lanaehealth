/**
 * Boundary tests for the zod validators added to PHI write routes.
 *
 * Each route under test has its body schema exported (BpLogBodySchema,
 * PainLogBodySchema, ProfilePutBodySchema, CycleLogBodySchema). These
 * tests pin the trust-boundary contract independently of the route
 * handler so a refactor that swaps zod for something else still gets
 * caught the moment the rejection envelope changes.
 *
 * Coverage strategy:
 *   - happy path: minimal valid body succeeds
 *   - shape: missing required fields and wrong primitive types reject
 *   - clamps: out-of-physiological-range numbers reject
 *   - encoding: oversized payloads reject
 *   - unicode: emoji and combining characters in user-text fields pass
 *
 * Notes on what we deliberately do NOT test here:
 *   - The downstream Supabase write. That path needs a service-client
 *     mock and lives in the route-level integration tests instead.
 *   - Authorization (auth gate). Owned by phi-route-auth.test.ts.
 */

import { describe, it, expect } from 'vitest'
import { BpLogBodySchema } from '../bp/log/route'
import { PainLogBodySchema } from '../log/pain/route'
import { ProfilePutBodySchema } from '../profile/route'
import { CycleLogBodySchema } from '../cycle/log/route'

// ── /api/bp/log ────────────────────────────────────────────────────────

describe('BpLogBodySchema', () => {
  const minimal = {
    date: '2026-04-25',
    systolic: 120,
    diastolic: 80,
  }

  it('accepts a minimal valid reading', () => {
    const r = BpLogBodySchema.safeParse(minimal)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.date).toBe('2026-04-25')
      // optional defaults present
      expect(r.data.position).toBe('unknown')
      expect(r.data.notes).toBe('')
    }
  })

  it('rejects an out-of-range systolic', () => {
    const r = BpLogBodySchema.safeParse({ ...minimal, systolic: 999 })
    expect(r.success).toBe(false)
  })

  it('rejects a malformed date', () => {
    const r = BpLogBodySchema.safeParse({ ...minimal, date: '04/25/2026' })
    expect(r.success).toBe(false)
  })

  it('rejects a notes field that exceeds the cap', () => {
    const huge = 'a'.repeat(501)
    const r = BpLogBodySchema.safeParse({ ...minimal, notes: huge })
    expect(r.success).toBe(false)
  })

  it('coerces empty pulse to undefined and accepts it', () => {
    // empty form-string should land as undefined per zod-forms preprocess
    const r = BpLogBodySchema.safeParse({ ...minimal, pulse: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.pulse).toBeUndefined()
  })
})

// ── /api/log/pain ──────────────────────────────────────────────────────

describe('PainLogBodySchema', () => {
  const minimal = {
    date: '2026-04-25',
    intensity: 5,
    scale_used: 'nrs' as const,
  }

  it('accepts a minimal valid pain log', () => {
    const r = PainLogBodySchema.safeParse(minimal)
    expect(r.success).toBe(true)
  })

  it('rejects an unknown scale_used value', () => {
    const r = PainLogBodySchema.safeParse({ ...minimal, scale_used: 'mpq' })
    expect(r.success).toBe(false)
  })

  it('rejects an intensity outside 0..10', () => {
    const r = PainLogBodySchema.safeParse({ ...minimal, intensity: 11 })
    expect(r.success).toBe(false)
  })

  it('rejects a trigger_guess longer than 280 chars', () => {
    const r = PainLogBodySchema.safeParse({
      ...minimal,
      trigger_guess: 'x'.repeat(281),
    })
    expect(r.success).toBe(false)
  })

  it('accepts emoji + combining characters in trigger_guess', () => {
    // Real-world user text has emoji. Make sure the validator does not
    // reject grapheme clusters or BMP-spanning chars.
    const text = 'crampy after coffee ☕👍 and é́'
    const r = PainLogBodySchema.safeParse({
      ...minimal,
      trigger_guess: text,
    })
    expect(r.success).toBe(true)
  })

  it('accepts a peg block with both axes 0..10', () => {
    const r = PainLogBodySchema.safeParse({
      ...minimal,
      peg: { enjoyment: 7, activity: 6 },
    })
    expect(r.success).toBe(true)
  })
})

// ── /api/profile (PUT) ────────────────────────────────────────────────

describe('ProfilePutBodySchema', () => {
  it('accepts a known section + small content', () => {
    const r = ProfilePutBodySchema.safeParse({
      section: 'demographics',
      content: { name: 'Lanae', dob: '1990-01-01' },
    })
    expect(r.success).toBe(true)
  })

  it('accepts any *_log section by convention', () => {
    const r = ProfilePutBodySchema.safeParse({
      section: 'sleep_temperature_log',
      content: { entries: [] },
    })
    expect(r.success).toBe(true)
  })

  it('rejects a section that is neither known nor matches *_log', () => {
    const r = ProfilePutBodySchema.safeParse({
      section: 'random-section',
      content: {},
    })
    expect(r.success).toBe(false)
  })

  it('rejects an absent content field', () => {
    const r = ProfilePutBodySchema.safeParse({ section: 'demographics' })
    expect(r.success).toBe(false)
  })

  it('accepts unicode payloads inside content', () => {
    const r = ProfilePutBodySchema.safeParse({
      section: 'notes',
      content: { note: 'feeling 🌸 today, BBT ↑ 0.4°F' },
    })
    expect(r.success).toBe(true)
  })
})

// ── /api/cycle/log ─────────────────────────────────────────────────────

describe('CycleLogBodySchema', () => {
  it('accepts a body with a YYYY-MM-DD date', () => {
    const r = CycleLogBodySchema.safeParse({ date: '2026-04-25' })
    expect(r.success).toBe(true)
  })

  it('rejects a missing date', () => {
    const r = CycleLogBodySchema.safeParse({ menstruation: true })
    expect(r.success).toBe(false)
  })

  it('rejects a wrong-shaped date', () => {
    const r = CycleLogBodySchema.safeParse({ date: '2026-4-25' })
    expect(r.success).toBe(false)
  })

  it('passes through unknown fields (handled downstream)', () => {
    // The route-level buildPatch is a soft whitelist; the schema only
    // owns date. Any additional field should ride along untouched.
    const r = CycleLogBodySchema.safeParse({
      date: '2026-04-25',
      menstruation: 'true',
      flow_level: 'medium',
      ovulation_signs: 'cervix_low,libido_high',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      // passthrough mode preserves the extra keys
      expect((r.data as Record<string, unknown>).menstruation).toBe('true')
    }
  })
})
