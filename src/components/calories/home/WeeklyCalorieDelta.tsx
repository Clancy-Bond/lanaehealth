/**
 * Home widget: today's calories vs 7-day average, plus a small
 * sparkline over the last 7 days.
 *
 * Copy is framed in terms of "your rhythm" rather than "on track" so
 * it stays neutral per the non-shaming voice rule. When the user has
 * fewer than 3 days of food_entries, we say so instead of drawing a
 * fake average from 2 data points.
 *
 * Links to /patterns/calories for the full 30-day view.
 */

import { format, addDays } from "date-fns";
import { getDailyTotalsRange } from "@/lib/calories/home-data";

interface Props {
  date: string;
}

export async function WeeklyCalorieDelta({ date }: Props) {
  const today = new Date(date + "T00:00:00");
  const startIso = format(addDays(today, -6), "yyyy-MM-dd");
  const endIso = date;

  const week = await getDailyTotalsRange(startIso, endIso);
  const values = week.map((d) => d.calories);
  const todayTotals = week.find((d) => d.date === date);
  const todayCalories = Math.round(todayTotals?.calories ?? 0);

  const prior = week.filter((d) => d.date !== date);
  const priorWithData = prior.filter((d) => d.calories > 0);
  const avgPrior =
    priorWithData.length > 0
      ? priorWithData.reduce((acc, d) => acc + d.calories, 0) / priorWithData.length
      : null;

  const delta = avgPrior != null ? todayCalories - avgPrior : null;
  const band = classifyDelta(delta);
  const accent =
    band === "high"
      ? "var(--accent-blush-light)"
      : band === "low"
        ? "var(--accent-sage-muted)"
        : "var(--border-light)";

  const max = Math.max(100, ...values);

  return (
    <div style={{ padding: "0 16px" }}>
      <a
        href="/patterns/calories"
        className="press-feedback"
        aria-label="Open 30-day calorie patterns"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "14px 18px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
          border: "1px solid var(--border-light)",
          borderLeftWidth: 3,
          borderLeftStyle: "solid",
          borderLeftColor: accent,
          boxShadow: "var(--shadow-sm)",
          textDecoration: "none",
          color: "var(--text-primary)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent-sage)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Your week
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>
              {headline(todayCalories, avgPrior, priorWithData.length)}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {subCopy(todayCalories, avgPrior, delta, priorWithData.length)}
            </div>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          >
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <Sparkline week={week} max={max} todayIso={date} />
      </a>
    </div>
  );
}

function classifyDelta(delta: number | null): "high" | "low" | "flat" | "unknown" {
  if (delta == null) return "unknown";
  if (delta > 300) return "high";
  if (delta < -300) return "low";
  return "flat";
}

function headline(
  todayCalories: number,
  avgPrior: number | null,
  priorDays: number,
): string {
  if (priorDays < 3) {
    return todayCalories > 0
      ? `${todayCalories} cal today`
      : "No food logged yet today";
  }
  const avg = Math.round(avgPrior ?? 0);
  if (todayCalories === 0) return `Usually ${avg} cal by now`;
  return `${todayCalories} cal today \u00B7 avg ${avg}`;
}

function subCopy(
  todayCalories: number,
  avgPrior: number | null,
  delta: number | null,
  priorDays: number,
): string {
  if (priorDays < 3) {
    return "A few more logged days will give a useful average.";
  }
  if (todayCalories === 0) {
    return "No comparison yet for today.";
  }
  if (delta == null) return "";
  const rounded = Math.round(delta);
  if (rounded > 300) return `Running higher than the week \u00B7 +${rounded}`;
  if (rounded < -300) return `Running lighter than the week \u00B7 ${rounded}`;
  return "In line with your typical week.";
}

function Sparkline({
  week,
  max,
  todayIso,
}: {
  week: Array<{ date: string; calories: number }>;
  max: number;
  todayIso: string;
}) {
  const barCount = week.length;
  const width = 100;
  const barW = width / barCount;
  const height = 28;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden
      style={{ display: "block" }}
    >
      {week.map((d, i) => {
        const h = Math.max(1, (d.calories / max) * (height - 4));
        const x = i * barW + 1;
        const y = height - h;
        const isToday = d.date === todayIso;
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={Math.max(1, barW - 2)}
            height={h}
            fill={isToday ? "var(--accent-sage)" : "var(--accent-sage-muted)"}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
