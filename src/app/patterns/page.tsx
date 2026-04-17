import { createServiceClient } from "@/lib/supabase";
import { PatternsClient } from "@/components/patterns/PatternsClient";
import { InsightCardList } from "@/components/patterns/InsightCard";
import {
  narrateTopInsights,
  hasEnoughConfidentInsights,
} from "@/lib/intelligence/insight-narrator";
import type { OuraDaily, DailyLog, NcImported, FoodEntry, CycleEntry, ClinicalScaleResponse } from "@/lib/types";
import type { CorrelationResult } from "@/components/patterns/PatternsClient";

// This page uses live Supabase data
export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const supabase = createServiceClient();

  // Compute 90-day cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoff = cutoffDate.toISOString().split("T")[0];

  // Fetch all data in parallel
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

    // Full NC history for CycleOverview stats (needs all cycles, not just 90d)
    supabase
      .from("nc_imported")
      .select("date, cycle_day, cycle_number, menstruation, fertility_color")
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
  ]);

  // results[0]=oura, [1]=dailyLogs, [2]=nc(90d), [3]=food, [4]=cycle(90d), [5]=correlations, [6]=fullNc, [7]=fullCycle, [8]=clinicalScales

  // Narrate the top insights on the server so the card list hydrates
  // with sentences already computed. Static/dynamic boundary is respected
  // inside narrateTopInsights (local template today, Claude path available
  // via narrateInsightClaude for a future caching layer).
  const correlations = (results[5].data || []) as CorrelationResult[];
  const narratedInsights = narrateTopInsights(correlations, 5);
  const insightsReady = hasEnoughConfidentInsights(correlations);

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
        }}
      >
        <InsightCardList items={narratedInsights} hasEnough={insightsReady} />
      </div>

      <PatternsClient
        ouraData={(results[0].data || []) as OuraDaily[]}
        dailyLogs={(results[1].data || []) as DailyLog[]}
        ncData={(results[2].data || []) as NcImported[]}
        foodEntries={(results[3].data || []) as FoodEntry[]}
        cycleEntries={(results[4].data || []) as CycleEntry[]}
        correlations={correlations}
        fullNcData={(results[6]?.data || []) as NcImported[]}
        fullCycleEntries={(results[7]?.data || []) as CycleEntry[]}
        clinicalScaleResponses={(results[8]?.data || []) as ClinicalScaleResponse[]}
      />
    </div>
  );
}
