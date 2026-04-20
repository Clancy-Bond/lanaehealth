/**
 * Patterns » Calories
 *
 * 30-day calorie + macro time series for the Calories tab. Reads
 * food_entries through the shared per-date loader and renders a
 * calorie bar chart, macro stacked bars, and a top-logged-foods list
 * all server-side so the first paint has real data.
 *
 * Voice stays neutral per docs/plans/2026-04-16-non-shaming-voice-rule.md:
 * we show averages and trends, never a "you went over by" shame frame.
 */

import Link from "next/link";
import { format, addDays } from "date-fns";
import { getDailyTotalsRange, type DayTotals } from "@/lib/calories/home-data";
import { loadNutritionGoals } from "@/lib/calories/goals";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type WindowKey = "7" | "30" | "90";

const WINDOW_LABELS: Record<WindowKey, string> = {
  "7": "7 days",
  "30": "30 days",
  "90": "90 days",
};

export default async function CaloriesPatterns({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  const windowKey: WindowKey =
    sp.window === "7" || sp.window === "90" ? sp.window : "30";
  const windowDays = Number(windowKey);
  const today = new Date();
  const todayIso = format(today, "yyyy-MM-dd");
  const startIso = format(addDays(today, -(windowDays - 1)), "yyyy-MM-dd");

  const [daily, goals, topFoods] = await Promise.all([
    getDailyTotalsRange(startIso, todayIso),
    loadNutritionGoals(),
    loadTopFoods(startIso, todayIso, 10),
  ]);

  const daysWithFood = daily.filter((d) => d.calories > 0);
  const avg = average(daysWithFood);
  const calTarget = goals.calorieTarget;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: "16px",
        maxWidth: 960,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      {/* Breadcrumb */}
      <Link
        href="/patterns"
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
        Patterns
      </Link>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Patterns &middot; Calories
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          Calorie &amp; macro trends
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Daily food_entries rolled up into averages, a time series, and
          your most-logged foods. Targets come from{" "}
          <Link href="/calories/plan" style={{ color: "var(--accent-sage)" }}>
            /calories/plan
          </Link>
          .
        </p>
      </div>

      {/* Window picker */}
      <WindowPicker current={windowKey} />

      {/* Summary stats */}
      <SummaryRow
        daysWithFood={daysWithFood.length}
        totalDays={daily.length}
        avgCals={avg.cals}
        avgProtein={avg.protein}
        avgCarbs={avg.carbs}
        avgFat={avg.fat}
      />

      {/* Calorie time series */}
      <Card title="Calorie intake">
        {daysWithFood.length === 0 ? (
          <EmptyState window={WINDOW_LABELS[windowKey]} />
        ) : (
          <CalorieSeries
            daily={daily}
            target={calTarget}
          />
        )}
      </Card>

      {/* Macro trend */}
      <Card title="Macro composition">
        {daysWithFood.length === 0 ? (
          <EmptyState window={WINDOW_LABELS[windowKey]} />
        ) : (
          <MacroStackedBars daily={daily} />
        )}
      </Card>

      {/* Top foods */}
      <Card title="Most-logged foods">
        {topFoods.length === 0 ? (
          <EmptyState window={WINDOW_LABELS[windowKey]} />
        ) : (
          <TopFoodsList foods={topFoods} />
        )}
      </Card>

      <Link
        href="/calories"
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          borderRadius: 10,
          background: "var(--bg-card)",
          color: "var(--accent-sage)",
          border: "1px solid var(--border-light)",
          fontSize: 12,
          fontWeight: 700,
          textDecoration: "none",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        &lsaquo; Back to Calories
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

async function loadTopFoods(
  startDate: string,
  endDate: string,
  limit: number,
): Promise<Array<{ name: string; count: number; totalCal: number }>> {
  const sb = createServiceClient();
  const { data: logs } = await sb
    .from("daily_logs")
    .select("id, date")
    .gte("date", startDate)
    .lte("date", endDate);
  const ids = ((logs ?? []) as Array<{ id: string }>).map((l) => l.id);
  if (ids.length === 0) return [];
  const { data } = await sb
    .from("food_entries")
    .select("food_items, calories")
    .in("log_id", ids)
    .not("food_items", "is", null);
  const rows = ((data ?? []) as unknown) as Array<{ food_items: string | null; calories: number | null }>;
  const counts = new Map<string, { count: number; totalCal: number }>();
  for (const r of rows) {
    const name = (r.food_items ?? "").trim().toLowerCase();
    if (!name) continue;
    const prev = counts.get(name) ?? { count: 0, totalCal: 0 };
    prev.count += 1;
    prev.totalCal += r.calories ?? 0;
    counts.set(name, prev);
  }
  return [...counts.entries()]
    .map(([name, stats]) => ({ name, count: stats.count, totalCal: stats.totalCal }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function average(days: DayTotals[]): {
  cals: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  if (days.length === 0) return { cals: 0, protein: 0, carbs: 0, fat: 0 };
  const sum = days.reduce(
    (acc, d) => ({
      cals: acc.cals + d.calories,
      protein: acc.protein + d.protein,
      carbs: acc.carbs + d.carbs,
      fat: acc.fat + d.fat,
    }),
    { cals: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    cals: Math.round(sum.cals / days.length),
    protein: Math.round(sum.protein / days.length),
    carbs: Math.round(sum.carbs / days.length),
    fat: Math.round(sum.fat / days.length),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────

function WindowPicker({ current }: { current: WindowKey }) {
  const options: WindowKey[] = ["7", "30", "90"];
  return (
    <div
      role="tablist"
      aria-label="Choose window"
      style={{ display: "flex", gap: 6 }}
    >
      {options.map((k) => {
        const active = k === current;
        return (
          <Link
            key={k}
            href={`/patterns/calories?window=${k}`}
            role="tab"
            aria-selected={active}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              border: "1px solid",
              borderColor: active ? "var(--accent-sage)" : "var(--border-light)",
              background: active ? "var(--accent-sage)" : "var(--bg-card)",
              color: active ? "var(--text-inverse)" : "var(--text-secondary)",
            }}
          >
            {WINDOW_LABELS[k]}
          </Link>
        );
      })}
    </div>
  );
}

function SummaryRow({
  daysWithFood,
  totalDays,
  avgCals,
  avgProtein,
  avgCarbs,
  avgFat,
}: {
  daysWithFood: number;
  totalDays: number;
  avgCals: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
      }}
    >
      <Stat label="Days with food logged" value={`${daysWithFood} of ${totalDays}`} />
      <Stat label="Avg cal / day" value={avgCals > 0 ? `${avgCals}` : "\u2014"} />
      <Stat label="Avg protein / day" value={avgProtein > 0 ? `${avgProtein} g` : "\u2014"} />
      <Stat label="Avg carbs / day" value={avgCarbs > 0 ? `${avgCarbs} g` : "\u2014"} />
      <Stat label="Avg fat / day" value={avgFat > 0 ? `${avgFat} g` : "\u2014"} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
      <span
        className="tabular"
        style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ window }: { window: string }) {
  return (
    <p
      style={{
        fontSize: 13,
        color: "var(--text-muted)",
        margin: 0,
        lineHeight: 1.5,
      }}
    >
      No food_entries in the last {window}. Log a meal on{" "}
      <Link href="/calories" style={{ color: "var(--accent-sage)" }}>
        /calories
      </Link>{" "}
      and this will start to fill in.
    </p>
  );
}

function CalorieSeries({
  daily,
  target,
}: {
  daily: DayTotals[];
  target: number;
}) {
  const width = 720;
  const height = 180;
  const pad = { top: 10, right: 20, bottom: 28, left: 32 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(target * 1.2, ...daily.map((d) => d.calories), 100);
  const barW = plotW / daily.length;
  const targetY = pad.top + plotH - (target / max) * plotH;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily calories bar chart"
        style={{ display: "block", minWidth: "100%" }}
      >
        {/* Target line */}
        <line
          x1={pad.left}
          x2={pad.left + plotW}
          y1={targetY}
          y2={targetY}
          stroke="var(--accent-blush-light)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text
          x={pad.left + plotW - 4}
          y={targetY - 4}
          textAnchor="end"
          fontSize={9}
          fill="var(--accent-blush)"
        >
          Target {target}
        </text>

        {/* Bars */}
        {daily.map((d, i) => {
          const h = (d.calories / max) * plotH;
          const x = pad.left + i * barW + 1;
          const y = pad.top + plotH - h;
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={Math.max(1, barW - 2)}
              height={Math.max(1, h)}
              fill={d.calories > target ? "var(--accent-blush-light)" : "var(--accent-sage)"}
              rx={1}
            >
              <title>{`${d.date}: ${Math.round(d.calories)} cal`}</title>
            </rect>
          );
        })}

        {/* X-axis labels: first, middle, last */}
        {[0, Math.floor(daily.length / 2), daily.length - 1].map((idx) => {
          const d = daily[idx];
          if (!d) return null;
          const x = pad.left + idx * barW + barW / 2;
          return (
            <text
              key={d.date}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize={9}
              fill="var(--text-muted)"
            >
              {format(new Date(d.date + "T00:00:00"), "MMM d")}
            </text>
          );
        })}

        {/* Y-axis 0 */}
        <text
          x={pad.left - 6}
          y={pad.top + plotH + 3}
          textAnchor="end"
          fontSize={9}
          fill="var(--text-muted)"
        >
          0
        </text>
        {/* Y-axis max */}
        <text
          x={pad.left - 6}
          y={pad.top + 6}
          textAnchor="end"
          fontSize={9}
          fill="var(--text-muted)"
        >
          {Math.round(max)}
        </text>
      </svg>
    </div>
  );
}

function MacroStackedBars({ daily }: { daily: DayTotals[] }) {
  const width = 720;
  const height = 150;
  const pad = { top: 10, right: 20, bottom: 28, left: 32 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxCal = Math.max(
    1,
    ...daily.map((d) => d.protein * 4 + d.carbs * 4 + d.fat * 9),
  );
  const barW = plotW / daily.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ overflowX: "auto" }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Daily macro composition stacked bars"
          style={{ display: "block", minWidth: "100%" }}
        >
          {daily.map((d, i) => {
            const proteinCal = d.protein * 4;
            const carbsCal = d.carbs * 4;
            const fatCal = d.fat * 9;
            const proteinH = (proteinCal / maxCal) * plotH;
            const carbsH = (carbsCal / maxCal) * plotH;
            const fatH = (fatCal / maxCal) * plotH;
            const x = pad.left + i * barW + 1;
            const baseY = pad.top + plotH;
            return (
              <g key={d.date}>
                <rect
                  x={x}
                  y={baseY - proteinH}
                  width={Math.max(1, barW - 2)}
                  height={Math.max(0, proteinH)}
                  fill="var(--accent-sage)"
                />
                <rect
                  x={x}
                  y={baseY - proteinH - carbsH}
                  width={Math.max(1, barW - 2)}
                  height={Math.max(0, carbsH)}
                  fill="var(--accent-blush-light)"
                />
                <rect
                  x={x}
                  y={baseY - proteinH - carbsH - fatH}
                  width={Math.max(1, barW - 2)}
                  height={Math.max(0, fatH)}
                  fill="var(--phase-luteal)"
                />
                <title>{`${d.date}: P ${Math.round(d.protein)}g / C ${Math.round(d.carbs)}g / F ${Math.round(d.fat)}g`}</title>
              </g>
            );
          })}

          {[0, Math.floor(daily.length / 2), daily.length - 1].map((idx) => {
            const d = daily[idx];
            if (!d) return null;
            const x = pad.left + idx * barW + barW / 2;
            return (
              <text
                key={d.date}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-muted)"
              >
                {format(new Date(d.date + "T00:00:00"), "MMM d")}
              </text>
            );
          })}
        </svg>
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Protein", color: "var(--accent-sage)" },
    { label: "Carbs", color: "var(--accent-blush-light)" },
    { label: "Fat", color: "var(--phase-luteal)" },
  ];
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {items.map((i) => (
        <span
          key={i.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--text-secondary)",
            fontWeight: 600,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: i.color,
              display: "inline-block",
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function TopFoodsList({
  foods,
}: {
  foods: Array<{ name: string; count: number; totalCal: number }>;
}) {
  return (
    <ol
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        listStyle: "none",
        padding: 0,
        margin: 0,
      }}
    >
      {foods.map((f, i) => (
        <li
          key={f.name}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--bg-primary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              aria-hidden
              className="tabular"
              style={{
                minWidth: 22,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
              }}
            >
              {i + 1}.
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                textTransform: "capitalize",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {f.name}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <span className="tabular" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {f.count}&times;
            </span>
            <span
              className="tabular"
              style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-sage)" }}
            >
              {Math.round(f.totalCal)} cal
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
