import { describe, it, expect } from 'vitest'
import { samplesToDailySummaries } from '@/lib/healthkit/samples-to-summaries'

describe('samplesToDailySummaries', () => {
  it('bins HR samples and computes avg/min/max', () => {
    const out = samplesToDailySummaries([
      { identifier: 'HKQuantityTypeIdentifierHeartRate', start: '2026-04-28T08:00:00.000Z', end: '2026-04-28T08:00:30.000Z', value: 60 },
      { identifier: 'HKQuantityTypeIdentifierHeartRate', start: '2026-04-28T09:00:00.000Z', end: '2026-04-28T09:00:30.000Z', value: 80 },
      { identifier: 'HKQuantityTypeIdentifierHeartRate', start: '2026-04-28T10:00:00.000Z', end: '2026-04-28T10:00:30.000Z', value: 100 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-04-28')
    expect(out[0].heartRateAvg).toBe(80)
    expect(out[0].heartRateMin).toBe(60)
    expect(out[0].heartRateMax).toBe(100)
  })
  it('picks the highest menstrual flow severity that day', () => {
    const out = samplesToDailySummaries([
      { identifier: 'HKCategoryTypeIdentifierMenstrualFlow', start: '2026-04-28T08:00:00.000Z', end: '2026-04-28T08:00:01.000Z', code: 1, valueText: 'light' },
      { identifier: 'HKCategoryTypeIdentifierMenstrualFlow', start: '2026-04-28T18:00:00.000Z', end: '2026-04-28T18:00:01.000Z', code: 4, valueText: 'heavy' },
    ])
    expect(out[0].menstrualFlow).toBe('heavy')
  })
  it('keeps the LAST weight reading of the day', () => {
    const out = samplesToDailySummaries([
      { identifier: 'HKQuantityTypeIdentifierBodyMass', start: '2026-04-28T07:00:00.000Z', end: '2026-04-28T07:00:01.000Z', value: 60.5 },
      { identifier: 'HKQuantityTypeIdentifierBodyMass', start: '2026-04-28T19:00:00.000Z', end: '2026-04-28T19:00:01.000Z', value: 61.2 },
    ])
    expect(out[0].weight).toBe(61.2)
  })
  it('sums steps + active energy across the day', () => {
    const out = samplesToDailySummaries([
      { identifier: 'HKQuantityTypeIdentifierStepCount', start: '2026-04-28T08:00:00.000Z', end: '2026-04-28T08:30:00.000Z', value: 1200 },
      { identifier: 'HKQuantityTypeIdentifierStepCount', start: '2026-04-28T18:00:00.000Z', end: '2026-04-28T18:30:00.000Z', value: 4500 },
      { identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned', start: '2026-04-28T08:00:00.000Z', end: '2026-04-28T08:30:00.000Z', value: 50 },
      { identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned', start: '2026-04-28T18:00:00.000Z', end: '2026-04-28T18:30:00.000Z', value: 200 },
    ])
    expect(out[0].steps).toBe(5700)
    expect(out[0].activeEnergy).toBe(250)
  })
  it('groups by ISO date across multiple days', () => {
    const out = samplesToDailySummaries([
      { identifier: 'HKQuantityTypeIdentifierHeartRate', start: '2026-04-27T08:00:00.000Z', end: '2026-04-27T08:00:30.000Z', value: 70 },
      { identifier: 'HKQuantityTypeIdentifierHeartRate', start: '2026-04-28T08:00:00.000Z', end: '2026-04-28T08:00:30.000Z', value: 80 },
    ])
    expect(out.map(d => d.date)).toEqual(['2026-04-27', '2026-04-28'])
  })
})
