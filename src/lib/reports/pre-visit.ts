/**
 * Pre-Visit Doctor Prep Sheet generator.
 *
 * Reads appointments, active_problems, lab_results, daily_logs, symptoms,
 * medical_timeline, medications/supplements (from health_profile),
 * headache_attacks, oura_daily, orthostatic_tests, and nc_imported.
 *
 * Everything is READ ONLY. Non-diagnostic framing per
 * docs/plans/2026-04-16-non-shaming-voice-rule.md and
 * docs/competitive/design-decisions.md. Every claim cites its data source
 * via a sourceRef string so the UI can surface provenance.
 *
 * Exports:
 *   - inferSpecialty(appointment): classify specialty bucket
 *   - rankOutstandingTests(...): pure helper for follow-up from last visit
 *   - buildPreVisitReport(sb, appointmentId, today): full payload
 *   - SPECIALTY_ORDER: priority buckets per specialty (used in the page)
 *
 * Ship rules from brief:
 *   - Specialty-aware prioritization: OB/GYN, Cardiology, Neurology, PCP
 *   - Non-diagnostic voice ("may be worth discussing" / observation, not
 *     diagnosis)
 *   - Cite every claim with a sourceRef
 *   - Print-friendly layout (CSS in the page itself)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProfileContent } from "@/lib/profile/parse-content";
import type { Appointment, LabResult } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────

export type SpecialtyBucket =
  | "obgyn"
  | "cardiology"
  | "neurology"
  | "pcp"
  | "internal_medicine"
  | "other";

export interface PreVisitClaim {
  label: string;
  value: string;
  sourceRef: string; // e.g. "daily_logs 2026-04-10..2026-04-17"
  emphasis?: "info" | "notable" | "discuss"; // used for styling
}

export interface PreVisitSection {
  title: string;
  subtitle?: string;
  claims: PreVisitClaim[];
  emptyNote?: string;
}

export interface PreVisitReportPayload {
  patient: {
    name: string;
    age: number | null;
    sex: string | null;
  };
  appointment: {
    id: string;
    date: string;
    specialty: string | null;
    specialtyBucket: SpecialtyBucket;
    doctorName: string | null;
    clinic: string | null;
    reason: string | null;
  };
  lastVisit: {
    date: string | null;
    specialty: string | null;
    actionItems: string | null;
    followUpDate: string | null;
  };
  // Ordered sections. Specialty-aware ordering is encoded in SPECIALTY_ORDER.
  sections: PreVisitSection[];
  // A single neutral-tone "top 3 talking points" list used for print banner.
  topPriorities: PreVisitClaim[];
  generatedAt: string;
  notes: string[]; // disclosures about data limitations
}

// ── Specialty inference ───────────────────────────────────────────────

/**
 * Classify an appointment into a specialty bucket. Case insensitive
 * substring match on specialty; falls back to reason/doctor text.
 * Returns "other" if nothing matches.
 */
export function inferSpecialty(appt: Pick<Appointment, "specialty" | "reason" | "doctor_name">): SpecialtyBucket {
  const hay = [appt.specialty, appt.reason, appt.doctor_name]
    .filter((s): s is string => typeof s === "string")
    .join(" ")
    .toLowerCase();
  if (!hay) return "other";
  if (hay.includes("ob") || hay.includes("gyn") || hay.includes("women")) return "obgyn";
  if (hay.includes("cardio") || hay.includes("heart")) return "cardiology";
  if (hay.includes("neuro") || hay.includes("headache") || hay.includes("migraine")) return "neurology";
  if (hay.includes("pcp") || hay.includes("primary care") || hay.includes("family medicine")) return "pcp";
  if (hay.includes("internal med") || hay.includes("im ")) return "internal_medicine";
  return "other";
}

/**
 * Section priority ordering per specialty bucket. Earlier entries render
 * first; the top 3 priorities are drawn from the first three sections
 * with non-empty claims.
 */
export const SPECIALTY_ORDER: Record<SpecialtyBucket, string[]> = {
  obgyn: [
    "cycle_stats",
    "pelvic_pain",
    "hormonal_symptoms",
    "active_problems",
    "outstanding_tests",
    "medications",
    "recent_labs",
    "recent_changes",
  ],
  cardiology: [
    "orthostatic",
    "vitals_trends",
    "cardiovascular_labs",
    "active_problems",
    "outstanding_tests",
    "medications",
    "recent_changes",
  ],
  neurology: [
    "headache_summary",
    "cycle_migraine_correlation",
    "triggers",
    "active_problems",
    "outstanding_tests",
    "medications",
    "recent_labs",
  ],
  pcp: [
    "whole_picture",
    "active_problems",
    "recent_changes_since_last_visit",
    "outstanding_tests",
    "medications",
    "top_symptoms",
    "recent_labs",
  ],
  internal_medicine: [
    "whole_picture",
    "active_problems",
    "recent_changes_since_last_visit",
    "outstanding_tests",
    "medications",
    "top_symptoms",
    "recent_labs",
  ],
  other: [
    "active_problems",
    "outstanding_tests",
    "medications",
    "top_symptoms",
    "recent_labs",
    "recent_changes",
  ],
};

