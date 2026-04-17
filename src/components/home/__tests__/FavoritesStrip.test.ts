/**
 * Unit tests for the FavoritesStrip tile resolver (Wave 2e F5).
 *
 * We do not render React here; we cover the pure resolver so tests stay
 * fast and framework-free. Rendering is trivial once the tile value is
 * computed; the branching logic is what matters.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveFavoriteTile,
  type FavoritesMetricValues,
} from '@/components/home/FavoritesStrip'
import type { FavoriteItem } from '@/lib/api/favorites'

const EMPTY: FavoritesMetricValues = {}

describe('resolveFavoriteTile', () => {
  it('renders "--" for missing standing_pulse', () => {
    const tile = resolveFavoriteTile({ metric: 'standing_pulse' }, EMPTY)
    expect(tile.value).toBe('--')
    expect(tile.unit).toBe('bpm')
    expect(tile.label).toBe('Standing pulse')
    expect(tile.href).toBe('/patterns?metric=standing_pulse')
  })

  it('rounds standing_pulse to an integer', () => {
    const tile = resolveFavoriteTile(
      { metric: 'standing_pulse' },
      { standingPulse: 106.4 },
    )
    expect(tile.value).toBe('106')
  })

  it('renders body_temp with one decimal and F unit', () => {
    const tile = resolveFavoriteTile(
      { metric: 'body_temp' },
      { bodyTempF: 98.673 },
    )
    expect(tile.value).toBe('98.7')
    expect(tile.unit).toBe('F')
  })

  it('uses the user-provided displayAs over the default label', () => {
    const item: FavoriteItem = { metric: 'hrv', displayAs: 'Recovery' }
    const tile = resolveFavoriteTile(item, { hrv: 42 })
    expect(tile.label).toBe('Recovery')
  })

  it('renders cycle_day as integer and empty as --', () => {
    const filled = resolveFavoriteTile(
      { metric: 'cycle_day' },
      { cycleDay: 14 },
    )
    expect(filled.value).toBe('14')
    const empty = resolveFavoriteTile(
      { metric: 'cycle_day' },
      { cycleDay: null },
    )
    expect(empty.value).toBe('--')
  })

  it('renders cycle_phase label string and falls back to --', () => {
    const filled = resolveFavoriteTile(
      { metric: 'cycle_phase' },
      { cyclePhaseLabel: 'Luteal' },
    )
    expect(filled.value).toBe('Luteal')
    const empty = resolveFavoriteTile({ metric: 'cycle_phase' }, {})
    expect(empty.value).toBe('--')
  })

  it('renders /10-scoped symptom metrics with proper units', () => {
    const pain = resolveFavoriteTile(
      { metric: 'overall_pain' },
      { overallPain: 7 },
    )
    expect(pain.value).toBe('7')
    expect(pain.unit).toBe('/10')

    const fatigue = resolveFavoriteTile(
      { metric: 'fatigue' },
      { fatigue: 4 },
    )
    expect(fatigue.value).toBe('4')
    expect(fatigue.unit).toBe('/10')
  })

  it('renders sleep_score and readiness as unit-less integers', () => {
    const sleep = resolveFavoriteTile(
      { metric: 'sleep_score' },
      { sleepScore: 82 },
    )
    expect(sleep.value).toBe('82')
    expect(sleep.unit).toBeUndefined()

    const readiness = resolveFavoriteTile(
      { metric: 'readiness' },
      { readiness: 74 },
    )
    expect(readiness.value).toBe('74')
    expect(readiness.unit).toBeUndefined()
  })

  it('renders top_lab using the provided label + value and --', () => {
    const tile = resolveFavoriteTile(
      { metric: 'top_lab' },
      { topLabLabel: 'TSH', topLabValue: '5.1' },
    )
    expect(tile.label).toBe('TSH')
    expect(tile.value).toBe('5.1')
    expect(tile.href).toBe('/records')

    const empty = resolveFavoriteTile({ metric: 'top_lab' }, {})
    expect(empty.value).toBe('--')
  })

  it('always emits an href so the tile is clickable', () => {
    const metrics: FavoriteItem[] = [
      { metric: 'standing_pulse' },
      { metric: 'hrv' },
      { metric: 'rhr' },
      { metric: 'body_temp' },
      { metric: 'cycle_day' },
      { metric: 'cycle_phase' },
      { metric: 'overall_pain' },
      { metric: 'fatigue' },
      { metric: 'sleep_score' },
      { metric: 'readiness' },
      { metric: 'top_lab' },
    ]
    for (const item of metrics) {
      const tile = resolveFavoriteTile(item, EMPTY)
      expect(tile.href).toMatch(/^\//)
      expect(tile.label.length).toBeGreaterThan(0)
    }
  })
})
