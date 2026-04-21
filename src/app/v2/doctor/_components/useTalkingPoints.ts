import { useMemo } from 'react'
import type { DoctorPageData } from '@/app/doctor/page'
import {
  SPECIALIST_CONFIG,
  type SpecialistView,
  type DataBucket,
} from '@/lib/doctor/specialist-config'

export interface TalkingPoint {
  prefix: string
  detail: string
  priority: number // lower = higher priority
  bucket: DataBucket
}

/*
 * useTalkingPoints
 *
 * The 7-point ranking that drives the "What to tell the doctor" card.
 * Every signal in DoctorPageData is examined, turned into at most a
 * few candidate points, and the top seven after specialist weighting
 * bubble to the top.
 *
 * Algorithm ported verbatim from legacy TalkingPoints.tsx for parity.
 * The user contribution opportunity below is in the PRIORITY priors:
 * the numeric weights that decide which signal outranks which. That
 * decision is clinical, not technical, and the user knows their own
 * history better than I do.
 *
 * ─────────────────────────────────────────────────────────────────
 * LEARNING-MODE HOOK D2 — Clinical priority priors
 *
 * Each branch below assigns a baseline priority (1–4, lower = higher)
 * to a class of findings. The specialist-config layer then adds a
 * view-specific weight on top; the final sort is `priority − weight`.
 *
 * The priors below are my defaults. They match legacy /doctor today.
 * If you want the OB/GYN view to float cycle-burden above abnormal-
 * lab trends, or the cardio view to rank low-HRV above active-problem
 * worsening, tune these numbers. Five minutes of your clinical prior
 * will ship better doctor briefs than any amount of code I write.
 *
 *   priority = 1 → top of brief, doctor hears it first
 *   priority = 2 → significant, usually above the fold
 *   priority = 3 → worth mentioning
 *   priority = 4 → only if space allows
 *
 * The five knobs worth considering:
 *   a. DECLINING_ABNORMAL_LAB_TREND (legacy = 1)
 *   b. WORSENING_ACTIVE_PROBLEM     (legacy = 1)
 *   c. STABLE_ACTIVE_PROBLEM        (legacy = 2)
 *   d. IMAGING_FINDING              (legacy = 2)
 *   e. LOW_HRV                      (legacy = 2)
 *   f. CYCLE_BURDEN                 (legacy = 2)
 *   g. ABNORMAL_LAB_FLAG_NO_TREND   (legacy = 3)
 *   h. SUSPECTED_CONDITION          (legacy = 3)
 *   i. STRONG_CORRELATION           (legacy = 4)
 *
 * To tune: edit the PRIORITY constants in the block below. Everything
 * downstream (specialist filtering, top-7 slicing, category grouping)
 * adapts automatically.
 * ─────────────────────────────────────────────────────────────────
 */
const PRIORITY = {
  DECLINING_ABNORMAL_LAB_TREND: 1,
  WORSENING_ACTIVE_PROBLEM: 1,
  STABLE_ACTIVE_PROBLEM: 2,
  IMAGING_FINDING: 2,
  LOW_HRV: 2,
  CYCLE_BURDEN: 2,
  ABNORMAL_LAB_FLAG_NO_TREND: 3,
  SUSPECTED_CONDITION: 3,
  STRONG_CORRELATION: 4,
} as const

