// ARCHIVED: This legacy route is now redirected to /v2/doctor via next.config.ts.
// Kept in source for fast revert. To revive: remove the redirect in next.config.ts.
// Cutover landed: 2026-04-25 (PR #30 doctor mode acceptance gate flipped).

import Link from "next/link";
import { createServiceClient } from "@/lib/supabase";
import { DoctorClient } from "@/components/doctor/DoctorClient";
import { computeMedicationDeltas, type MedicationDelta } from "@/lib/doctor/medication-deltas";
import {
  computeCyclePhaseFindings,
  type CyclePhaseFinding,
} from "@/lib/doctor/cycle-phase-correlation";
import { computeCompleteness, type CompletenessReport } from "@/lib/doctor/completeness";
import { computeFollowThrough, type FollowThroughItem } from "@/lib/doctor/follow-through";
import { computeRedFlags, type RedFlag } from "@/lib/doctor/red-flags";
import { loadKBHypotheses, type KBHypothesisPayload } from "@/lib/doctor/kb-hypotheses";
import { loadKBActions, type KBActionsPayload } from "@/lib/doctor/kb-actions";
import { loadKBChallenger, type ChallengerPayload } from "@/lib/doctor/kb-challenger";
import { loadKBResearch, type ResearchPayload } from "@/lib/doctor/kb-research";
import { computeStaleTests, type StaleTest } from "@/lib/doctor/stale-tests";
import {
  computeWrongModalityFlags,
  type WrongModalityFlag,
} from "@/lib/doctor/wrong-modality";
import { parseProfileContent } from "@/lib/profile/parse-content";
import type {
  LabResult,
  OuraDaily,
  ImagingStudy,
  MedicalTimelineEvent,
  Appointment,
} from "@/lib/types";

// Live data - always re-fetch
export const dynamic = "force-dynamic";

// ── Interfaces for health_profile JSONB shapes ─────────────────────

interface PersonalContent {
  full_name: string;
  age: number;
  sex: string;
  blood_type: string;
  height_cm: number;
  weight_kg: number;
  location: string;
}

interface MedicationContent {
  as_needed?: Array<{ name: string; dose?: string; frequency?: string }>;
}

interface SupplementItem {
  name: string;
  dose?: string;
}

interface MenstrualHistoryContent {
  average_cycle_length?: number;
  last_period_date?: string;
  current_phase?: string;
  menarche_age?: number;
  regularity?: string;
  period_duration_days?: number;
  flow?: string;
  clots?: string;
  pain?: string;
  pad_changes_heavy_day?: string;
  iron_loss_per_cycle?: string;
  hormonal_bc?: string;
  fertility?: string;
}

// ── Types exported for child components ────────────────────────────

export interface DoctorPageData {
  patient: {
    name: string;
    age: number;
    sex: string;
    bloodType: string;
    heightCm: number;
    weightKg: number;
  };
  activeProblems: Array<{
    problem: string;
    status: string;
    latestData: string | null;
  }>;
  confirmedDiagnoses: string[];
  suspectedConditions: string[];
  medications: Array<{ name: string; dose?: string; frequency?: string }>;
  supplements: Array<{ name: string; dose?: string }>;
  allergies: string[];
  familyHistory: string[];
  latestVitals: {
    hrvAvg: number | null;
    restingHr: number | null;
    sleepScore: number | null;
    tempDeviation: number | null;
    readinessScore: number | null;
    spo2Avg: number | null;
    respiratoryRate: number | null;
    date: string | null;
  };
  abnormalLabs: LabResult[];
  allLabs: LabResult[];
  cycleStatus: {
    currentPhase: string | null;
    lastPeriodDate: string | null;
    averageCycleLength: number | null;
    periodLengthDays: number | null;
    flow: string | null;
    clots: string | null;
    pain: string | null;
    padChangesHeavyDay: string | null;
    ironLossPerCycle: string | null;
    regularity: string | null;
  };
  timelineEvents: MedicalTimelineEvent[];
  imagingStudies: ImagingStudy[];
  correlations: Array<{
    factorA: string;
    factorB: string;
    effectDescription: string | null;
    confidenceLevel: string;
    sampleSize: number | null;
    coefficient: number | null;
  }>;
  upcomingAppointments: Appointment[];
  lastAppointmentDate: string | null;
  orthostaticTests: Array<{
    id: string;
    test_date: string;
    resting_hr_bpm: number;
    peak_rise_bpm: number | null;
    standing_hr_1min: number | null;
    standing_hr_3min: number | null;
    standing_hr_5min: number | null;
    standing_hr_10min: number | null;
    symptoms_experienced: string | null;
  }>;
  medicationDeltas: MedicationDelta[];
  cyclePhaseFindings: CyclePhaseFinding[];
  completeness: CompletenessReport;
  followThrough: FollowThroughItem[];
  redFlags: RedFlag[];
  kbHypotheses: KBHypothesisPayload | null;
  kbActions: KBActionsPayload | null;
  kbChallenger: ChallengerPayload | null;
  kbResearch: ResearchPayload | null;
  staleTests: StaleTest[];
  wrongModalityFlags: WrongModalityFlag[];
}

