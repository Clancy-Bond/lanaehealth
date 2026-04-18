/**
 * Calories &raquo; Daily Analysis
 *
 * MyNetDiary-style "Daily Analysis" that kicks in once Lanae has
 * logged 400+ calories today. Uses pattern-based diet insights from
 * src/lib/calories/analyze.ts. POTS sodium, endo iron, migraine
 * triggers, and fiber targets are all condition-specific checks.
 *
 * Insight cards render with level styling:
 *   good  - sage accent
 *   info  - muted
 *   watch - blush light
 *   flag  - blush bold
 */

import { createServiceClient } from "@/lib/supabase";
import { format, addDays, startOfDay } from "date-fns";
import { loadNutritionGoals } from "@/lib/calories/goals";
import { analyze, type Insight, type InsightLevel } from "@/lib/calories/analyze";
import { CaloriesSubNav } from "@/components/calories/SubNav";
import { TopicCycleBanner } from "@/components/topics/TopicCycleBanner";
import { ResearchCitations } from "@/components/topics/ResearchCitations";
import { getCurrentCycleDay } from "@/lib/cycle/current-day";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface FoodEntryRow {
  id: string;
  log_id: string;
  meal_type: string | null;
  food_items: string | null;
  calories: number | null;
  macros: Record<string, number> | null;
  flagged_triggers: string[] | null;
}

interface DailyLogLite {
  id: string;
  date: string;
}

function parseDateParam(raw: string | undefined): string {
  const today = format(new Date(), "yyyy-MM-dd");
  if (!raw) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;
  return raw;
}

function sumMacros(entries: FoodEntryRow[]): {
  fat: number;
  carbs: number;
  protein: number;
  fiber: number;
  sodium: number;
  iron: number;
} {
  const totals = { fat: 0, carbs: 0, protein: 0, fiber: 0, sodium: 0, iron: 0 };
  for (const e of entries) {
    if (!e.macros) continue;
    totals.fat += Number(e.macros.fat ?? 0) || 0;
    totals.carbs += Number(e.macros.carbs ?? 0) || 0;
    totals.protein += Number(e.macros.protein ?? 0) || 0;
    totals.fiber += Number(e.macros.fiber ?? 0) || 0;
    totals.sodium += Number(e.macros.sodium ?? 0) || 0;
    totals.iron += Number(e.macros.iron ?? 0) || 0;
  }
  return totals;
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = createServiceClient();
  const params = await searchParams;
  const viewDate = parseDateParam(params.date);
  const viewDateObj = startOfDay(new Date(viewDate + "T00:00:00"));
  const sevenAgoISO = format(addDays(viewDateObj, -6), "yyyy-MM-dd");

  const [goals, cycle, logResult] = await Promise.all([
    loadNutritionGoals(),
    getCurrentCycleDay(viewDate).catch(() => null),
    supabase
      .from("daily_logs")
      .select("id, date")
      .gte("date", sevenAgoISO)
      .lte("date", viewDate)
      .order("date", { ascending: true }),
  ]);

  const logs = ((logResult.data ?? []) as unknown) as DailyLogLite[];
  const logIds = logs.map((l) => l.id);

  const { data: foodRows } =
    logIds.length > 0
      ? await supabase
          .from("food_entries")
          .select("id, log_id, meal_type, food_items, calories, macros, flagged_triggers")
          .in("log_id", logIds)
      : { data: [] };
  const entries = ((foodRows ?? []) as unknown) as FoodEntryRow[];

  const logIdToDate = new Map(logs.map((l) => [l.id, l.date]));
  const caloriesByDate = new Map<string, number>();
  const todayEntries: FoodEntryRow[] = [];
  for (const e of entries) {
    const d = logIdToDate.get(e.log_id);
    if (!d) continue;
    caloriesByDate.set(d, (caloriesByDate.get(d) ?? 0) + (e.calories ?? 0));
    if (d === viewDate) todayEntries.push(e);
  }

  const calories = caloriesByDate.get(viewDate) ?? 0;
  const macros = sumMacros(todayEntries);

  const triggerFoodsToday: string[] = [];
  for (const e of todayEntries) {
    for (const t of e.flagged_triggers ?? []) {
      triggerFoodsToday.push(t);
    }
  }

  const phase = (cycle?.phase ?? null) as Parameters<typeof analyze>[0]["hasCyclePhase"];

  const insights = analyze({
    calories,
    goals,
    macros,
    triggerFoodsToday,
    loggedEntryCount: todayEntries.length,
    sevenDayCaloriesByDate: caloriesByDate,
    hasCyclePhase: phase,
  });

  const byLevel: Record<InsightLevel, Insight[]> = {
    flag: [],
    watch: [],
    info: [],
    good: [],
  };
  for (const i of insights) byLevel[i.level].push(i);

  const renderOrder: InsightLevel[] = ["flag", "watch", "good", "info"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 16,
        maxWidth: 820,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <Link
        href="/calories"
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path
            d="M12.5 5L7.5 10L12.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Calories
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Calories &middot; Daily analysis
          </span>
          <TopicCycleBanner />
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          Diet analysis for {format(viewDateObj, "EEE MMM d")}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
          Pattern-based insights, not diagnosis. Each card looks at a single
          dimension of today's food log against your goals and your conditions
          (POTS sodium, endo iron, migraine triggers). Works best once you've
          logged a few meals.
        </p>
        <CaloriesSubNav current="dashboard" />
      </div>

      {insights.length === 0 && (
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>No analysis yet</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Log a few meals and this page will fill in.
          </p>
        </div>
      )}

      {renderOrder.map((level) => {
        const group = byLevel[level];
        if (group.length === 0) return null;
        return (
          <section
            key={level}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <h2
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--text-muted)",
                margin: 0,
                padding: "0 4px",
              }}
            >
              {LEVEL_LABEL[level]}
            </h2>
            {group.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </section>
        );
      })}

      <ResearchCitations
        citations={[
          {
            label: "Dysautonomia International: POTS sodium recommendations (3-10 g/day)",
            url: "https://www.dysautonomiainternational.org/page.php?ID=44",
            source: "DI",
          },
          {
            label: "USDA FoodData Central: macro and micronutrient reference",
            url: "https://fdc.nal.usda.gov/",
            source: "USDA",
          },
          {
            label: "Iron absorption in menstruating women: heme vs non-heme, vitamin C co-factor",
            url: "https://pubmed.ncbi.nlm.nih.gov/10801954/",
            source: "PubMed 10801954",
          },
        ]}
      />
    </div>
  );
}

const LEVEL_LABEL: Record<InsightLevel, string> = {
  flag: "Needs attention",
  watch: "Worth watching",
  good: "Doing well",
  info: "Context",
};

function InsightCard({ insight }: { insight: Insight }) {
  const accent = LEVEL_ACCENT[insight.level];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderLeftColor: accent,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700 }}>{insight.title}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: accent,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {insight.category}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
        {insight.detail}
      </p>
    </div>
  );
}

const LEVEL_ACCENT: Record<InsightLevel, string> = {
  good: "var(--accent-sage)",
  info: "var(--border-light)",
  watch: "var(--accent-blush-light)",
  flag: "var(--accent-blush)",
};
