/**
 * Cycle Health Report generator for OB/GYN visits.
 *
 * Reads nc_imported (Natural Cycles historical data), cycle_entries,
 * symptoms, pain_points, medical_timeline, daily_logs, lab_results,
 * appointments, and health_profile. Everything is READ ONLY. No writes.
 *
 * Design rules (from docs/competitive/flo/implementation-notes.md §Feature 3):
 *   - Present data, do not diagnose. Every derived flag is phrased as
 *     "may be worth discussing" never as a diagnosis.
 *   - Short luteal phase (<10 days in the last 6 cycles) is flagged
 *     visibly but non-alarmingly.
 *   - Empty sections degrade to "not enough data yet", never fabricated.
 *   - Browser print is the delivery channel (no server-side PDF render).
 *
 * Exported:
 *   - buildCycleReport(sb, today): full report payload
 *   - analyzeCycleLengths(periodStarts): pure helper usable in tests
 *   - analyzeLutealPhases(cycleSegments): pure helper
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProfileContent } from "@/lib/profile/parse-content";

// ── Pure helpers (exported for testing) ───────────────────────────────

export interface PeriodStart {
  cycleNumber: number | null;
  startDate: string; // YYYY-MM-DD
  periodDays: number; // number of menstruation days in this cycle
}

export interface CycleLengthStats {
  cycles: Array<{
    cycleNumber: number | null;
    startDate: string;
    length: number;
    periodDays: number;
  }>;
  avgLength: number | null;
  minLength: number | null;
  maxLength: number | null;
  sdLength: number | null;
  regularityFlag: "regular" | "slightly_irregular" | "irregular" | "insufficient_data";
  n: number;
}

export interface LutealStats {
  segments: Array<{
    cycleNumber: number | null;
    startDate: string;
    ovulationDay: number | null;
    lutealDays: number | null;
  }>;
  avgLutealDays: number | null;
  shortLutealCount: number; // days with estimated luteal < 10
  hasShortLutealFlag: boolean;
}

const SHORT_LUTEAL_THRESHOLD_DAYS = 10;

/**
 * Cycle length analysis from a list of ordered period starts.
 *
 * Requires at least 2 starts to compute any lengths. Uses classic
 * definition: length_i = days between start_i and start_{i+1}.
 */
export function analyzeCycleLengths(starts: PeriodStart[]): CycleLengthStats {
  const sorted = [...starts].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );

  const rows: CycleLengthStats["cycles"] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const d1 = new Date(prev.startDate + "T00:00:00").getTime();
    const d2 = new Date(cur.startDate + "T00:00:00").getTime();
    const len = Math.round((d2 - d1) / 86400000);
    // Only include physiologically plausible cycle lengths.
    if (len >= 18 && len <= 90) {
      rows.push({
        cycleNumber: prev.cycleNumber,
        startDate: prev.startDate,
        length: len,
        periodDays: prev.periodDays,
      });
    }
  }

  if (rows.length === 0) {
    return {
      cycles: rows,
      avgLength: null,
      minLength: null,
      maxLength: null,
      sdLength: null,
      regularityFlag: "insufficient_data",
      n: 0,
    };
  }

  const lens = rows.map((r) => r.length);
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(
    lens.map((x) => (x - avg) ** 2).reduce((a, b) => a + b, 0) / lens.length,
  );

  let regularityFlag: CycleLengthStats["regularityFlag"] = "regular";
  if (lens.length < 3) regularityFlag = "insufficient_data";
  else if (sd > 7) regularityFlag = "irregular";
  else if (sd > 3) regularityFlag = "slightly_irregular";

  return {
    cycles: rows,
    avgLength: Math.round(avg * 10) / 10,
    minLength: Math.min(...lens),
    maxLength: Math.max(...lens),
    sdLength: Math.round(sd * 10) / 10,
    regularityFlag,
    n: lens.length,
  };
}

export interface CycleSegmentForLuteal {
  cycleNumber: number | null;
  startDate: string;
  nextStartDate: string;
  ovulationDay: number | null; // day within cycle (1-indexed)
}

