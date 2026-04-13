"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { OuraDaily, DailyLog, NcImported } from "@/lib/types";
import type { TimeRange } from "./PatternsClient";

interface TrendChartProps {
  ouraData: OuraDaily[];
  dailyLogs: DailyLog[];
  ncData: NcImported[];
  timeRange: TimeRange;
}

interface MetricConfig {
  key: string;
  label: string;
  color: string;
  domain?: [number, number];
}

const METRICS: MetricConfig[] = [
  { key: "pain", label: "Pain", color: "#E8506A" },
  { key: "energy", label: "Energy", color: "#E8A849" },
  { key: "sleepScore", label: "Sleep", color: "#5B9BD5" },
  { key: "hrv", label: "HRV", color: "#6B9080" },
  { key: "restingHr", label: "Rest HR", color: "#8B5CF6" },
  { key: "temperature", label: "Temp", color: "#06B6D4" },
];

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  pain: number | null;
  energy: number | null;
  sleepScore: number | null;
  hrv: number | null;
  restingHr: number | null;
  temperature: number | null;
  cyclePhase: string | null;
}

// Determine cycle phase from NC data for a given date
function getPhaseFromNc(ncEntry: NcImported | undefined): string | null {
  if (!ncEntry) return null;
  const day = ncEntry.cycle_day;
  if (day === null) return null;
  if (day <= 5) return "menstrual";
  if (day <= 13) return "follicular";
  if (day <= 16) return "ovulatory";
  return "luteal";
}

// Build phase overlay regions
interface PhaseRegion {
  x1: string;
  x2: string;
  phase: string;
  color: string;
}

function buildPhaseRegions(data: ChartDataPoint[]): PhaseRegion[] {
  if (data.length === 0) return [];

  const phaseColors: Record<string, string> = {
    menstrual: "rgba(232, 80, 106, 0.08)",
    follicular: "rgba(91, 155, 213, 0.08)",
    ovulatory: "rgba(107, 191, 89, 0.08)",
    luteal: "rgba(232, 168, 73, 0.08)",
  };

  const regions: PhaseRegion[] = [];
  let currentPhase: string | null = null;
  let startDate = "";

  for (const point of data) {
    if (point.cyclePhase !== currentPhase) {
      if (currentPhase && startDate) {
        regions.push({
          x1: startDate,
          x2: point.date,
          phase: currentPhase,
          color: phaseColors[currentPhase] || "transparent",
        });
      }
      currentPhase = point.cyclePhase;
      startDate = point.date;
    }
  }

  // Close last region
  if (currentPhase && startDate && data.length > 0) {
    regions.push({
      x1: startDate,
      x2: data[data.length - 1].date,
      phase: currentPhase,
      color: phaseColors[currentPhase] || "transparent",
    });
  }

  return regions;
}

function CustomTooltipContent({
  active,
  payload,
  label,
  visibleMetrics,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null; color: string }>;
  label?: string;
  visibleMetrics: Set<string>;
}) {
  if (!active || !payload || !label) return null;

  const dateStr = (() => {
    try {
      return format(parseISO(label), "MMM d, yyyy");
    } catch {
      return label;
    }
  })();

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "var(--shadow-md)",
        fontSize: 12,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 6,
        }}
      >
        {dateStr}
      </div>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => {
          const metric = METRICS.find((m) => m.key === p.dataKey);
          if (!metric || !visibleMetrics.has(metric.key)) return null;
          let displayVal = String(p.value);
          if (metric.key === "temperature" && p.value !== null) {
            const sign = p.value >= 0 ? "+" : "";
            displayVal = `${sign}${p.value.toFixed(2)}C`;
          }
          return (
            <div
              key={p.dataKey}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 3,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: p.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--text-secondary)" }}>
                {metric.label}:
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {displayVal}
              </span>
            </div>
          );
        })}
    </div>
  );
}

