import { createServiceClient } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { QuickActions } from "@/components/home/QuickActions";
import { QuickStatusStrip } from "@/components/home/QuickStatusStrip";
import { SmartCards } from "@/components/home/SmartCards";
import { CalendarHeatmap } from "@/components/home/CalendarHeatmap";
import DataCompleteness from "@/components/home/DataCompleteness";
import { AppointmentBanner } from "@/components/home/AppointmentBanner";
import { HealthAlertsBanner } from "@/components/home/HealthAlertsBanner";
import { AppointmentPrepNudge } from "@/components/home/AppointmentPrepNudge";
import { AdaptiveMovementCard } from "@/components/home/AdaptiveMovementCard";
import { BaselineCard } from "@/components/home/BaselineCard";
import { MorningSignalCard } from "@/components/home/MorningSignalCard";
import { CalorieCard } from "@/components/home/CalorieCard";
import { TopicsGrid } from "@/components/home/TopicsGrid";
import { YearInPixels } from "@/components/home/YearInPixels";
import { QuickSymptomGrid } from "@/components/home/QuickSymptomGrid";
import { WeeklyDigestCard } from "@/components/home/WeeklyDigestCard";
import { buildWeeklyDigest } from "@/lib/intelligence/weekly-digest";
import PrnEffectivenessPoll from "@/components/log/PrnEffectivenessPoll";
import { getOpenInAppPolls } from "@/lib/api/prn-doses";
import { FavoritesStrip, type FavoritesMetricValues } from "@/components/home/FavoritesStrip";
import { getFavorites } from "@/lib/api/favorites";
import { getCurrentCycleDay } from "@/lib/cycle/current-day";
import { computeRedFlags } from "@/lib/doctor/red-flags";
import { computeFollowThrough } from "@/lib/doctor/follow-through";
import type { Appointment } from "@/lib/types";
import type { DailyRow } from "@/lib/intelligence/baseline";