// ── Pure helpers (exported for tests) ────────────────────────────────

export interface OutstandingTestInput {
  source: "action_items" | "follow_up_date";
  text: string;
  sourceRef: string;
  referenceDate: string; // the date the item was noted
}

/**
 * Rank outstanding tests/follow-ups by recency. Given action_items text
 * from the last visit plus any follow-up date that hasn't happened yet,
 * returns a deduplicated list. Pure function so it's easy to unit-test.
 */
export function rankOutstandingTests(
  items: OutstandingTestInput[],
): OutstandingTestInput[] {
  const seen = new Set<string>();
  const out: OutstandingTestInput[] = [];
  const sorted = [...items].sort((a, b) =>
    b.referenceDate.localeCompare(a.referenceDate),
  );
  for (const it of sorted) {
    const key = it.text.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/**
 * Summarize daily_logs pain/fatigue/sleep over the lookback window.
 * Returns human-readable averages and a count; never returns NaN.
 */
export function summarizeSymptomWindow(rows: Array<{
  date: string;
  overall_pain: number | null;
  fatigue: number | null;
  sleep_quality: number | null;
}>): {
  nDays: number;
  avgPain: number | null;
  avgFatigue: number | null;
  avgSleep: number | null;
} {
  const nDays = rows.length;
  if (nDays === 0) {
    return { nDays: 0, avgPain: null, avgFatigue: null, avgSleep: null };
  }
  const collect = (key: "overall_pain" | "fatigue" | "sleep_quality") => {
    const vals = rows
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };
  return {
    nDays,
    avgPain: collect("overall_pain"),
    avgFatigue: collect("fatigue"),
    avgSleep: collect("sleep_quality"),
  };
}

// ── Builder context ───────────────────────────────────────────────────

interface BuilderCtx {
  sb: SupabaseClient;
  today: string;
  appointmentId: string;
}

interface ProfileMedication {
  name: string;
  dose?: string;
  frequency?: string;
  indication?: string;
}

/**
 * Build the pre-visit prep sheet payload. Returns null if the appointment
 * ID does not resolve. Each section is independent; a failed section
 * degrades to an empty-state note rather than failing the whole report.
 */
export async function buildPreVisitReport(
  sb: SupabaseClient,
  appointmentId: string,
  today: string,
): Promise<PreVisitReportPayload | null> {
  const ctx: BuilderCtx = { sb, appointmentId, today };

  // Appointment ----------------------------------------------------
  const { data: apptData } = await sb
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!apptData) return null;
  const appt = apptData as Appointment;
  const bucket = inferSpecialty(appt);

  // Patient + profile ---------------------------------------------
  const { data: profileRows } = await sb
    .from("health_profile")
    .select("section, content");
  const profileMap = new Map<string, unknown>();
  for (const r of (profileRows ?? []) as Array<{ section: string; content: unknown }>) {
    profileMap.set(r.section, parseProfileContent(r.content));
  }
  const personal = profileMap.get("personal") as
    | { full_name?: string; age?: number; sex?: string }
    | undefined;

  // Last visit with same specialty (or just last visit) ------------
  const lastVisit = await loadLastVisit(ctx, appt);

  // Section builders ------------------------------------------------
  const sectionMap: Record<string, PreVisitSection> = {};
  sectionMap.active_problems = await buildActiveProblemsSection(ctx);
  sectionMap.outstanding_tests = await buildOutstandingTestsSection(ctx, lastVisit);
  sectionMap.medications = buildMedicationsSection(profileMap);
  sectionMap.top_symptoms = await buildTopSymptomsSection(ctx, lastVisit);
  sectionMap.recent_labs = await buildRecentLabsSection(ctx, lastVisit);
  sectionMap.recent_changes = await buildRecentChangesSection(ctx);
  sectionMap.recent_changes_since_last_visit = await buildRecentChangesSinceLastVisit(ctx, lastVisit);
  sectionMap.whole_picture = await buildWholePictureSection(ctx);

  if (bucket === "obgyn") {
    sectionMap.cycle_stats = await buildCycleStatsSection(ctx, profileMap);
    sectionMap.pelvic_pain = await buildPelvicPainSection(ctx);
    sectionMap.hormonal_symptoms = await buildHormonalSymptomsSection(ctx);
  }
  if (bucket === "cardiology") {
    sectionMap.orthostatic = await buildOrthostaticSection(ctx);
    sectionMap.vitals_trends = await buildVitalsTrendsSection(ctx);
    sectionMap.cardiovascular_labs = await buildCardiovascularLabsSection(ctx);
  }
  if (bucket === "neurology") {
    sectionMap.headache_summary = await buildHeadacheSummarySection(ctx);
    sectionMap.cycle_migraine_correlation = await buildCycleMigraineSection(ctx);
    sectionMap.triggers = await buildTriggersSection(ctx);
  }

  // Ordered sections per specialty --------------------------------
  const order = SPECIALTY_ORDER[bucket];
  const sections: PreVisitSection[] = [];
  for (const key of order) {
    const section = sectionMap[key];
    if (section) sections.push(section);
  }

  // Top 3 priorities (first three sections with at least one claim)
  const topPriorities: PreVisitClaim[] = [];
  for (const s of sections) {
    if (topPriorities.length >= 3) break;
    if (s.claims.length > 0) topPriorities.push(s.claims[0]);
  }

  const notes: string[] = [];
  if (lastVisit.date == null) {
    notes.push(
      "No prior visit is on record for this provider. Symptom and lab windows use the last 30 days as the default lookback.",
    );
  }

  return {
    patient: {
      name: personal?.full_name ?? "Lanae A. Bond",
      age: personal?.age ?? null,
      sex: personal?.sex ?? null,
    },
    appointment: {
      id: appt.id,
      date: appt.date,
      specialty: appt.specialty,
      specialtyBucket: bucket,
      doctorName: appt.doctor_name,
      clinic: appt.clinic,
      reason: appt.reason,
    },
    lastVisit,
    sections,
    topPriorities,
    generatedAt: new Date().toISOString(),
    notes,
  };
}

// ── Individual section builders ───────────────────────────────────────

async function loadLastVisit(
  ctx: BuilderCtx,
  appt: Appointment,
): Promise<PreVisitReportPayload["lastVisit"]> {
  // Prefer a past visit with the same specialty. Fall back to any past visit.
  let data: Appointment | null = null;
  if (appt.specialty) {
    const { data: match } = await ctx.sb
      .from("appointments")
      .select("*")
      .eq("specialty", appt.specialty)
      .lt("date", appt.date)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    data = (match as Appointment | null) ?? null;
  }
  if (!data) {
    const { data: any_past } = await ctx.sb
      .from("appointments")
      .select("*")
      .lt("date", appt.date)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    data = (any_past as Appointment | null) ?? null;
  }
  return {
    date: data?.date ?? null,
    specialty: data?.specialty ?? null,
    actionItems: data?.action_items ?? null,
    followUpDate: data?.follow_up_date ?? null,
  };
}

async function buildActiveProblemsSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const { data } = await ctx.sb
    .from("active_problems")
    .select("problem, status, latest_data, updated_at")
    .neq("status", "resolved")
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as Array<{
    problem: string;
    status: string;
    latest_data: string | null;
    updated_at: string | null;
  }>;
  const claims: PreVisitClaim[] = rows.map((r) => ({
    label: r.problem,
    value: r.latest_data ?? `Status: ${r.status}`,
    sourceRef: `active_problems${r.updated_at ? " " + r.updated_at.slice(0, 10) : ""}`,
    emphasis: "notable",
  }));
  return {
    title: "Current active problems",
    subtitle: "Unresolved issues currently on record.",
    claims,
    emptyNote: "No active problems on record.",
  };
}

