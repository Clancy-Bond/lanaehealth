import { describe, it, expect } from 'vitest'
import {
  renderNutritionCoachContext,
  type RecentMealRow,
  type ActiveProblemRow,
} from '@/lib/intelligence/nutrition-coach-context'
import type { ResolvedTarget } from '@/lib/nutrition/target-resolver'

/**
 * Tests for the pure renderer that composes the coach dynamic-context
 * block. The async database-backed builder is intentionally not covered
 * here; it would require a Supabase mock which we avoid to keep the
 * test surface purely deterministic.
 */

function meal(over: Partial<RecentMealRow> = {}): RecentMealRow {
  return {
    logged_at: '2026-04-17T12:00:00Z',
    meal_type: 'lunch',
    food_items: 'salmon, rice, spinach',
    flagged_triggers: null,
    date: '2026-04-17',
    ...over,
  }
}

function target(over: Partial<ResolvedTarget> = {}): ResolvedTarget {
  return {
    nutrient: 'iron',
    displayName: 'Iron',
    amount: 18,
    unit: 'mg',
    source: 'rda',
    presetName: null,
    rationale: 'baseline',
    citation: 'NIH ODS',
    ...over,
  }
}

function problem(over: Partial<ActiveProblemRow> = {}): ActiveProblemRow {
  return {
    problem: 'suspected iron deficiency',
    status: 'monitoring',
    latest_data: 'ferritin 12 ng/mL on 2026-02-19',
    ...over,
  }
}

describe('renderNutritionCoachContext', () => {
  it('wraps output in a nutrition_coach_context envelope', () => {
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [],
      targets: [],
      problems: [],
    })
    expect(out.text.startsWith('<nutrition_coach_context>')).toBe(true)
    expect(out.text.trim().endsWith('</nutrition_coach_context>')).toBe(true)
  })

  it('emits a missing-cycle note when cycle data is unavailable', () => {
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [],
      targets: [],
      problems: [],
    })
    expect(out.text).toMatch(/No current cycle data available/)
  })

  it('reports cycle day and phase when provided', () => {
    const out = renderNutritionCoachContext({
      cycle: { day: 14, phase: 'ovulatory' },
      meals: [],
      targets: [],
      problems: [],
    })
    expect(out.text).toMatch(/Current cycle day: 14/)
    expect(out.text).toMatch(/Current phase: ovulatory/)
  })

  it('lists each recent meal with its date and food items', () => {
    const meals = [
      meal({ date: '2026-04-17', meal_type: 'breakfast', food_items: 'oats' }),
      meal({ date: '2026-04-16', meal_type: 'dinner', food_items: 'pasta' }),
    ]
    const out = renderNutritionCoachContext({
      cycle: null,
      meals,
      targets: [],
      problems: [],
    })
    expect(out.text).toMatch(/2026-04-17 breakfast: oats/)
    expect(out.text).toMatch(/2026-04-16 dinner: pasta/)
    expect(out.sections.recentMealCount).toBe(2)
  })

  it('inlines flagged triggers when present', () => {
    const m = meal({ flagged_triggers: ['high_fodmap', 'dairy'] })
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [m],
      targets: [],
      problems: [],
    })
    expect(out.text).toMatch(/\[triggers: high_fodmap, dairy\]/)
  })

  it('states an empty meals note when no meals exist', () => {
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [],
      targets: [],
      problems: [],
    })
    expect(out.text).toMatch(/No meals logged in the last 7 days/)
  })

  it('renders each resolved nutrient target with source and unit', () => {
    const ts = [
      target({ nutrient: 'iron', amount: 18, unit: 'mg', source: 'rda' }),
      target({
        nutrient: 'sodium',
        amount: 5000,
        unit: 'mg',
        source: 'preset',
        presetName: 'pots',
      }),
    ]
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [],
      targets: ts,
      problems: [],
    })
    expect(out.text).toMatch(/iron: 18mg \[source=rda\]/)
    expect(out.text).toMatch(/sodium: 5000mg \[source=preset\]/)
    expect(out.sections.nutrientTargetCount).toBe(2)
  })

  it('lists active problems with status tags', () => {
    const ps = [problem()]
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [],
      targets: [],
      problems: ps,
    })
    expect(out.text).toMatch(/\[monitoring\] suspected iron deficiency/)
    expect(out.text).toMatch(/ferritin 12 ng\/mL/)
  })

  it('clamps a giant food description to keep token budget bounded', () => {
    const huge = 'x'.repeat(500)
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [meal({ food_items: huge })],
      targets: [],
      problems: [],
    })
    const mealLine = out.text.split('\n').find((l) => l.includes('xxxx')) ?? ''
    // The line should be truncated (we cap at 180 chars) and still carry
    // a date/meal prefix.
    expect(mealLine.length).toBeLessThan(260)
  })

  it('caps targets to at most 25 rows to keep the prompt small', () => {
    const many: ResolvedTarget[] = Array.from({ length: 40 }).map((_, i) =>
      target({ nutrient: `nutrient_${i}`, amount: i, unit: 'mg' }),
    )
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [],
      targets: many,
      problems: [],
    })
    const lines = out.text.split('\n').filter((l) => l.startsWith('- nutrient_'))
    expect(lines.length).toBe(25)
    // Metadata still reflects the true count so callers can log the total.
    expect(out.sections.nutrientTargetCount).toBe(40)
  })

  it('emits neutral copy when all sections are empty', () => {
    const out = renderNutritionCoachContext({
      cycle: null,
      meals: [],
      targets: [],
      problems: [],
    })
    // Non-shaming voice: no "you missed", "failed", "track" framing.
    expect(out.text.toLowerCase()).not.toMatch(/missed|failed|off.?track|streak/)
  })
})
