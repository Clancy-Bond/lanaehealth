import { describe, it, expect } from 'vitest'
import { mergeBbtSources, type BbtReading } from '@/lib/cycle/bbt-source'

describe('mergeBbtSources', () => {
  it('returns an empty array when all sources are empty', () => {
    expect(mergeBbtSources({})).toEqual([])
    expect(mergeBbtSources({ oura: [], ncImported: [], manual: [] })).toEqual([])
  })

  it('promotes Oura over nc_import when both have the same date', () => {
    const result = mergeBbtSources({
      oura: [{ date: '2026-04-20', body_temp_deviation: 0.33 }],
      ncImported: [{ date: '2026-04-20', temperature: 36.7 }],
    })
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('oura')
    expect(result[0].kind).toBe('deviation')
    expect(result[0].value).toBeCloseTo(0.33, 3)
  })

  it('falls back to nc_import when Oura has no entry for a date', () => {
    const result = mergeBbtSources({
      oura: [{ date: '2026-04-20', body_temp_deviation: 0.5 }],
      ncImported: [
        { date: '2026-04-20', temperature: 36.7 },
        { date: '2026-04-21', temperature: 36.85 },
      ],
    })
    const dates = result.map((r) => r.date)
    expect(dates).toEqual(['2026-04-20', '2026-04-21'])
    expect(result[1].source).toBe('nc_import')
    expect(result[1].kind).toBe('absolute')
    expect(result[1].value).toBeCloseTo(36.85, 2)
  })

  it('falls back to manual entries when no other source covers the date', () => {
    const result = mergeBbtSources({
      manual: [
        {
          date: '2026-04-19',
          temp_c: 36.5,
          temp_f: 97.7,
          source: 'manual',
        },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('manual')
    expect(result[0].kind).toBe('absolute')
    expect(result[0].value).toBeCloseTo(36.5, 2)
  })

  it('drops nc_import rows whose temperature is null or out of range', () => {
    const result = mergeBbtSources({
      ncImported: [
        { date: '2026-04-19', temperature: null },
        { date: '2026-04-20', temperature: 99 }, // implausible C, plausible F (~37.2C)
        { date: '2026-04-21', temperature: 12 }, // garbage
      ],
    })
    // 99 F converts to 37.22 C which is in range; 12 is dropped; null is dropped.
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-04-20')
    expect(result[0].value).toBeCloseTo(37.22, 1)
    expect(result[0].source).toBe('nc_import')
  })

  it('drops Oura rows whose body_temp_deviation is null or non-finite', () => {
    const result = mergeBbtSources({
      oura: [
        { date: '2026-04-19', body_temp_deviation: null },
        { date: '2026-04-20', body_temp_deviation: Number.NaN },
        { date: '2026-04-21', body_temp_deviation: 0.27 },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-04-21')
    expect(result[0].value).toBeCloseTo(0.27, 3)
  })

  it('returns readings sorted by date ascending', () => {
    const result = mergeBbtSources({
      oura: [
        { date: '2026-04-21', body_temp_deviation: 0.5 },
        { date: '2026-04-19', body_temp_deviation: 0.1 },
        { date: '2026-04-20', body_temp_deviation: 0.3 },
      ],
    })
    expect(result.map((r) => r.date)).toEqual(['2026-04-19', '2026-04-20', '2026-04-21'])
  })

  it('rejects malformed date strings rather than coercing them', () => {
    const result = mergeBbtSources({
      oura: [
        { date: 'yesterday', body_temp_deviation: 0.2 } as unknown as { date: string; body_temp_deviation: number },
        { date: '2026/04/20', body_temp_deviation: 0.2 } as unknown as { date: string; body_temp_deviation: number },
      ],
    })
    expect(result).toHaveLength(0)
  })

  it('produces the expected mixed-source output for a realistic week', () => {
    const result: BbtReading[] = mergeBbtSources({
      oura: [
        { date: '2026-04-18', body_temp_deviation: 0.1 },
        { date: '2026-04-19', body_temp_deviation: 0.15 },
        { date: '2026-04-20', body_temp_deviation: null },
        { date: '2026-04-21', body_temp_deviation: 0.33 },
      ],
      ncImported: [{ date: '2026-04-20', temperature: 36.7 }],
      manual: [{ date: '2026-04-22', temp_c: 36.6, temp_f: 97.88, source: 'manual' }],
    })
    expect(result.map((r) => r.date)).toEqual([
      '2026-04-18',
      '2026-04-19',
      '2026-04-20',
      '2026-04-21',
      '2026-04-22',
    ])
    expect(result.find((r) => r.date === '2026-04-20')?.source).toBe('nc_import')
    expect(result.find((r) => r.date === '2026-04-22')?.source).toBe('manual')
  })
})
