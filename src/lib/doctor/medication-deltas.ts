/**
 * Medication-Delta Correlation
 *
 * For each medication_change event in medical_timeline, compare the
 * 14 days before vs 14 days after across:
 *   - daily_logs: overall_pain, fatigue, bloating, stress, sleep_quality
 *   - oura_daily: hrv_avg, resting_hr
 *
 * Flags deltas exceeding threshold so the doctor can see whether a
 * medication start/stop preceded a symptom shift.
 *
 * Runs server-side in the doctor page's parallel fetch so we can use
 * the existing Supabase service client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface MedicationDelta {
  eventDate: string;
  title: string;              // e.g. "Started Isotretinoin (Accutane) 80mg"
  description: string | null;
  windowBeforeStart: string;  // yyyy-mm-dd
  windowAfterEnd: string;     // yyyy-mm-dd

  metrics: Array<{
    metric: string;           // human-readable e.g. "Overall pain"
    beforeMean: number | null;
    afterMean: number | null;
    delta: number | null;
    nBefore: number;
    nAfter: number;
    direction: "improved" | "worsened" | "stable" | "insufficient";
    noteworthy: boolean;      // true when absolute delta exceeds threshold
  }>;
}

const METRICS: Array<{
  key: "overall_pain" | "fatigue" | "bloating" | "stress" | "sleep_quality";
  label: string;
  // Higher = worse (pain/fatigue/bloating/stress), except sleep_quality
  worseWhen: "higher" | "lower";
  threshold: number;          // absolute delta that counts as noteworthy (0-10 scale)
}> = [
  { key: "overall_pain", label: "Overall pain", worseWhen: "higher", threshold: 1.0 },
  { key: "fatigue", label: "Fatigue", worseWhen: "higher", threshold: 1.0 },
  { key: "bloating", label: "Bloating", worseWhen: "higher", threshold: 1.0 },
  { key: "stress", label: "Stress", worseWhen: "higher", threshold: 1.0 },
  { key: "sleep_quality", label: "Sleep quality", worseWhen: "lower", threshold: 1.0 },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function mean(values: Array<number | null>): number | null {
  const filtered = values.filter((v): v is number => v !== null);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

interface TimelineRow {
  event_date: string;
  title: string;
  description: string | null;
}

interface DailyLogRow {
  date: string;
  overall_pain: number | null;
  fatigue: number | null;
  bloating: number | null;
  stress: number | null;
  sleep_quality: number | null;
}

interface OuraRow {
  date: string;
  hrv_avg: number | null;
  resting_hr: number | null;
}

export async function computeMedicationDeltas(
  sb: SupabaseClient
): Promise<MedicationDelta[]> {
  // 1. Fetch medication_change events
  const { data: events, error: evErr } = await sb
    .from("medical_timeline")
    .select("event_date, title, description")
    .eq("event_type", "medication_change")
    .order("event_date", { ascending: false })
    .limit(10);

  if (evErr || !events || events.length === 0) return [];

  const typedEvents = events as TimelineRow[];

  // 2. Determine full date range covering all windows (28 days per event)
  const allDates = typedEvents.flatMap((e) => [
    addDays(e.event_date, -14),
    addDays(e.event_date, 14),
  ]);
  const minDate = allDates.sort()[0];
  const maxDate = allDates.sort().reverse()[0];

  // 3. Fetch daily_logs + oura_daily for the full range in parallel
  const [logsResult, ouraResult] = await Promise.all([
    sb
      .from("daily_logs")
      .select("date, overall_pain, fatigue, bloating, stress, sleep_quality")
      .gte("date", minDate)
      .lte("date", maxDate),
    sb
      .from("oura_daily")
      .select("date, hrv_avg, resting_hr")
      .gte("date", minDate)
      .lte("date", maxDate),
  ]);

  const logs = (logsResult.data ?? []) as DailyLogRow[];
  const oura = (ouraResult.data ?? []) as OuraRow[];

  // 4. Compute deltas per event
  return typedEvents.map((ev): MedicationDelta => {
    const startWindow = addDays(ev.event_date, -14);
    const endWindow = addDays(ev.event_date, 14);

    const before = logs.filter(
      (l) => l.date >= startWindow && l.date < ev.event_date
    );
    const after = logs.filter(
      (l) => l.date > ev.event_date && l.date <= endWindow
    );
    const ouraBefore = oura.filter(
      (o) => o.date >= startWindow && o.date < ev.event_date
    );
    const ouraAfter = oura.filter(
      (o) => o.date > ev.event_date && o.date <= endWindow
    );

    const metrics: MedicationDelta["metrics"] = [];

    for (const m of METRICS) {
      const bMean = mean(before.map((l) => l[m.key]));
      const aMean = mean(after.map((l) => l[m.key]));
      const nB = before.filter((l) => l[m.key] !== null).length;
      const nA = after.filter((l) => l[m.key] !== null).length;

      let delta: number | null = null;
      let direction: MedicationDelta["metrics"][number]["direction"] = "insufficient";

      if (nB < 3 || nA < 3 || bMean === null || aMean === null) {
        direction = "insufficient";
      } else {
        delta = aMean - bMean;
        const improving =
          m.worseWhen === "higher" ? delta < 0 : delta > 0;
        if (Math.abs(delta) < 0.3) direction = "stable";
        else if (improving) direction = "improved";
        else direction = "worsened";
      }

      metrics.push({
        metric: m.label,
        beforeMean: bMean,
        afterMean: aMean,
        delta,
        nBefore: nB,
        nAfter: nA,
        direction,
        noteworthy:
          delta !== null && Math.abs(delta) >= m.threshold,
      });
    }

    // Oura HRV delta
    const hrvBMean = mean(ouraBefore.map((o) => o.hrv_avg));
    const hrvAMean = mean(ouraAfter.map((o) => o.hrv_avg));
    const hrvDelta =
      hrvBMean !== null && hrvAMean !== null ? hrvAMean - hrvBMean : null;
    metrics.push({
      metric: "HRV (Oura avg)",
      beforeMean: hrvBMean,
      afterMean: hrvAMean,
      delta: hrvDelta,
      nBefore: ouraBefore.filter((o) => o.hrv_avg !== null).length,
      nAfter: ouraAfter.filter((o) => o.hrv_avg !== null).length,
      direction:
        hrvDelta === null
          ? "insufficient"
          : Math.abs(hrvDelta) < 3
          ? "stable"
          : hrvDelta > 0
          ? "improved"
          : "worsened",
      noteworthy: hrvDelta !== null && Math.abs(hrvDelta) >= 8,
    });

    // Oura resting HR delta
    const hrBMean = mean(ouraBefore.map((o) => o.resting_hr));
    const hrAMean = mean(ouraAfter.map((o) => o.resting_hr));
    const hrDelta =
      hrBMean !== null && hrAMean !== null ? hrAMean - hrBMean : null;
    metrics.push({
      metric: "Resting HR (Oura avg)",
      beforeMean: hrBMean,
      afterMean: hrAMean,
      delta: hrDelta,
      nBefore: ouraBefore.filter((o) => o.resting_hr !== null).length,
      nAfter: ouraAfter.filter((o) => o.resting_hr !== null).length,
      direction:
        hrDelta === null
          ? "insufficient"
          : Math.abs(hrDelta) < 2
          ? "stable"
          : hrDelta < 0
          ? "improved"
          : "worsened",
      noteworthy: hrDelta !== null && Math.abs(hrDelta) >= 5,
    });

    return {
      eventDate: ev.event_date,
      title: ev.title,
      description: ev.description,
      windowBeforeStart: startWindow,
      windowAfterEnd: endWindow,
      metrics,
    };
  });
}
