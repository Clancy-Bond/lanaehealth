import { createServiceClient } from '@/lib/supabase'
import { safeAll } from '@/lib/v2/safe-all'
import { computeCompleteness, type CompletenessReport } from '@/lib/doctor/completeness'
import { computeFollowThrough, type FollowThroughItem } from '@/lib/doctor/follow-through'
import { computeRedFlags, type RedFlag } from '@/lib/doctor/red-flags'
import { computeStaleTests, type StaleTest } from '@/lib/doctor/stale-tests'
import { computeMedicationDeltas, type MedicationDelta } from '@/lib/doctor/medication-deltas'
import {
  computeCyclePhaseFindings,
  type CyclePhaseFinding,
} from '@/lib/doctor/cycle-phase-correlation'
import { computeWrongModalityFlags, type WrongModalityFlag } from '@/lib/doctor/wrong-modality'
import { loadKBHypotheses } from '@/lib/doctor/kb-hypotheses'
import { loadKBActions } from '@/lib/doctor/kb-actions'
import { loadKBChallenger } from '@/lib/doctor/kb-challenger'
import { loadKBResearch } from '@/lib/doctor/kb-research'
import { parseProfileContent } from '@/lib/profile/parse-content'
import type {
  Appointment,
  ImagingStudy,
  LabResult,
  MedicalTimelineEvent,
  OuraDaily,
} from '@/lib/types'
import DoctorClientV2 from './_components/DoctorClientV2'
import type { DoctorPageData } from '@/app/doctor/page'
import type { SpecialistView } from '@/lib/doctor/specialist-config'

export const dynamic = 'force-dynamic'

/*
 * /v2/doctor - Phase B (11 panels).
 *
 * Fetches the subset of DoctorPageData needed by the panels landed
 * so far: Phase A (patient, vitals, labs, cycle, appointments, red
 * flags, stale tests, follow-through, completeness) plus Phase B
 * (timeline, imaging, correlations, medication deltas, cycle-phase
 * findings, wrong-modality, last-appointment date, talking points).
 * Orthostatic tests + KB hypotheses / actions / challenger / research
 * stay stubbed until Phase C adds their cards.
 *
 * Full data parity with legacy /doctor will be reached once every
 * panel has landed. For now the legacy route stays authoritative.
 */

interface PersonalContent {
  full_name: string
  age: number
  sex: string
  blood_type: string
  height_cm: number
  weight_kg: number
  location: string
}
interface MedicationContent {
  as_needed?: Array<{ name: string; dose?: string; frequency?: string }>
}
interface SupplementItem {
  name: string
  dose?: string
}
interface MenstrualHistoryContent {
  average_cycle_length?: number
  last_period_date?: string
  current_phase?: string
  period_duration_days?: number
  flow?: string
  clots?: string
  pain?: string
  pad_changes_heavy_day?: string
  iron_loss_per_cycle?: string
  regularity?: string
}

function profileMap(rows: Array<{ section: string; content: unknown }>): Map<string, unknown> {
  const m = new Map<string, unknown>()
  for (const r of rows) m.set(r.section, parseProfileContent(r.content))
  return m
}

function parseInitialView(v: string | undefined): SpecialistView {
  if (v === 'pcp' || v === 'obgyn' || v === 'cardiology') return v
  return 'pcp'
}

interface V2DoctorPageProps {
  searchParams: Promise<{ v?: string }>
}

