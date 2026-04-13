import { createServiceClient } from "@/lib/supabase";
import { format } from "date-fns";
import { HealthRing } from "@/components/home/HealthRing";
import { QuickStatusStrip } from "@/components/home/QuickStatusStrip";
import { SmartCards } from "@/components/home/SmartCards";

// This page uses live Supabase data that changes daily
export const dynamic = "force-dynamic";

/**
 * Determine cycle phase from cycle day using standard 28-day model.
 * Returns null if cycle day is unknown.
 */
function estimateCyclePhase(cycleDay: number | null): string | null {
  if (cycleDay === null) return null;
  if (cycleDay <= 5) return "menstrual";
  if (cycleDay <= 13) return "follicular";
  if (cycleDay <= 16) return "ovulatory";
  return "luteal";
}

export default async function Home() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch all data in parallel
  const [
    dailyLogResult,
    ouraRecentResult,
    cycleEntryResult,
    ncImportedResult,
    activeProblemsResult,
    ouraTrendResult,
  ] = await Promise.all([
    // Today's daily log
    supabase
      .from("daily_logs")
      .select("*")
      .eq("date", today)
      .maybeSingle(),

    // Most recent Oura data (grab last 7 entries regardless of date)
    supabase
      .from("oura_daily")
      .select("*")
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(7),

    // Today's cycle entry
    supabase
      .from("cycle_entries")
      .select("*")
      .eq("date", today)
      .maybeSingle(),

    // Today's NC imported data - fall back to most recent entry
    supabase
      .from("nc_imported")
      .select("*")
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Active problems (not resolved)
    supabase
      .from("active_problems")
      .select("id, problem, status")
      .neq("status", "resolved")
      .order("updated_at", { ascending: false }),

    // Recent Oura trend for average calculations (last 14 entries)
    supabase
      .from("oura_daily")
      .select("date, sleep_score, hrv_avg")
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(14),
  ]);

  // Extract results, defaulting gracefully on errors
  const dailyLog = dailyLogResult.data;
  const ouraRecent = ouraRecentResult.data || [];
  // cycleEntryResult available for future use (today's cycle_entries row)
  void cycleEntryResult;
  const ncImported = ncImportedResult.data;
  const activeProblems = activeProblemsResult.data || [];
  const ouraTrend = ouraTrendResult.data || [];

  // Derive values for components

  // Cycle day: prefer NC imported data (has cycle_day field), fall back to cycle entry
  const cycleDay: number | null = ncImported?.cycle_day ?? null;

  // Cycle phase: estimate from cycle day, or use daily log's stored phase
  const cyclePhase: string | null =
    dailyLog?.cycle_phase ??
    estimateCyclePhase(cycleDay) ??
    null;

  // Has the user logged anything today?
  const hasLoggedToday =
    dailyLog !== null &&
    (dailyLog.overall_pain !== null ||
      dailyLog.fatigue !== null ||
      dailyLog.notes !== null);

  // Latest Oura data (most recent entry, which may be from a few days ago)
  const latestOura = ouraRecent.length > 0 ? ouraRecent[0] : null;

  // 7-day averages from trend data
  const trendSleepScores = ouraTrend
    .map((d: { sleep_score: number | null }) => d.sleep_score)
    .filter((v: number | null): v is number => v !== null);
  const avgSleepScore =
    trendSleepScores.length > 0
      ? trendSleepScores.reduce((a: number, b: number) => a + b, 0) /
        trendSleepScores.length
      : null;

  const trendHrvValues = ouraTrend
    .map((d: { hrv_avg: number | null }) => d.hrv_avg)
    .filter((v: number | null): v is number => v !== null);
  const avgHrv =
    trendHrvValues.length > 0
      ? trendHrvValues.reduce((a: number, b: number) => a + b, 0) /
        trendHrvValues.length
      : null;

  // Format today for display when no cycle data
  const todayFormatted = format(new Date(), "EEEE, MMM d");

  // Phase label for the status strip
  const cyclePhaseLabel = cyclePhase
    ? cyclePhase.charAt(0).toUpperCase() + cyclePhase.slice(1)
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        paddingTop: 16,
        paddingBottom: 24,
        maxWidth: 480,
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
      }}
    >
      {/* Header */}
      <div style={{ padding: "0 16px" }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Today
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            margin: "4px 0 0",
          }}
        >
          {todayFormatted}
        </p>
      </div>

      {/* Health Ring - hero element */}
      <HealthRing
        cycleDay={cycleDay}
        cyclePhase={cyclePhase}
        overallPain={dailyLog?.overall_pain ?? null}
        sleepScore={latestOura?.sleep_score ?? null}
        hasLoggedToday={hasLoggedToday}
        todayFormatted={todayFormatted}
      />

      {/* Quick Status Strip */}
      <QuickStatusStrip
        overallPain={dailyLog?.overall_pain ?? null}
        fatigue={dailyLog?.fatigue ?? null}
        sleepScore={latestOura?.sleep_score ?? null}
        hrvAvg={latestOura?.hrv_avg ?? null}
        cyclePhaseLabel={cyclePhaseLabel}
      />

      {/* Smart Cards */}
      <SmartCards
        hasLoggedToday={hasLoggedToday}
        activeProblems={activeProblems}
        latestSleepScore={latestOura?.sleep_score ?? null}
        avgSleepScore={avgSleepScore}
        latestHrv={latestOura?.hrv_avg ?? null}
        avgHrv={avgHrv}
        ouraDate={latestOura?.date ?? null}
      />
    </div>
  );
}
