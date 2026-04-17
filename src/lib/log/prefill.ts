import { createServiceClient } from '@/lib/supabase'
import { format, subDays, parseISO, differenceInDays } from 'date-fns'
import { calculateCyclePhase } from '@/lib/cycle-calculator'
import { SYMPTOM_OPTIONS } from '@/lib/symptom-options'
import type {
  OuraDaily,
  WeatherDaily,
  CycleEntry,
  CyclePhase,
  FlowLevel,
  SymptomCategory,
} from '@/lib/types'

const DEFAULT_PILLS: Array<{ symptom: string; category: SymptomCategory }> = [
  { symptom: 'Headache',    category: 'physical' },
  { symptom: 'Fatigue',     category: 'physical' },
  { symptom: 'Nausea',      category: 'digestive' },
  { symptom: 'Bloating',    category: 'digestive' },
  { symptom: 'Brain Fog',   category: 'mental' },
  { symptom: 'Dizziness',   category: 'physical' },
  { symptom: 'Back Pain',   category: 'physical' },
  { symptom: 'Anxiety',     category: 'mental' },
]

function categoryFor(name: string): SymptomCategory | null {
  for (const [cat, list] of Object.entries(SYMPTOM_OPTIONS) as Array<[SymptomCategory, string[]]>) {
    if (list.includes(name)) return cat
  }
  return null
}

export interface CheckInPrefill {
  date: string
  oura: OuraDaily | null
  weather: WeatherDaily | null
  cycle: {
    day: number | null
    phase: CyclePhase | null
    flow: FlowLevel | null
  }
  yesterday: {
    overall_pain: number | null
    fatigue: number | null
    stress: number | null
    sleep_quality: number | null
  }
  today: {
    overall_pain: number | null
    fatigue: number | null
    stress: number | null
    sleep_quality: number | null
    notes: string | null
  }
  medications: {
    scheduled_today: number
    taken_today: number
  }
  topPills: Array<{ symptom: string; category: SymptomCategory }>
  insight: {
    text: string
    confidence: 'strong' | 'moderate' | 'suggestive' | 'weak' | null
  } | null
  todaySeverity: {
    count: number
    severe: number
    moderate: number
    mild: number
    highest: 'severe' | 'moderate' | 'mild' | null
    names: string[]
  }
  nextAppointment: {
    date: string
    doctor: string | null
    specialty: string | null
    reason: string | null
    daysAway: number
  } | null
  availableMeds: Array<{ name: string; dose: string }>
  weekly: {
    avgPain: number | null
    avgFatigue: number | null
    avgSleepScore: number | null
    symptomsCount: number
    dayCount: number
    painSparkline: Array<{ date: string; pain: number | null }>
  }
  lastChat: {
    content: string
    createdAt: string
  } | null
  ouraLastSync: {
    date: string
    daysAgo: number
  } | null
}

function computeCycleDay(date: string, history: CycleEntry[]): number | null {
  const periodStarts = history
    .filter(e => e.menstruation)
    .map(e => parseISO(e.date))
    .sort((a, b) => b.getTime() - a.getTime())
  const target = parseISO(date)
  const last = periodStarts.find(d => d <= target)
  if (!last) return null
  return differenceInDays(target, last) + 1
}