export function analyzeLutealPhases(
  segments: CycleSegmentForLuteal[],
): LutealStats {
  const rows: LutealStats["segments"] = [];
  let shortCount = 0;

  for (const seg of segments) {
    const d1 = new Date(seg.startDate + "T00:00:00").getTime();
    const d2 = new Date(seg.nextStartDate + "T00:00:00").getTime();
    const cycleLen = Math.round((d2 - d1) / 86400000);
    let luteal: number | null = null;
    if (seg.ovulationDay != null && cycleLen > 0) {
      luteal = cycleLen - seg.ovulationDay;
    }
    rows.push({
      cycleNumber: seg.cycleNumber,
      startDate: seg.startDate,
      ovulationDay: seg.ovulationDay,
      lutealDays: luteal,
    });
    if (luteal != null && luteal < SHORT_LUTEAL_THRESHOLD_DAYS) shortCount++;
  }

  const withLuteal = rows
    .map((r) => r.lutealDays)
    .filter((v): v is number => v != null);
  const avg =
    withLuteal.length > 0
      ? withLuteal.reduce((a, b) => a + b, 0) / withLuteal.length
      : null;

  return {
    segments: rows,
    avgLutealDays: avg != null ? Math.round(avg * 10) / 10 : null,
    shortLutealCount: shortCount,
    hasShortLutealFlag: shortCount > 0,
  };
}

// ── Report payload ────────────────────────────────────────────────────

export interface CycleReportPayload {
  patient: {
    name: string;
    age: number | null;
    sex: string | null;
  };
  generatedAt: string; // ISO
  cycleLength: CycleLengthStats;
  luteal: LutealStats;
  periodPattern: {
    avgPeriodDays: number | null;
    flowBreakdown: Record<string, number>; // LIGHT/MEDIUM/HEAVY -> day count
    clotsReported: boolean;
  };
  recentSymptomsByPhase: {
    menstrual: Array<{ symptom: string; count: number; maxSeverity: string | null }>;
    follicular: Array<{ symptom: string; count: number; maxSeverity: string | null }>;
    ovulatory: Array<{ symptom: string; count: number; maxSeverity: string | null }>;
    luteal: Array<{ symptom: string; count: number; maxSeverity: string | null }>;
    unknown: Array<{ symptom: string; count: number; maxSeverity: string | null }>;
  };
  painByPhase: Record<string, { avg: number | null; count: number }>;
  recentChanges: string[];
  medications: Array<{ name: string; dose?: string | null; indication?: string | null }>;
  supplements: Array<{ name: string; dose?: string | null }>;
  nextAppointment: {
    date: string | null;
    specialty: string | null;
    reason: string | null;
  } | null;
  flags: {
    shortLuteal: boolean;
    irregularCycles: boolean;
    heavyFlow: boolean;
  };
  notes: string[];
}

const PHASE_KEYS = [
  "menstrual",
  "follicular",
  "ovulatory",
  "luteal",
  "unknown",
] as const;
type PhaseKey = (typeof PHASE_KEYS)[number];

/**
 * Estimate the cycle phase on a given date, given the period start date
 * and the observed cycle length. Uses a simple classical model:
 *   menstrual:  days 1-5
 *   follicular: 6 .. (ovulationDay - 3)
 *   ovulatory:  ovulationDay ± 2
 *   luteal:     everything after ovulationDay + 2
 */
function estimatePhaseForDate(
  dayInCycle: number,
  cycleLength: number,
): PhaseKey {
  if (dayInCycle < 1) return "unknown";
  if (dayInCycle <= 5) return "menstrual";
  const ovulationDay = Math.max(cycleLength - 14, 6);
  if (dayInCycle < ovulationDay - 2) return "follicular";
  if (dayInCycle <= ovulationDay + 2) return "ovulatory";
  return "luteal";
}

interface BuilderCtx {
  sb: SupabaseClient;
  today: string; // YYYY-MM-DD
}

/**
 * Main entry point. Builds the full report payload from Supabase data.
 * Wrapped in try/catch per section so a missing table does not nuke
 * the whole report.
 */