async function buildOutstandingTestsSection(
  ctx: BuilderCtx,
  lastVisit: PreVisitReportPayload["lastVisit"],
): Promise<PreVisitSection> {
  const items: OutstandingTestInput[] = [];
  if (lastVisit.actionItems && lastVisit.date) {
    const lines = lastVisit.actionItems
      .split(/\r?\n|;|\u2022/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const ln of lines) {
      items.push({
        source: "action_items",
        text: ln,
        sourceRef: `appointments ${lastVisit.date} action_items`,
        referenceDate: lastVisit.date,
      });
    }
  }
  if (lastVisit.followUpDate && lastVisit.date) {
    items.push({
      source: "follow_up_date",
      text: `Follow-up scheduled for ${lastVisit.followUpDate}`,
      sourceRef: `appointments ${lastVisit.date} follow_up_date`,
      referenceDate: lastVisit.date,
    });
  }
  const ranked = rankOutstandingTests(items);
  const claims: PreVisitClaim[] = ranked.map((r) => ({
    label: r.source === "action_items" ? "Follow-up item" : "Scheduled follow-up",
    value: r.text,
    sourceRef: r.sourceRef,
    emphasis: "discuss",
  }));
  return {
    title: "Outstanding from last visit",
    subtitle: lastVisit.date
      ? `Items noted at your ${lastVisit.date} visit that may not be resolved yet.`
      : "No prior visit recorded; nothing to follow up on.",
    claims,
    emptyNote: "No outstanding items from the last visit on record.",
  };
}