// This page uses live Supabase data that changes daily
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createServiceClient();
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  // Cycle day + phase come from the ONE shared helper.
  // See src/lib/cycle/current-day.ts for the authoritative algorithm and
  // docs/qa/2026-04-16-cycle-day-three-values.md for the history of why
  // this must not be computed locally anymore.
  const cycleCurrent = await getCurrentCycleDay(today);

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
    recentLogsResult,
    todaySymptomsResult,
    weatherResult,
    nextApptResult,
    lastApptResult,
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
      .select("date, sleep_score, hrv_avg, readiness_score")
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

    // Recent logs: last 30 days for check-in count (non-shaming voice)
    supabase
      .from("daily_logs")
      .select("date, overall_pain")
      .gte("date", format(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"))
      .lte("date", today)
      .order("date", { ascending: false }),

    // Recent symptoms (last 24h, for severity banner)
    supabase
      .from("symptoms")
      .select("id, symptom, severity")
      .gte("logged_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),

    // Today's weather (barometric pressure affects chronic pain + POTS)
    supabase
      .from("weather_daily")
      .select("barometric_pressure_hpa, temperature_c, description")
      .eq("date", today)
      .maybeSingle(),

    // Next upcoming appointment (for banner)
    supabase
      .from("appointments")
      .select("*")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),

    // Most recent past appointment (for post-visit capture prompt)
    supabase
      .from("appointments")
      .select("*")
      .lt("date", today)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Extract results, defaulting gracefully on errors
  const dailyLog = dailyLogResult.data;
  const ouraRecent = ouraRecentResult.data || [];
  // cycleEntryResult + ncImportedResult available for future use. Both are
  // already consulted by getCurrentCycleDay() via the shared helper, so the
  // page keeps the parallel query (still cheap) but no longer reads cycle_day
  // directly from either row. See docs/qa/2026-04-16-home-cycle-day-from-nc-predicted.md.
  void cycleEntryResult;
  void ncImportedResult;
  const activeProblems = activeProblemsResult.data || [];
  const ouraTrend = ouraTrendResult.data || [];
  const monthLogs = monthLogsResult.data || [];
  const monthCycle = monthCycleResult.data || [];
  const monthOura = monthOuraResult.data || [];
  const strongCorrelation = strongCorrelationResult.data || null;
  const painLogCount = painLogCountResult.count ?? 0;

  const todaySymptoms = (todaySymptomsResult.data ?? []) as Array<{ id: string; symptom: string; severity: 'mild' | 'moderate' | 'severe' | null }>;
  const symptomSeverity = (() => {
    if (todaySymptoms.length === 0) return null;
    const sev = { severe: 0, moderate: 0, mild: 0 };
    for (const s of todaySymptoms) {
      if (s.severity === 'severe') sev.severe++;
      else if (s.severity === 'mild') sev.mild++;
      else sev.moderate++;
    }
    const highest = sev.severe > 0 ? 'severe' : sev.moderate > 0 ? 'moderate' : 'mild';
    return {
      total: todaySymptoms.length,
      highest,
      names: todaySymptoms.slice(0, 3).map(s => s.symptom),
      ...sev,
    };
  })();

  // Fetch mood separately (depends on dailyLog.id from above)
  const moodResult = dailyLog
    ? await supabase.from("mood_entries").select("mood_score, emotions").eq("log_id", dailyLog.id).maybeSingle()
    : { data: null }
  const todayMood = moodResult.data as { mood_score: number; emotions: string[] } | null

  // Fetch today's food entries for the CalorieCard (MyNetDiary-style
  // running total on Home). Depends on dailyLog.id, so runs after the
  // parallel batch. Returns empty array when no log yet.
  const foodEntriesToday = dailyLog
    ? (await supabase
        .from("food_entries")
        .select("calories")
        .eq("log_id", dailyLog.id)).data ?? []
    : []
  const caloriesToday = (foodEntriesToday as Array<{ calories: number | null }>).reduce(
    (acc, e) => acc + (e.calories ?? 0),
    0,
  )
  const mealCount = foodEntriesToday.length

  // Count check-ins in the last 7 days (positive presence only -- we never
  // render a streak, percentage, or "back on track" framing). See the
  // non-shaming voice rule: docs/plans/2026-04-16-non-shaming-voice-rule.md
  const recentLogs = (recentLogsResult.data || []) as { date: string; overall_pain: number | null }[]

  // Year-in-Pixels: 365-day pain-score grid. Separate fetch to avoid
  // ballooning the main parallel batch (this is cheap: one indexed read).
  const yearAgoISO = format(
    new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd",
  );
  const { data: yearPainLogs } = await supabase
    .from("daily_logs")
    .select("date, overall_pain")
    .gte("date", yearAgoISO)
    .lte("date", today)
    .order("date", { ascending: true });
  const yearLogs = (yearPainLogs || []) as Array<{
    date: string;
    overall_pain: number | null;
  }>;

  // Weekly digest: past 14 days of daily_logs (so we can compare this
  // week to prior) + today's symptoms + today's Oura.
  const fourteenAgoISO = format(
    new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd",
  );
  const { data: weekLogsData } = await supabase
    .from("daily_logs")
    .select("date, overall_pain, fatigue, stress")
    .gte("date", fourteenAgoISO)
    .lte("date", today)
    .order("date", { ascending: true });
  const weekLogs = (weekLogsData ?? []) as Array<{
    date: string;
    overall_pain: number | null;
    fatigue: number | null;
    stress: number | null;
  }>;
  const { data: weekSymptomsData } = await supabase
    .from("symptoms")
    .select("logged_at, category, severity")
    .gte("logged_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("logged_at", { ascending: true });
  const weekSymptoms = (weekSymptomsData ?? []) as Array<{
    logged_at: string;
    category: string;
    severity: string | null;
  }>;
  const weeklyDigest = buildWeeklyDigest({
    today,
    dailyLogs: weekLogs,
    ouraRows: monthOura.map((r: { date: string; sleep_score: number | null; hrv_avg: number | null }) => ({
      date: r.date,
      sleep_score: r.sleep_score,
      hrv_avg: r.hrv_avg,
    })),
    symptoms: weekSymptoms,
  });
  let checkInsThisWeek = 0
  for (let i = 0; i < 7; i++) {
    const d = format(new Date(now.getTime() - i * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
    const log = recentLogs.find(l => l.date === d)
    if (log && log.overall_pain !== null) checkInsThisWeek++
  }

  // Mood emoji for header display
  const MOOD_EMOJIS = ['', '\u{1F629}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F604}']
  const moodEmoji = todayMood?.mood_score ? MOOD_EMOJIS[todayMood.mood_score] : null

  const nextAppt = (nextApptResult.data as Appointment | null) ?? null;
  const lastAppt = (lastApptResult.data as Appointment | null) ?? null;

  // Home-page health alerts: red flags + overdue follow-through.
  // Both are resilient (return [] on error) so they never break home rendering.
  // Orthostatic summary: count + latest test for the pre-visit nudge.
  // Table may not exist yet on older Supabase instances. Supabase's query
  // builder is thenable but not a Promise, so wrap in an async IIFE to
  // get try/catch semantics.
  const fetchOrthoSummary = async () => {
    try {
      const { data, error } = await supabase
        .from("orthostatic_tests")
        .select("test_date, peak_rise_bpm")
        .order("test_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows =
        (data as Array<{ test_date: string; peak_rise_bpm: number | null }> | null) ?? [];
      return {
        count: rows.length,
        latestDate: rows[0]?.test_date ?? null,
        latestPeakRise: rows[0]?.peak_rise_bpm ?? null,
      };
    } catch {
      return { count: 0, latestDate: null as string | null, latestPeakRise: null as number | null };
    }
  };

  const [homeRedFlags, homeFollowThrough, orthoSummary, favoriteItems, baselineWindow, openPrnPolls] = await Promise.all([
    computeRedFlags(supabase).catch(() => []),
    computeFollowThrough(supabase).catch(() => []),
    fetchOrthoSummary(),
    // Wave 2e F5: pinned metric list for FavoritesStrip
    getFavorites().catch(() => []),
    // Wave 2d F4: 28-day rolling window of Oura rows for BaselineCard.
    // We fetch 29 days so we can split today from the prior 28 cleanly.
    supabase
      .from("oura_daily")
      .select("date, resting_hr, hrv_avg, body_temp_deviation, respiratory_rate")
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(29),
    // Wave 2e F7 extension: surface open PRN efficacy polls on Home so
    // Lanae sees the "Did [med] help?" prompt on app open without
    // navigating to /log. In-app fallback for iOS PWA push unreliability.
    getOpenInAppPolls().catch(() => []),
  ]);

  // Weather data -- auto-fetch if not cached for today
  let todayWeather = weatherResult.data as { barometric_pressure_hpa: number | null; temperature_c: number | null; description: string | null } | null
  if (!todayWeather) {
    // Fire-and-forget: fetch weather in the background so it's cached for next load
    // We don't await this to avoid slowing down the page render
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3005';
      fetch(`${baseUrl}/api/weather`).catch(() => {/* silent */});
    } catch {
      // Silently fail -- weather is a nice-to-have
    }
  }

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

  // Cycle day + phase now come straight from the shared helper. No more NC
  // predicted-counter trust, no more 60-day staleness hack. If the helper
  // cannot find any real menstruation within the last 90 days, both values
  // are null and the UI falls back to the "Cycle unknown" state.
  const cycleDay: number | null = cycleCurrent.day;
  const ncDataStale = false;

  // Cycle phase: prefer the daily log's stored phase (user-entered), else
  // fall back to the helper's calendar-derived phase.
  const cyclePhase: string | null = dailyLog?.cycle_phase ?? cycleCurrent.phase ?? null;

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

  // 7-day readiness average for the AdaptiveMovementCard delta-from-typical
  // disclosure. Slice to the most recent 7 of the 14-entry trend so the
  // window matches the card's contract.
  const trendReadinessValues = ouraTrend
    .slice(0, 7)
    .map((d: { readiness_score: number | null }) => d.readiness_score)
    .filter((v: number | null): v is number => v !== null);
  const avgReadiness =
    trendReadinessValues.length > 0
      ? trendReadinessValues.reduce((a: number, b: number) => a + b, 0) /
        trendReadinessValues.length
      : null;

  // ── Wave 2d F4: BaselineCard inputs ─────────────────────────────────
  // Split the 29-row window into (windowRows = 28 prior days, todayRow = today)
  const baselineRowsRaw = (baselineWindow.data ?? []) as DailyRow[];
  const baselineTodayRow = baselineRowsRaw.find((r) => r.date === today) ?? null;
  const baselineWindowRows = baselineRowsRaw.filter((r) => r.date !== today).slice(0, 28);
  const baselineLastSynced = baselineWindowRows.length > 0 ? baselineWindowRows[0].date : null;

  // ── Wave 2e F5: FavoritesStrip values ───────────────────────────────
  // The strip renders whatever pinned metric ids the user has set. We feed
  // it every current value we already compute above; unknown/missing values
  // render as "--" in the tile.
  const favoritesValues: FavoritesMetricValues = {
    standingPulse: orthoSummary.latestPeakRise !== null ? orthoSummary.latestPeakRise : null,
    hrv: latestOura?.hrv_avg ?? null,
    rhr: latestOura?.resting_hr ?? null,
    bodyTempF:
      latestOura?.body_temp_deviation != null
        ? 98.6 + latestOura.body_temp_deviation * 9 / 5
        : null,
    cycleDay: cycleCurrent.day,
    cyclePhaseLabel: cyclePhase
      ? cyclePhase.charAt(0).toUpperCase() + cyclePhase.slice(1)
      : null,
    overallPain: dailyLog?.overall_pain ?? null,
    fatigue: dailyLog?.fatigue ?? null,
    sleepScore: latestOura?.sleep_score ?? null,
    readiness: latestOura?.readiness_score ?? null,
    topLabLabel: null,
    topLabValue: null,
  };

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

  // Severity banner: softened per design-decisions §5/§6.
  // "Rough day" replaces "SEVERE DAY" shouty pill; pill uses cream bg w/
  // a blush accent stripe only on severe/moderate so it no longer feels like
  // a red shame tag. Sentence-case everywhere.
  const severityLabel = (() => {
    if (!symptomSeverity) return null;
    if (symptomSeverity.highest === "severe") return "Rough day";
    if (symptomSeverity.highest === "moderate") return "Heavier day";
    return "Noticing symptoms";
  })();
  const severityAccent = (() => {
    if (!symptomSeverity) return null;
    if (symptomSeverity.highest === "severe") return "var(--accent-blush)";
    if (symptomSeverity.highest === "moderate") return "var(--accent-blush-light)";
    return "var(--border-light)";
  })();

  // Primary column: hero CTA, appointment banner, symptom banner, vitals row,
  // and (on mobile) quick actions + smart cards + data completeness + calendar.
  // On desktop, the secondary column holds smart cards + data completeness +
  // calendar so the primary column stays focused on today's status.
  const heroSection = (
    <>
      {/* 1. Header: greeting + weekly check-in count + date */}
      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1
            className="page-title"
            style={{ fontSize: 28 }}
          >
            {greeting}{moodEmoji ? ` ${moodEmoji}` : ""}
          </h1>
          {checkInsThisWeek > 0 && (
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
              Checked in <span className="tabular">{checkInsThisWeek}x</span> this week
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
              &middot; <span className="tabular">{Math.round(todayWeather.temperature_c * 9/5 + 32)}</span>&deg;F
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

      {/* 2. Compact daily check-in CTA with progress -- the SINGLE sage primary */}
      <div style={{ padding: "0 16px" }}>
        <a
          href="/log"
          className="press-feedback"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 18px",
            borderRadius: 16,
            background: hasLoggedToday
              ? "var(--bg-card)"
              : "linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)",
            color: hasLoggedToday ? "var(--text-primary)" : "var(--text-inverse)",
            border: "none",
            boxShadow: hasLoggedToday ? "var(--shadow-sm)" : "var(--shadow-md)",
            textDecoration: "none",
            transition: "transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
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
                style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset var(--duration-slow) var(--ease-decelerate)" }}
              />
            </svg>
            <span
              className="tabular"
              style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: hasLoggedToday ? "var(--accent-sage)" : "#FFFFFF",
              }}
            >
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

      {/* Appointment banner (prep-before or capture-after) */}
      <HealthAlertsBanner redFlags={homeRedFlags} followThrough={homeFollowThrough} />

      {/* Wave 2e F7 extension: open PRN efficacy polls. Surfaced on
          home so the "Did [med] help?" prompt appears the moment
          Lanae opens the app, not only when she navigates to /log.
          The component self-hides when there are no open polls. */}
      {openPrnPolls.length > 0 && (
        <div style={{ padding: "0 16px" }}>
          <PrnEffectivenessPoll initialPolls={openPrnPolls} />
        </div>
      )}

      <AppointmentPrepNudge nextAppt={nextAppt} orthostatic={orthoSummary} />

      <AppointmentBanner next={nextAppt} mostRecentPast={lastAppt} />

      {symptomSeverity && severityLabel ? (
        <div style={{ padding: "0 16px" }}>
          <a
            href="/log"
            className="press-feedback"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderLeftWidth: 3,
              borderLeftStyle: "solid",
              borderLeftColor: severityAccent ?? "var(--border-light)",
              boxShadow: "var(--shadow-sm)",
              textDecoration: "none",
              color: "var(--text-primary)",
              transition: "transform var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
            }}
          >
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.01em",
                background: "var(--accent-blush-muted)",
                color: "var(--text-primary)",
              }}
            >
              {severityLabel}
            </span>
            <span style={{ flex: 1, fontSize: 13, lineHeight: 1.3 }}>
              <strong><span className="tabular">{symptomSeverity.total}</span> symptom{symptomSeverity.total === 1 ? "" : "s"}</strong>{" "}
              <span style={{ color: "var(--text-muted)" }}>{symptomSeverity.names.join(", ")}</span>
            </span>
          </a>
        </div>
      ) : null}

      {/* 3. Compact cycle + vitals row */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {/* Mini cycle indicator */}
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "10px 14px", borderRadius: 14,
              background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
              border: cycleCurrent.isUnusuallyLong
                ? "1px solid var(--accent-blush-light)"
                : "none",
              boxShadow: "var(--shadow-sm)", minWidth: 72,
            }}
          >
            {cycleDay !== null ? (
              <>
                <span
                  className="tabular"
                  style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}
                >
                  CD {cycleDay}
                </span>
                {cyclePhaseLabel && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, lineHeight: 1.4, marginTop: 3,
                    color: cycleCurrent.isUnusuallyLong
                      ? "var(--accent-blush)"
                      : getPhaseColor(cyclePhase) !== "var(--text-muted)" ? getPhaseColor(cyclePhase) : "var(--text-secondary)",
                    textTransform: "uppercase", letterSpacing: "0.03em",
                  }}>
                    {cycleCurrent.isUnusuallyLong ? "Long cycle" : cyclePhaseLabel}
                  </span>
                )}
              </>
            ) : (
              <span style={{
                fontSize: 10.5, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.3,
              }}>
                {ncDataStale ? "Cycle paused." : "Cycle unknown."}
                <br />
                <span style={{ color: "var(--accent-sage)", fontWeight: 600 }}>Log a period.</span>
              </span>
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

        {/*
          Long-cycle heads-up. Shown only when the computed cycle day exceeds
          the ACOG 35-day "typical" upper bound. Voice: informational, not
          alarming (see docs/plans/2026-04-16-non-shaming-voice-rule.md).
          Raw CD is left visible above; we never silently cap it.
        */}
        {cycleCurrent.isUnusuallyLong && cycleCurrent.lastPeriodStart && (
          <a
            href="/log"
            className="press-feedback"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 10,
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              borderLeftWidth: 3, borderLeftStyle: "solid",
              borderLeftColor: "var(--accent-blush-light)",
              boxShadow: "var(--shadow-sm)",
              textDecoration: "none", color: "var(--text-primary)",
              fontSize: 12, lineHeight: 1.4,
            }}
          >
            <span style={{ fontSize: 15 }} aria-hidden>{"\u{1F331}"}</span>
            <span style={{ flex: 1 }}>
              <strong>Heads up</strong>{" "}
              <span style={{ color: "var(--text-muted)" }}>
                Last period was{" "}
                <span className="tabular">{cycleCurrent.daysSinceLastPeriod}</span> days ago
                ({cycleCurrent.lastPeriodStart}). Log a period or note a skipped cycle?
              </span>
            </span>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: "var(--text-muted)" }}>
              <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
      </div>

      {/* MyNetDiary-style running calorie total. Taps through to
          /log for the full USDA-backed food search. */}
      <CalorieCard caloriesToday={caloriesToday} mealCount={mealCount} />

      {/* 4. Quick actions (secondary) */}
      <QuickActions />

      {/* Wave 2e F5: User-curated favorites strip. Empty list renders an
          "Add a favorite" CTA that deep-links to /settings#favorites. */}
      <FavoritesStrip items={favoriteItems} values={favoritesValues} />

      {/* Topic navigation: orthostatic, migraine, cycle, nutrition
          deep-dive pages. Introduced 2026-04-17 as part of the
          competitor-informed anchor-page family. */}
      <TopicsGrid />

      {/* Weekly digest card (Whoop / Bearable weekly-email pattern)
          compresses last 7 days into a small bulleted summary. */}
      <WeeklyDigestCard digest={weeklyDigest} />

      {/* Quick-tap symptom grid (Bearable pattern) - 10-second logging
          for the most-common symptoms for Lanae's conditions. */}
      <QuickSymptomGrid />

      {/* Year-in-Pixels: 365-day pain-score grid (Daylio pattern).
          Tap a pixel to open /log for that date. */}
      <YearInPixels days={yearLogs} today={today} />
    </>
  );

  // Morning Signal inputs. We show a signal even if today's ring data has
  // not synced yet; the card labels it "Based on yesterday's reading" via
  // its own stalePhrase helper. Trend is the six prior rows (most recent
  // first), which gives the z-score math enough history without letting
  // today contaminate its own baseline.
  const morningSignalToday = latestOura;
  const morningSignalTrend = ouraRecent.slice(1);

  const secondarySection = (
    <>
      {/* Morning Signal: single-number readiness + top contributor waterfall.
          Competitor-informed (Oura). Formula in readiness-signal.ts is a
          placeholder; Clancy owns the weighted version. */}
      <MorningSignalCard
        today={morningSignalToday}
        trend={morningSignalTrend}
        todayDate={today}
      />

      {/* Adaptive movement suggestion scaled to today's Oura readiness. */}
      <AdaptiveMovementCard
        readinessScore={latestOura?.readiness_score ?? null}
        readingDate={latestOura?.date ?? null}
        today={today}
        sevenDayAvg={avgReadiness}
      />

      {/* Wave 2d F4: Today vs 28-day Oura baseline (median + IQR fence). */}
      <BaselineCard
        windowRows={baselineWindowRows}
        todayRow={baselineTodayRow}
        lastSyncedDate={baselineLastSynced}
        today={today}
      />

      {/* 5. Smart Cards (only when something needs attention) */}
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

      {/* 6. Data Completeness Ring */}
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

      {/* 7. Calendar Heatmap */}
      <CalendarHeatmap
        dailyLogs={monthLogs}
        cycleEntries={monthCycle}
        ouraEntries={monthOura}
        initialMonth={format(now, "yyyy-MM")}
      />
    </>
  );

  return (
    <div className="home-layout">
      <div className="home-layout__primary">{heroSection}</div>
      <div className="home-layout__secondary">{secondarySection}</div>

      {/*
        Single render tree: stacks on mobile/tablet, splits 2-col on >=1024px.
        Satisfies design-decisions §13 (desktop must not be centered mobile).
      */}
      <style>{`
        .home-layout {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-top: 12px;
          padding-bottom: 24px;
          max-width: 640px;
          margin-left: auto;
          margin-right: auto;
          width: 100%;
        }
        .home-layout__primary,
        .home-layout__secondary {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (min-width: 1024px) {
          .home-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 360px;
            gap: var(--space-8);
            max-width: 1160px;
          }
        }
      `}</style>
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