export function TrendChart({
  ouraData,
  dailyLogs,
  ncData,
}: TrendChartProps) {
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(
    () => new Set(["pain", "hrv"])
  );

  const toggleMetric = (key: string) => {
    setVisibleMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Merge all data sources by date
  const chartData = useMemo(() => {
    const dateMap = new Map<string, ChartDataPoint>();

    // Collect all dates from all sources
    const allDates = new Set<string>();
    ouraData.forEach((d) => allDates.add(d.date));
    dailyLogs.forEach((d) => allDates.add(d.date));
    ncData.forEach((d) => allDates.add(d.date));

    // Create NC lookup
    const ncByDate = new Map<string, NcImported>();
    ncData.forEach((d) => ncByDate.set(d.date, d));

    // Create oura lookup
    const ouraByDate = new Map<string, OuraDaily>();
    ouraData.forEach((d) => ouraByDate.set(d.date, d));

    // Create logs lookup
    const logsByDate = new Map<string, DailyLog>();
    dailyLogs.forEach((d) => logsByDate.set(d.date, d));

    for (const date of allDates) {
      const oura = ouraByDate.get(date);
      const log = logsByDate.get(date);
      const nc = ncByDate.get(date);

      dateMap.set(date, {
        date,
        dateLabel: (() => {
          try {
            return format(parseISO(date), "MMM d");
          } catch {
            return date;
          }
        })(),
        pain: log?.overall_pain ?? null,
        energy:
          log?.fatigue !== null && log?.fatigue !== undefined
            ? 10 - log.fatigue
            : null,
        sleepScore: oura?.sleep_score ?? null,
        hrv: oura?.hrv_avg ?? null,
        restingHr: oura?.resting_hr ?? null,
        temperature: oura?.body_temp_deviation ?? null,
        cyclePhase: getPhaseFromNc(nc),
      });
    }

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [ouraData, dailyLogs, ncData]);

  const phaseRegions = useMemo(() => buildPhaseRegions(chartData), [chartData]);

  // Compute tick interval based on data length
  const tickInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 10) return 0;
    if (len <= 30) return 3;
    return 7;
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div
        className="card"
        style={{ padding: 24, textAlign: "center" }}
      >
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 14,
          }}
        >
          No data available for this time range
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "16px 12px" }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 12px 4px",
        }}
      >
        Health Trends
      </h2>

      {/* Metric toggle pills */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 16,
          paddingLeft: 4,
        }}
      >
        {METRICS.map((m) => {
          const isActive = visibleMetrics.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 500,
                border: `1.5px solid ${isActive ? m.color : "var(--border)"}`,
                background: isActive
                  ? `${m.color}14`
                  : "var(--bg-card)",
                color: isActive ? m.color : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 200ms ease",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: isActive ? m.color : "var(--border)",
                  transition: "background 200ms ease",
                }}
              />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, bottom: 4, left: -12 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-light)"
            vertical={false}
          />

          {/* Cycle phase overlays */}
          {phaseRegions.map((region, i) => (
            <ReferenceArea
              key={`phase-${i}`}
              x1={region.x1}
              x2={region.x2}
              fill={region.color}
              fillOpacity={1}
              strokeOpacity={0}
            />
          ))}

          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border-light)" }}
            interval={tickInterval}
            tickFormatter={(val: string) => {
              try {
                return format(parseISO(val), "MMM d");
              } catch {
                return val;
              }
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            content={
              <CustomTooltipContent visibleMetrics={visibleMetrics} />
            }
          />

          {METRICS.map((m) =>
            visibleMetrics.has(m.key) ? (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: m.color }}
                connectNulls
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Phase legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 10,
          paddingLeft: 4,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        {[
          { label: "Menstrual", color: "var(--phase-menstrual)" },
          { label: "Follicular", color: "var(--phase-follicular)" },
          { label: "Ovulatory", color: "var(--phase-ovulatory)" },
          { label: "Luteal", color: "var(--phase-luteal)" },
        ].map((p) => (
          <span key={p.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 10,
                height: 6,
                borderRadius: 2,
                background: p.color,
                opacity: 0.35,
              }}
            />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
