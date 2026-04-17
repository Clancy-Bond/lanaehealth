import { describe, it, expect } from 'vitest'
import {
  generateAlerts,
  labMatchesDirection,
  getMappingCatalogSize,
  type AlertLabInput,
  type NutrientIntakeAverage,
} from '@/lib/intelligence/nutrient-lab-alerts'
import {
  NUTRIENT_LAB_MAPPINGS,
} from '@/lib/nutrition/nutrient-lab-map'
import type { ResolvedTarget } from '@/lib/nutrition/target-resolver'

// ── Fixtures ──────────────────────────────────────────────────────────

function lab(
  test_name: string,
  value: number | null,
  overrides: Partial<AlertLabInput> = {},
): AlertLabInput {
  return {
    test_name,
    value,
    unit: overrides.unit ?? null,
    reference_range_low: overrides.reference_range_low ?? null,
    reference_range_high: overrides.reference_range_high ?? null,
    flag: overrides.flag ?? null,
    date: overrides.date ?? '2026-02-19',
  }
}

function target(
  nutrient: string,
  amount: number,
  unit: string,
): ResolvedTarget {
  return {
    nutrient,
    displayName: nutrient,
    amount,
    unit,
    source: 'rda',
    presetName: null,
    rationale: null,
    citation: 'NIH ODS',
  }
}

function intake(
  nutrient: string,
  averagePerDay: number,
  unit: string,
): NutrientIntakeAverage {
  return { nutrient, averagePerDay, unit, daysCovered: 14 }
}

// ── labMatchesDirection ───────────────────────────────────────────────

describe('labMatchesDirection', () => {
  const ferritinMapping = NUTRIENT_LAB_MAPPINGS.find(
    (m) => m.id === 'ferritin_below_range',
  )!
  const tshMapping = NUTRIENT_LAB_MAPPINGS.find(
    (m) => m.id === 'tsh_borderline_high',
  )!
  const cholMapping = NUTRIENT_LAB_MAPPINGS.find(
    (m) => m.id === 'total_cholesterol_above_range',
  )!

  it('matches below_range via flag="low"', () => {
    const l = lab('Ferritin', 10, { flag: 'low' })
    expect(labMatchesDirection(l, ferritinMapping)).toBe(true)
  })

  it('matches below_range via reference range when flag missing', () => {
    const l = lab('Ferritin', 8, { reference_range_low: 15 })
    expect(labMatchesDirection(l, ferritinMapping)).toBe(true)
  })

  it('does not match below_range when value above reference low', () => {
    const l = lab('Ferritin', 45, { reference_range_low: 15 })
    expect(labMatchesDirection(l, ferritinMapping)).toBe(false)
  })

  it('matches tsh borderline_high when value > threshold', () => {
    // Lanae case: TSH 5.1 inside a 0.5 to 5.5 inside-range but clinically watched
    const l = lab('TSH', 5.1, { unit: 'mIU/L', reference_range_high: 5.5 })
    expect(labMatchesDirection(l, tshMapping)).toBe(true)
  })

  it('does not match tsh borderline when value is clearly normal', () => {
    const l = lab('TSH', 2.0, { unit: 'mIU/L' })
    expect(labMatchesDirection(l, tshMapping)).toBe(false)
  })

  it('matches above_range via critical flag', () => {
    const l = lab('Total Cholesterol', 310, { flag: 'critical' })
    expect(labMatchesDirection(l, cholMapping)).toBe(true)
  })

  it('matches above_range via reference range', () => {
    const l = lab('Total Cholesterol', 286, { reference_range_high: 200 })
    expect(labMatchesDirection(l, cholMapping)).toBe(true)
  })
})

// ── generateAlerts ────────────────────────────────────────────────────