export async function buildCycleReport(
  sb: SupabaseClient,
  today: string,
): Promise<CycleReportPayload> {
  const ctx: BuilderCtx = { sb, today };
  const notes: string[] = [];

  // Patient ---------------------------------------------------------
  const { data: profileRows } = await sb
    .from("health_profile")
    .select("section, content");
  const profileMap = new Map<string, unknown>();
  for (const r of (profileRows ?? []) as Array<{
    section: string;
    content: unknown;
  }>) {
    // parseProfileContent handles legacy JSON-stringified rows plus raw
    // jsonb objects. See src/lib/profile/parse-content.ts (W2.6).
    profileMap.set(r.section, parseProfileContent(r.content));
  }
  const personal = profileMap.get("personal") as
    | { full_name?: string; age?: number; sex?: string }
    | undefined;

  // Cycle length ----------------------------------------------------
  const { cycleLength, periodStarts, cycleSegments } =
    await loadCycleLengthData(ctx);

  // Luteal ----------------------------------------------------------
  const luteal = analyzeLutealPhases(cycleSegments);

  // Period pattern (flow distribution) -----------------------------
  const periodPattern = await loadPeriodPattern(ctx, periodStarts);

  // Symptoms by phase (last 6 cycles worth of data) -----------------
  const recentSymptomsByPhase = await loadSymptomsByPhase(
    ctx,
    periodStarts,
    cycleLength,
  );

  // Pain by phase ---------------------------------------------------
  const painByPhase = await loadPainByPhase(ctx, periodStarts, cycleLength);

  // Recent changes --------------------------------------------------
  const recentChanges = await loadRecentChanges(ctx);

  // Medications -----------------------------------------------------
  const medications = extractMedications(profileMap);
  const supplements = extractSupplements(profileMap);

  // Next OB/GYN appointment ----------------------------------------
  const nextAppointment = await loadNextObgyn(ctx);

  // Flags -----------------------------------------------------------
  const flags = {
    shortLuteal: luteal.hasShortLutealFlag,
    irregularCycles:
      cycleLength.regularityFlag === "irregular" ||
      cycleLength.regularityFlag === "slightly_irregular",
    heavyFlow: (periodPattern.flowBreakdown.HEAVY ?? 0) > 3,
  };

  if (cycleLength.n < 3) {
    notes.push(
      "We have fewer than 3 complete cycles on record. Treat the statistics as preliminary.",
    );
  }
  if (luteal.segments.length === 0 || luteal.segments.every((s) => s.lutealDays == null)) {
    notes.push(
      "Ovulation day is not reliably recorded in Natural Cycles imports. Luteal length shown is estimated from cycle length using the classical ovulation-to-period model.",
    );
  }

  return {
    patient: {
      name: personal?.full_name ?? "Lanae A. Bond",
      age: personal?.age ?? null,
      sex: personal?.sex ?? null,
    },
    generatedAt: new Date().toISOString(),
    cycleLength,
    luteal,
    periodPattern,
    recentSymptomsByPhase,
    painByPhase,
    recentChanges,
    medications,
    supplements,
    nextAppointment,
    flags,
    notes,
  };
}

// ── Supabase loaders ──────────────────────────────────────────────────