export async function assemblePrefill(date: string): Promise<CheckInPrefill> {
  const sb = createServiceClient()
  const yesterday = format(subDays(new Date(date), 1), 'yyyy-MM-dd')
  const sixtyDaysAgo = format(subDays(new Date(date), 60), 'yyyy-MM-dd')
  const ninetyDaysAgoIso = subDays(new Date(date), 90).toISOString()

  const fourteenDaysAgo = format(subDays(new Date(date), 14), 'yyyy-MM-dd')
  const sevenDaysAgo = format(subDays(new Date(date), 7), 'yyyy-MM-dd')

  const [ouraRes, weatherRes, cycleRes, cycleHistoryRes, yRes, tRes, symptomHistRes, correlationRes, activeProblemRes, timelineRes, appointmentRes, medProfileRes, weeklyLogsRes, weeklyOuraRes, lastChatRes, ouraLatestRes] = await Promise.all([
    sb.from('oura_daily').select('*').eq('date', date).maybeSingle(),
    sb.from('weather_daily').select('*').eq('date', date).maybeSingle(),
    sb.from('cycle_entries').select('*').eq('date', date).maybeSingle(),
    sb.from('cycle_entries').select('*').gte('date', sixtyDaysAgo).order('date', { ascending: false }),
    sb.from('daily_logs').select('overall_pain,fatigue,stress,sleep_quality').eq('date', yesterday).maybeSingle(),
    sb.from('daily_logs').select('overall_pain,fatigue,stress,sleep_quality,notes,cycle_phase').eq('date', date).maybeSingle(),
    sb.from('symptoms').select('id,symptom,category,severity,logged_at').gte('logged_at', ninetyDaysAgoIso),
    sb.from('correlation_results')
      .select('effect_description,confidence_level')
      .in('confidence_level', ['strong', 'moderate', 'suggestive'])
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('active_problems')
      .select('problem,latest_data,status,linked_symptoms,updated_at')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(10),
    sb.from('medical_timeline')
      .select('title,description,significance,event_date')
      .in('significance', ['important', 'critical'])
      .gte('event_date', fourteenDaysAgo)
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('appointments')
      .select('date,doctor_name,specialty,reason')
      .gte('date', date)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    sb.from('health_profile')
      .select('content')
      .in('section', ['supplements', 'current_medications']),
    sb.from('daily_logs')
      .select('date, overall_pain, fatigue')
      .gte('date', sevenDaysAgo)
      .lte('date', date),
    sb.from('oura_daily')
      .select('date, sleep_score')
      .gte('date', sevenDaysAgo)
      .lte('date', date),
    sb.from('chat_messages')
      .select('content, created_at')
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('oura_daily')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const history = (cycleHistoryRes.data ?? []) as CycleEntry[]
  const cycle = cycleRes.data as CycleEntry | null
  const phase = (tRes.data?.cycle_phase as CyclePhase | null) ?? calculateCyclePhase(date, history)
  const day = computeCycleDay(date, history)

  const symptomRows = (symptomHistRes.data ?? []) as Array<{ symptom: string; category: SymptomCategory | null; severity: 'mild' | 'moderate' | 'severe' | null; logged_at: string }>
  const counts = new Map<string, { category: SymptomCategory; count: number }>()
  for (const row of symptomRows) {
    const name = row.symptom
    if (!name) continue
    const cat = row.category ?? categoryFor(name)
    if (!cat) continue
    const prev = counts.get(name)
    if (prev) prev.count += 1
    else counts.set(name, { category: cat, count: 1 })
  }

  const todayStart = new Date(date + 'T00:00:00').getTime()
  const todayEnd = todayStart + 24 * 60 * 60 * 1000
  const todayRows = symptomRows.filter(s => {
    const t = new Date(s.logged_at).getTime()
    return t >= todayStart && t < todayEnd
  })
  const sev = { severe: 0, moderate: 0, mild: 0 }
  const names: string[] = []
  for (const r of todayRows) {
    if (r.severity === 'severe') sev.severe++
    else if (r.severity === 'mild') sev.mild++
    else sev.moderate++
    names.push(r.symptom)
  }
  const highest: 'severe' | 'moderate' | 'mild' | null =
    sev.severe > 0 ? 'severe' : sev.moderate > 0 ? 'moderate' : sev.mild > 0 ? 'mild' : null
  const todaySeverity = {
    count: todayRows.length,
    severe: sev.severe,
    moderate: sev.moderate,
    mild: sev.mild,
    highest,
    names,
  }
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([symptom, v]) => ({ symptom, category: v.category }))
  const topPills: Array<{ symptom: string; category: SymptomCategory }> = []
  const seen = new Set<string>()
  for (const p of ranked) {
    if (seen.has(p.symptom)) continue
    seen.add(p.symptom)
    topPills.push(p)
    if (topPills.length === 8) break
  }
  for (const p of DEFAULT_PILLS) {
    if (topPills.length === 8) break
    if (seen.has(p.symptom)) continue
    seen.add(p.symptom)
    topPills.push(p)
  }

  return {
    date,
    oura: (ouraRes.data as OuraDaily | null) ?? null,
    weather: (weatherRes.data as WeatherDaily | null) ?? null,
    cycle: {
      day,
      phase,
      flow: cycle?.flow_level ?? null,
    },
    yesterday: {
      overall_pain: yRes.data?.overall_pain ?? null,
      fatigue: yRes.data?.fatigue ?? null,
      stress: yRes.data?.stress ?? null,
      sleep_quality: yRes.data?.sleep_quality ?? null,
    },
    today: {
      overall_pain: tRes.data?.overall_pain ?? null,
      fatigue: tRes.data?.fatigue ?? null,
      stress: tRes.data?.stress ?? null,
      sleep_quality: tRes.data?.sleep_quality ?? null,
      notes: tRes.data?.notes ?? null,
    },
    medications: {
      scheduled_today: 0,
      taken_today: 0,
    },
    topPills,
    insight: pickInsight(correlationRes.data, (activeProblemRes.data ?? []) as ProblemRow[], todaySeverity.names, timelineRes.data),
    todaySeverity,
    nextAppointment: appointmentRes.data
      ? (() => {
          const apt = appointmentRes.data as { date: string; doctor_name: string | null; specialty: string | null; reason: string | null }
          const daysAway = Math.round((new Date(apt.date).getTime() - new Date(date).getTime()) / (24 * 60 * 60 * 1000))
          return {
            date: apt.date,
            doctor: apt.doctor_name,
            specialty: apt.specialty,
            reason: apt.reason,
            daysAway,
          }
        })()
      : null,
    availableMeds: extractMeds((medProfileRes.data ?? []) as Array<{ content: unknown }>),
    weekly: computeWeekly(
      (weeklyLogsRes.data ?? []) as Array<{ date: string; overall_pain: number | null; fatigue: number | null }>,
      (weeklyOuraRes.data ?? []) as Array<{ date: string; sleep_score: number | null }>,
      symptomRows,
      date,
      sevenDaysAgo
    ),
    lastChat: lastChatRes.data
      ? {
          content: String((lastChatRes.data as { content?: string }).content ?? ''),
          createdAt: String((lastChatRes.data as { created_at?: string }).created_at ?? ''),
        }
      : null,
    ouraLastSync: ouraLatestRes.data
      ? (() => {
          const latest = (ouraLatestRes.data as { date: string }).date
          const diffMs = new Date(date).getTime() - new Date(latest).getTime()
          const daysAgo = Math.round(diffMs / (24 * 60 * 60 * 1000))
          return { date: latest, daysAgo: Math.max(0, daysAgo) }
        })()
      : null,
  }
}

function computeWeekly(
  logs: Array<{ date: string; overall_pain: number | null; fatigue: number | null }>,
  oura: Array<{ date: string; sleep_score: number | null }>,
  symptomRows: Array<{ logged_at: string }>,
  today: string,
  sevenAgo: string
): CheckInPrefill['weekly'] {
  const painVals = logs.map(l => l.overall_pain).filter((v): v is number => v !== null)
  const fatigueVals = logs.map(l => l.fatigue).filter((v): v is number => v !== null)
  const sleepVals = oura.map(o => o.sleep_score).filter((v): v is number => v !== null)
  const avg = (arr: number[]) => (arr.length === 0 ? null : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10)
  const sevenAgoIso = new Date(sevenAgo + 'T00:00:00').getTime()
  const todayEndIso = new Date(today + 'T23:59:59').getTime()
  const weeklySymptoms = symptomRows.filter(r => {
    const t = new Date(r.logged_at).getTime()
    return t >= sevenAgoIso && t <= todayEndIso
  })
  const logsByDate = new Map(logs.map(l => [l.date, l]))
  const sparkline: Array<{ date: string; pain: number | null }> = []
  const startDate = new Date(sevenAgo + 'T00:00:00')
  for (let i = 0; i <= 7; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    sparkline.push({ date: dateStr, pain: logsByDate.get(dateStr)?.overall_pain ?? null })
  }

  return {
    avgPain: avg(painVals),
    avgFatigue: avg(fatigueVals),
    avgSleepScore: avg(sleepVals),
    symptomsCount: weeklySymptoms.length,
    dayCount: logs.length,
    painSparkline: sparkline,
  }
}

function extractMeds(rows: Array<{ content: unknown }>): Array<{ name: string; dose: string }> {
  const out: Array<{ name: string; dose: string }> = []
  for (const row of rows) {
    if (!Array.isArray(row.content)) continue
    for (const item of row.content) {
      if (item && typeof item === 'object' && 'name' in item) {
        const entry = item as { name?: unknown; dose?: unknown }
        const name = typeof entry.name === 'string' ? entry.name : null
        const dose = typeof entry.dose === 'string' ? entry.dose : ''
        if (name) out.push({ name, dose })
      }
    }
  }
  return out
}

type CorrelationRow = { effect_description?: string | null; confidence_level?: 'strong' | 'moderate' | 'suggestive' | 'weak' | null }
type ProblemRow = { problem?: string | null; latest_data?: string | null; linked_symptoms?: string[] | null; updated_at?: string | null }
type TimelineRow = { title?: string | null; description?: string | null; significance?: string | null }

const HIGH_PRIORITY_TERMS = [
  'POTS', 'dysautonom', 'orthostatic', 'tachycardia',
  'endometrios', 'pelvic', 'dysmenorrh',
  'IBS', 'bowel', 'GI',
  'fibromyalg',
  'thyroid', 'hypothyroid', 'hyperthyroid',
  'PCOS',
  'migraine', 'headache',
  'chronic fatigue', 'ME/CFS', 'long COVID',
]

function scoreProblem(p: ProblemRow, todaySymptoms: string[]): number {
  let score = 0
  const hay = `${p.problem ?? ''} ${(p.linked_symptoms ?? []).join(' ')}`.toLowerCase()
  for (const sym of todaySymptoms) {
    if (hay.includes(sym.toLowerCase())) score += 10
  }
  for (const term of HIGH_PRIORITY_TERMS) {
    if (hay.includes(term.toLowerCase())) score += 3
  }
  if (p.updated_at) {
    const daysAgo = (Date.now() - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000)
    if (daysAgo < 7) score += 2
    else if (daysAgo < 30) score += 1
  }
  return score
}

function pickInsight(
  corr: CorrelationRow | null,
  problems: ProblemRow[],
  todaySymptoms: string[],
  timeline: TimelineRow | null
): CheckInPrefill['insight'] {
  if (corr && corr.effect_description) {
    return {
      text: corr.effect_description,
      confidence: corr.confidence_level ?? null,
    }
  }
  if (problems.length > 0) {
    const scored = problems
      .map(p => ({ problem: p, score: scoreProblem(p, todaySymptoms) }))
      .sort((a, b) => b.score - a.score)
    const best = scored[0].problem
    const latest = best.latest_data ? ` — ${best.latest_data.split(/\.\s+/)[0]}` : ''
    return {
      text: `Active problem: ${best.problem ?? 'unknown'}${latest}`,
      confidence: scored[0].score >= 10 ? 'strong' : scored[0].score >= 3 ? 'moderate' : 'suggestive',
    }
  }
  if (timeline && (timeline.title || timeline.description)) {
    const title = timeline.title ?? 'Recent event'
    const desc = timeline.description ? ` — ${timeline.description.split(/\.\s+/)[0]}` : ''
    return {
      text: `${title}${desc}`,
      confidence: timeline.significance === 'critical' ? 'strong' : 'moderate',
    }
  }
  return null
}
