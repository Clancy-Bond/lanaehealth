/**
 * /activity - Exercise & movement dashboard
 *
 * Pulls Oura's daily_activity payload (added to sync 2026-04-18) from
 * oura_daily.raw_json.oura.daily_activity and surfaces:
 *   - Today's steps + active calories + total calories
 *   - 30-day trend for steps
 *   - Best / worst day in the window
 *   - Contextual copy: POTS-specific pacing (don't chase step goals
 *     on low-readiness days)
 */

import { loadActivityRange } from "@/lib/calories/activity";
import { createServiceClient } from "@/lib/supabase";
import { format, addDays } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const startISO = format(addDays(new Date(todayISO + "T00:00:00"), -29), "yyyy-MM-dd");

  const [activityRows, ouraRes] = await Promise.all([
    loadActivityRange(startISO, todayISO),
    createServiceClient()
      .from("oura_daily")
      .select("date, readiness_score")
      .gte("date", startISO)
      .lte("date", todayISO),
  ]);

  const readinessByDate = new Map<string, number | null>();
  for (const r of ((ouraRes.data ?? []) as Array<{ date: string; readiness_score: number | null }>)) {
    readinessByDate.set(r.date, r.readiness_score);
  }

  const today = activityRows.find((r) => r.date === todayISO) ?? null;
  const withSteps = activityRows.filter((r) => r.steps !== null);
  const stepsValues = withSteps.map((r) => r.steps as number);

  const avg = stepsValues.length > 0 ? Math.round(stepsValues.reduce((a, b) => a + b, 0) / stepsValues.length) : null;
  const sorted = [...withSteps].sort((a, b) => (b.steps ?? 0) - (a.steps ?? 0));
  const best = sorted[0] ?? null;
  const worst = sorted[sorted.length - 1] ?? null;

  const totalActive = activityRows.reduce((acc, r) => acc + (r.activeCalories ?? 0), 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 16,
        maxWidth: 920,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        &lsaquo; Home
      </Link>

      <div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Activity
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Movement today</h1>
      </div>

      {/* Hero */}
      {today ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            padding: "18px 20px",
            borderRadius: 16,
            background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <HeroStat label="Steps" value={today.steps !== null ? today.steps.toLocaleString() : "\u2014"} unit="" />
          <HeroStat label="Active calories" value={today.activeCalories !== null ? Math.round(today.activeCalories).toString() : "\u2014"} unit="cal" />
          <HeroStat label="Total calories" value={today.totalCalories !== null ? Math.round(today.totalCalories).toString() : "\u2014"} unit="cal" />
          <HeroStat
            label="Walking distance"
            value={today.equivalentWalkingDistanceM !== null ? (today.equivalentWalkingDistanceM / 1000).toFixed(1) : "\u2014"}
            unit={today.equivalentWalkingDistanceM !== null ? "km" : ""}
          />
        </div>
      ) : (
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>No activity data today</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Oura should sync within the hour. Make sure your ring has charge.
          </p>
        </div>
      )}

      {/* 30-day tiles */}
      {withSteps.length >= 3 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <StatTile label="30-day avg steps" value={avg !== null ? avg.toLocaleString() : "\u2014"} />
          <StatTile label="Total active cal (30d)" value={Math.round(totalActive).toLocaleString()} />
          <StatTile
            label="Best day"
            value={best?.steps?.toLocaleString() ?? "\u2014"}
            detail={best ? format(new Date(best.date + "T00:00:00"), "MMM d") : null}
          />
          <StatTile
            label="Rest day"
            value={worst?.steps?.toLocaleString() ?? "\u2014"}
            detail={worst ? format(new Date(worst.date + "T00:00:00"), "MMM d") : null}
          />
        </div>
      )}

      {/* 30-day trend */}
      {withSteps.length >= 2 && <StepsChart rows={activityRows} readinessByDate={readinessByDate} />}

      {/* POTS pacing copy */}
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--text-primary)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 6,
          }}
        >
          How to read this for POTS
        </div>
        <p style={{ margin: 0 }}>
          Step totals are a signal, not a target. On low-readiness days,
          forcing steps trades a bad day tomorrow for a mediocre one today.
          The Morning Signal card on Home scales movement to recovery
          automatically. Use this dashboard to spot <em>patterns</em>:
          consistent 7-day averages matter more than any single day.
        </p>
      </div>

      {/* History table */}
      {activityRows.length > 0 && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 8,
            }}
          >
            Last 14 days
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...activityRows].reverse().slice(0, 14).map((r) => (
              <div
                key={r.date}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 1fr",
                  gap: 10,
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: "var(--bg-primary)",
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <span>{format(new Date(r.date + "T00:00:00"), "EEE MMM d")}</span>
                <span className="tabular" style={{ fontWeight: 700 }}>
                  {r.steps !== null ? r.steps.toLocaleString() : "\u2014"}
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 3, fontWeight: 600 }}>
                    steps
                  </span>
                </span>
                <span className="tabular" style={{ color: "var(--text-muted)" }}>
                  {r.activeCalories !== null ? Math.round(r.activeCalories).toLocaleString() : "\u2014"}
                  <span style={{ fontSize: 10, marginLeft: 3, fontWeight: 600 }}>
                    {r.activeCalories !== null ? "active cal" : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, marginTop: 3 }}>
        {value}
        {unit && <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
        {value}
      </div>
      {detail && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{detail}</div>}
    </div>
  );
}

function StepsChart({
  rows,
  readinessByDate,
}: {
  rows: import("@/lib/calories/activity").DailyActivity[];
  readinessByDate: Map<string, number | null>;
}) {
  const width = 720;
  const height = 120;
  const padding = 18;
  const valid = rows.filter((r) => r.steps !== null) as Array<import("@/lib/calories/activity").DailyActivity & { steps: number }>;
  if (valid.length < 2) return null;
  const max = Math.max(10000, ...valid.map((r) => r.steps));
  const xStep = (width - 2 * padding) / Math.max(1, valid.length - 1);
  const barWidth = Math.max(4, Math.min(14, xStep - 2));

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          30-day steps &middot; low-readiness days highlighted
        </span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {valid.map((r, i) => {
          const x = padding + i * xStep - barWidth / 2;
          const h = ((r.steps ?? 0) / max) * (height - 2 * padding);
          const y = height - padding - h;
          const readiness = readinessByDate.get(r.date);
          const lowReadiness = readiness !== null && readiness !== undefined && readiness < 65;
          return (
            <rect
              key={r.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(1, h)}
              rx={2}
              fill={lowReadiness ? "var(--accent-blush)" : "var(--accent-sage)"}
            />
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        Blush = days when Oura readiness was under 65 (low-recovery days).
      </div>
    </div>
  );
}
