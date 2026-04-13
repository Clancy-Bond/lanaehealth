import { createServiceClient } from "@/lib/supabase";
import { PatternsClient } from "@/components/patterns/PatternsClient";

// This page uses live Supabase data
export const dynamic = "force-dynamic";

export default async function PatternsPage() {
  const supabase = createServiceClient();

  // Compute 90-day cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoff = cutoffDate.toISOString().split("T")[0];

  // Fetch all data in parallel
  const [
    ouraResult,
    dailyLogsResult,
    ncResult,
    foodResult,
    cycleResult,
    correlationResult,
  ] = await Promise.all([
    // oura_daily: last 90 days, ordered by date ASC
    supabase
      .from("oura_daily")
      .select("*")
      .gte("date", cutoff)
      .order("date", { ascending: true }),

    // daily_logs: last 90 days (include all rows; nulls handled in merge)
    supabase
      .from("daily_logs")
      .select("*")
      .gte("date", cutoff)
      .order("date", { ascending: true }),

    // nc_imported: last 90 days
    supabase
      .from("nc_imported")
      .select("*")
      .gte("date", cutoff)
      .order("date", { ascending: true }),

    // food_entries: last 90 days via logged_at
    supabase
      .from("food_entries")
      .select("*")
      .gte("logged_at", cutoff)
      .order("logged_at", { ascending: true }),

    // cycle_entries: last 90 days
    supabase
      .from("cycle_entries")
      .select("*")
      .gte("date", cutoff)
      .order("date", { ascending: true }),

    // correlation_results: moderate + strong confidence
    supabase
      .from("correlation_results")
      .select("*")
      .in("confidence_level", ["moderate", "strong"])
      .order("computed_at", { ascending: false }),
  ]);

  return (
    <PatternsClient
      ouraData={ouraResult.data || []}
      dailyLogs={dailyLogsResult.data || []}
      ncData={ncResult.data || []}
      foodEntries={foodResult.data || []}
      cycleEntries={cycleResult.data || []}
      correlations={correlationResult.data || []}
    />
  );
}
