import { createServiceClient } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { QuickActions } from "@/components/home/QuickActions";
import { QuickStatusStrip } from "@/components/home/QuickStatusStrip";
import { SmartCards } from "@/components/home/SmartCards";
import { CalendarHeatmap } from "@/components/home/CalendarHeatmap";
import DataCompleteness from "@/components/home/DataCompleteness";

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
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  // Fetch all data in parallel
  const [
    dailyLogResult,
    ouraRecentResult,
    cycleEntryResult,
    ncImportedResult,
    activeProblemsResult,
    ouraTrendResult,
    monthLogsResult,
    monthCycleResult,
    monthOuraResult,
    strongCorrelationResult,
    painLogCountResult,
    streakLogsResult,
    weatherResult,
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

    // Calendar: daily logs for current month
    supabase
      .from("daily_logs")
      .select("date, overall_pain")
      .gte("date", monthStart)
      .lte("date", monthEnd),

    // Calendar: cycle entries for current month
    supabase
      .from("cycle_entries")
      .select("date, menstruation")
      .gte("date", monthStart)
      .lte("date", monthEnd),

    // Calendar: Oura data for current month (detail panel)
    supabase
      .from("oura_daily")
      .select("date, sleep_score, hrv_avg, resting_hr")
      .gte("date", monthStart)
      .lte("date", monthEnd),

    // Strong correlation for smart card
    supabase
      .from("correlation_results")
      .select("id, effect_description, confidence_level")
      .eq("confidence_level", "strong")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Count of logs with actual pain data (for welcome banner)
    supabase
      .from("daily_logs")
      .select("id", { count: "exact", head: true })
      .not("overall_pain", "is", null),

    // Streak: last 30 days of logs for streak calculation
    supabase
      .from("daily_logs")
      .select("date, overall_pain")
      .gte("date", format(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"))
      .lte("date", today)
      .order("date", { ascending: false }),

    // Today's weather (barometric pressure affects chronic pain + POTS)
    supabase
      .from("weather_daily")
      .select("barometric_pressure_hpa, temperature_c, description")
      .eq("date", today)
      .maybeSingle(),
  ]);

  // Extract results, defaulting gracefully on errors
  const dailyLog = dailyLogResult.data;
  const ouraRecent = ouraRecentResult.data || [];
  // cycleEntryResult available for future use (today's cycle_entries row)
  void cycleEntryResult;
  const ncImported = ncImportedResult.data;
  const activeProblems = activeProblemsResult.data || [];
  const ouraTrend = ouraTrendResult.data || [];
  const monthLogs = monthLogsResult.data || [];
  const monthCycle = monthCycleResult.data || [];
  const monthOura = monthOuraResult.data || [];
  const strongCorrelation = strongCorrelationResult.data || null;
  const painLogCount = painLogCountResult.count ?? 0;

  // Fetch mood separately (depends on dailyLog.id from above)
  const moodResult = dailyLog
    ? await supabase.from("mood_entries").select("mood_score, emotions").eq("log_id", dailyLog.id).maybeSingle()
    : { data: null }
  const todayMood = moodResult.data as { mood_score: number; emotions: string[] } | null

  // Compute logging streak (consecutive days with pain data, backwards from yesterday)
  const streakLogs = (streakLogsResult.data || []) as { date: string; overall_pain: number | null }[]
  let streak = 0
  for (let i = 1; i <= 30; i++) {
    const d = format(new Date(now.getTime() - i * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
    const log = streakLogs.find(l => l.date === d)
    if (log && log.overall_pain !== null) streak++
    else break
  }

  // Mood emoji for header display
  const MOOD_EMOJIS = ['', '\u{1F629}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F604}']
  const moodEmoji = todayMood?.mood_score ? MOOD_EMOJIS[todayMood.mood_score] : null

  // Weather data
  const todayWeather = weatherResult.data as { barometric_pressure_hpa: number | null; temperature_c: number | null; description: string | null } | null

  // --- Task B: Auto-fill sleep quality from Oura ---
  // If today's log exists but sleep_quality is null, and Oura sleep_score is
  // available for today, silently backfill: sleep_quality = round(score / 10)
  const latestOuraForAutofill = ouraRecent.length > 0 ? ouraRecent[0] : null;
  if (
    dailyLog &&
    dailyLog.sleep_quality === null &&
    latestOuraForAutofill &&
    latestOuraForAutofill.date === today &&
    latestOuraForAutofill.sleep_score !== null
  ) {
    const mappedSleep = Math.round(latestOuraForAutofill.sleep_score / 10);
    await supabase
      .from("daily_logs")
      .update({ sleep_quality: mappedSleep })
      .eq("date", today);
    // Update local reference so the page reflects the new value immediately
    dailyLog.sleep_quality = mappedSleep;
  }

  // Derive values for components

  // Cycle day: prefer NC imported data (has cycle_day field), fall back to cycle entry.
  // If NC data is older than 60 days, treat it as stale and do not show cycle day.
  let cycleDay: number | null = ncImported?.cycle_day ?? null;
  let ncDataStale = false;

  if (ncImported?.date) {
    const ncDate = new Date(ncImported.date + "T00:00:00");
    const diffMs = now.getTime() - ncDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 60) {
      cycleDay = null;
      ncDataStale = true;
    }
  }

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

  // Format today for display -- use local date
  const todayFormatted = format(now, "EEEE, MMM d");

  // Time-aware greeting
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Phase label for the status strip
  const cyclePhaseLabel = cyclePhase
    ? cyclePhase.charAt(0).toUpperCase() + cyclePhase.slice(1)
    : null;

  // Count logged sections for progress indicator
  const sectionsLogged = [
    dailyLog?.overall_pain !== null,
    dailyLog?.fatigue !== null,
    dailyLog?.stress !== null,
    todayMood !== null,
    dailyLog?.notes !== null,
  ].filter(Boolean).length;
  const totalSections = 5;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        paddingTop: 12,
        paddingBottom: 24,
        maxWidth: 640,
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
      }}
    >
      {/* ── 1. Header: greeting + streak + date ── */}
      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {greeting} {moodEmoji || ''}
          </h1>
          {streak > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: "var(--accent-sage-muted)",
                color: "var(--accent-sage)",
              }}
            >
              &#x1F525; {streak}d streak
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {todayFormatted}
          </p>
          {todayWeather?.temperature_c != null && (
            <span style={{
              fontSize: 12, color: "var(--text-muted)",
              display: "inline-flex", alignItems: "center", gap: 3,
            }}>
              &middot; {Math.round(todayWeather.temperature_c * 9/5 + 32)}&deg;F
              {todayWeather.barometric_pressure_hpa != null && (
                <span style={{
                  fontSize: 11,
                  color: todayWeather.barometric_pressure_hpa < 1010 ? "var(--accent-blush)" : "var(--text-muted)",
                }}>
                  {todayWeather.barometric_pressure_hpa < 1010 ? " (low pressure)" : ""}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Compact daily check-in CTA with progress ── */}
      {/* This is THE primary action - above fold, thumb-reachable */}
      <div style={{ padding: "0 16px" }}>
        <a
          href="/log"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 18px",
            borderRadius: 16,
            background: hasLoggedToday ? "var(--bg-card)" : "var(--accent-sage)",
            color: hasLoggedToday ? "var(--text-primary)" : "var(--text-inverse)",
            border: hasLoggedToday ? "1px solid var(--border-light)" : "none",
            boxShadow: hasLoggedToday ? "var(--shadow-sm)" : "0 4px 16px rgba(107, 144, 128, 0.35)",
            textDecoration: "none",
            transition: "all 0.15s ease",
          }}
        >
          {/* Progress circle */}
          <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke={hasLoggedToday ? "var(--border-light)" : "rgba(255,255,255,0.25)"} strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16" fill="none"
                stroke={hasLoggedToday ? "var(--accent-sage)" : "#FFFFFF"}
                strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 16}`}
                strokeDashoffset={`${2 * Math.PI * 16 * (1 - sectionsLogged / totalSections)}`}
                style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <span style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              color: hasLoggedToday ? "var(--accent-sage)" : "#FFFFFF",
            }}>
              {sectionsLogged}/{totalSections}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
              {hasLoggedToday ? "Today's check-in" : "Log your check-in"}
            </div>
            <div style={{
              fontSize: 12, lineHeight: 1.4, marginTop: 2,
              color: hasLoggedToday ? "var(--text-secondary)" : "rgba(255,255,255,0.8)",
            }}>
              {hasLoggedToday
                ? `${sectionsLogged} of ${totalSections} sections logged`
                : "Track pain, mood, energy, and symptoms"
              }
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>

      {/* ── 3. Compact cycle + vitals row ── */}
      <div style={{ padding: "0 16px", display: "flex", gap: 10, alignItems: "stretch" }}>
        {/* Mini cycle indicator */}
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "10px 14px", borderRadius: 14,
            background: "var(--bg-card)", border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-sm)", minWidth: 72,
          }}
        >
          {cycleDay !== null ? (
            <>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                CD {cycleDay}
              </span>
              {cyclePhaseLabel && (
                <span style={{
                  fontSize: 10, fontWeight: 600, lineHeight: 1.4, marginTop: 3,
                  color: getPhaseColor(cyclePhase) !== "var(--text-muted)" ? getPhaseColor(cyclePhase) : "var(--text-secondary)",
                  textTransform: "uppercase", letterSpacing: "0.03em",
                }}>
                  {cyclePhaseLabel}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>No cycle data</span>
          )}
        </div>

        {/* Vitals strip */}
        <QuickStatusStrip
          overallPain={dailyLog?.overall_pain ?? null}
          fatigue={dailyLog?.fatigue ?? null}
          sleepScore={latestOura?.sleep_score ?? null}
          hrvAvg={latestOura?.hrv_avg ?? null}
          cyclePhaseLabel={null}
        />
      </div>

      {/* ── 4. Quick actions (secondary) ── */}
      <QuickActions />

      {/* ── 5. Smart Cards (only when something needs attention) ── */}
      <SmartCards
        hasLoggedToday={hasLoggedToday}
        activeProblems={activeProblems}
        latestSleepScore={latestOura?.sleep_score ?? null}
        avgSleepScore={avgSleepScore}
        latestHrv={latestOura?.hrv_avg ?? null}
        avgHrv={avgHrv}
        ouraDate={latestOura?.date ?? null}
        strongCorrelation={strongCorrelation}
      />

      {/* ── 6. Data Completeness Ring ── */}
      <div style={{ padding: "0 16px" }}>
        <DataCompleteness
          sources={[
            { id: 'mood', label: 'Mood', icon: '\u{1F60A}', logged: hasLoggedToday },
            { id: 'pain', label: 'Pain', icon: '\u{1FA7A}', logged: (dailyLog?.overall_pain ?? null) !== null },
            { id: 'sleep', label: 'Sleep', icon: '\u{1F634}', logged: !!latestOura?.sleep_score },
            { id: 'food', label: 'Food', icon: '\u{1F34E}', logged: (dailyLog?.notes ?? '').length > 0 },
            { id: 'meds', label: 'Meds', icon: '\u{1F48A}', logged: false },
            { id: 'symptoms', label: 'Symptoms', icon: '\u{1F915}', logged: hasLoggedToday },
          ]}
        />
      </div>

      {/* ── 7. Calendar Heatmap ── */}
      <CalendarHeatmap
        dailyLogs={monthLogs}
        cycleEntries={monthCycle}
        ouraEntries={monthOura}
        initialMonth={format(now, "yyyy-MM")}
      />
    </div>
  );
}

function getPhaseColor(phase: string | null): string {
  switch (phase?.toLowerCase()) {
    case "menstrual": return "var(--phase-menstrual)";
    case "follicular": return "var(--phase-follicular)";
    case "ovulatory": return "var(--phase-ovulatory)";
    case "luteal": return "var(--phase-luteal)";
    default: return "var(--text-muted)";
  }
}