function buildMedicationsSection(
  profileMap: Map<string, unknown>,
): PreVisitSection {
  const meds = profileMap.get("medications") as
    | { current?: ProfileMedication[]; as_needed?: ProfileMedication[] }
    | undefined;
  const supps = profileMap.get("supplements") as
    | Array<{ name: string; dose?: string }>
    | undefined;
  const claims: PreVisitClaim[] = [];
  for (const m of meds?.current ?? []) {
    claims.push({
      label: m.name,
      value: [m.dose, m.frequency, m.indication].filter(Boolean).join(" \u2022 ") || "Current",
      sourceRef: "health_profile medications.current",
    });
  }
  for (const m of meds?.as_needed ?? []) {
    claims.push({
      label: `${m.name} (as needed)`,
      value: [m.dose, m.frequency, m.indication].filter(Boolean).join(" \u2022 ") || "As needed",
      sourceRef: "health_profile medications.as_needed",
    });
  }
  for (const s of supps ?? []) {
    claims.push({
      label: s.name,
      value: s.dose ?? "Supplement",
      sourceRef: "health_profile supplements",
    });
  }
  return {
    title: "Current medications and supplements",
    subtitle: "From your profile. Please confirm nothing changed before your visit.",
    claims,
    emptyNote: "No medications or supplements on record.",
  };
}

