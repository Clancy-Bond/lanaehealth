/**
 * Widget registry + composer tests.
 *
 * The home screen's behavior depends on the elevation rules
 * being correct. These tests pin the trigger conditions for
 * each widget so a refactor cannot silently change which
 * widgets bubble to the top.
 */
import { describe, expect, it } from 'vitest'
import {
  buildWidgetRegistry,
  computeSleepDrop,
  ELEVATION_THRESHOLDS,
  PRIORITY,
  type WidgetRenderers,
} from '../widget-registry'
import { composeHomeLayout } from '../composer'
import { defaultLayoutFromRegistry } from '../layout-store'
import type { HomeContext } from '@/lib/v2/load-home-context'

const RENDERERS: WidgetRenderers = {
  primaryInsight: 'primary-insight-node',
  metricStrip: 'metric-strip-node',
  homeAlerts: 'home-alerts-node',
  shortcuts: 'shortcuts-node',
  askAi: 'ask-ai-node',
}

function baseCtx(overrides: Partial<HomeContext> = {}): HomeContext {
  return {
    today: '2026-04-24',
    dailyLog: null,
    cycle: null,
    ouraTrend: [],
    calories: null,
    topCorrelation: null,
    nextAppointment: null,
    symptomsToday: 0,
    ...overrides,
  }
}

describe('buildWidgetRegistry', () => {
  it('returns the full set of widgets with required metadata', () => {
    const registry = buildWidgetRegistry(RENDERERS)
    const ids = registry.map((w) => w.id)
    expect(ids).toContain('primary-insight')
    expect(ids).toContain('red-flag-banner')
    expect(ids).toContain('metric-strip')
    expect(ids).toContain('appointment-card')
    expect(ids).toContain('cycle-card')
    expect(ids).toContain('sleep-card')
    expect(ids).toContain('pain-checkin')
    expect(ids).toContain('food-log-quick')
    expect(ids).toContain('oura-disconnect')
    expect(ids).toContain('missed-log-streak')
    expect(ids).toContain('ai-suggestion')
  })

  it('marks primary-insight and red-flag-banner as non-reorderable', () => {
    const registry = buildWidgetRegistry(RENDERERS)
    const insight = registry.find((w) => w.id === 'primary-insight')
    const banner = registry.find((w) => w.id === 'red-flag-banner')
    expect(insight?.canReorder).toBe(false)
    expect(insight?.canHide).toBe(false)
    expect(banner?.canReorder).toBe(false)
    expect(banner?.canHide).toBe(false)
  })
})

describe('elevation conditions', () => {
  const registry = buildWidgetRegistry(RENDERERS)
  const byId = (id: string) => registry.find((w) => w.id === id)!

  it('appointment-card elevates within 48 hours', () => {
    const ctx = baseCtx({
      nextAppointment: {
        id: 'a1',
        date: '2026-04-25',
        doctor_name: 'Dr Smith',
        specialty: null,
      } as HomeContext['nextAppointment'],
    })
    const result = byId('appointment-card').conditions!(ctx)
    expect(result.elevate).toBe(true)
    expect(result.reason.toLowerCase()).toContain('tomorrow')
  })

  it('appointment-card does NOT elevate beyond 48 hours', () => {
    const ctx = baseCtx({
      nextAppointment: {
        id: 'a1',
        date: '2026-04-30',
        doctor_name: 'Dr Smith',
        specialty: null,
      } as HomeContext['nextAppointment'],
    })
    expect(byId('appointment-card').conditions!(ctx).elevate).toBe(false)
  })

  it('sleep-card elevates on a 20+ point drop', () => {
    const ctx = baseCtx({
      ouraTrend: [
        { date: '2026-04-18', sleep_score: 90 },
        { date: '2026-04-19', sleep_score: 88 },
        { date: '2026-04-20', sleep_score: 85 },
        { date: '2026-04-21', sleep_score: 90 },
        { date: '2026-04-22', sleep_score: 92 },
        { date: '2026-04-23', sleep_score: 88 },
        { date: '2026-04-24', sleep_score: 60 },
      ] as HomeContext['ouraTrend'],
    })
    const drop = computeSleepDrop(ctx)
    expect(drop?.drop).toBeGreaterThanOrEqual(ELEVATION_THRESHOLDS.SLEEP_DROP_POINTS)
    expect(byId('sleep-card').conditions!(ctx).elevate).toBe(true)
  })

  it('sleep-card does not elevate on small variation', () => {
    const ctx = baseCtx({
      ouraTrend: [
        { date: '2026-04-21', sleep_score: 80 },
        { date: '2026-04-22', sleep_score: 82 },
        { date: '2026-04-23', sleep_score: 79 },
        { date: '2026-04-24', sleep_score: 78 },
      ] as HomeContext['ouraTrend'],
    })
    expect(byId('sleep-card').conditions!(ctx).elevate).toBe(false)
  })

  it('cycle-card elevates when cycle is unusually long', () => {
    const ctx = baseCtx({
      cycle: { current: { isUnusuallyLong: true, day: 35, phase: 'luteal' } } as HomeContext['cycle'],
    })
    expect(byId('cycle-card').conditions!(ctx).elevate).toBe(true)
  })

  it('pain-checkin elevates when no pain logged today', () => {
    const ctx = baseCtx({ dailyLog: null })
    const result = byId('pain-checkin').conditions!(ctx)
    expect(result.elevate).toBe(true)
  })

  it('pain-checkin does NOT elevate when pain already logged', () => {
    const ctx = baseCtx({
      dailyLog: { date: '2026-04-24', overall_pain: 5 } as HomeContext['dailyLog'],
    })
    expect(byId('pain-checkin').conditions!(ctx).elevate).toBe(false)
  })

  it('food-log-quick elevates after 6pm with low calories', () => {
    const realDate = global.Date
    class StubDate extends realDate {
      constructor() {
        super('2026-04-24T19:30:00Z')
      }
      getHours() {
        return 19
      }
    }
    // @ts-expect-error stub for test
    global.Date = StubDate
    try {
      const ctx = baseCtx({
        calories: { calories: 200 } as HomeContext['calories'],
      })
      expect(byId('food-log-quick').conditions!(ctx).elevate).toBe(true)
    } finally {
      global.Date = realDate
    }
  })

  it('oura-disconnect elevates if yesterday had no Oura row', () => {
    const ctx = baseCtx({
      ouraTrend: [{ date: '2026-04-22', sleep_score: 80 }] as HomeContext['ouraTrend'],
    })
    expect(byId('oura-disconnect').conditions!(ctx).elevate).toBe(true)
  })

  it('red-flag-banner elevates when overall_pain is 8 or higher', () => {
    const ctx = baseCtx({
      dailyLog: { date: '2026-04-24', overall_pain: 9 } as HomeContext['dailyLog'],
    })
    expect(byId('red-flag-banner').conditions!(ctx).elevate).toBe(true)
  })

  it('ai-suggestion elevates only on a strong correlation', () => {
    const moderate = baseCtx({
      topCorrelation: {
        id: 'c1',
        factor_a: 'sleep',
        factor_b: 'pain',
        correlation_type: 'pearson',
        coefficient: 0.4,
        effect_size: 0.4,
        effect_description: null,
        confidence_level: 'moderate',
        sample_size: 30,
        lag_days: 0,
        cycle_phase: null,
        computed_at: '2026-04-24T00:00:00Z',
      },
    })
    const strong = baseCtx({
      topCorrelation: { ...moderate.topCorrelation!, confidence_level: 'strong' },
    })
    expect(byId('ai-suggestion').conditions!(moderate).elevate).toBe(false)
    expect(byId('ai-suggestion').conditions!(strong).elevate).toBe(true)
  })
})

