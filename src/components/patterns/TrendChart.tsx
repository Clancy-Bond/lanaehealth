"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
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
  { key: "mood", label: "Mood", color: "#D4A0A0", domain: [1, 5] },
  { key: "sleepScore", label: "Sleep", color: "#5B9BD5" },
  { key: "hrv", label: "HRV", color: "#6B9080" },
  { key: "restingHr", label: "Rest HR", color: "#8B5CF6" },
  { key: "temperature", label: "Temp", color: "#06B6D4" },
];

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  pain?: number;
  energy?: number;
  mood?: number;
  sleepScore?: number;
  hrv?: number;
  restingHr?: number;
  temperature?: number;
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
    menstrual: "rgba(232, 80, 106, 0.12)",
    follicular: "rgba(91, 155, 213, 0.12)",
    ovulatory: "rgba(107, 191, 89, 0.12)",
    luteal: "rgba(232, 168, 73, 0.12)",
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Array<{ dataKey: string; value: any; color: string }>;
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

  const visibleEntries = payload.filter(
    (p) => p.value != null && visibleMetrics.has(p.dataKey)
  );

  if (visibleEntries.length === 0) return null;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E5DC",
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "0 4px 12px rgba(26, 26, 46, 0.08)",
        fontSize: 12,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "#1A1A2E",
          marginBottom: 6,
        }}
      >
        {dateStr}
      </div>
      {visibleEntries.map((p) => {
        const metric = METRICS.find((m) => m.key === p.dataKey);
        if (!metric) return null;
        let displayVal = String(p.value);
        if (metric.key === "temperature" && typeof p.value === "number") {
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
            <span style={{ color: "#6B7280" }}>
              {metric.label}:
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "#1A1A2E",
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
  // Measure parent width after mount instead of using ResponsiveContainer,
  // which gets 0 width during SSR/hydration on Vercel and never re-renders.
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (chartRef.current) {
        setChartWidth(chartRef.current.clientWidth);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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

      // Use undefined (not null) for missing values so Recharts v3
      // treats them as gaps rather than zero-like values
      const point: ChartDataPoint = {
        date,
        dateLabel: (() => {
          try {
            return format(parseISO(date), "MMM d");
          } catch {
            return date;
          }
        })(),
        cyclePhase: getPhaseFromNc(nc),
      };

      if (log?.overall_pain != null) point.pain = log.overall_pain;
      if (log?.fatigue != null) point.energy = 10 - log.fatigue;
      const logAny = log as unknown as Record<string, unknown> | undefined;
      if (logAny?.mood_score != null) point.mood = logAny.mood_score as number;
      if (oura?.sleep_score != null) point.sleepScore = oura.sleep_score;
      if (oura?.hrv_avg != null) point.hrv = oura.hrv_avg;
      if (oura?.resting_hr != null) point.restingHr = oura.resting_hr;
      if (oura?.body_temp_deviation != null) point.temperature = oura.body_temp_deviation;

      dateMap.set(date, point);
    }

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [ouraData, dailyLogs, ncData]);

  const phaseRegions = useMemo(() => buildPhaseRegions(chartData), [chartData]);

  // Compute tick interval based on data length to avoid label overlap
  const tickInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 7) return 0; // show every label
    if (len <= 14) return 1; // every other label
    if (len <= 30) return Math.ceil(len / 8) - 1;
    if (len <= 90) return Math.ceil(len / 10) - 1;
    return Math.ceil(len / 12) - 1;
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

      {/* Chart - measure parent width after mount, render only when width > 0 */}
      <div ref={chartRef} style={{ width: "100%", height: 270 }}>
        {chartWidth > 0 ? (
          <LineChart
            width={chartWidth}
            height={270}
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 24, left: -12 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#F0F0EA"
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
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              angle={-45}
              textAnchor="end"
              tickLine={false}
              axisLine={{ stroke: "#F0F0EA" }}
              interval={tickInterval}
              tickFormatter={(val: string) => {
                try {
                  return format(parseISO(val), "MMM d");
                } catch {
                  return val;
                }
              }}
              height={55}
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
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
                  isAnimationActive={false}
                />
              ) : null
            )}
          </LineChart>
        ) : (
          <div style={{ width: "100%", height: 270, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#9CA3AF", fontSize: 13 }}>Loading chart...</span>
          </div>
        )}
      </div>

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