async function buildTopSymptomsSection(
  ctx: BuilderCtx,
  lastVisit: PreVisitReportPayload["lastVisit"],
): Promise<PreVisitSection> {
  // Look back to last visit, or last 30 days if none
  const lookbackDate = lastVisit.date ?? lookbackDaysAgo(ctx.today, 30);
  const { data: logs } = await ctx.sb
    .from("daily_logs")
    .select("date, overall_pain, fatigue, sleep_quality")
    .gte("date", lookbackDate);
  const summary = summarizeSymptomWindow(
    (logs ?? []) as Array<{
      date: string;
      overall_pain: number | null;
      fatigue: number | null;
      sleep_quality: number | null;
    }>,
  );
  const { data: sym } = await ctx.sb
    .from("symptoms")
    .select("symptom, severity, logged_at")
    .gte("logged_at", lookbackDate + "T00:00:00")
    .limit(500);
  const countBy = new Map<string, { count: number; maxSev: string | null }>();
  for (const s of (sym ?? []) as Array<{
    symptom: string | null;
    severity: string | null;
    logged_at: string;
  }>) {
    if (!s.symptom) continue;
    const current = countBy.get(s.symptom) ?? { count: 0, maxSev: null };
    current.count += 1;
    if (s.severity && (!current.maxSev || sevRank(s.severity) > sevRank(current.maxSev))) {
      current.maxSev = s.severity;
    }
    countBy.set(s.symptom, current);
  }
  const top = [...countBy.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const claims: PreVisitClaim[] = [];
  if (summary.nDays > 0) {
    claims.push({
      label: `Daily averages across ${summary.nDays} days`,
      value: [
        summary.avgPain != null ? `pain ${summary.avgPain}/10` : null,
        summary.avgFatigue != null ? `fatigue ${summary.avgFatigue}/10` : null,
        summary.avgSleep != null ? `sleep quality ${summary.avgSleep}/10` : null,
      ]
        .filter(Boolean)
        .join(" \u2022 ") || "no numeric entries",
      sourceRef: `daily_logs ${lookbackDate}..${ctx.today}`,
      emphasis: "info",
    });
  }
  for (const [sym, v] of top) {
    claims.push({
      label: sym,
      value: `${v.count} logged${v.maxSev ? ` (max ${v.maxSev})` : ""}`,
      sourceRef: `symptoms ${lookbackDate}..${ctx.today}`,
    });
  }
  return {
    title: "Top symptoms recently",
    subtitle: lastVisit.date
      ? `Since your ${lastVisit.date} visit.`
      : "Last 30 days.",
    claims,
    emptyNote: "No symptoms logged in this window.",
  };
}

async function buildRecentLabsSection(
  ctx: BuilderCtx,
  lastVisit: PreVisitReportPayload["lastVisit"],
): Promise<PreVisitSection> {
  const lookbackDate = lastVisit.date ?? lookbackDaysAgo(ctx.today, 180);
  const { data } = await ctx.sb
    .from("lab_results")
    .select("*")
    .gte("date", lookbackDate)
    .order("date", { ascending: false });
  const labs = (data ?? []) as LabResult[];
  const abnormals = labs.filter((l) => l.flag && l.flag !== "normal");
  const claims: PreVisitClaim[] = abnormals.slice(0, 8).map((l) => ({
    label: l.test_name,
    value: `${l.value ?? ""}${l.unit ? " " + l.unit : ""} (${l.flag})${
      l.reference_range_low != null && l.reference_range_high != null
        ? ` \u2022 ref ${l.reference_range_low}-${l.reference_range_high}`
        : ""
    }`,
    sourceRef: `lab_results ${l.date}`,
    emphasis: l.flag === "critical" ? "discuss" : "notable",
  }));
  return {
    title: "Recent out-of-range labs",
    subtitle: lastVisit.date
      ? `Since your ${lastVisit.date} visit.`
      : "Last 6 months.",
    claims,
    emptyNote: "No out-of-range labs in this window.",
  };
}

async function buildRecentChangesSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const sinceDate = lookbackDaysAgo(ctx.today, 90);
  const { data } = await ctx.sb
    .from("medical_timeline")
    .select("event_date, event_type, title, significance")
    .gte("event_date", sinceDate)
    .in("significance", ["important", "critical"])
    .order("event_date", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as Array<{
    event_date: string;
    title: string;
    significance: string;
  }>;
  const claims: PreVisitClaim[] = rows.map((r) => ({
    label: r.title,
    value: `Event date: ${r.event_date}`,
    sourceRef: `medical_timeline ${r.event_date}`,
    emphasis: r.significance === "critical" ? "discuss" : "info",
  }));
  return {
    title: "Recent medical events",
    subtitle: "Important or critical events from the last 3 months.",
    claims,
    emptyNote: "No significant events in the last 3 months.",
  };
}

async function buildRecentChangesSinceLastVisit(
  ctx: BuilderCtx,
  lastVisit: PreVisitReportPayload["lastVisit"],
): Promise<PreVisitSection> {
  if (!lastVisit.date) {
    return {
      title: "Changes since last visit",
      subtitle: "No prior visit recorded.",
      claims: [],
      emptyNote: "No prior visit to compare against.",
    };
  }
  const { data } = await ctx.sb
    .from("medical_timeline")
    .select("event_date, event_type, title, significance")
    .gte("event_date", lastVisit.date)
    .in("significance", ["important", "critical"])
    .order("event_date", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as Array<{
    event_date: string;
    title: string;
    significance: string;
  }>;
  const claims: PreVisitClaim[] = rows.map((r) => ({
    label: r.title,
    value: `Event date: ${r.event_date}`,
    sourceRef: `medical_timeline ${r.event_date}`,
    emphasis: r.significance === "critical" ? "discuss" : "info",
  }));
  return {
    title: "Changes since last visit",
    subtitle: `Events on or after ${lastVisit.date}.`,
    claims,
    emptyNote: "No significant events since the last visit.",
  };
}

async function buildWholePictureSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const { data } = await ctx.sb
    .from("active_problems")
    .select("problem, status")
    .neq("status", "resolved")
    .limit(10);
  const rows = (data ?? []) as Array<{ problem: string; status: string }>;
  const claims: PreVisitClaim[] = [];
  if (rows.length > 0) {
    claims.push({
      label: "Active problem count",
      value: `${rows.length} unresolved issue${rows.length === 1 ? "" : "s"} on record`,
      sourceRef: "active_problems",
      emphasis: "info",
    });
  }
  return {
    title: "Whole-picture snapshot",
    subtitle: "A quick overview to set context before any specific topic.",
    claims,
    emptyNote: "No active issues currently on record.",
  };
}

// ── OB/GYN specific ──────────────────────────────────────────────────

async function buildCycleStatsSection(
  ctx: BuilderCtx,
  profileMap: Map<string, unknown>,
): Promise<PreVisitSection> {
  const menstrual = profileMap.get("menstrual_history") as
    | {
        average_cycle_length?: number;
        period_duration_days?: number;
        regularity?: string;
        last_period_date?: string;
        flow?: string;
        clots?: string;
      }
    | undefined;

  const { data: lastPeriod } = await ctx.sb
    .from("nc_imported")
    .select("date")
    .eq("menstruation", "MENSTRUATION")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastPeriodDate =
    (lastPeriod as { date: string } | null)?.date ??
    menstrual?.last_period_date ??
    null;

  const claims: PreVisitClaim[] = [];
  if (menstrual?.average_cycle_length != null) {
    claims.push({
      label: "Average cycle length",
      value: `${menstrual.average_cycle_length} days`,
      sourceRef: "health_profile menstrual_history",
    });
  }
  if (menstrual?.period_duration_days != null) {
    claims.push({
      label: "Typical period length",
      value: `${menstrual.period_duration_days} days`,
      sourceRef: "health_profile menstrual_history",
    });
  }
  if (menstrual?.regularity) {
    claims.push({
      label: "Cycle regularity",
      value: menstrual.regularity,
      sourceRef: "health_profile menstrual_history",
    });
  }
  if (lastPeriodDate) {
    claims.push({
      label: "Last period start",
      value: lastPeriodDate,
      sourceRef: lastPeriod ? `nc_imported ${lastPeriodDate}` : "health_profile menstrual_history",
    });
  }
  if (menstrual?.flow) {
    claims.push({
      label: "Flow",
      value: menstrual.flow,
      sourceRef: "health_profile menstrual_history",
    });
  }
  if (menstrual?.clots) {
    claims.push({
      label: "Clots",
      value: menstrual.clots,
      sourceRef: "health_profile menstrual_history",
      emphasis: "notable",
    });
  }
  return {
    title: "Cycle snapshot",
    subtitle: "From your profile and Natural Cycles import.",
    claims,
    emptyNote: "No cycle data on record yet.",
  };
}

async function buildPelvicPainSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const sinceDate = lookbackDaysAgo(ctx.today, 90);
  // pain_points uses logged_at + body_region. Filter client-side for pelvic region.
  const { data } = await ctx.sb
    .from("pain_points")
    .select("body_region, intensity, pain_type, logged_at")
    .gte("logged_at", sinceDate + "T00:00:00")
    .limit(500);
  const rows = (data ?? []) as Array<{
    body_region: string | null;
    intensity: number;
    pain_type: string | null;
    logged_at: string;
  }>;
  const pelvic = rows.filter((r) => {
    const region = (r.body_region ?? "").toLowerCase();
    return (
      region.includes("pelvi") ||
      region.includes("abdom") ||
      region.includes("lower back")
    );
  });
  const avg = pelvic.length
    ? Math.round(
        (pelvic.reduce((a, b) => a + (b.intensity ?? 0), 0) / pelvic.length) * 10,
      ) / 10
    : null;
  const typeCounts = new Map<string, number>();
  for (const p of pelvic) {
    if (p.pain_type) typeCounts.set(p.pain_type, (typeCounts.get(p.pain_type) ?? 0) + 1);
  }
  const topTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `${t} (${n})`)
    .join(", ");

  const claims: PreVisitClaim[] = [];
  if (pelvic.length > 0) {
    claims.push({
      label: "Pelvic pain entries",
      value: `${pelvic.length} logs${avg != null ? ` \u2022 avg intensity ${avg}/10` : ""}`,
      sourceRef: `pain_points ${sinceDate}..${ctx.today}`,
      emphasis: avg != null && avg >= 5 ? "discuss" : "notable",
    });
    if (topTypes) {
      claims.push({
        label: "Top pain types logged",
        value: topTypes,
        sourceRef: `pain_points ${sinceDate}..${ctx.today}`,
      });
    }
  }
  return {
    title: "Pelvic pain pattern",
    subtitle: "Pelvic, abdominal, and lower-back pain pins from the last 3 months.",
    claims,
    emptyNote: "No pelvic-area pain logs in the last 3 months.",
  };
}

