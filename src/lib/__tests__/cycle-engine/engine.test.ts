/**
 * Tests for engine.ts -- top-level cycle intelligence pipeline.
 *
 * References: Scherwitzl 2015 (PMID 25592280), Scherwitzl 2017 (PMC5669828),
 * Goodale 2019 (DOI 10.2196/13404), Shilaih 2017 (DOI 10.1038/s41598-017-01433-9).
 */
import { describe, it, expect } from 'vitest'
import { runCycleEngine, ENGINE_VERSION } from '../../intelligence/cycle-engine/engine'
import type { NcImported, OuraDaily } from '../../types'

function mkNc(date: string, overrides: Partial<NcImported> = {}): NcImported {
  return {
    id: date,
    date,
    temperature: null,
    menstruation: null,
    flow_quantity: null,
    cervical_mucus_consistency: null,
    cervical_mucus_quantity: null,
    mood_flags: null,
    lh_test: null,
    cycle_day: null,
    cycle_number: null,
    fertility_color: null,
    ovulation_status: null,
    data_flags: null,
    imported_at: `${date}T00:00:00Z`,
    ...overrides,
  }
}

function mkOura(date: string, overrides: Partial<OuraDaily> = {}): OuraDaily {
  return {
    id: date,
    date,
    sleep_score: null,
    sleep_duration: null,
    deep_sleep_min: null,
    rem_sleep_min: null,
    hrv_avg: null,
    hrv_max: null,
    resting_hr: null,
    body_temp_deviation: null,
    spo2_avg: null,
    stress_score: null,
    readiness_score: null,
    respiratory_rate: null,
    // Wave 1 (audit) materialized columns. All nullable.
    sleep_latency_min: null,
    stress_high_min: null,
    recovery_high_min: null,
    breathing_disturbance_index: null,
    activity_score: null,
    sedentary_min: null,
    low_activity_min: null,
    medium_activity_min: null,
    high_activity_min: null,
    raw_json: {},
    synced_at: `${date}T00:00:00Z`,
    ...overrides,
  }
}

/**
 * Build a synthetic 28-day cycle with a classic biphasic BBT shift:
 *   Days 1-5 menstruation (no BBT; NC does not recommend taking temp during
 *     flow since blood-loss-related fluctuations make it unreliable),
 *   Days 6-14 follicular baseline (~36.3 C),
 *   Days 15-28 sustained elevated luteal (~36.55 C).
 */
function buildClassicCycle(start: string): NcImported[] {
  const rows: NcImported[] = []
  const startDate = new Date(`${start}T00:00:00Z`)
  for (let i = 0; i < 28; i++) {
    const d = new Date(startDate)
    d.setUTCDate(d.getUTCDate() + i)
    const date = d.toISOString().slice(0, 10)

    const menstruating = i < 5
    const preShift = i >= 5 && i < 14
    const elevated = i >= 14

    let temp: number | null
    if (menstruating) temp = null // no BBT during flow (realistic for NC users)
    else if (preShift) temp = 36.3 + (i % 2 === 0 ? -0.02 : 0.02)
    else if (elevated) temp = 36.55
    else temp = null

    rows.push(
      mkNc(date, {
        temperature: temp,
        menstruation: menstruating ? 'menstruation' : null,
      })
    )
  }
  return rows
}

