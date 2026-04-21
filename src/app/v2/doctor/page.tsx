import { createServiceClient } from '@/lib/supabase'
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
 * /v2/doctor — Phase B (11 panels).
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

export default async function V2DoctorPage({ searchParams }: V2DoctorPageProps) {
  const { v } = await searchParams
  const initialView = parseInitialView(v)
  const sb = createServiceClient()

  const thirty = new Date()
  thirty.setDate(thirty.getDate() - 30)
  const thirtyStr = thirty.toISOString().split('T')[0]

  const todayStr = new Date().toISOString().split('T')[0]
  const [
    hpResult,
    apResult,
    labResult,
    ouraResult,
    upcomingApptResult,
    lastApptResult,
    tlResult,
    imgResult,
    corrResult,
  ] = await Promise.all([
    sb.from('health_profile').select('section, content'),
    sb
      .from('active_problems')
      .select('problem, status, latest_data')
      .neq('status', 'resolved')
      .order('updated_at', { ascending: false }),
    sb.from('lab_results').select('*').order('date', { ascending: true }),
    sb.from('oura_daily').select('*').gte('date', thirtyStr).order('date', { ascending: false }),
    sb
      .from('appointments')
      .select('*')
      .gte('date', todayStr)
      .order('date', { ascending: true }),
    sb
      .from('appointments')
      .select('date')
      .lt('date', todayStr)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('medical_timeline')
      .select('*')
      .in('significance', ['important', 'critical'])
      .order('event_date', { ascending: false }),
    sb.from('imaging_studies').select('*').order('study_date', { ascending: false }),
    sb
      .from('correlation_results')
      .select('factor_a, factor_b, effect_description, confidence_level, sample_size, coefficient')
      .in('confidence_level', ['moderate', 'strong'])
      .order('computed_at', { ascending: false })
      .limit(20),
  ])

  const [followThrough, redFlags, staleTests, completeness, medicationDeltas, cyclePhaseFindings] =
    await Promise.all([
      computeFollowThrough(sb).catch(() => [] as FollowThroughItem[]),
      computeRedFlags(sb).catch(() => [] as RedFlag[]),
      computeStaleTests(sb).catch(() => [] as StaleTest[]),
      computeCompleteness(sb).catch(
        () =>
          ({
            windowDays: 30,
            dailyLogs: { total: 0, withPain: 0, withFatigue: 0, withSleep: 0, coveragePct: 0 },
            ouraDays: { total: 0, coveragePct: 0 },
            cycleDays: { total: 0, coveragePct: 0 },
            symptoms: { total: 0 },
            orthostaticTests: { total: 0, positive: 0 },
            labCount: { total: 0 },
            warnings: [],
          }) as CompletenessReport,
      ),
      computeMedicationDeltas(sb).catch(() => [] as MedicationDelta[]),
      computeCyclePhaseFindings(sb).catch(() => [] as CyclePhaseFinding[]),
    ])

  // wrong-modality needs hypothesis names. Pull from active problems.
  const apRows =
    (apResult.data as Array<{ problem: string; status: string; latest_data: string | null }>) ?? []
  const hypothesisNames = apRows.map((r) => r.problem).filter(Boolean)
  const wrongModalityFlags = await computeWrongModalityFlags(sb, hypothesisNames).catch(
    () => [] as WrongModalityFlag[],
  )

  const hp = profileMap((hpResult.data as Array<{ section: string; content: unknown }>) ?? [])
  const personal = hp.get('personal') as PersonalContent | undefined
  const meds = hp.get('medications') as MedicationContent | undefined
  const supps = hp.get('supplements') as SupplementItem[] | undefined
  const diagnoses = hp.get('confirmed_diagnoses') as string[] | undefined
  const suspected = hp.get('suspected_conditions') as string[] | undefined
  const allergies = hp.get('allergies') as string[] | undefined
  const family = hp.get('family_history') as string[] | undefined
  const menstrual = hp.get('menstrual_history') as MenstrualHistoryContent | undefined

  const allLabs = (labResult.data as LabResult[]) ?? []
  const abnormalLabs = allLabs
    .filter((l) => l.flag && l.flag !== 'normal')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const ouraData = (ouraResult.data as OuraDaily[]) ?? []
  const latestOura = ouraData[0] ?? null

  const upcomingAppointments = (upcomingApptResult.data as Appointment[]) ?? []
  const lastAppointmentDate = (lastApptResult.data as { date: string } | null)?.date ?? null
  const timelineEvents = (tlResult.data as MedicalTimelineEvent[]) ?? []
  const imagingStudies = (imgResult.data as ImagingStudy[]) ?? []
  const correlations = (
    (corrResult.data as Array<{
      factor_a: string
      factor_b: string
      effect_description: string | null
      confidence_level: string
      sample_size: number | null
      coefficient: number | null
    }>) ?? []
  ).map((c) => ({
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
    activeProblems: (
      (apResult.data as Array<{ problem: string; status: string; latest_data: string | null }>) ?? []
    ).map((p) => ({ problem: p.problem, status: p.status, latestData: p.latest_data })),
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
    kbHypotheses: null,
    kbActions: null,
    kbChallenger: null,
    kbResearch: null,
    staleTests,
    wrongModalityFlags,
  }

  return <DoctorClientV2 data={pageData} initialView={initialView} />
}