async function buildHormonalSymptomsSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const sinceDate = lookbackDaysAgo(ctx.today, 90);
  const { data } = await ctx.sb
    .from("symptoms")
    .select("symptom, severity, logged_at, category")
    .gte("logged_at", sinceDate + "T00:00:00")
    .limit(500);
  const rows = (data ?? []) as Array<{
    symptom: string | null;
    severity: string | null;
    logged_at: string;
    category: string | null;
  }>;
  const hormonalKeywords = [
    "mood",
    "hot flash",
    "breast",
    "libido",
    "bleed",
    "spotting",
    "pms",
    "cramp",
    "acne",
    "bloat",
  ];
  const matches = rows.filter((r) => {
    const s = (r.symptom ?? "").toLowerCase();
    return hormonalKeywords.some((kw) => s.includes(kw));
  });
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (!m.symptom) continue;
    counts.set(m.symptom, (counts.get(m.symptom) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const claims: PreVisitClaim[] = top.map(([sym, n]) => ({
    label: sym,
    value: `${n} log${n === 1 ? "" : "s"} in the last 3 months`,
    sourceRef: `symptoms ${sinceDate}..${ctx.today}`,
  }));
  return {
    title: "Hormonal or cycle-linked symptoms",
    subtitle: "Observed in the last 3 months. Presence does not imply cause.",
    claims,
    emptyNote: "No hormonal-pattern symptoms logged in the last 3 months.",
  };
}

// ── Cardiology specific ───────────────────────────────────────────────

async function buildOrthostaticSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const { data, error } = await ctx.sb
    .from("orthostatic_tests")
    .select(
      "test_date, resting_hr_bpm, peak_rise_bpm, standing_hr_1min, standing_hr_3min, standing_hr_5min, standing_hr_10min, symptoms_experienced",
    )
    .order("test_date", { ascending: false })
    .limit(5);
  if (error) {
    return {
      title: "Orthostatic tests",
      subtitle: "Stand tests on record.",
      claims: [],
      emptyNote: "No orthostatic tests on record.",
    };
  }
  const rows = (data ?? []) as Array<{
    test_date: string;
    resting_hr_bpm: number | null;
    peak_rise_bpm: number | null;
    standing_hr_1min: number | null;
    standing_hr_3min: number | null;
    standing_hr_5min: number | null;
    standing_hr_10min: number | null;
    symptoms_experienced: string | null;
  }>;
  const claims: PreVisitClaim[] = rows.map((r) => {
    const peak = r.peak_rise_bpm;
    const emphasis: PreVisitClaim["emphasis"] = peak != null && peak >= 30 ? "discuss" : "notable";
    return {
      label: `Stand test ${r.test_date}`,
      value: [
        r.resting_hr_bpm != null ? `resting ${r.resting_hr_bpm} bpm` : null,
        peak != null ? `peak rise ${peak} bpm` : null,
        r.standing_hr_10min != null ? `10 min ${r.standing_hr_10min} bpm` : null,
        r.symptoms_experienced ? `symptoms: ${r.symptoms_experienced}` : null,
      ]
        .filter(Boolean)
        .join(" \u2022 "),
      sourceRef: `orthostatic_tests ${r.test_date}`,
      emphasis,
    };
  });
  return {
    title: "Orthostatic / stand tests",
    subtitle: "POTS-relevant measurements. A peak rise under 30 bpm does not rule POTS out, and a rise \u2265 30 bpm is an observation, not a diagnosis.",
    claims,
    emptyNote: "No orthostatic tests on record.",
  };
}