// Empty pageData used when the Supabase client itself cannot be
// constructed (missing env vars on a preview deploy is the canonical
// case). The page still renders so the user sees the failure banner
// rather than the v2 error boundary.
function buildEmptyPageData(): DoctorPageData {
  return {
    patient: {
      name: 'Lanae A. Bond',
      age: 24,
      sex: 'Female',
      bloodType: 'A+',
      heightCm: 170,
      weightKg: 67.3,
    },
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
    completeness: {
      windowDays: 30,
      dailyLogs: { total: 0, withPain: 0, withFatigue: 0, withSleep: 0, coveragePct: 0 },
      ouraDays: { total: 0, coveragePct: 0 },
      cycleDays: { total: 0, coveragePct: 0 },
      symptoms: { total: 0 },
      orthostaticTests: { total: 0, positive: 0 },
      labCount: { total: 0 },
      warnings: [],
    },
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

export default async function V2DoctorPage({ searchParams }: V2DoctorPageProps) {
  const { v } = await searchParams
  const initialView = parseInitialView(v)

  // createServiceClient throws synchronously when env vars are
  // missing, which is the canonical Vercel-preview failure mode. If
  // we cannot build the client, render the page with empty data and
  // a full-failure banner rather than triggering the error boundary.
  let sb: ReturnType<typeof createServiceClient>
  try {
    sb = createServiceClient()
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[v2/doctor] createServiceClient failed:', err)
    return (
      <DoctorClientV2
        data={buildEmptyPageData()}
        initialView={initialView}
        failureCount={1}
        totalQueries={1}
      />
    )
  }

  const thirty = new Date()
  thirty.setDate(thirty.getDate() - 30)
  const thirtyStr = thirty.toISOString().split('T')[0]

  const todayStr = new Date().toISOString().split('T')[0]

  // Per-query error isolation. A single Promise.all rejection used to
  // tear down the whole render and trip the v2 error boundary, even
  // when the failure was an environmental hiccup on one query (a
  // missing env var or a temporary Supabase blip on Vercel preview).
  // Each panel can degrade to its empty state while the others render.
  // We aggregate errors and surface a banner so the doctor knows what
  // is missing. Silent partial failure is the wrong default for a
  // medical surface.
  const queryResults = await safeAll({
    hp: Promise.resolve(sb.from('health_profile').select('section, content')),
    ap: Promise.resolve(
      sb
        .from('active_problems')
        .select('problem, status, latest_data')
        .neq('status', 'resolved')
        .order('updated_at', { ascending: false }),
    ),
    lab: Promise.resolve(sb.from('lab_results').select('*').order('date', { ascending: true })),
    oura: Promise.resolve(
      sb.from('oura_daily').select('*').gte('date', thirtyStr).order('date', { ascending: false }),
    ),
    upcomingAppt: Promise.resolve(
      sb
        .from('appointments')
        .select('*')
        .gte('date', todayStr)
        .order('date', { ascending: true }),
    ),
    lastAppt: Promise.resolve(
      sb
        .from('appointments')
        .select('date')
        .lt('date', todayStr)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
    tl: Promise.resolve(
      sb
        .from('medical_timeline')
        .select('*')
        .in('significance', ['important', 'critical'])
        .order('event_date', { ascending: false }),
    ),
    img: Promise.resolve(
      sb.from('imaging_studies').select('*').order('study_date', { ascending: false }),
    ),
    corr: Promise.resolve(
      sb
        .from('correlation_results')
        .select(
          'factor_a, factor_b, effect_description, confidence_level, sample_size, coefficient',
        )
        .in('confidence_level', ['moderate', 'strong'])
        .order('computed_at', { ascending: false })
        .limit(20),
    ),
  })

  // Treat a Supabase-level error (data === null + error set) as a
  // failure for the banner, even though the promise itself fulfilled.
  function failedQuery(r: { data: unknown; error: Error | null; label: string }): boolean {
    if (r.error) return true
    const inner = r.data as { error?: unknown } | null
    if (inner && typeof inner === 'object' && 'error' in inner && inner.error) return true
    return false
  }

  const hpResult = (queryResults.hp.data ?? { data: null }) as {
    data: Array<{ section: string; content: unknown }> | null
  }
  const apResult = (queryResults.ap.data ?? { data: null }) as {
    data: Array<{ problem: string; status: string; latest_data: string | null }> | null
  }
  const labResult = (queryResults.lab.data ?? { data: null }) as { data: LabResult[] | null }
  const ouraResult = (queryResults.oura.data ?? { data: null }) as { data: OuraDaily[] | null }
  const upcomingApptResult = (queryResults.upcomingAppt.data ?? { data: null }) as {
    data: Appointment[] | null
  }
  const lastApptResult = (queryResults.lastAppt.data ?? { data: null }) as {
    data: { date: string } | null
  }
  const tlResult = (queryResults.tl.data ?? { data: null }) as {
    data: MedicalTimelineEvent[] | null
  }
  const imgResult = (queryResults.img.data ?? { data: null }) as { data: ImagingStudy[] | null }
  const corrResult = (queryResults.corr.data ?? { data: null }) as {
    data: Array<{
      factor_a: string
      factor_b: string
      effect_description: string | null
      confidence_level: string
      sample_size: number | null
      coefficient: number | null
    }> | null
  }

  const computedResults = await safeAll({
    followThrough: computeFollowThrough(sb),
    redFlags: computeRedFlags(sb),
    staleTests: computeStaleTests(sb),
    completeness: computeCompleteness(sb),
    medicationDeltas: computeMedicationDeltas(sb),
    cyclePhaseFindings: computeCyclePhaseFindings(sb),
    kbHypotheses: loadKBHypotheses(sb),
    kbActions: loadKBActions(sb),
    kbChallenger: loadKBChallenger(sb),
    kbResearch: loadKBResearch(sb),
  })

  const followThrough = (computedResults.followThrough.data ?? []) as FollowThroughItem[]
  const redFlags = (computedResults.redFlags.data ?? []) as RedFlag[]
  const staleTests = (computedResults.staleTests.data ?? []) as StaleTest[]
  const completeness = (computedResults.completeness.data ?? {
    windowDays: 30,
    dailyLogs: { total: 0, withPain: 0, withFatigue: 0, withSleep: 0, coveragePct: 0 },
    ouraDays: { total: 0, coveragePct: 0 },
    cycleDays: { total: 0, coveragePct: 0 },
    symptoms: { total: 0 },
    orthostaticTests: { total: 0, positive: 0 },
    labCount: { total: 0 },
    warnings: [],
  }) as CompletenessReport
  const medicationDeltas = (computedResults.medicationDeltas.data ?? []) as MedicationDelta[]
  const cyclePhaseFindings = (computedResults.cyclePhaseFindings.data ?? []) as CyclePhaseFinding[]
  const kbHypotheses = computedResults.kbHypotheses.data ?? null
  const kbActions = computedResults.kbActions.data ?? null
  const kbChallenger = computedResults.kbChallenger.data ?? null
  const kbResearch = computedResults.kbResearch.data ?? null

  // wrong-modality needs hypothesis names. Pull from active problems.
  const apRows = (apResult.data as Array<
    { problem: string; status: string; latest_data: string | null }
  > | null) ?? []
  const hypothesisNames = apRows.map((r) => r.problem).filter(Boolean)
  const wrongModalityResult = await safeAll({
    wrongModality: computeWrongModalityFlags(sb, hypothesisNames),
  })
  const wrongModalityFlags = (wrongModalityResult.wrongModality.data ?? []) as WrongModalityFlag[]

  // Aggregate failures across every fan-out so the banner can tell
  // the user how much is missing.
  const allResults = [
    ...Object.values(queryResults),
    ...Object.values(computedResults),
    ...Object.values(wrongModalityResult),
  ]
  const totalQueries = allResults.length
  const failedCount = allResults.filter(failedQuery).length

  const hp = profileMap(hpResult.data ?? [])
  const personal = hp.get('personal') as PersonalContent | undefined
  const meds = hp.get('medications') as MedicationContent | undefined
  const supps = hp.get('supplements') as SupplementItem[] | undefined
  const diagnoses = hp.get('confirmed_diagnoses') as string[] | undefined
  const suspected = hp.get('suspected_conditions') as string[] | undefined
  const allergies = hp.get('allergies') as string[] | undefined
  const family = hp.get('family_history') as string[] | undefined
  const menstrual = hp.get('menstrual_history') as MenstrualHistoryContent | undefined

  const allLabs = labResult.data ?? []
  const abnormalLabs = allLabs
    .filter((l) => l.flag && l.flag !== 'normal')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const ouraData = ouraResult.data ?? []
  const latestOura = ouraData[0] ?? null

  const upcomingAppointments = upcomingApptResult.data ?? []
  const lastAppointmentDate = lastApptResult.data?.date ?? null
  const timelineEvents = tlResult.data ?? []
  const imagingStudies = imgResult.data ?? []
  const correlations = (corrResult.data ?? []).map((c) => ({
    factorA: c.factor_a,
    factorB: c.factor_b,
    effectDescription: c.effect_description,
    confidenceLevel: c.confidence_level,
    sampleSize: c.sample_size,
    coefficient: c.coefficient,
  }))

  const pageData: DoctorPageData = {
    patient: {
      name: personal?.full_name ?? 'Lanae A. Bond',
      age: personal?.age ?? 24,
      sex: personal?.sex ?? 'Female',
      bloodType: personal?.blood_type ?? 'A+',
      heightCm: personal?.height_cm ?? 170,
      weightKg: personal?.weight_kg ?? 67.3,
    },
    activeProblems: (apResult.data ?? []).map((p) => ({
      problem: p.problem,
      status: p.status,
      latestData: p.latest_data,
    })),
    confirmedDiagnoses: diagnoses ?? [],
    suspectedConditions: suspected ?? [],
    medications: meds?.as_needed ?? [],
    supplements: (supps ?? []).map((s) => ({ name: s.name, dose: s.dose })),
    allergies: allergies ?? [],
    familyHistory: family ?? [],
    latestVitals: {
      hrvAvg: latestOura?.hrv_avg ?? null,
      restingHr: latestOura?.resting_hr ?? null,
      sleepScore: latestOura?.sleep_score ?? null,
      tempDeviation: latestOura?.body_temp_deviation ?? null,
      readinessScore: latestOura?.readiness_score ?? null,
      spo2Avg: latestOura?.spo2_avg ?? null,
      respiratoryRate: latestOura?.respiratory_rate ?? null,
      date: latestOura?.date ?? null,
    },
    abnormalLabs,
    allLabs,
    cycleStatus: {
      currentPhase: menstrual?.current_phase ?? null,
      lastPeriodDate: menstrual?.last_period_date ?? null,
      averageCycleLength: menstrual?.average_cycle_length ?? null,
      periodLengthDays: menstrual?.period_duration_days ?? null,
      flow: menstrual?.flow ?? null,
      clots: menstrual?.clots ?? null,
      pain: menstrual?.pain ?? null,
      padChangesHeavyDay: menstrual?.pad_changes_heavy_day ?? null,
      ironLossPerCycle: menstrual?.iron_loss_per_cycle ?? null,
      regularity: menstrual?.regularity ?? null,
    },
    timelineEvents,
    imagingStudies,
    correlations,
    upcomingAppointments,
    lastAppointmentDate,
    orthostaticTests: [],
    medicationDeltas,
    cyclePhaseFindings,
    completeness,
    followThrough,
    redFlags,
    kbHypotheses,
    kbActions,
    kbChallenger,
    kbResearch,
    staleTests,
    wrongModalityFlags,
  }

  return (
    <DoctorClientV2
      data={pageData}
      initialView={initialView}
      failureCount={failedCount}
      totalQueries={totalQueries}
    />
  )
}
