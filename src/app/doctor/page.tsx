import { createServiceClient } from "@/lib/supabase";
import { DoctorClient } from "@/components/doctor/DoctorClient";
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
}

// ── Helper: build profile map from health_profile rows ─────────────

function profileMap(
  rows: Array<{ section: string; content: unknown }>
): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const r of rows) m.set(r.section, r.content);
  return m;
}

// ── Server component ───────────────────────────────────────────────

export default async function DoctorPage() {
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
    upcomingApptResult,
    lastApptResult,
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
  ]);

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
  let currentPhase: string | null = menstrual?.current_phase ?? null;
  if (!currentPhase && ncData?.cycle_day) {
    const cd = ncData.cycle_day;
    if (cd <= 5) currentPhase = "Menstrual";
    else if (cd <= 13) currentPhase = "Follicular";
    else if (cd <= 16) currentPhase = "Ovulatory";
    else currentPhase = "Luteal";
  }

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
      lastPeriodDate: menstrual?.last_period_date ?? null,
      averageCycleLength: menstrual?.average_cycle_length ?? null,
    },
    timelineEvents,
    imagingStudies,
    correlations,
    upcomingAppointments,
    lastAppointmentDate,
  };

  return <DoctorClient data={pageData} />;
}