async function buildVitalsTrendsSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const sinceDate = lookbackDaysAgo(ctx.today, 30);
  const { data } = await ctx.sb
    .from("oura_daily")
    .select("date, resting_hr, hrv_avg")
    .gte("date", sinceDate)
    .order("date", { ascending: false });
  const rows = (data ?? []) as Array<{
    date: string;
    resting_hr: number | null;
    hrv_avg: number | null;
  }>;
  const rhrVals = rows.map((r) => r.resting_hr).filter((v): v is number => typeof v === "number");
  const hrvVals = rows.map((r) => r.hrv_avg).filter((v): v is number => typeof v === "number");
  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
  const claims: PreVisitClaim[] = [];
  const avgRhr = avg(rhrVals);
  const avgHrv = avg(hrvVals);
  if (avgRhr != null) {
    claims.push({
      label: "Average resting HR (30-day)",
      value: `${avgRhr} bpm across ${rhrVals.length} nights`,
      sourceRef: `oura_daily ${sinceDate}..${ctx.today}`,
    });
  }
  if (avgHrv != null) {
    claims.push({
      label: "Average HRV (30-day)",
      value: `${avgHrv} ms across ${hrvVals.length} nights`,
      sourceRef: `oura_daily ${sinceDate}..${ctx.today}`,
    });
  }
  return {
    title: "Oura vitals trends",
    subtitle: "Rolling 30-day averages from your Oura ring.",
    claims,
    emptyNote: "No Oura data in the last 30 days.",
  };
}

async function buildCardiovascularLabsSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const sinceDate = lookbackDaysAgo(ctx.today, 365);
  const { data } = await ctx.sb
    .from("lab_results")
    .select("*")
    .gte("date", sinceDate)
    .order("date", { ascending: false });
  const labs = (data ?? []) as LabResult[];
  const targets = ["cholesterol", "ldl", "hdl", "triglyceride", "crp", "lp(a)"];
  const matched = labs.filter((l) =>
    targets.some((t) => l.test_name.toLowerCase().includes(t)),
  );
  const claims: PreVisitClaim[] = matched.slice(0, 8).map((l) => ({
    label: l.test_name,
    value: `${l.value ?? ""}${l.unit ? " " + l.unit : ""}${l.flag && l.flag !== "normal" ? " (" + l.flag + ")" : ""}`,
    sourceRef: `lab_results ${l.date}`,
    emphasis: l.flag && l.flag !== "normal" ? "notable" : "info",
  }));
  return {
    title: "Cardiovascular labs",
    subtitle: "Lipid, inflammation, and related markers from the last year.",
    claims,
    emptyNote: "No cardiovascular labs in the last year.",
  };
}

// ── Neurology specific ───────────────────────────────────────────────

