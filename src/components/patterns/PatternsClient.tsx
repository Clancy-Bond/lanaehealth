"use client";

import { useState, useMemo } from "react";
import { TrendChart } from "./TrendChart";
import { BiometricCards } from "./BiometricCards";
import { CycleOverview } from "./CycleOverview";
import { FoodTriggers } from "./FoodTriggers";
import { CorrelationCards } from "./CorrelationCards";
import type { OuraDaily, DailyLog, NcImported, FoodEntry, CycleEntry } from "@/lib/types";

export interface CorrelationResult {
  id: string;
  factor_a: string;
  factor_b: string;
  correlation_type: string;
  coefficient: number | null;
  p_value: number | null;
  effect_size: number | null;
  effect_description: string | null;
  confidence_level: "suggestive" | "moderate" | "strong";
  sample_size: number | null;
  lag_days: number | null;
  cycle_phase: string | null;
  passed_fdr: boolean;
  computed_at: string;
}

export type TimeRange = "7d" | "30d" | "90d";

interface PatternsClientProps {
  ouraData: OuraDaily[];
  dailyLogs: DailyLog[];
  ncData: NcImported[];
  foodEntries: FoodEntry[];
  cycleEntries: CycleEntry[];
  correlations: CorrelationResult[];
  fullNcData?: NcImported[];
  fullCycleEntries?: CycleEntry[];
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export function PatternsClient({
  ouraData,
  dailyLogs,
  ncData,
  foodEntries,
  cycleEntries,
  correlations,
  fullNcData,
  fullCycleEntries,
}: PatternsClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const rangeDays = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
  const cutoff = getDaysAgo(rangeDays);

  // Filter data by time range
  const filteredOura = useMemo(
    () => ouraData.filter((d) => d.date >= cutoff),
    [ouraData, cutoff]
  );
  const filteredLogs = useMemo(
    () => dailyLogs.filter((d) => d.date >= cutoff),
    [dailyLogs, cutoff]
  );
  const filteredNc = useMemo(
    () => ncData.filter((d) => d.date >= cutoff),
    [ncData, cutoff]
  );
  const filteredFood = useMemo(
    () => foodEntries.filter((d) => d.logged_at >= cutoff),
    [foodEntries, cutoff]
  );
  const filteredCycle = useMemo(
    () => cycleEntries.filter((d) => d.date >= cutoff),
    [cycleEntries, cutoff]
  );

  const ranges: TimeRange[] = ["7d", "30d", "90d"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        paddingTop: 16,
        paddingBottom: 24,
        maxWidth: 480,
        marginLeft: "auto",
        marginRight: "auto",
        width: "100%",
      }}
    >
      {/* Header */}
      <div style={{ padding: "0 16px" }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Patterns
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            margin: "4px 0 0",
          }}
        >
          Trends and correlations across your health data
        </p>
      </div>

      {/* Time range selector */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "0 16px",
        }}
      >
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setTimeRange(r)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid",
              borderColor:
                timeRange === r ? "var(--accent-sage)" : "var(--border)",
              background:
                timeRange === r
                  ? "var(--accent-sage)"
                  : "var(--bg-card)",
              color:
                timeRange === r
                  ? "var(--text-inverse)"
                  : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
          >
            {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
          </button>
        ))}
      </div>

      {/* Trend Chart */}
      <section style={{ padding: "0 16px" }}>
        <TrendChart
          ouraData={filteredOura}
          dailyLogs={filteredLogs}
          ncData={filteredNc}
          timeRange={timeRange}
        />
      </section>

      {/* Biometric Snapshot */}
      <section style={{ padding: "0 16px" }}>
        <BiometricCards ouraData={ouraData} />
      </section>

      {/* Cycle Overview */}
      <section style={{ padding: "0 16px" }}>
        <CycleOverview
          ncData={fullNcData || ncData}
          cycleEntries={fullCycleEntries || cycleEntries}
        />
      </section>

      {/* Food Triggers */}
      <section style={{ padding: "0 16px" }}>
        <FoodTriggers foodEntries={filteredFood} timeRange={timeRange} />
      </section>

      {/* Correlation Cards */}
      <section style={{ padding: "0 16px" }}>
        <CorrelationCards correlations={correlations} />
      </section>
    </div>
  );
}
