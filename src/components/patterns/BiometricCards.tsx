"use client";

import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { OuraDaily } from "@/lib/types";

interface BiometricCardsProps {
  ouraData: OuraDaily[];
}

interface MetricDef {
  key: keyof OuraDaily;
  label: string;
  unit: string;
  /** true = higher is better (sage when above avg), false = lower is better */
  higherIsBetter: boolean;
  format?: (v: number) => string;
}

const METRICS: MetricDef[] = [
  { key: "sleep_score", label: "Sleep Score", unit: "", higherIsBetter: true },
  { key: "hrv_avg", label: "HRV", unit: "ms", higherIsBetter: true },
  { key: "resting_hr", label: "Resting HR", unit: "bpm", higherIsBetter: false },
  {
    key: "body_temp_deviation",
    label: "Temp Deviation",
    unit: "C",
    higherIsBetter: false,
    format: (v: number) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)),
  },
  { key: "readiness_score", label: "Readiness", unit: "", higherIsBetter: true },
  { key: "stress_score", label: "Stress", unit: "", higherIsBetter: false },
];

function computeMetric(
  data: OuraDaily[],
  key: keyof OuraDaily,
): { current: number | null; avg: number | null; sparkline: { v: number }[] } {
  // Last 14 data points for sparkline
  const last14 = data.slice(-14);
  const values = last14
    .map((d) => d[key])
    .filter((v): v is number => typeof v === "number" && v !== null);

  const sparkline = values.map((v) => ({ v }));

  // Last 7 for average
  const last7 = data.slice(-7);
  const last7Values = last7
    .map((d) => d[key])
    .filter((v): v is number => typeof v === "number" && v !== null);
  const avg =
    last7Values.length > 0
      ? last7Values.reduce((a, b) => a + b, 0) / last7Values.length
      : null;

  // Current = most recent entry
  const current =
    data.length > 0
      ? (data[data.length - 1][key] as number | null) ?? null
      : null;

  return { current, avg, sparkline };
}

function BiometricCard({
  label,
  unit,
  current,
  avg,
  sparkline,
  higherIsBetter,
  formatFn,
}: {
  label: string;
  unit: string;
  current: number | null;
  avg: number | null;
  sparkline: { v: number }[];
  higherIsBetter: boolean;
  formatFn?: (v: number) => string;
}) {
  if (current === null) return null;

  const diff = avg !== null ? current - avg : null;
  const isGood =
    diff !== null ? (higherIsBetter ? diff >= 0 : diff <= 0) : null;
  const compColor = isGood === null
    ? "var(--text-muted)"
    : isGood
      ? "var(--accent-sage)"
      : "var(--accent-rose)";

  const displayValue = formatFn ? formatFn(current) : Math.round(current);
  const displayAvg = avg !== null ? (formatFn ? formatFn(avg) : Math.round(avg)) : null;
  const sparkColor = isGood === null
    ? "var(--accent-sage)"
    : isGood
      ? "var(--accent-sage)"
      : "var(--accent-rose)";

  return (
    <div
      className="card"
      style={{
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 0,
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>

      {/* Current value */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1,
          }}
        >
          {displayValue}
        </span>
        {unit && (
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Avg comparison */}
      {displayAvg !== null && (
        <span
          style={{
            fontSize: 11,
            color: compColor,
            fontWeight: 500,
          }}
        >
          vs avg {displayAvg}
        </span>
      )}

      {/* Mini sparkline */}
      {sparkline.length >= 2 && (
        <div style={{ height: 40, marginTop: 2, marginLeft: -4, marginRight: -4 }}>
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={sparkline}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function BiometricCards({ ouraData }: BiometricCardsProps) {
  const metrics = useMemo(() => {
    return METRICS.map((m) => {
      const { current, avg, sparkline } = computeMetric(ouraData, m.key);
      return { ...m, current, avg, sparkline };
    }).filter((m) => m.current !== null);
  }, [ouraData]);

  if (metrics.length === 0) return null;

  return (
    <div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 12px 0",
        }}
      >
        Biometric Snapshot
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {metrics.map((m) => (
          <BiometricCard
            key={m.key}
            label={m.label}
            unit={m.unit}
            current={m.current}
            avg={m.avg}
            sparkline={m.sparkline}
            higherIsBetter={m.higherIsBetter}
            formatFn={m.format}
          />
        ))}
      </div>
    </div>
  );
}
