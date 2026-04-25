// ARCHIVED: This legacy route is now redirected to /v2/sleep via next.config.ts.
// Kept in source for fast revert. To revive: remove the redirect in next.config.ts.
// Cutover landed: 2026-04-25 (legacy → v2 unified merge).

/**
 * /sleep - Sleep dashboard
 *
 * Surfaces Oura sleep data in one dedicated view:
 *   - Last-night hero: sleep score, total sleep, deep + REM
 *   - 30-day trend: nightly score + duration
 *   - Best / worst night in the last 30 days
 *   - Overnight vitals (HR, HRV, temp deviation, respiratory rate)
 *
 * Pulls from oura_daily. No writes. Mobile-first stacked layout that
 * opens up on desktop.
 */

import { createServiceClient } from "@/lib/supabase";
import { format, addDays } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SleepRow {
  date: string;
  sleep_score: number | null;
  sleep_duration: number | null;
  deep_sleep_min: number | null;
  rem_sleep_min: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
  body_temp_deviation: number | null;
  respiratory_rate: number | null;
}

function minsFromSeconds(sec: number | null): number | null {
  if (sec === null) return null;
  return Math.round(sec / 60);
}

function bandForScore(s: number | null): { label: string; color: string } {
  if (s === null) return { label: "No reading", color: "var(--text-muted)" };
  if (s >= 85) return { label: "Optimal", color: "var(--accent-sage)" };
  if (s >= 70) return { label: "Good", color: "var(--accent-sage)" };
  if (s >= 60) return { label: "Fair", color: "var(--phase-luteal)" };
  return { label: "Pay attention", color: "var(--accent-blush)" };
}

