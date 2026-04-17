import { createServiceClient } from "@/lib/supabase";
import { PatternsClient } from "@/components/patterns/PatternsClient";
import { InsightCardList } from "@/components/patterns/InsightCard";
import { CyclePredictionCard } from "@/components/patterns/CyclePredictionCard";
import { MenstrualMigraineCard } from "@/components/patterns/MenstrualMigraineCard";
import NutrientLabAlertsCard from "@/components/patterns/NutrientLabAlertsCard";
import { BestWorstDaysCard } from "@/components/patterns/BestWorstDaysCard";
import {
  aggregateBestWorst,
  type MoodRow,
  type TrackableEntryRow,
} from "@/lib/intelligence/best-worst-aggregator";
import {
  narrateTopInsights,
  hasEnoughConfidentInsights,
} from "@/lib/intelligence/insight-narrator";
import { runCycleEngine, type EngineSummary } from "@/lib/intelligence/cycle-engine/engine";
import {
  generateAlerts,
  type AlertLabInput,
  type NutrientIntakeAverage,
  type NutrientLabAlert,
} from "@/lib/intelligence/nutrient-lab-alerts";
import { resolveAllTargets, type ResolvedTarget } from "@/lib/nutrition/target-resolver";
import type { HeadacheAttack } from "@/lib/api/headache";
import type { OuraDaily, DailyLog, NcImported, FoodEntry, CycleEntry, ClinicalScaleResponse, LabResult } from "@/lib/types";
import type { CorrelationResult } from "@/components/patterns/PatternsClient";