async function buildHeadacheSummarySection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const sinceDate = lookbackDaysAgo(ctx.today, 90);
  const { data, error } = await ctx.sb
    .from("headache_attacks")
    .select("started_at, severity, aura_categories, hit6_score, midas_grade, medication_relief_minutes")
    .gte("started_at", sinceDate + "T00:00:00")
    .order("started_at", { ascending: false });
  if (error) {
    return {
      title: "Headache summary",
      subtitle: "Attacks logged over the last 3 months.",
      claims: [],
      emptyNote: "Headache attack tracking is not yet enabled.",
    };
  }
  const attacks = (data ?? []) as Array<{
    started_at: string;
    severity: number | null;
    aura_categories: string[] | null;
    hit6_score: number | null;
    midas_grade: string | null;
    medication_relief_minutes: number | null;
  }>;
  const claims: PreVisitClaim[] = [];
  if (attacks.length > 0) {
    const severities = attacks
      .map((a) => a.severity)
      .filter((v): v is number => typeof v === "number");
    const avgSev = severities.length
      ? Math.round((severities.reduce((a, b) => a + b, 0) / severities.length) * 10) / 10
      : null;
    claims.push({
      label: "Attack count (90 days)",
      value: `${attacks.length} attack${attacks.length === 1 ? "" : "s"}${avgSev != null ? `, avg severity ${avgSev}/10` : ""}`,
      sourceRef: `headache_attacks ${sinceDate}..${ctx.today}`,
      emphasis: attacks.length >= 15 ? "discuss" : "notable",
    });
    const auraCount = attacks.filter((a) => (a.aura_categories ?? []).length > 0).length;
    if (auraCount > 0) {
      claims.push({
        label: "Attacks with aura",
        value: `${auraCount} of ${attacks.length}`,
        sourceRef: `headache_attacks ${sinceDate}..${ctx.today}`,
      });
    }
    const latestHit6 = attacks.find((a) => a.hit6_score != null);
    if (latestHit6?.hit6_score != null) {
      claims.push({
        label: "Most recent HIT-6",
        value: `${latestHit6.hit6_score}`,
        sourceRef: `headache_attacks ${latestHit6.started_at.slice(0, 10)}`,
      });
    }
    const latestMidas = attacks.find((a) => a.midas_grade != null);
    if (latestMidas?.midas_grade) {
      claims.push({
        label: "Most recent MIDAS grade",
        value: latestMidas.midas_grade,
        sourceRef: `headache_attacks ${latestMidas.started_at.slice(0, 10)}`,
      });
    }
  }
  return {
    title: "Headache summary",
    subtitle: "Attacks logged over the last 3 months. HIT-6 and MIDAS are patient-reported scales, not diagnoses.",
    claims,
    emptyNote: "No headache attacks logged in the last 3 months.",
  };
}

async function buildCycleMigraineSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const sinceDate = lookbackDaysAgo(ctx.today, 180);
  const { data, error } = await ctx.sb
    .from("headache_attacks")
    .select("started_at, cycle_phase")
    .gte("started_at", sinceDate + "T00:00:00");
  if (error) {
    return {
      title: "Cycle / migraine pattern",
      subtitle: "Attack distribution by cycle phase.",
      claims: [],
      emptyNote: "Cycle-migraine correlation data is not yet available.",
    };
  }
  const rows = (data ?? []) as Array<{ started_at: string; cycle_phase: string | null }>;
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const phase = (r.cycle_phase ?? "unknown").toLowerCase();
    counts[phase] = (counts[phase] ?? 0) + 1;
  }
  const claims: PreVisitClaim[] = [];
  for (const phase of ["menstrual", "follicular", "ovulatory", "luteal", "unknown"]) {
    const n = counts[phase] ?? 0;
    if (n > 0) {
      claims.push({
        label: `${phase[0].toUpperCase()}${phase.slice(1)}`,
        value: `${n} attack${n === 1 ? "" : "s"}`,
        sourceRef: `headache_attacks ${sinceDate}..${ctx.today}`,
      });
    }
  }
  return {
    title: "Cycle / migraine pattern",
    subtitle: "Attacks grouped by cycle phase over the last 6 months. Presence does not imply causation.",
    claims,
    emptyNote: "No cycle-tagged headache attacks in the last 6 months.",
  };
}

async function buildTriggersSection(ctx: BuilderCtx): Promise<PreVisitSection> {
  const sinceDate = lookbackDaysAgo(ctx.today, 90);
  const { data, error } = await ctx.sb
    .from("headache_attacks")
    .select("triggers")
    .gte("started_at", sinceDate + "T00:00:00");
  if (error) {
    return {
      title: "Common triggers logged",
      subtitle: "Patient-reported trigger tags.",
      claims: [],
      emptyNote: "Trigger data is not yet available.",
    };
  }
  const rows = (data ?? []) as Array<{ triggers: string[] | null }>;
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.triggers ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const claims: PreVisitClaim[] = top.map(([t, n]) => ({
    label: t,
    value: `${n} attack${n === 1 ? "" : "s"}`,
    sourceRef: `headache_attacks ${sinceDate}..${ctx.today}`,
  }));
  return {
    title: "Common triggers logged",
    subtitle: "Patient-reported tags from the last 3 months. These are associations, not confirmed causes.",
    claims,
    emptyNote: "No triggers tagged in the last 3 months.",
  };
}

// ── Utilities ─────────────────────────────────────────────────────────

function sevRank(s: string): number {
  switch (s.toLowerCase()) {
    case "mild":
      return 1;
    case "moderate":
      return 2;
    case "severe":
      return 3;
    default:
      return 0;
  }
}

function lookbackDaysAgo(today: string, days: number): string {
  const base = new Date(today + "T00:00:00").getTime();
  const then = new Date(base - days * 86400000);
  return then.toISOString().split("T")[0];
}