describe('runCycleEngine', () => {
  it('returns an empty summary when there is no NC data', () => {
    const summary = runCycleEngine({ ncRows: [], ouraRows: [] })
    expect(summary.totalCycles).toBe(0)
    expect(summary.confirmedOvulatoryCycles).toBe(0)
    expect(summary.predictions).toEqual([])
  })

  it('detects ovulation on a classic biphasic cycle', () => {
    const rows: NcImported[] = []
    // Two back-to-back 28-day cycles so the first cycle can close.
    rows.push(...buildClassicCycle('2026-01-01'))
    rows.push(...buildClassicCycle('2026-01-29'))

    const summary = runCycleEngine({ ncRows: rows, ouraRows: [] })

    expect(summary.totalCycles).toBeGreaterThanOrEqual(1)
    const firstCycle = summary.predictions[0]
    expect(firstCycle.cycleStart).toBe('2026-01-01')
    expect(firstCycle.shift.confirmed).toBe(true)
    expect(firstCycle.confirmedOvulationDate).not.toBeNull()
    expect(firstCycle.fertileWindow).not.toBeNull()
    expect(firstCycle.anovulatory.status).toBe('likely_ovulatory')
    // Cover line should sit slightly above the follicular max (~36.3).
    expect(firstCycle.coverLine?.coverLineC).toBeGreaterThan(36.3)
    expect(firstCycle.coverLine?.coverLineC).toBeLessThan(36.5)
  })

  it('flags anovulatory cycles when neither BBT shift nor LH surge appears', () => {
    const rows: NcImported[] = []
    // Cycle 1: flat temps, no LH
    rows.push(mkNc('2026-02-01', { menstruation: 'menstruation', temperature: 36.3 }))
    for (let d = 2; d <= 28; d++) {
      rows.push(mkNc(`2026-02-${d.toString().padStart(2, '0')}`, { temperature: 36.3 }))
    }
    // Cycle 2 start closes Cycle 1
    rows.push(mkNc('2026-03-01', { menstruation: 'menstruation' }))
    rows.push(mkNc('2026-03-30', { menstruation: 'menstruation' }))

    const summary = runCycleEngine({ ncRows: rows, ouraRows: [] })

    expect(summary.likelyAnovulatoryCycles).toBeGreaterThanOrEqual(1)
    expect(summary.confirmedOvulatoryCycles).toBe(0)
  })

  it('respects caller-supplied exclusion map (POTS flare / fever days)', () => {
    const rows = buildClassicCycle('2026-04-01')
    rows.push(mkNc('2026-04-29', { menstruation: 'menstruation' }))

    // Exclude every other elevated day. This breaks the run of three
    // consecutive elevated reads NC requires to confirm a shift.
    const excludedDates = new Map<string, string>()
    excludedDates.set('2026-04-15', 'fever')
    excludedDates.set('2026-04-17', 'fever')
    excludedDates.set('2026-04-19', 'fever')
    excludedDates.set('2026-04-21', 'fever')
    excludedDates.set('2026-04-23', 'fever')
    excludedDates.set('2026-04-25', 'fever')
    excludedDates.set('2026-04-27', 'fever')

    const summary = runCycleEngine({
      ncRows: rows,
      ouraRows: [],
      excludedDates,
    })

    const firstCycle = summary.predictions[0]
    expect(firstCycle.shift.confirmed).toBe(false)
    expect(firstCycle.excludedData.length).toBeGreaterThanOrEqual(3)
    expect(firstCycle.excludedData[0]).toEqual({
      date: '2026-04-15',
      reason: 'fever',
    })
  })

  it('elevates confidence when Oura HRV and RHR corroborate a BBT shift', () => {
    const rows = buildClassicCycle('2026-05-01')
    rows.push(mkNc('2026-05-29', { menstruation: 'menstruation' }))

    // Build Oura HRV + RHR that matches Goodale 2019 luteal pattern.
    const ouraRows: OuraDaily[] = []
    for (let i = 0; i < 28; i++) {
      const d = new Date('2026-05-01T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + i)
      const date = d.toISOString().slice(0, 10)
      const isLuteal = i >= 13
      ouraRows.push(
        mkOura(date, {
          hrv_avg: isLuteal ? 45 : 40,
          resting_hr: isLuteal ? 60 : 55,
        })
      )
    }

    const summary = runCycleEngine({ ncRows: rows, ouraRows })

    const firstCycle = summary.predictions[0]
    expect(firstCycle.shift.confirmed).toBe(true)
    expect(firstCycle.signalsUsed).toContain('bbt_shift')
    expect(firstCycle.signalsUsed).toContain('hrv')
    expect(firstCycle.signalsUsed).toContain('rhr')
    expect(firstCycle.confidence).toBeGreaterThan(0.5)
  })

  it('reports engine version + computedAt on every prediction', () => {
    const rows = buildClassicCycle('2026-06-01')
    rows.push(mkNc('2026-06-29', { menstruation: 'menstruation' }))
    const summary = runCycleEngine({ ncRows: rows, ouraRows: [] })
    for (const p of summary.predictions) {
      expect(p.engineVersion).toBe(ENGINE_VERSION)
      expect(p.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }
  })

  it('computes cycle-level stats (mean length, luteal length, SD)', () => {
    // Three back-to-back classic cycles closed out by a fourth period start
    const rows: NcImported[] = []
    rows.push(...buildClassicCycle('2026-07-01'))
    rows.push(...buildClassicCycle('2026-07-29'))
    rows.push(...buildClassicCycle('2026-08-26'))
    rows.push(mkNc('2026-09-23', { menstruation: 'menstruation' }))

    const summary = runCycleEngine({ ncRows: rows, ouraRows: [] })

    expect(summary.totalCycles).toBeGreaterThanOrEqual(3)
    expect(summary.averageCycleLength).toBeGreaterThan(25)
    expect(summary.averageCycleLength).toBeLessThan(32)
    expect(summary.averageLutealLength).toBeGreaterThan(10)
    expect(summary.averageLutealLength).toBeLessThan(18)
  })

  it('does not retroactively mutate past predictions (every run is a fresh object)', () => {
    const rows = buildClassicCycle('2026-09-01')
    rows.push(mkNc('2026-09-29', { menstruation: 'menstruation' }))

    const first = runCycleEngine({ ncRows: rows, ouraRows: [] })
    const second = runCycleEngine({ ncRows: rows, ouraRows: [] })

    // Different object references: past runs are not in-place mutated.
    expect(first.predictions).not.toBe(second.predictions)
    expect(first.predictions[0]).not.toBe(second.predictions[0])
    // Values should match though (deterministic).
    expect(first.predictions[0].cycleStart).toBe(second.predictions[0].cycleStart)
    expect(first.predictions[0].confirmedOvulationDate).toBe(
      second.predictions[0].confirmedOvulationDate
    )
  })
})