export default async function SleepPage() {
  const sb = createServiceClient();
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const startISO = format(addDays(new Date(todayISO + "T00:00:00"), -29), "yyyy-MM-dd");

  const { data } = await sb
    .from("oura_daily")
    .select(
      "date, sleep_score, sleep_duration, deep_sleep_min, rem_sleep_min, hrv_avg, resting_hr, body_temp_deviation, respiratory_rate",
    )
    .gte("date", startISO)
    .lte("date", todayISO)
    .order("date", { ascending: true });
  const rows = ((data ?? []) as unknown) as SleepRow[];

  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const latestBand = bandForScore(latest?.sleep_score ?? null);
  const latestMins = minsFromSeconds(latest?.sleep_duration ?? null);
  const latestHours = latestMins !== null ? (latestMins / 60).toFixed(1) : null;

  const scores = rows.map((r) => r.sleep_score).filter((v): v is number => v !== null);
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const durations = rows.map((r) => minsFromSeconds(r.sleep_duration)).filter((v): v is number => v !== null);
  const avgHours = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length / 60 : null;

  const sorted = [...rows].filter((r) => r.sleep_score !== null).sort((a, b) => (b.sleep_score ?? 0) - (a.sleep_score ?? 0));
  const bestNight = sorted[0] ?? null;
  const worstNight = sorted[sorted.length - 1] ?? null;

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
          Sleep
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Last night</h1>
      </div>

      {/* Hero */}
      {latest ? (
        <div
          style={{
            padding: "20px 24px",
            borderRadius: 20,
            background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
            border: "1px solid var(--border-light)",
            borderLeftWidth: 4,
            borderLeftStyle: "solid",
            borderLeftColor: latestBand.color,
            boxShadow: "var(--shadow-md)",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: "8px 10px",
              borderRadius: 14,
              background: "var(--bg-card)",
              minWidth: 90,
            }}
          >
            <div
              className="tabular"
              style={{
                fontSize: 40,
                fontWeight: 800,
                lineHeight: 1,
                color: latestBand.color,
              }}
            >
              {latest.sleep_score ?? "\u2014"}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: latestBand.color,
                marginTop: 4,
              }}
            >
              {latestBand.label}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {format(new Date(latest.date + "T00:00:00"), "EEE MMM d")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, marginTop: 2 }}>
              {latestHours ? `${latestHours}h asleep` : "Duration missing"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
              {latest.deep_sleep_min !== null && `Deep ${latest.deep_sleep_min}m`}
              {latest.rem_sleep_min !== null && ` \u00B7 REM ${latest.rem_sleep_min}m`}
              {latest.resting_hr !== null && ` \u00B7 RHR ${latest.resting_hr} bpm`}
              {latest.hrv_avg !== null && ` \u00B7 HRV ${latest.hrv_avg}`}
            </div>
          </div>
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
          <div style={{ fontSize: 15, fontWeight: 700 }}>No Oura sleep data yet</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Sync Oura from Settings to populate this page.
          </p>
        </div>
      )}

      {/* 30-day stat tiles */}
      {rows.length >= 3 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <StatTile label="30-day avg score" value={avg !== null ? `${avg}` : "\u2014"} unit="/ 100" />
          <StatTile label="30-day avg hours" value={avgHours !== null ? avgHours.toFixed(1) : "\u2014"} unit="h" />
          <StatTile
            label="Best night"
            value={bestNight?.sleep_score?.toString() ?? "\u2014"}
            unit={bestNight ? format(new Date(bestNight.date + "T00:00:00"), "MMM d") : ""}
          />
          <StatTile
            label="Worst night"
            value={worstNight?.sleep_score?.toString() ?? "\u2014"}
            unit={worstNight ? format(new Date(worstNight.date + "T00:00:00"), "MMM d") : ""}
          />
        </div>
      )}

      {/* Trend chart */}
      {rows.length >= 2 && <TrendChart rows={rows} />}

      {/* 30-day history list */}
      {rows.length > 0 && (
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
            Last 14 nights
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...rows].reverse().slice(0, 14).map((r) => {
              const band = bandForScore(r.sleep_score);
              const mins = minsFromSeconds(r.sleep_duration);
              return (
                <div
                  key={r.date}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 60px 1fr auto",
                    gap: 10,
                    padding: "6px 8px",
                    borderRadius: 8,
                    background: "var(--bg-primary)",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  <span>{format(new Date(r.date + "T00:00:00"), "EEE MMM d")}</span>
                  <span className="tabular" style={{ fontWeight: 700, color: band.color }}>
                    {r.sleep_score ?? "\u2014"}
                  </span>
                  <span className="tabular" style={{ color: "var(--text-muted)" }}>
                    {mins !== null ? `${(mins / 60).toFixed(1)}h` : "\u2014"}
                    {r.deep_sleep_min !== null && ` \u00B7 deep ${r.deep_sleep_min}m`}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: band.color,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {band.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
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
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4, fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
  );
}

function TrendChart({ rows }: { rows: SleepRow[] }) {
  const width = 720;
  const height = 120;
  const padding = 20;
  const scores = rows.map((r) => r.sleep_score ?? 0);
  const max = Math.max(100, ...scores);
  const min = 0;
  const xStep = (width - 2 * padding) / Math.max(1, rows.length - 1);
  const points = rows
    .map((r, i) => {
      if (r.sleep_score === null) return null;
      const x = padding + i * xStep;
      const y = height - padding - ((r.sleep_score - min) / (max - min)) * (height - 2 * padding);
      return { x, y, date: r.date, score: r.sleep_score };
    })
    .filter((p): p is { x: number; y: number; date: string; score: number } => p !== null);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const ref70y = height - padding - ((70 - min) / (max - min)) * (height - 2 * padding);

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
          30-day score trend
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Sage line at 70 = Oura &quot;Good&quot; threshold
        </span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line
          x1={padding}
          x2={width - padding}
          y1={ref70y}
          y2={ref70y}
          stroke="var(--border-light)"
          strokeDasharray="3 3"
        />
        <path d={path} fill="none" stroke="var(--accent-sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r="2" fill="var(--accent-sage)" />
        ))}
      </svg>
    </div>
  );
}