async function loadCycleLengthData(ctx: BuilderCtx): Promise<{
  cycleLength: CycleLengthStats;
  periodStarts: PeriodStart[];
  cycleSegments: CycleSegmentForLuteal[];
}> {
  const { data: menRows } = await ctx.sb
    .from("nc_imported")
    .select("date, cycle_number, menstruation, ovulation_status, cycle_day")
    .eq("menstruation", "MENSTRUATION")
    .order("date", { ascending: true });

  const rows = (menRows ?? []) as Array<{
    date: string;
    cycle_number: number | null;
    menstruation: string | null;
    ovulation_status: string | null;
    cycle_day: number | null;
  }>;

  // Build per-cycle start by grouping on cycle_number. Fall back to
  // a date-gap approach when cycle_number is null.
  const byCycle = new Map<
    number,
    { startDate: string; periodDays: number }
  >();
  const withoutCycleNumber: Array<{ date: string }> = [];

  for (const r of rows) {
    if (r.cycle_number == null) {
      withoutCycleNumber.push({ date: r.date });
      continue;
    }
    const existing = byCycle.get(r.cycle_number);
    if (!existing) {
      byCycle.set(r.cycle_number, { startDate: r.date, periodDays: 1 });
    } else {
      if (r.date < existing.startDate) existing.startDate = r.date;
      existing.periodDays += 1;
    }
  }

  const starts: PeriodStart[] = [];
  for (const [cycleNumber, v] of byCycle) {
    starts.push({
      cycleNumber,
      startDate: v.startDate,
      periodDays: v.periodDays,
    });
  }

  // Date-gap fallback for rows without cycle_number
  if (withoutCycleNumber.length) {
    const sorted = [...withoutCycleNumber].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    let prev: Date | null = null;
    for (const r of sorted) {
      const d = new Date(r.date + "T00:00:00");
      if (
        !prev ||
        (d.getTime() - prev.getTime()) / 86400000 > 10
      ) {
        starts.push({
          cycleNumber: null,
          startDate: r.date,
          periodDays: 1,
        });
      } else {
        // absorbed into previous period
        const last = starts[starts.length - 1];
        if (last && last.cycleNumber == null) last.periodDays += 1;
      }
      prev = d;
    }
  }

  starts.sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Keep only the last 12 cycles for headline stats
  const recentStarts = starts.slice(-13); // 13 gives 12 intervals
  const cycleLength = analyzeCycleLengths(recentStarts);

  // Build segments for luteal analysis from ALL rows (not just starts)
  // so that ovulation_status within a cycle can be found.
  const cycleSegments: CycleSegmentForLuteal[] = [];
  for (let i = 1; i < starts.length; i++) {
    const prev = starts[i - 1];
    const cur = starts[i];
    // Try to find an ovulation marker from nc_imported between these dates.
    const { data: withinCycle } = await ctx.sb
      .from("nc_imported")
      .select("date, cycle_day, ovulation_status")
      .gte("date", prev.startDate)
      .lt("date", cur.startDate)
      .order("date", { ascending: true });
    const ovul = (withinCycle ?? []).find(
      (d) =>
        d.ovulation_status &&
        String(d.ovulation_status).toUpperCase().includes("OVULATION"),
    );
    cycleSegments.push({
      cycleNumber: prev.cycleNumber,
      startDate: prev.startDate,
      nextStartDate: cur.startDate,
      ovulationDay: ovul?.cycle_day ?? null,
    });
  }

  return { cycleLength, periodStarts: starts, cycleSegments };
}

async function loadPeriodPattern(
  ctx: BuilderCtx,
  periodStarts: PeriodStart[],
): Promise<CycleReportPayload["periodPattern"]> {
  if (periodStarts.length === 0) {
    return {
      avgPeriodDays: null,
      flowBreakdown: {},
      clotsReported: false,
    };
  }
  // Use the last 6 cycles for flow breakdown.
  const recent = periodStarts.slice(-6);
  const sinceDate = recent[0].startDate;

  const { data: flowRows } = await ctx.sb
    .from("nc_imported")
    .select("date, flow_quantity, menstruation")
    .gte("date", sinceDate)
    .in("menstruation", ["MENSTRUATION", "SPOTTING"]);

  const breakdown: Record<string, number> = {};
  for (const r of (flowRows ?? []) as Array<{
    flow_quantity: string | null;
  }>) {
    const key = r.flow_quantity ?? "UNKNOWN";
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }

  const avgPeriodDays =
    recent.reduce((a, b) => a + b.periodDays, 0) / recent.length;

  // Check cycle_entries for clots reports over the last year.
  const oneYearAgo = new Date(
    new Date(ctx.today + "T00:00:00").getTime() - 365 * 86400000,
  )
    .toISOString()
    .split("T")[0];
  const { data: clotsRows } = await ctx.sb
    .from("cycle_entries")
    .select("clots_present, clot_count")
    .gte("date", oneYearAgo)
    .eq("clots_present", true);
  const clotsReported = (clotsRows ?? []).length > 0;

  return {
    avgPeriodDays: Math.round(avgPeriodDays * 10) / 10,
    flowBreakdown: breakdown,
    clotsReported,
  };
}

