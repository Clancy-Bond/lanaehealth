import { describe, expect, it } from 'vitest'
import { buildTalkingPoints, type TalkingPoint } from '@/components/doctor/TalkingPoints'
import type { DoctorPageData } from '@/app/doctor/page'

/**
 * Ranking and grouping tests for the doctor mode TalkingPoints surface.
 *
 * The behavior under test is `buildTalkingPoints`: pure pre-computation
 * over patient data that produces the bullet list rendered above the
 * fold during a real visit. Two safety properties matter:
 *
 *   1. Priority numbers stay aligned with clinical urgency. The current
 *      ranking (lower = higher priority):
 *         priority 1: lab trend declining despite treatment
 *                     active concern with status=worsening
 *         priority 2: low HRV (POTS workup signal)
 *                     ordinary active concern
 *                     imaging finding
 *                     cycle burden
 *         priority 3: lab flagged but not declining
 *                     suspected condition (demoted from concern)
 *         priority 4: strong correlation pattern
 *
 *   2. Specialist filtering does not silently swallow the highest-priority
 *      point. Cardiology must NOT see cycle bullets; OB/GYN must NOT see
 *      orthostatic / vitals-only bullets.
 */

function blankData(): DoctorPageData {
  return {
    patient: { name: 'Test', age: 30, sex: 'F', bloodType: 'O+', heightCm: 165, weightKg: 60 },
    activeProblems: [],
    confirmedDiagnoses: [],
    suspectedConditions: [],
    medications: [],
    supplements: [],
    allergies: [],
    familyHistory: [],
    latestVitals: {
      hrvAvg: null,
      restingHr: null,
      sleepScore: null,
      tempDeviation: null,
      readinessScore: null,
      spo2Avg: null,
      respiratoryRate: null,
      date: null,
    },
    abnormalLabs: [],
    allLabs: [],
    cycleStatus: {
      currentPhase: null,
      lastPeriodDate: null,
      averageCycleLength: null,
      periodLengthDays: null,
      flow: null,
      clots: null,
      pain: null,
      padChangesHeavyDay: null,
      ironLossPerCycle: null,
      regularity: null,
    },
    timelineEvents: [],
    imagingStudies: [],
    correlations: [],
    upcomingAppointments: [],
    lastAppointmentDate: null,
    orthostaticTests: [],
    medicationDeltas: [],
    cyclePhaseFindings: [],
    completeness: {} as DoctorPageData['completeness'],
    followThrough: [],
    redFlags: [],
    kbHypotheses: null,
    kbActions: null,
    kbChallenger: null,
    kbResearch: null,
    staleTests: [],
    wrongModalityFlags: [],
  }
}

function findPoint(points: TalkingPoint[], prefixContains: string): TalkingPoint | undefined {
  return points.find((p) => p.prefix.includes(prefixContains))
}