// This page uses live Supabase data
export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const supabase = createServiceClient();

  // Compute 90-day cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoff = cutoffDate.toISOString().split("T")[0];

  // Fetch all data in parallel. Cards downstream of Wave 2b rely on a few
  // tables that may not be migrated in every environment (headache_attacks,
  // user_nutrient_targets, lab_results). We wrap those queries in safe
  // fallbacks so the page still renders when a migration is missing.
  const safeQuery = async <T,>(run: () => Promise<{ data: T[] | null }>): Promise<T[]> => {
    try {
      const { data } = await run();
      return (data ?? []) as T[];
    } catch {
      return [] as T[];
    }
  };

  const results = await Promise.all([
    // oura_daily: last 90 days, only columns needed for charts
    supabase
      .from("oura_daily")
      .select("date, sleep_score, hrv_avg, resting_hr, body_temp_deviation, stress_score, readiness_score, spo2_avg")
      .gte("date", cutoff)
      .order("date", { ascending: true })
      .limit(100),

    // daily_logs: last 90 days, only columns needed for charts
    supabase
      .from("daily_logs")
      .select("date, overall_pain, fatigue, bloating, stress, sleep_quality, cycle_phase")
      .gte("date", cutoff)
      .order("date", { ascending: true })
      .limit(100),

    // nc_imported: last 90 days, only columns needed
    supabase
      .from("nc_imported")
      .select("date, temperature, cycle_day, cycle_number, fertility_color, menstruation, ovulation_status")
      .gte("date", cutoff)
      .order("date", { ascending: true })
      .limit(100),

    // food_entries: last 90 days, only needed columns
    supabase
      .from("food_entries")
      .select("logged_at, meal_type, food_items, flagged_triggers")
      .gte("logged_at", cutoff)
      .order("logged_at", { ascending: true })
      .limit(500),

    // cycle_entries: last 90 days
    supabase
      .from("cycle_entries")
      .select("date, flow_level, menstruation, lh_test_result")
      .gte("date", cutoff)
      .order("date", { ascending: true })
      .limit(100),

    // correlation_results: all non-none confidence
    supabase
      .from("correlation_results")
      .select("*")
      .in("confidence_level", ["moderate", "strong", "suggestive"])
      .order("computed_at", { ascending: false })
      .limit(20),

    // Full NC history for CycleOverview stats + cycle engine (needs all cycles)
    supabase
      .from("nc_imported")
      .select("date, cycle_day, cycle_number, menstruation, fertility_color, temperature, lh_test")
      .order("date", { ascending: true })
      .limit(2000),

    // Full cycle entries history for CycleOverview
    supabase
      .from("cycle_entries")
      .select("date, flow_level, menstruation")
      .order("date", { ascending: true })
      .limit(2000),

    // Clinical scale responses (PHQ-9, GAD-7) for mental health trends
    supabase
      .from("clinical_scale_responses")
      .select("*")
      .order("date", { ascending: true })
      .limit(100),

    // Full Oura history so the cycle engine can use HRV + RHR fusion across
    // every completed cycle (not just the last 90 days).
    supabase
      .from("oura_daily")
      .select("date, hrv_avg, resting_hr, body_temp_deviation")
      .order("date", { ascending: true })
      .limit(2000),
  ]);

  // Best vs Worst Days (Daylio F3): fetch mood_entries + custom_trackable_entries
  // scoped to daily_logs in the 90-day window. Aggregator enforces the 10-day
  // per-bucket threshold so the empty state is driven by data, not props.
  type LogIdRow = { id: string; date: string };
  type BestWorstMoodRow = { log_id: string; mood_score: number };
  type BestWorstEntryRow = {
    log_id: string;
    trackable_id: string;
    toggled: boolean | null;
    value: number | null;
    custom_trackables:
      | {
          id: string;
          name: string;
          category: string;
          icon: string | null;
        }
      | null;
  };
  const bestWorstPromise = (async () => {
    const logRows = await safeQuery<LogIdRow>(() =>
      supabase
        .from("daily_logs")
        .select("id, date")
        .gte("date", cutoff)
        .limit(200) as unknown as Promise<{ data: LogIdRow[] | null }>,
    );
    const logIds = logRows.map((r) => r.id);
    if (logIds.length === 0) {
      return { moods: [] as BestWorstMoodRow[], entries: [] as BestWorstEntryRow[] };
    }
    const [moodRows, entryRows] = await Promise.all([
      safeQuery<BestWorstMoodRow>(() =>
        supabase
          .from("mood_entries")
          .select("log_id, mood_score")
          .in("log_id", logIds)
          .limit(500) as unknown as Promise<{ data: BestWorstMoodRow[] | null }>,
      ),
      safeQuery<BestWorstEntryRow>(() =>
        supabase
          .from("custom_trackable_entries")
          .select(
            "log_id, trackable_id, toggled, value, custom_trackables(id, name, category, icon)",
          )
          .in("log_id", logIds)
          .limit(5000) as unknown as Promise<{ data: BestWorstEntryRow[] | null }>,
      ),
    ]);
    return { moods: moodRows, entries: entryRows };
  })();

  // Wave 2b card inputs. Each wrapped in safeQuery so a missing migration
  // gracefully empty-states rather than failing the page.
  const [attacksRaw, labsRaw, nutrientTargetRows] = await Promise.all([
    safeQuery<HeadacheAttack>(() =>
      supabase
        .from("headache_attacks")
        .select("id, started_at, cycle_phase")
        .order("started_at", { ascending: false })
        .limit(500) as unknown as Promise<{ data: HeadacheAttack[] | null }>,
    ),
    safeQuery<LabResult>(() =>
      supabase
        .from("lab_results")
        .select("*")
        .order("date", { ascending: false })
        .limit(200) as unknown as Promise<{ data: LabResult[] | null }>,
    ),
    safeQuery<Parameters<typeof resolveAllTargets>[0][number]>(() =>
      supabase
        .from("user_nutrient_targets")
        .select("*")
        .eq("active", true) as unknown as Promise<{
        data: Parameters<typeof resolveAllTargets>[0][number][] | null;
      }>,
    ),
  ]);

  // results[0]=oura, [1]=dailyLogs, [2]=nc(90d), [3]=food, [4]=cycle(90d), [5]=correlations, [6]=fullNc, [7]=fullCycle, [8]=clinicalScales, [9]=fullOura

  // Narrate the top insights on the server so the card list hydrates
  // with sentences already computed. Static/dynamic boundary is respected
  // inside narrateTopInsights (local template today, Claude path available
  // via narrateInsightClaude for a future caching layer).
  const correlations = (results[5].data || []) as CorrelationResult[];
  const narratedInsights = narrateTopInsights(correlations, 5);
  const insightsReady = hasEnoughConfidentInsights(correlations);

  // Wave 2b: cycle engine prediction (CyclePredictionCard)
  const fullNcRows = (results[6]?.data || []) as NcImported[];
  const fullOuraRows = (results[9]?.data || []) as OuraDaily[];
  let engineSummary: EngineSummary | null = null;
  try {
    engineSummary = runCycleEngine({
      patientId: "lanae",
      ncRows: fullNcRows,
      ouraRows: fullOuraRows,
    });
  } catch {
    engineSummary = null;
  }

  // Wave 2b: menstrual-migraine (MenstrualMigraineCard). Headache attacks
  // may be empty when migration 014 has not been applied yet; the card
  // handles this gracefully via its sufficientData empty state.
  const attacksForCard = attacksRaw.map((a) => ({
    id: a.id,
    started_at: a.started_at,
    cycle_phase: a.cycle_phase,
  }));

  // Wave 2b: nutrient-lab cross-reference alerts (NutrientLabAlertsCard).
  // Intake averages from food_entries are not wired here (requires a
  // rollup not yet implemented); pass an empty array so the engine emits
  // info-severity alerts from labs + targets alone. When migration 017
  // is missing, targets will be empty and the card renders its empty state.
  const resolvedTargets: ResolvedTarget[] =
    nutrientTargetRows.length > 0 ? resolveAllTargets(nutrientTargetRows) : [];
  const alertLabs: AlertLabInput[] = labsRaw.map((lab) => ({
    test_name: lab.test_name,
    value: lab.value,
    unit: lab.unit,
    reference_range_low: lab.reference_range_low,
    reference_range_high: lab.reference_range_high,
    flag: lab.flag,
    date: lab.date,
  }));
  const intakeAverages: NutrientIntakeAverage[] = [];
  let nutrientAlerts: NutrientLabAlert[] = [];
  try {
    nutrientAlerts =
      alertLabs.length > 0 && resolvedTargets.length > 0
        ? generateAlerts(alertLabs, resolvedTargets, intakeAverages)
        : [];
  } catch {
    nutrientAlerts = [];
  }

  // Best vs Worst Days (Daylio F3): resolve the parallel fetch and aggregate.
  const bestWorstData = await bestWorstPromise;
  const bestWorstMoods: MoodRow[] = bestWorstData.moods
    .filter(
      (m) =>
        Number.isFinite(m.mood_score) &&
        m.mood_score >= 1 &&
        m.mood_score <= 5,
    )
    .map((m) => ({
      log_id: m.log_id,
      mood_score: m.mood_score as MoodRow["mood_score"],
    }));
  const bestWorstEntries: TrackableEntryRow[] = bestWorstData.entries
    .filter((e) => e.custom_trackables !== null)
    .map((e) => ({
      log_id: e.log_id,
      trackable_id: e.trackable_id,
      toggled: e.toggled,
      value: e.value,
      trackable: {
        id: e.custom_trackables!.id,
        name: e.custom_trackables!.name,
        category: e.custom_trackables!.category as TrackableEntryRow["trackable"]["category"],
        icon: e.custom_trackables!.icon,
      },
    }));
  const bestWorstResult = aggregateBestWorst({
    moods: bestWorstMoods,
    entries: bestWorstEntries,
    windowLabel: "Last 90 days",
  });

  return (
    <div>
      {/* Plain-English insight cards: mounted above the existing client so the
          correlation rendering below continues to work for power users. */}
      <div
        style={{
          maxWidth: 640,
          marginLeft: "auto",
          marginRight: "auto",
          padding: "16px 16px 0",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <InsightCardList items={narratedInsights} hasEnough={insightsReady} />
        <CyclePredictionCard summary={engineSummary} />
        <MenstrualMigraineCard attacks={attacksForCard} ncRows={fullNcRows} />
        <NutrientLabAlertsCard alerts={nutrientAlerts} />
        <BestWorstDaysCard result={bestWorstResult} />
      </div>

      <PatternsClient
        ouraData={(results[0].data || []) as OuraDaily[]}
        dailyLogs={(results[1].data || []) as DailyLog[]}
        ncData={(results[2].data || []) as NcImported[]}
        foodEntries={(results[3].data || []) as FoodEntry[]}
        cycleEntries={(results[4].data || []) as CycleEntry[]}
        correlations={correlations}
        fullNcData={fullNcRows}
        fullCycleEntries={(results[7]?.data || []) as CycleEntry[]}
        clinicalScaleResponses={(results[8]?.data || []) as ClinicalScaleResponse[]}
      />
    </div>
  );
}