async function loadSymptomsByPhase(
  ctx: BuilderCtx,
  periodStarts: PeriodStart[],
  cycleLength: CycleLengthStats,
): Promise<CycleReportPayload["recentSymptomsByPhase"]> {
  const empty: CycleReportPayload["recentSymptomsByPhase"] = {
    menstrual: [],
    follicular: [],
    ovulatory: [],
    luteal: [],
    unknown: [],
  };

  // Limit to last 6 cycles
  const recent = periodStarts.slice(-6);
  if (recent.length === 0) return empty;
  const sinceDate = recent[0].startDate;
  const cycleLen =
    cycleLength.avgLength != null ? Math.round(cycleLength.avgLength) : 28;

  const { data: sym } = await ctx.sb
    .from("symptoms")
    .select("symptom, severity, logged_at")
    .gte("logged_at", sinceDate + "T00:00:00")
    .limit(1000);

  const bucket: Record<
    PhaseKey,
    Map<string, { count: number; maxSeverity: string | null }>
  > = {
    menstrual: new Map(),
    follicular: new Map(),
    ovulatory: new Map(),
    luteal: new Map(),
    unknown: new Map(),
  };

  const severityRank: Record<string, number> = {
    mild: 1,
    moderate: 2,
    severe: 3,
  };

  for (const s of (sym ?? []) as Array<{
    symptom: string | null;
    severity: string | null;
    logged_at: string;
  }>) {
    if (!s.symptom) continue;
    const logged = new Date(s.logged_at).toISOString().split("T")[0];

    // Find the period start on or before logged date
    let phase: PhaseKey = "unknown";
    for (let i = recent.length - 1; i >= 0; i--) {
      if (logged >= recent[i].startDate) {
        const days =
          (new Date(logged + "T00:00:00").getTime() -
            new Date(recent[i].startDate + "T00:00:00").getTime()) /
          86400000;
        phase = estimatePhaseForDate(Math.round(days) + 1, cycleLen);
        break;
      }
    }

    const m = bucket[phase];
    const current = m.get(s.symptom) ?? { count: 0, maxSeverity: null };
    current.count += 1;
    if (s.severity) {
      const newRank = severityRank[s.severity] ?? 0;
      const oldRank = current.maxSeverity
        ? severityRank[current.maxSeverity] ?? 0
        : 0;
      if (newRank > oldRank) current.maxSeverity = s.severity;
    }
    m.set(s.symptom, current);
  }

  const out: CycleReportPayload["recentSymptomsByPhase"] = { ...empty };
  for (const phase of PHASE_KEYS) {
    const arr = Array.from(bucket[phase].entries())
      .map(([symptom, v]) => ({ symptom, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    out[phase] = arr;
  }
  return out;
}

async function loadPainByPhase(
  ctx: BuilderCtx,
  periodStarts: PeriodStart[],
  cycleLength: CycleLengthStats,
): Promise<Record<string, { avg: number | null; count: number }>> {
  const empty: Record<string, { avg: number | null; count: number }> = {
    menstrual: { avg: null, count: 0 },
    follicular: { avg: null, count: 0 },
    ovulatory: { avg: null, count: 0 },
    luteal: { avg: null, count: 0 },
    unknown: { avg: null, count: 0 },
  };
  const recent = periodStarts.slice(-6);
  if (recent.length === 0) return empty;
  const sinceDate = recent[0].startDate;
  const cycleLen =
    cycleLength.avgLength != null ? Math.round(cycleLength.avgLength) : 28;

  const { data: logs } = await ctx.sb
    .from("daily_logs")
    .select("date, overall_pain, cycle_phase")
    .gte("date", sinceDate)
    .not("overall_pain", "is", null);

  const acc: Record<string, { sum: number; n: number }> = {
    menstrual: { sum: 0, n: 0 },
    follicular: { sum: 0, n: 0 },
    ovulatory: { sum: 0, n: 0 },
    luteal: { sum: 0, n: 0 },
    unknown: { sum: 0, n: 0 },
  };

  for (const row of (logs ?? []) as Array<{
    date: string;
    overall_pain: number | null;
    cycle_phase: string | null;
  }>) {
    if (row.overall_pain == null) continue;
    let phase: PhaseKey = "unknown";
    if (row.cycle_phase && PHASE_KEYS.includes(row.cycle_phase as PhaseKey)) {
      phase = row.cycle_phase as PhaseKey;
    } else {
      for (let i = recent.length - 1; i >= 0; i--) {
        if (row.date >= recent[i].startDate) {
          const days =
            (new Date(row.date + "T00:00:00").getTime() -
              new Date(recent[i].startDate + "T00:00:00").getTime()) /
            86400000;
          phase = estimatePhaseForDate(Math.round(days) + 1, cycleLen);
          break;
        }
      }
    }
    acc[phase].sum += row.overall_pain;
    acc[phase].n += 1;
  }

  const out: Record<string, { avg: number | null; count: number }> = {};
  for (const k of Object.keys(acc)) {
    const v = acc[k];
    out[k] = {
      avg: v.n > 0 ? Math.round((v.sum / v.n) * 10) / 10 : null,
      count: v.n,
    };
  }
  return out;
}

async function loadRecentChanges(ctx: BuilderCtx): Promise<string[]> {
  const threeMonthsAgo = new Date(
    new Date(ctx.today + "T00:00:00").getTime() - 90 * 86400000,
  )
    .toISOString()
    .split("T")[0];
  const { data } = await ctx.sb
    .from("medical_timeline")
    .select("event_date, event_type, title, significance")
    .gte("event_date", threeMonthsAgo)
    .in("significance", ["important", "critical"])
    .order("event_date", { ascending: false })
    .limit(10);
  return ((data ?? []) as Array<{
    event_date: string;
    title: string;
  }>).map((e) => `${e.event_date}: ${e.title}`);
}

function extractMedications(
  profileMap: Map<string, unknown>,
): CycleReportPayload["medications"] {
  const meds = profileMap.get("medications") as
    | {
        current?: Array<{
          name: string;
          dose?: string;
          indication?: string;
        }>;
        as_needed?: Array<{
          name: string;
          dose?: string;
          indication?: string;
        }>;
      }
    | undefined;
  const rows: CycleReportPayload["medications"] = [];
  for (const m of meds?.current ?? []) {
    rows.push({
      name: m.name,
      dose: m.dose ?? null,
      indication: m.indication ?? null,
    });
  }
  for (const m of meds?.as_needed ?? []) {
    rows.push({
      name: `${m.name} (as needed)`,
      dose: m.dose ?? null,
      indication: m.indication ?? null,
    });
  }
  return rows;
}

function extractSupplements(
  profileMap: Map<string, unknown>,
): CycleReportPayload["supplements"] {
  const supps = profileMap.get("supplements") as
    | Array<{ name: string; dose?: string }>
    | undefined;
  return (supps ?? []).map((s) => ({
    name: s.name,
    dose: s.dose ?? null,
  }));
}

async function loadNextObgyn(
  ctx: BuilderCtx,
): Promise<CycleReportPayload["nextAppointment"]> {
  const { data } = await ctx.sb
    .from("appointments")
    .select("date, specialty, reason")
    .gte("date", ctx.today)
    .order("date", { ascending: true });
  const rows = (data ?? []) as Array<{
    date: string;
    specialty: string | null;
    reason: string | null;
  }>;
  const obgyn = rows.find(
    (a) =>
      a.specialty &&
      (a.specialty.toLowerCase().includes("ob") ||
        a.specialty.toLowerCase().includes("gyn")),
  );
  if (obgyn)
    return {
      date: obgyn.date,
      specialty: obgyn.specialty,
      reason: obgyn.reason,
    };
  // fall back to any upcoming appointment
  const first = rows[0];
  return first
    ? {
        date: first.date,
        specialty: first.specialty,
        reason: first.reason,
      }
    : null;
}