describe('buildTalkingPoints', () => {
  describe('priority assignment', () => {
    it('assigns priority 2 to low HRV (POTS workup signal)', () => {
      const data = blankData()
      data.latestVitals.hrvAvg = 18
      const points = buildTalkingPoints(data, 'cardiology')
      const hrv = findPoint(points, 'Low HRV')
      expect(hrv).toBeDefined()
      expect(hrv?.priority).toBe(2)
      expect(hrv?.bucket).toBe('vitals')
    })

    it('does NOT surface low HRV when value is at or above the 25 ms threshold', () => {
      const data = blankData()
      data.latestVitals.hrvAvg = 25
      const points = buildTalkingPoints(data, 'cardiology')
      expect(findPoint(points, 'Low HRV')).toBeUndefined()
    })

    it('assigns priority 3 to a suspected condition (demoted below active concerns)', () => {
      const data = blankData()
      data.suspectedConditions = ['Endometriosis']
      const points = buildTalkingPoints(data, 'pcp')
      const suspected = points.find((p) => p.prefix === 'Suspected')
      expect(suspected).toBeDefined()
      expect(suspected?.priority).toBe(3)
    })

    it('assigns priority 1 to a worsening active concern', () => {
      const data = blankData()
      data.activeProblems = [
        { problem: 'POTS symptoms', status: 'worsening', latestData: 'standing HR 110' },
      ]
      const points = buildTalkingPoints(data, 'pcp')
      const concern = points.find((p) => p.prefix === 'Active concern')
      expect(concern).toBeDefined()
      expect(concern?.priority).toBe(1)
    })

    it('assigns priority 2 to an active concern that is not worsening', () => {
      const data = blankData()
      data.activeProblems = [
        { problem: 'Stable migraines', status: 'stable', latestData: null },
      ]
      const points = buildTalkingPoints(data, 'pcp')
      const concern = points.find((p) => p.prefix === 'Active concern')
      expect(concern?.priority).toBe(2)
    })

    it('assigns priority 4 to a strong correlation pattern', () => {
      const data = blankData()
      data.correlations = [
        {
          factorA: 'Sleep score',
          factorB: 'HRV next day',
          effectDescription: 'Lower sleep predicts lower next-day HRV (r = 0.62)',
          confidenceLevel: 'strong',
          sampleSize: 30,
          coefficient: 0.62,
        },
      ]
      const points = buildTalkingPoints(data, 'pcp')
      const pattern = points.find((p) => p.prefix === 'Pattern found')
      expect(pattern).toBeDefined()
      expect(pattern?.priority).toBe(4)
    })
  })

  describe('grouping signals (lab vs concern vs other)', () => {
    it('emits lab-trend points with prefix matching the "trend" filter', () => {
      const data = blankData()
      data.allLabs = [
        { id: '1', date: '2026-01-01', category: 'iron', test_name: 'Ferritin', value: 30, unit: 'ng/mL', reference_range: null, abnormal_flag: 'low', notes: null },
        { id: '2', date: '2026-04-01', category: 'iron', test_name: 'Ferritin', value: 18, unit: 'ng/mL', reference_range: null, abnormal_flag: 'low', notes: null },
      ] as unknown as DoctorPageData['allLabs']
      data.abnormalLabs = data.allLabs
      const points = buildTalkingPoints(data, 'pcp')
      const trend = findPoint(points, 'trend')
      expect(trend).toBeDefined()
      expect(trend?.bucket).toBe('labs')
      expect(trend?.priority).toBe(1)
    })

    it('emits a "flagged" point when an abnormal lab is not declining', () => {
      const data = blankData()
      data.allLabs = [
        { id: '1', date: '2026-01-01', category: 'iron', test_name: 'Ferritin', value: 18, unit: 'ng/mL', reference_range: null, abnormal_flag: 'low', notes: null },
        { id: '2', date: '2026-04-01', category: 'iron', test_name: 'Ferritin', value: 30, unit: 'ng/mL', reference_range: null, abnormal_flag: 'low', notes: null },
      ] as unknown as DoctorPageData['allLabs']
      data.abnormalLabs = data.allLabs
      const points = buildTalkingPoints(data, 'pcp')
      const flagged = findPoint(points, 'flagged')
      expect(flagged).toBeDefined()
      expect(flagged?.priority).toBe(3)
    })

    it('groups lab points (trend / flagged) together via their prefix shape', () => {
      const data = blankData()
      data.allLabs = [
        { id: '1', date: '2026-01-01', category: 'iron', test_name: 'Ferritin', value: 30, unit: 'ng/mL', reference_range: null, abnormal_flag: 'low', notes: null },
        { id: '2', date: '2026-04-01', category: 'iron', test_name: 'Ferritin', value: 18, unit: 'ng/mL', reference_range: null, abnormal_flag: 'low', notes: null },
        { id: '3', date: '2026-01-01', category: 'd', test_name: 'Vitamin D', value: 22, unit: 'ng/mL', reference_range: null, abnormal_flag: 'low', notes: null },
        { id: '4', date: '2026-04-01', category: 'd', test_name: 'Vitamin D', value: 35, unit: 'ng/mL', reference_range: null, abnormal_flag: 'low', notes: null },
      ] as unknown as DoctorPageData['allLabs']
      data.abnormalLabs = data.allLabs
      const points = buildTalkingPoints(data, 'pcp')
      const labPoints = points.filter((p) => p.bucket === 'labs')
      expect(labPoints.length).toBeGreaterThanOrEqual(2)
      // Lab grouping in the UI uses prefix-string matching, so confirm the
      // contract holds: every lab point includes "trend" or "flagged".
      for (const p of labPoints) {
        expect(p.prefix.includes('trend') || p.prefix.includes('flagged')).toBe(true)
      }
    })

    it('groups concern points (Active concern / Suspected) under the activeProblems bucket', () => {
      const data = blankData()
      data.activeProblems = [
        { problem: 'Migraines', status: 'stable', latestData: '3x/week' },
      ]
      data.suspectedConditions = ['POTS']
      const points = buildTalkingPoints(data, 'pcp')
      const concerns = points.filter(
        (p) => p.prefix === 'Active concern' || p.prefix === 'Suspected'
      )
      expect(concerns.length).toBe(2)
      for (const p of concerns) {
        expect(p.bucket).toBe('activeProblems')
      }
    })
  })

  describe('specialist visibility filter', () => {
    it('cardiology view drops cycle-burden points (cycle bucket = -1)', () => {
      const data = blankData()
      data.cycleStatus.pain = 'severe'
      data.cycleStatus.padChangesHeavyDay = '8 pads'
      data.cycleStatus.clots = 'large'
      const cardiology = buildTalkingPoints(data, 'cardiology')
      expect(cardiology.find((p) => p.prefix === 'Cycle burden')).toBeUndefined()
      // PCP and OB/GYN should still see it.
      const pcp = buildTalkingPoints(data, 'pcp')
      expect(pcp.find((p) => p.prefix === 'Cycle burden')).toBeDefined()
      const obgyn = buildTalkingPoints(data, 'obgyn')
      expect(obgyn.find((p) => p.prefix === 'Cycle burden')).toBeDefined()
    })

    it('OB/GYN does not see vitals as a top point if the only signal is HRV (vitals weight = 0)', () => {
      // OB/GYN keeps vitals visible (weight 0, not -1), but its effective
      // priority gets pushed down vs cycle (weight 3). This test locks
      // down the visibility floor: vitals appear, just lower in the list.
      const data = blankData()
      data.latestVitals.hrvAvg = 18
      data.cycleStatus.pain = 'severe'
      const obgyn = buildTalkingPoints(data, 'obgyn')
      const hrvIdx = obgyn.findIndex((p) => p.prefix === 'Low HRV')
      const cycleIdx = obgyn.findIndex((p) => p.prefix === 'Cycle burden')
      expect(hrvIdx).toBeGreaterThanOrEqual(0)
      expect(cycleIdx).toBeGreaterThanOrEqual(0)
      expect(cycleIdx).toBeLessThan(hrvIdx)
    })

    it('caps the returned list at 7 points', () => {
      const data = blankData()
      // Pile 10 active concerns onto the list.
      data.activeProblems = Array.from({ length: 10 }).map((_, i) => ({
        problem: `Concern ${i}`,
        status: 'stable',
        latestData: null,
      }))
      const points = buildTalkingPoints(data, 'pcp')
      expect(points.length).toBeLessThanOrEqual(7)
    })
  })

  describe('stable ordering for equal priority', () => {
    it('preserves insertion order across two equal-priority concerns', () => {
      const data = blankData()
      data.activeProblems = [
        { problem: 'First', status: 'stable', latestData: null },
        { problem: 'Second', status: 'stable', latestData: null },
        { problem: 'Third', status: 'stable', latestData: null },
      ]
      const points = buildTalkingPoints(data, 'pcp')
      const concernDetails = points
        .filter((p) => p.prefix === 'Active concern')
        .map((p) => p.detail)
      expect(concernDetails).toEqual(['First', 'Second', 'Third'])
    })
  })
})