function buildTalkingPoints(data: DoctorPageData, view: SpecialistView): TalkingPoint[] {
  const points: TalkingPoint[] = []
  const weights = SPECIALIST_CONFIG[view].bucketWeights

  // 1. Lab trends: labs tested multiple times where abnormal, flag decline
  const labsByTest = new Map<string, { values: number[]; unit: string }>()
  for (const lab of data.allLabs) {
    if (lab.value === null) continue
    const key = lab.test_name
    if (!labsByTest.has(key)) labsByTest.set(key, { values: [], unit: lab.unit || '' })
    labsByTest.get(key)!.values.push(lab.value)
  }
  for (const [testName, { values, unit }] of labsByTest) {
    if (values.length < 2) continue
    const first = values[0]
    const last = values[values.length - 1]
    const hasAbnormal = data.abnormalLabs.some((l) => l.test_name === testName)
    if (hasAbnormal && last < first) {
      const trend = values.map((v) => `${v}`).join(' -> ')
      points.push({
        prefix: `${testName} trend`,
        detail: `${trend} ${unit} -- declining despite treatment`,
        priority: PRIORITY.DECLINING_ABNORMAL_LAB_TREND,
        bucket: 'labs',
      })
    } else if (hasAbnormal) {
      const latest = values[values.length - 1]
      points.push({
        prefix: `${testName} flagged`,
        detail: `Latest: ${latest} ${unit}`,
        priority: PRIORITY.ABNORMAL_LAB_FLAG_NO_TREND,
        bucket: 'labs',
      })
    }
  }

  // 2. Active problems
  for (const problem of data.activeProblems) {
    const detail = problem.latestData ? `${problem.problem}: ${problem.latestData}` : problem.problem
    points.push({
      prefix: 'Active concern',
      detail,
      priority: problem.status === 'worsening' ? PRIORITY.WORSENING_ACTIVE_PROBLEM : PRIORITY.STABLE_ACTIVE_PROBLEM,
      bucket: 'activeProblems',
    })
  }

  // 3. Imaging findings
  for (const study of data.imagingStudies) {
    if (study.findings_summary) {
      points.push({
        prefix: `${study.modality} ${study.body_part}`,
        detail: study.findings_summary,
        priority: PRIORITY.IMAGING_FINDING,
        bucket: 'imaging',
      })
    }
  }

  // 4. Suspected conditions
  for (const condition of data.suspectedConditions) {
    points.push({
      prefix: 'Suspected',
      detail: condition,
      priority: PRIORITY.SUSPECTED_CONDITION,
      bucket: 'activeProblems',
    })
  }

  // 5. Strong correlations (top 2)
  for (const corr of data.correlations.filter((c) => c.confidenceLevel === 'strong').slice(0, 2)) {
    if (corr.effectDescription) {
      points.push({
        prefix: 'Pattern found',
        detail: corr.effectDescription,
        priority: PRIORITY.STRONG_CORRELATION,
        bucket: 'correlations',
      })
    }
  }

  // 6. Low HRV
  if (data.latestVitals.hrvAvg !== null && data.latestVitals.hrvAvg < 25) {
    points.push({
      prefix: 'Low HRV',
      detail: `${Math.round(data.latestVitals.hrvAvg)}ms average -- autonomic stress indicator`,
      priority: PRIORITY.LOW_HRV,
      bucket: 'vitals',
    })
  }

  // 7. Cycle burden
  if (data.cycleStatus.padChangesHeavyDay || data.cycleStatus.clots || data.cycleStatus.pain) {
    const bits: string[] = []
    if (data.cycleStatus.pain) bits.push(`pain: ${data.cycleStatus.pain}`)
    if (data.cycleStatus.padChangesHeavyDay) bits.push(`heaviest day: ${data.cycleStatus.padChangesHeavyDay}`)
    if (data.cycleStatus.clots) bits.push(`clots: ${data.cycleStatus.clots}`)
    points.push({
      prefix: 'Cycle burden',
      detail: bits.join(' | '),
      priority: PRIORITY.CYCLE_BURDEN,
      bucket: 'cycle',
    })
  }

  // Specialist weighting: drop bucket weight -1, sort by priority − weight
  return points
    .filter((p) => weights[p.bucket] >= 0)
    .sort((a, b) => a.priority - weights[a.bucket] - (b.priority - weights[b.bucket]))
    .slice(0, 7)
}

export function useTalkingPoints(data: DoctorPageData, view: SpecialistView): TalkingPoint[] {
  return useMemo(() => buildTalkingPoints(data, view), [data, view])
}
