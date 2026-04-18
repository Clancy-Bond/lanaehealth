/**
 * Weekly digest builder.
 *
 * Pure function producing a 7-day roll-up for the Home page:
 *   - Check-in streak (#days logged vs possible)
 *   - Pain trend (average, delta vs prior week)
 *   - Symptom counts by category
 *   - Sleep average (Oura)
 *   - Cycle-day delta (did she finish a period this week?)
 *
 * Output is intentionally a small shape: the home Digest component
 * renders 4-5 bullets and nothing more. Mirrors the "weekly email
 * summary" pattern popular on Whoop and Bearable.
 */

import { differenceInCalendarDays, format, subDays } from "date-fns";

export interface DigestInput {
  today: string;
  dailyLogs: Array<{ date: string; overall_pain: number | null; fatigue: number | null; stress: number | null }>;
  ouraRows: Array<{ date: string; sleep_score: number | null; hrv_avg: number | null }>;
  symptoms: Array<{ logged_at: string; category: string; severity: string | null }>;
}

export interface Digest {
  summaries: string[];
  streak: { logged: number; window: number };
  painAverage: number | null;
  painDeltaVsPrior: number | null;
  sleepAverage: number | null;
  symptomCount: number;
}

export function buildWeeklyDigest(input: DigestInput): Digest {
  const today = new Date(input.today + "T00:00:00");
  const lastDay = today;
  const firstDay = subDays(lastDay, 6);

  const inLastWeek = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d >= firstDay && d <= lastDay;
  };
  const inPriorWeek = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    const prevEnd = subDays(firstDay, 1);
    const prevStart = subDays(prevEnd, 6);
    return d >= prevStart && d <= prevEnd;
  };

  const thisWeek = input.dailyLogs.filter((r) => inLastWeek(r.date));
  const priorWeek = input.dailyLogs.filter((r) => inPriorWeek(r.date));

  const loggedDays = thisWeek.filter((r) => r.overall_pain !== null).length;
  const windowDays = 7;

  const painValues = thisWeek
    .map((r) => r.overall_pain)
    .filter((v): v is number => v !== null);
  const painAverage = painValues.length > 0 ? avg(painValues) : null;

  const priorPainValues = priorWeek
    .map((r) => r.overall_pain)
    .filter((v): v is number => v !== null);
  const priorAvg = priorPainValues.length > 0 ? avg(priorPainValues) : null;
  const painDeltaVsPrior = painAverage !== null && priorAvg !== null ? Number((painAverage - priorAvg).toFixed(1)) : null;

  const sleepValues = input.ouraRows
    .filter((r) => inLastWeek(r.date))
    .map((r) => r.sleep_score)
    .filter((v): v is number => v !== null);
  const sleepAverage = sleepValues.length > 0 ? avg(sleepValues) : null;

  const thisWeekSymptoms = input.symptoms.filter((s) => {
    const iso = s.logged_at.slice(0, 10);
    return inLastWeek(iso);
  });

  const summaries: string[] = [];
  if (loggedDays > 0) {
    summaries.push(
      `Checked in ${loggedDays} of ${windowDays} days (${format(firstDay, "MMM d")} - ${format(lastDay, "MMM d")}).`,
    );
  } else {
    summaries.push(
      `No check-ins logged this week yet. Open the Log page or use a quick-tap tile on Home.`,
    );
  }
  if (painAverage !== null) {
    if (painDeltaVsPrior !== null && Math.abs(painDeltaVsPrior) >= 0.5) {
      const dir = painDeltaVsPrior > 0 ? "up" : "down";
      summaries.push(
        `Avg pain ${painAverage.toFixed(1)} / 10, ${Math.abs(painDeltaVsPrior).toFixed(1)} ${dir} vs prior week.`,
      );
    } else {
      summaries.push(`Avg pain ${painAverage.toFixed(1)} / 10. Steady vs prior week.`);
    }
  }
  if (thisWeekSymptoms.length > 0) {
    const categoryCounts: Record<string, number> = {};
    for (const s of thisWeekSymptoms) {
      categoryCounts[s.category] = (categoryCounts[s.category] ?? 0) + 1;
    }
    const topCat = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
    summaries.push(
      `${thisWeekSymptoms.length} symptom${thisWeekSymptoms.length === 1 ? "" : "s"} logged this week (${topCat[0]} most common).`,
    );
  }
  if (sleepAverage !== null) {
    summaries.push(`7-day avg sleep score ${Math.round(sleepAverage)} / 100.`);
  }

  return {
    summaries,
    streak: { logged: loggedDays, window: windowDays },
    painAverage,
    painDeltaVsPrior,
    sleepAverage,
    symptomCount: thisWeekSymptoms.length,
  };
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
void differenceInCalendarDays;