// ── Helper: build profile map from health_profile rows ─────────────

function profileMap(
  rows: Array<{ section: string; content: unknown }>
): Map<string, unknown> {
  const m = new Map<string, unknown>();
  // parseProfileContent handles both shapes that coexist in health_profile:
  // raw jsonb objects and legacy JSON-stringified strings (pre-W2.6).
  for (const r of rows) m.set(r.section, parseProfileContent(r.content));
  return m;
}

// ── Server component ───────────────────────────────────────────────

interface DoctorPageProps {
  searchParams: Promise<{ v?: string }>;
}

function parseInitialView(v: string | undefined): "pcp" | "obgyn" | "cardiology" {
  if (v === "obgyn" || v === "cardiology" || v === "pcp") return v;
  return "pcp";
}

export default async function DoctorPage({ searchParams }: DoctorPageProps) {
  const { v } = await searchParams;
  const initialView = parseInitialView(v);
  const sb = createServiceClient();

  // Calculate date 30 days ago for Oura query
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // Fetch ALL data in parallel
  const [
    hpResult,
    apResult,
    tlResult,
    labResult,
    ouraResult,
    imgResult,
    corrResult,
    ncResult,
    ncLastPeriodResult,
    upcomingApptResult,
    lastApptResult,
    orthostaticResult,
  ] = await Promise.all([
    // Health profile - all sections
    sb.from("health_profile").select("section, content"),

    // Active problems - unresolved
    sb
      .from("active_problems")
      .select("problem, status, latest_data")
      .neq("status", "resolved")
      .order("updated_at", { ascending: false }),

    // Medical timeline - important + critical only
    sb
      .from("medical_timeline")
      .select("*")
      .in("significance", ["important", "critical"])
      .order("event_date", { ascending: false }),

    // Lab results - ALL (for trend charts)
    sb
      .from("lab_results")
      .select("*")
      .order("date", { ascending: true }),

    // Oura - last 30 days
    sb
      .from("oura_daily")
      .select("*")
      .gte("date", thirtyDaysAgoStr)
      .order("date", { ascending: false }),

    // Imaging studies
    sb
      .from("imaging_studies")
      .select("*")
      .order("study_date", { ascending: false }),

    // Correlation results - moderate + strong only
    sb
      .from("correlation_results")
      .select(
        "factor_a, factor_b, effect_description, confidence_level, sample_size, coefficient"
      )
      .in("confidence_level", ["moderate", "strong"])
      .order("computed_at", { ascending: false })
      .limit(20),

    // Natural Cycles - most recent entry for cycle phase
    sb
      .from("nc_imported")
      .select("cycle_day, cycle_number, fertility_color, ovulation_status, date, menstruation")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Natural Cycles - most recent menstruation=true for last period date
    sb
      .from("nc_imported")
      .select("date")
      .eq("menstruation", true)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Appointments - upcoming (today or later)
    sb
      .from("appointments")
      .select("*")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true }),

    // Appointments - most recent past one (for "changes since last visit")
    sb
      .from("appointments")
      .select("date")
      .lt("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Orthostatic tests (may fail silently if table not yet created)
    sb
      .from("orthostatic_tests")
      .select(
        "id, test_date, resting_hr_bpm, peak_rise_bpm, standing_hr_1min, standing_hr_3min, standing_hr_5min, standing_hr_10min, symptoms_experienced"
      )
      .order("test_date", { ascending: false })
      .limit(20),
  ]);

  // Tier 2+3 parallel analytics + KB hypothesis tracker. These wrap their
  // own queries, so run them separately; each is resilient to errors.
  const [medDeltasP, cycleFindingsP, completenessP, followThroughP, redFlagsP, kbHypothesesP, kbActionsP, kbChallengerP, kbResearchP, staleTestsP] =
    await Promise.all([
      computeMedicationDeltas(sb).catch(() => [] as MedicationDelta[]),
      computeCyclePhaseFindings(sb).catch(() => [] as CyclePhaseFinding[]),
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
          } as CompletenessReport),
      ),
      computeFollowThrough(sb).catch(() => [] as FollowThroughItem[]),
      computeRedFlags(sb).catch(() => [] as RedFlag[]),
      loadKBHypotheses(sb).catch(() => null),
      loadKBActions(sb).catch(() => null),
      loadKBChallenger(sb).catch(() => null),
      loadKBResearch(sb).catch(() => null),
      computeStaleTests(sb).catch(() => [] as StaleTest[]),
    ]);

  // computeWrongModalityFlags needs the current hypothesis names. Pull them
  // from the KB hypotheses payload (or fall back to active-problem names)
  // so the check runs against the most relevant working diagnoses.
  const hypothesisNames = (() => {
    type HypothesisCandidate = { name?: unknown; hypothesis?: unknown; label?: unknown };
    const payload = kbHypothesesP as { hypotheses?: HypothesisCandidate[] } | null;
    const fromKb: string[] = [];
    for (const h of payload?.hypotheses ?? []) {
      const raw = h.name ?? h.hypothesis ?? h.label;
      if (typeof raw === 'string' && raw.trim().length > 0) fromKb.push(raw);
    }
    if (fromKb.length > 0) return fromKb;
    const apRows = (apResult.data as Array<{ problem: string }> | null) ?? [];
    return apRows.map((r) => r.problem).filter(Boolean);
  })();
  const wrongModalityFlagsP = await computeWrongModalityFlags(sb, hypothesisNames).catch(
    () => [] as WrongModalityFlag[],
  );

  // Build health profile lookup
  const hp = profileMap(
    (hpResult.data as Array<{ section: string; content: unknown }>) ?? []
  );

  const personal = hp.get("personal") as PersonalContent | undefined;
  const meds = hp.get("medications") as MedicationContent | undefined;
  const supps = hp.get("supplements") as SupplementItem[] | undefined;
  const allergies = hp.get("allergies") as string[] | undefined;
  const family = hp.get("family_history") as string[] | undefined;
  const diagnoses = hp.get("confirmed_diagnoses") as string[] | undefined;
  const suspected = hp.get("suspected_conditions") as string[] | undefined;
  const menstrual = hp.get("menstrual_history") as
    | MenstrualHistoryContent
    | undefined;

  // Active problems
  const activeProblems = (
    (apResult.data as Array<{
      problem: string;
      status: string;
      latest_data: string | null;
    }>) ?? []
  ).map((p) => ({
    problem: p.problem,
    status: p.status,
    latestData: p.latest_data,
  }));

  // Labs
  const allLabs = (labResult.data as LabResult[]) ?? [];
  const abnormalLabs = allLabs
    .filter((l) => l.flag && l.flag !== "normal")
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

  // Oura - latest entry for vitals
  const ouraData = (ouraResult.data as OuraDaily[]) ?? [];
  const latestOura = ouraData.length > 0 ? ouraData[0] : null;

  // Timeline
  const timelineEvents =
    (tlResult.data as MedicalTimelineEvent[]) ?? [];

  // Imaging
  const imagingStudies = (imgResult.data as ImagingStudy[]) ?? [];

  // Correlations
  const correlations = (
    (corrResult.data as Array<{
      factor_a: string;
      factor_b: string;
      effect_description: string | null;
      confidence_level: string;
      sample_size: number | null;
      coefficient: number | null;
    }>) ?? []
  ).map((c) => ({
    factorA: c.factor_a,
    factorB: c.factor_b,
    effectDescription: c.effect_description,
    confidenceLevel: c.confidence_level,
    sampleSize: c.sample_size,
    coefficient: c.coefficient,
  }));

  // Cycle status - combine NC data with health profile menstrual history
  const ncData = ncResult.data;
  const ncLastPeriodData = ncLastPeriodResult.data as { date: string } | null;
  let currentPhase: string | null = menstrual?.current_phase ?? null;
  if (!currentPhase && ncData?.cycle_day) {
    const cd = ncData.cycle_day;
    if (cd <= 5) currentPhase = "Menstrual";
    else if (cd <= 13) currentPhase = "Follicular";
    else if (cd <= 16) currentPhase = "Ovulatory";
    else currentPhase = "Luteal";
  }

  // Prefer NC menstruation data for last period date, fall back to health_profile
  const lastPeriodDate =
    ncLastPeriodData?.date ?? menstrual?.last_period_date ?? null;

  // Upcoming appointments
  const upcomingAppointments = (upcomingApptResult.data as Appointment[]) ?? [];

  // Last past appointment date (for "changes since last visit")
  const lastApptData = lastApptResult.data as { date: string } | null;
  const lastAppointmentDate = lastApptData?.date ?? null;

  // Assemble the complete data payload
  const pageData: DoctorPageData = {
    patient: {
      name: personal?.full_name ?? "Lanae A. Bond",
      age: personal?.age ?? 24,
      sex: personal?.sex ?? "Female",
      bloodType: personal?.blood_type ?? "A+",
      heightCm: personal?.height_cm ?? 170,
      weightKg: personal?.weight_kg ?? 67.3,
    },
    activeProblems,
    confirmedDiagnoses: diagnoses ?? [],
    suspectedConditions: suspected ?? [],
    medications: meds?.as_needed ?? [],
    supplements: (supps ?? []).map((s) => ({
      name: s.name,
      dose: s.dose,
    })),
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
      currentPhase,
      lastPeriodDate: lastPeriodDate,
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
    orthostaticTests:
      orthostaticResult.error ||
      !Array.isArray(orthostaticResult.data)
        ? []
        : (orthostaticResult.data as DoctorPageData["orthostaticTests"]),
    medicationDeltas: medDeltasP,
    cyclePhaseFindings: cycleFindingsP,
    completeness: completenessP,
    followThrough: followThroughP,
    redFlags: redFlagsP,
    kbHypotheses: kbHypothesesP,
    kbActions: kbActionsP,
    kbChallenger: kbChallengerP,
    kbResearch: kbResearchP,
    staleTests: staleTestsP,
    wrongModalityFlags: wrongModalityFlagsP,
  };

  // Entry point to the one-tap OB/GYN cycle report. Shown as a banner
  // above Doctor Mode so Lanae can pull it up in seconds on her way
  // into the exam room.
  const upcomingObgyn = upcomingAppointments.find(
    (a) =>
      a.specialty &&
      (a.specialty.toLowerCase().includes("ob") ||
        a.specialty.toLowerCase().includes("gyn")),
  );
  const obgynLabel = upcomingObgyn
    ? (() => {
        const d = new Date(upcomingObgyn.date + "T00:00:00");
        return `for visit on ${d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}`;
      })()
    : null;

  return (
    <>
      <div
        className="no-print"
        style={{
          padding: "12px 16px 0",
          maxWidth: 820,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <Link
          href="/doctor/cycle-report"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--accent-sage-muted)",
            border: "1px solid var(--accent-sage)",
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: "var(--text-sm)",
          }}
        >
          <span>
            <strong style={{ color: "var(--accent-sage)" }}>Cycle Health Report</strong>{" "}
            <span style={{ color: "var(--text-secondary)" }}>
              one-tap OB/GYN summary {obgynLabel ?? ""}
            </span>
          </span>
          <span
            aria-hidden="true"
            style={{
              fontSize: "var(--text-base)",
              color: "var(--accent-sage)",
            }}
          >
            &rarr;
          </span>
        </Link>

        {/* Wave 2d D6: Care Card entry point. One-page emergency summary
            (patient identity, diagnoses, meds, allergies) with an optional
            7-day shareable read-only link for paramedics/family. */}
        <Link
          href="/doctor/care-card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            background: "var(--accent-blush-muted)",
            border: "1px solid var(--accent-blush)",
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: "var(--text-sm)",
          }}
        >
          <span>
            <strong style={{ color: "var(--accent-blush)" }}>Care Card</strong>{" "}
            <span style={{ color: "var(--text-secondary)" }}>
              one-page emergency summary + share link
            </span>
          </span>
          <span
            aria-hidden="true"
            style={{
              fontSize: "var(--text-base)",
              color: "var(--accent-blush)",
            }}
          >
            &rarr;
          </span>
        </Link>
      </div>
      <DoctorClient data={pageData} initialView={initialView} />
    </>
  );
}
