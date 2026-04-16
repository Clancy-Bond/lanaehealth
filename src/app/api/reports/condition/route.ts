/**
 * Condition-Specific Report Generator
 * GET /api/reports/condition?type=endometriosis|pots|ibs&days=90
 *
 * Generates focused clinical reports for specific conditions.
 * Each report type pulls condition-relevant data and formats it
 * the way that specialty doctors want to see it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const maxDuration = 30

type ConditionType = 'endometriosis' | 'pots' | 'ibs'

export async function GET(req: NextRequest) {
  const conditionType = req.nextUrl.searchParams.get('type') as ConditionType
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '90', 10)

  if (!conditionType || !['endometriosis', 'pots', 'ibs'].includes(conditionType)) {
    return NextResponse.json({ error: 'type must be endometriosis, pots, or ibs' }, { status: 400 })
  }

  const sb = createServiceClient()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  switch (conditionType) {
    case 'endometriosis':
      return generateEndoReport(sb, cutoff, days)
    case 'pots':
      return generatePOTSReport(sb, cutoff, days)
    case 'ibs':
      return generateIBSReport(sb, cutoff, days)
  }
}

async function generateEndoReport(sb: ReturnType<typeof createServiceClient>, cutoff: string, days: number) {
  const [logsResult, cycleResult, labsResult, ouraResult, foodResult] = await Promise.all([
    sb.from('daily_logs').select('date, overall_pain, fatigue, bloating, stress, cycle_phase')
      .gte('date', cutoff).order('date'),
    sb.from('cycle_entries').select('date, flow_level, menstruation, lh_test_result')
      .gte('date', cutoff).order('date'),
    sb.from('lab_results').select('date, test_name, value, unit, flag')
      .in('test_name', ['Ferritin', 'Iron', 'TIBC', 'Hemoglobin', 'WBC', 'hs-CRP', 'ESR', 'CA-125'])
      .gte('date', cutoff).order('date', { ascending: false }),
    sb.from('oura_daily').select('date, sleep_score, hrv_avg, resting_hr')
      .gte('date', cutoff).order('date'),
    sb.from('food_entries').select('logged_at, food_items, flagged_triggers')
      .gte('logged_at', cutoff),
  ])

  const logs = logsResult.data ?? []
  const cycles = cycleResult.data ?? []

  // Pain analysis by cycle phase
  const painByPhase: Record<string, number[]> = { menstrual: [], follicular: [], ovulatory: [], luteal: [] }
  for (const log of logs) {
    if (log.overall_pain !== null && log.cycle_phase) {
      painByPhase[log.cycle_phase]?.push(log.overall_pain)
    }
  }

  const avgPainByPhase: Record<string, number | null> = {}
  for (const [phase, pains] of Object.entries(painByPhase)) {
    avgPainByPhase[phase] = pains.length > 0
      ? Math.round(pains.reduce((a, b) => a + b, 0) / pains.length * 10) / 10
      : null
  }

  // Menstrual pattern
  const menstrualDays = cycles.filter(c => c.menstruation).length
  const heavyDays = cycles.filter(c => c.flow_level === 'heavy').length

  // Food triggers frequency
  const triggerCounts = new Map<string, number>()
  for (const entry of foodResult.data ?? []) {
    for (const trigger of (entry.flagged_triggers ?? [])) {
      triggerCounts.set(trigger, (triggerCounts.get(trigger) ?? 0) + 1)
    }
  }
  const topTriggers = Array.from(triggerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return NextResponse.json({
    reportType: 'endometriosis',
    period: `${days} days`,
    forDoctor: 'OB/GYN or Reproductive Endocrinologist',
    sections: {
      painSummary: {
        avgOverall: avg(logs.map(l => l.overall_pain)),
        avgFatigue: avg(logs.map(l => l.fatigue)),
        avgBloating: avg(logs.map(l => l.bloating)),
        painByPhase: avgPainByPhase,
        worstDays: logs.filter(l => (l.overall_pain ?? 0) >= 7).length,
        daysLogged: logs.length,
      },
      menstrualPattern: {
        menstrualDays,
        heavyDays,
        cycleEntries: cycles.length,
        flowPattern: cycles.slice(-30).map(c => ({ date: c.date, flow: c.flow_level })),
      },
      relevantLabs: (labsResult.data ?? []).map(l => ({
        date: l.date,
        test: l.test_name,
        value: l.value,
        unit: l.unit,
        flag: l.flag,
      })),
      foodTriggers: topTriggers.map(([trigger, count]) => ({ trigger, count })),
      sleepImpact: {
        avgSleepScore: avg((ouraResult.data ?? []).map(o => o.sleep_score)),
        avgHrv: avg((ouraResult.data ?? []).map(o => o.hrv_avg)),
      },
    },
  })
}

async function generatePOTSReport(sb: ReturnType<typeof createServiceClient>, cutoff: string, days: number) {
  const [logsResult, labsResult, ouraResult] = await Promise.all([
    sb.from('daily_logs').select('date, overall_pain, fatigue, stress, sleep_quality')
      .gte('date', cutoff).order('date'),
    sb.from('lab_results').select('date, test_name, value, unit, flag')
      .or('test_name.ilike.%heart rate%,test_name.ilike.%hr%,test_name.ilike.%bp%,test_name.ilike.%tilt%,test_name.ilike.%orthostatic%')
      .gte('date', cutoff).order('date', { ascending: false }),
    sb.from('oura_daily').select('date, sleep_score, hrv_avg, resting_hr, spo2_avg')
      .gte('date', cutoff).order('date'),
  ])

  const oura = ouraResult.data ?? []

  // HR variability analysis
  const rhrValues = oura.map(o => o.resting_hr).filter((v): v is number => v !== null)
  const hrvValues = oura.map(o => o.hrv_avg).filter((v): v is number => v !== null)

  // Find orthostatic/tilt test results
  const orthoResults = (labsResult.data ?? []).filter(l =>
    (l.test_name as string).toLowerCase().includes('orthostatic') ||
    (l.test_name as string).toLowerCase().includes('tilt') ||
    (l.test_name as string).toLowerCase().includes('standing')
  )

  return NextResponse.json({
    reportType: 'pots',
    period: `${days} days`,
    forDoctor: 'Cardiologist or Autonomic Specialist',
    sections: {
      autonomicMetrics: {
        avgRHR: avg(rhrValues.map(v => v)),
        minRHR: rhrValues.length > 0 ? Math.min(...rhrValues) : null,
        maxRHR: rhrValues.length > 0 ? Math.max(...rhrValues) : null,
        avgHRV: avg(hrvValues.map(v => v)),
        daysTracked: oura.length,
      },
      orthostacticTests: orthoResults.map(r => ({
        date: r.date,
        test: r.test_name,
        value: r.value,
        unit: r.unit,
        flag: r.flag,
      })),
      symptomBurden: {
        avgFatigue: avg((logsResult.data ?? []).map(l => l.fatigue)),
        avgPain: avg((logsResult.data ?? []).map(l => l.overall_pain)),
        daysWithFatigue7Plus: (logsResult.data ?? []).filter(l => (l.fatigue ?? 0) >= 7).length,
      },
      sleepQuality: {
        avgSleepScore: avg(oura.map(o => o.sleep_score)),
        avgSpO2: avg(oura.map(o => o.spo2_avg)),
      },
    },
  })
}

async function generateIBSReport(sb: ReturnType<typeof createServiceClient>, cutoff: string, days: number) {
  const [logsResult, foodResult] = await Promise.all([
    sb.from('daily_logs').select('date, overall_pain, bloating, stress, cycle_phase')
      .gte('date', cutoff).order('date'),
    sb.from('food_entries').select('logged_at, food_items, flagged_triggers')
      .gte('logged_at', cutoff),
  ])

  const logs = logsResult.data ?? []

  // Bloating analysis
  const bloatingDays = logs.filter(l => (l.bloating ?? 0) >= 5).length

  // Stress-bloating correlation
  const stressBloating = logs
    .filter(l => l.stress !== null && l.bloating !== null)
    .map(l => ({ stress: l.stress!, bloating: l.bloating! }))

  // Food triggers
  const triggerCounts = new Map<string, number>()
  for (const entry of foodResult.data ?? []) {
    for (const trigger of (entry.flagged_triggers ?? [])) {
      triggerCounts.set(trigger, (triggerCounts.get(trigger) ?? 0) + 1)
    }
  }

  return NextResponse.json({
    reportType: 'ibs',
    period: `${days} days`,
    forDoctor: 'Gastroenterologist',
    sections: {
      digestiveSummary: {
        avgBloating: avg(logs.map(l => l.bloating)),
        avgPain: avg(logs.map(l => l.overall_pain)),
        bloatingDaysOver5: bloatingDays,
        totalDays: logs.length,
      },
      stressCorrelation: {
        dataPoints: stressBloating.length,
        avgStress: avg(stressBloating.map(s => s.stress)),
        avgBloatingOnHighStress: avg(
          stressBloating.filter(s => s.stress >= 7).map(s => s.bloating)
        ),
        avgBloatingOnLowStress: avg(
          stressBloating.filter(s => s.stress <= 3).map(s => s.bloating)
        ),
      },
      foodTriggers: Array.from(triggerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([trigger, count]) => ({ trigger, count })),
      cyclePhaseImpact: {
        bloatingByPhase: (() => {
          const byPhase: Record<string, number[]> = {}
          for (const log of logs) {
            if (log.bloating !== null && log.cycle_phase) {
              if (!byPhase[log.cycle_phase]) byPhase[log.cycle_phase] = []
              byPhase[log.cycle_phase].push(log.bloating)
            }
          }
          const result: Record<string, number | null> = {}
          for (const [phase, vals] of Object.entries(byPhase)) {
            result[phase] = vals.length > 0
              ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
              : null
          }
          return result
        })(),
      },
    },
  })
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10
}