describe('generateAlerts', () => {
  it('returns empty when there are no labs', () => {
    const alerts = generateAlerts([], [], [])
    expect(alerts).toEqual([])
  })

  it('fires iron/ferritin alert for Lanae-shaped data (low ferritin + low intake)', () => {
    const labs = [
      lab('Ferritin', 10, { unit: 'ng/mL', reference_range_low: 15, flag: 'low' }),
    ]
    const targets = [target('iron', 27, 'mg')]
    const intakes = [intake('iron', 9, 'mg')]
    const alerts = generateAlerts(labs, targets, intakes)

    const ironAlert = alerts.find((a) => a.id === 'ferritin_below_range')
    expect(ironAlert).toBeDefined()
    expect(ironAlert!.severity).toBe('action')
    // Voice rule: actionable but non-diagnostic.
    expect(ironAlert!.body.toLowerCase()).toContain('iron intake averages')
    expect(ironAlert!.body.toLowerCase()).toContain('talk to your doctor')
    expect(ironAlert!.body.toLowerCase()).not.toContain('you have low iron')
    expect(ironAlert!.suggestedFoods).toContain('lentils')
  })

  it('fires TSH borderline alert for Lanae-shaped data (TSH 5.1)', () => {
    const labs = [lab('TSH', 5.1, { unit: 'mIU/L' })]
    const targets = [
      target('selenium', 55, 'mcg'),
    ]
    const intakes = [intake('selenium', 40, 'mcg')]
    const alerts = generateAlerts(labs, targets, intakes)
    const tshAlert = alerts.find((a) => a.id === 'tsh_borderline_high')
    expect(tshAlert).toBeDefined()
    expect(tshAlert!.labDisplayName).toBe('TSH')
    expect(tshAlert!.body.toLowerCase()).toContain('selenium')
  })

  it('fires cholesterol alert for Lanae-shaped data (286 mg/dL)', () => {
    const labs = [
      lab('Total Cholesterol', 286, { unit: 'mg/dL', reference_range_high: 200, flag: 'high' }),
    ]
    const targets = [target('fiber', 25, 'g')]
    const intakes = [intake('fiber', 14, 'g')]
    const alerts = generateAlerts(labs, targets, intakes)
    const ch = alerts.find((a) => a.id === 'total_cholesterol_above_range')
    expect(ch).toBeDefined()
    expect(ch!.severity).toBe('action')
    expect(ch!.suggestedFoods).toContain('oats')
  })

  it('sorts action before watch before info', () => {
    const labs = [
      // triggers action (formally-out + intake below 75% target)
      lab('Ferritin', 10, { reference_range_low: 15, flag: 'low' }),
      // triggers info (borderline without strong gap)
      lab('TSH', 4.5, { unit: 'mIU/L' }),
    ]
    const targets = [
      target('iron', 27, 'mg'),
      target('selenium', 55, 'mcg'),
    ]
    const intakes = [
      intake('iron', 9, 'mg'),
      intake('selenium', 50, 'mcg'),
    ]
    const alerts = generateAlerts(labs, targets, intakes)
    expect(alerts[0].severity).toBe('action')
    // The last alert should be info (borderline TSH without large intake gap).
    const last = alerts[alerts.length - 1]
    expect(['info', 'watch']).toContain(last.severity)
    // Confirm ordering
    const rank = { action: 0, watch: 1, info: 2 } as const
    for (let i = 1; i < alerts.length; i++) {
      expect(rank[alerts[i].severity]).toBeGreaterThanOrEqual(rank[alerts[i - 1].severity])
    }
  })

  it('picks the latest lab row per test_name', () => {
    const labs = [
      lab('Ferritin', 40, { reference_range_low: 15, date: '2026-01-01' }),
      lab('Ferritin', 10, { reference_range_low: 15, flag: 'low', date: '2026-02-19' }),
    ]
    const alerts = generateAlerts(labs, [target('iron', 27, 'mg')], [intake('iron', 9, 'mg')])
    const f = alerts.find((a) => a.id === 'ferritin_below_range')
    expect(f).toBeDefined()
    expect(f!.labValue).toBe(10)
    expect(f!.labDate).toBe('2026-02-19')
  })

  it('does not use shaming or diagnostic language in any generated body', () => {
    const labs = [
      lab('Ferritin', 8, { reference_range_low: 15, flag: 'low' }),
      lab('TSH', 5.1, { unit: 'mIU/L' }),
      lab('Total Cholesterol', 286, { reference_range_high: 200, flag: 'high' }),
    ]
    const targets = [
      target('iron', 27, 'mg'),
      target('selenium', 55, 'mcg'),
      target('fiber', 25, 'g'),
    ]
    const intakes = [
      intake('iron', 9, 'mg'),
      intake('selenium', 40, 'mcg'),
      intake('fiber', 14, 'g'),
    ]
    const alerts = generateAlerts(labs, targets, intakes)
    const banned = [
      'you have low',
      'you are deficient',
      'you failed',
      'you must',
      'diagnosed',
      'diagnosis',
      'you should ',
    ]
    for (const a of alerts) {
      const lower = a.body.toLowerCase()
      for (const phrase of banned) {
        expect(lower.includes(phrase)).toBe(false)
      }
    }
  })

  it('continues to work when intake data is missing for some nutrients', () => {
    const labs = [
      lab('Ferritin', 8, { reference_range_low: 15, flag: 'low' }),
    ]
    const alerts = generateAlerts(labs, [target('iron', 27, 'mg')], [])
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].intake).toBeNull()
  })
})

describe('getMappingCatalogSize', () => {
  it('reports the seed size consistent with the source module', () => {
    expect(getMappingCatalogSize()).toBe(NUTRIENT_LAB_MAPPINGS.length)
  })
})
