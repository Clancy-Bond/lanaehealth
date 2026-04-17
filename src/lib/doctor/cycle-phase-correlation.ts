/**
 * Cycle-Phase x Symptom Correlation
 *
 * Joins nc_imported.cycle_day with daily_logs and symptoms to compute
 * per-phase averages of pain / fatigue / bloating / stress and counts
 * of symptom occurrences. If a symptom concentrates in luteal phase
 * (days 17-28), that's evidence for:
 *   - Catamenial patterns (MCAS, migraine)
 *   - Endometriosis (cyclical pain)
 *   - PMDD
 *
 * Reports the strongest phase effect for each metric.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";

export interface CyclePhaseFinding {
  metric: string;
  dominantPhase: CyclePhase;
  phaseAverages: Record<CyclePhase, { mean: number | null; n: number }>;
  relativeIncrease: number;   // % above the other-phase baseline
  noteworthy: boolean;        // true when dominantPhase mean is >= 30% above other phases
}

function phaseForCycleDay(day: number | null): CyclePhase | null {
  if (day === null) return null;
  if (day <= 5) return "menstrual";
  if (day <= 13) return "follicular";
  if (day <= 16) return "ovulatory";
  return "luteal";
}

interface NcRow {
  date: string;
  cycle_day: number | null;
}

interface LogRow {
  date: string;
  overall_pain: number | null;
  fatigue: number | null;
  bloating: number | null;
  stress: number | null;
}

const METRICS: Array<keyof Omit<LogRow, "date">> = [
  "overall_pain",
  "fatigue",
  "bloating",
  "stress",
];

const METRIC_LABELS: Record<string, string> = {
  overall_pain: "Overall pain",
  fatigue: "Fatigue",
  bloating: "Bloating",
  stress: "Stress",
};

function mean(values: Array<number | null>): number | null {
  const f = values.filter((v): v is number => v !== null);
  if (f.length === 0) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

/** Build date → phase map from the 90 most recent NC entries. */
async function buildPhaseIndex(
  sb: SupabaseClient,
  since: string
): Promise<Map<string, CyclePhase>> {
  const { data } = await sb
    .from("nc_imported")
    .select("date, cycle_day")
    .gte("date", since);

  const rows = (data ?? []) as NcRow[];
  const m = new Map<string, CyclePhase>();
  for (const r of rows) {
    const phase = phaseForCycleDay(r.cycle_day);
    if (phase) m.set(r.date, phase);
  }
  return m;
}

export async function computeCyclePhaseFindings(
  sb: SupabaseClient
): Promise<CyclePhaseFinding[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const since = ninetyDaysAgo.toISOString().slice(0, 10);

  const [phaseMap, logsResult] = await Promise.all([
    buildPhaseIndex(sb, since),
    sb
      .from("daily_logs")
      .select("date, overall_pain, fatigue, bloating, stress")
      .gte("date", since),
  ]);

  const logs = (logsResult.data ?? []) as LogRow[];

  if (logs.length === 0 || phaseMap.size === 0) return [];

  // Bucket logs by phase
  const byPhase: Record<CyclePhase, LogRow[]> = {
    menstrual: [],
    follicular: [],
    ovulatory: [],
    luteal: [],
  };

  for (const l of logs) {
    const p = phaseMap.get(l.date);
    if (p) byPhase[p].push(l);
  }

  const findings: CyclePhaseFinding[] = [];

  for (const metric of METRICS) {
    const phaseAverages = {} as Record<CyclePhase, { mean: number | null; n: number }>;
    const phases: CyclePhase[] = ["menstrual", "follicular", "ovulatory", "luteal"];

    for (const p of phases) {
      const rows = byPhase[p];
      const nonNull = rows.filter((l) => l[metric] !== null);
      phaseAverages[p] = {
        mean: mean(rows.map((l) => l[metric])),
        n: nonNull.length,
      };
    }

    // Find phase with highest mean (only consider phases with n ≥ 3)
    const eligible = phases.filter((p) => phaseAverages[p].n >= 3);
    if (eligible.length < 2) continue;  // need at least two comparable phases

    let dominant: CyclePhase | null = null;
    let dominantMean = -Infinity;
    for (const p of eligible) {
      const m = phaseAverages[p].mean;
      if (m !== null && m > dominantMean) {
        dominantMean = m;
        dominant = p;
      }
    }
    if (!dominant) continue;

    // Compute baseline from non-dominant phases
    const nonDominant = eligible.filter((p) => p !== dominant);
    const baselineValues = nonDominant
      .map((p) => phaseAverages[p].mean)
      .filter((v): v is number => v !== null);
    const baseline = baselineValues.length > 0 ? mean(baselineValues) ?? 0 : 0;

    const relativeIncrease =
      baseline > 0 ? ((dominantMean - baseline) / baseline) * 100 : 0;

    findings.push({
      metric: METRIC_LABELS[metric as string],
      dominantPhase: dominant,
      phaseAverages,
      relativeIncrease,
      noteworthy: relativeIncrease >= 30 && dominantMean >= 3,  // ≥30% above baseline and meaningful intensity
    });
  }

  // Sort by noteworthy first, then by relativeIncrease desc
  findings.sort((a, b) => {
    if (a.noteworthy !== b.noteworthy) return a.noteworthy ? -1 : 1;
    return b.relativeIncrease - a.relativeIncrease;
  });

  return findings;
}