describe('composeHomeLayout', () => {
  const registry = buildWidgetRegistry(RENDERERS)

  it('keeps pinned widgets at the top regardless of elevation', () => {
    const layout = defaultLayoutFromRegistry(registry)
    const ctx = baseCtx({
      nextAppointment: {
        id: 'a1',
        date: '2026-04-25',
        doctor_name: 'Dr Smith',
        specialty: null,
      } as HomeContext['nextAppointment'],
    })
    const composed = composeHomeLayout(registry, layout, ctx)
    // Primary insight (pinned) must come before any flexible widget.
    const insightIdx = composed.findIndex((c) => c.widget.id === 'primary-insight')
    const apptIdx = composed.findIndex((c) => c.widget.id === 'appointment-card')
    expect(insightIdx).toBeLessThan(apptIdx)
    expect(insightIdx).toBe(0) // Or banner if elevated; here banner is null condition.
  })

  it('places elevated widgets above non-elevated flexible widgets', () => {
    const layout = defaultLayoutFromRegistry(registry)
    const ctx = baseCtx({
      nextAppointment: {
        id: 'a1',
        date: '2026-04-24',
        doctor_name: 'Dr Smith',
        specialty: null,
      } as HomeContext['nextAppointment'],
    })
    const composed = composeHomeLayout(registry, layout, ctx)
    const flexible = composed.filter((c) => c.widget.canReorder)
    // Among flexible widgets, the appointment card should be first
    // because it elevated, even though metric-strip has higher
    // default priority.
    expect(flexible[0]?.widget.id).toBe('appointment-card')
  })

  it('omits hidden widgets', () => {
    const layout = defaultLayoutFromRegistry(registry)
    layout.hidden = ['shortcuts']
    const composed = composeHomeLayout(registry, layout, baseCtx())
    expect(composed.some((c) => c.widget.id === 'shortcuts')).toBe(false)
  })

  it('respects user-customized order for non-elevated widgets', () => {
    const layout = {
      order: [
        'primary-insight',
        'red-flag-banner',
        'shortcuts',
        'ask-ai',
        'metric-strip',
      ],
      hidden: [],
      updated_at: '2026-04-24T00:00:00Z',
    }
    const composed = composeHomeLayout(registry, layout, baseCtx())
    const flexible = composed.filter((c) => c.widget.canReorder).map((c) => c.widget.id)
    expect(flexible[0]).toBe('shortcuts')
    expect(flexible[1]).toBe('ask-ai')
  })
})

describe('PRIORITY constants', () => {
  it('has a strict ordering ESSENTIAL > HIGH > MEDIUM > LOW', () => {
    expect(PRIORITY.ESSENTIAL).toBeGreaterThan(PRIORITY.HIGH)
    expect(PRIORITY.HIGH).toBeGreaterThan(PRIORITY.MEDIUM)
    expect(PRIORITY.MEDIUM).toBeGreaterThan(PRIORITY.LOW)
  })
})
