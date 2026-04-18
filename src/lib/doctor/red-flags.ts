/**
 * Red-Flag Triggers
 *
 * A static ruleset for "call the doctor today" events. Fires a non-
 * dismissable banner on home when any rule is true. Deliberately
 * conservative so we don't cry wolf.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface RedFlag {
  id: string;                    // stable key e.g. "syncope_recent"
  severity: "call-today" | "call-this-week";
  headline: string;              // brief statement
  detail: string;                // one-sentence context
  dataRef: string;               // row ID(s) or date ref
  action: string;                // the specific action to take
}

interface TimelineRow {
  id: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  significance: string;
}

interface OuraRow {
  date: string;
  resting_hr: number | null;
}

interface LabRow {
  id: string;
  date: string;
  test_name: string;
  value: number | null;
  flag: string | null;
}

export async function computeRedFlags(
  sb: SupabaseClient
): Promise<RedFlag[]> {
  const flags: RedFlag[] = [];
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [timelineResult, ouraResult, labResult] = await Promise.all([
    sb
      .from("medical_timeline")
      .select("id, event_date, event_type, title, description, significance")
      .gte("event_date", thirtyDaysAgoStr),
    sb
      .from("oura_daily")
      .select("date, resting_hr")
      .gte("date", thirtyDaysAgoStr),
    sb
      .from("lab_results")
      .select("id, date, test_name, value, flag")
      .eq("flag", "critical")
      .order("date", { ascending: false })
      .limit(10),
  ]);

  const timeline = (timelineResult.data ?? []) as TimelineRow[];
  const oura = (ouraResult.data ?? []) as OuraRow[];
  const labs = (labResult.data ?? []) as LabRow[];

  // Rule 1: syncope or loss-of-consciousness event in last 30 days
  for (const ev of timeline) {
    const text = `${ev.title} ${ev.description ?? ""}`.toLowerCase();
    if (
      /syncope|fainting|lost\s+consciousness|loc\b|collapse/.test(text) &&
      ev.event_type !== "diagnosis"
    ) {
      flags.push({
        id: `syncope_${ev.id}`,
        severity: "call-today",
        headline: "Recent syncope event",
        detail: `${ev.title} on ${ev.event_date}. Syncope warrants workup before next exertion.`,
        dataRef: `medical_timeline.id=${ev.id}`,
        action: "Contact PCP or urgent care within 24-48 hours.",
      });
    }
  }

  // Rule 2: resting HR drop below 40 bpm in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
  const lowHr = oura.filter(
    (o) => o.date >= sevenDaysAgoStr && o.resting_hr !== null && o.resting_hr < 40
  );
  if (lowHr.length > 0) {
    flags.push({
      id: "resting_hr_below_40",
      severity: "call-today",
      headline: `Resting HR <40 bpm on ${lowHr.length} day${lowHr.length > 1 ? "s" : ""}`,
      detail: `Lowest: ${Math.min(
        ...lowHr.map((o) => o.resting_hr as number)
      )} bpm on ${
        lowHr.sort((a, b) => (a.resting_hr as number) - (b.resting_hr as number))[0].date
      }. Symptomatic bradycardia needs evaluation.`,
      dataRef: `oura_daily.date=${lowHr.map((o) => o.date).join(",")}`,
      action: "Contact cardiology or PCP today, especially if lightheaded or short of breath.",
    });
  }

  // Rule 3: any critical-flagged lab in last 30 days not yet addressed
  for (const lab of labs) {
    if (lab.date < thirtyDaysAgoStr) continue;
    flags.push({
      id: `critical_lab_${lab.id}`,
      severity: "call-today",
      headline: `Critical lab: ${lab.test_name}`,
      detail: `${lab.value ?? "unknown value"} on ${lab.date}. Flagged critical.`,
      dataRef: `lab_results.id=${lab.id}`,
      action: "Confirm the ordering physician has reviewed and given a treatment plan.",
    });
  }

  // Rule 4: ferritin dropped below 15 after starting iron (regression)
  // (handled downstream, requires knowing iron start date; placeholder for now)

  return flags;
}
