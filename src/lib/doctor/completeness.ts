/**
 * Data Completeness
 *
 * Reports how much ground-truth data backs each data domain. A
 * hypothesis that rests on a low-completeness domain should be
 * labelled "INSUFFICIENT DATA" rather than having inflated confidence.
 *
 * Returned to the brief so the doctor can see *why* we can't say more.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CompletenessReport {
  windowDays: number;
  dailyLogs: { total: number; withPain: number; withFatigue: number; withSleep: number; coveragePct: number };
  ouraDays: { total: number; coveragePct: number };
  cycleDays: { total: number; coveragePct: number };
  symptoms: { total: number };
  orthostaticTests: { total: number; positive: number };
  labCount: { total: number };
  warnings: string[];          // human-readable issues
}

export async function computeCompleteness(
  sb: SupabaseClient,
  windowDays: number = 30
): Promise<CompletenessReport> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().slice(0, 10);

  const [logsResult, ouraResult, ncResult, symptomsResult, orthoResult, labsResult] =
    await Promise.all([
      sb
        .from("daily_logs")
        .select("date, overall_pain, fatigue, sleep_quality")
        .gte("date", sinceStr),
      sb.from("oura_daily").select("date").gte("date", sinceStr),
      sb.from("nc_imported").select("date").gte("date", sinceStr),
      sb.from("symptoms").select("id").gte("logged_at", since.toISOString()),
      // orthostatic_tests may not exist yet; swallow errors
      sb
        .from("orthostatic_tests")
        .select("peak_rise_bpm")
        .gte("test_date", sinceStr),
      sb.from("lab_results").select("id").gte("date", sinceStr),
    ]);

  const logs = (logsResult.data ?? []) as Array<{
    date: string;
    overall_pain: number | null;
    fatigue: number | null;
    sleep_quality: number | null;
  }>;

  const ouraDays = (ouraResult.data ?? []).length;
  const cycleDays = (ncResult.data ?? []).length;
  const symptomsCount = (symptomsResult.data ?? []).length;
  const orthoData =
    orthoResult.error || !Array.isArray(orthoResult.data)
      ? []
      : (orthoResult.data as Array<{ peak_rise_bpm: number | null }>);
  const labsCount = (labsResult.data ?? []).length;

  const totalPain = logs.filter((l) => l.overall_pain !== null).length;
  const totalFatigue = logs.filter((l) => l.fatigue !== null).length;
  const totalSleep = logs.filter((l) => l.sleep_quality !== null).length;

  const warnings: string[] = [];

  const painCoverage = (totalPain / windowDays) * 100;
  if (painCoverage < 30) {
    warnings.push(
      `Only ${totalPain}/${windowDays} days have pain logged (${Math.round(painCoverage)}%). Pattern claims are uncertain.`
    );
  }
  if ((ouraDays / windowDays) * 100 < 70) {
    warnings.push(
      `Oura data on only ${ouraDays}/${windowDays} days. HRV/HR averages may be unrepresentative.`
    );
  }
  if (cycleDays < 5) {
    warnings.push(
      `Natural Cycles data thin (${cycleDays} days in last ${windowDays}). Cycle-phase correlations are preliminary.`
    );
  }
  if (orthoData.length === 0) {
    warnings.push(
      "No orthostatic tests logged. POTS hypothesis rests on incidental Oura data only."
    );
  }

  return {
    windowDays,
    dailyLogs: {
      total: logs.length,
      withPain: totalPain,
      withFatigue: totalFatigue,
      withSleep: totalSleep,
      coveragePct: Math.round((logs.length / windowDays) * 100),
    },
    ouraDays: {
      total: ouraDays,
      coveragePct: Math.round((ouraDays / windowDays) * 100),
    },
    cycleDays: {
      total: cycleDays,
      coveragePct: Math.round((cycleDays / windowDays) * 100),
    },
    symptoms: { total: symptomsCount },
    orthostaticTests: {
      total: orthoData.length,
      positive: orthoData.filter(
        (t) => t.peak_rise_bpm !== null && t.peak_rise_bpm >= 30
      ).length,
    },
    labCount: { total: labsCount },
    warnings,
  };
}
