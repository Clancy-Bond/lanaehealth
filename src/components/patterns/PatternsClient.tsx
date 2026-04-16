"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { TrendChart } from "./TrendChart";
import { BiometricCards } from "./BiometricCards";
import { CycleOverview } from "./CycleOverview";
import { FoodTriggers } from "./FoodTriggers";
import { CorrelationCards } from "./CorrelationCards";
import SleepOverview from "./SleepOverview";
import NutrientDashboard from "./NutrientDashboard";
import FoodSymptomCorrelation from "./FoodSymptomCorrelation";
import AGPChart from "./AGPChart";
import AdherenceDisplay from "./AdherenceDisplay";
import { ScrollToTop } from "@/components/ScrollToTop";
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

  // Count days with actual pain data logged
  const daysWithPainData = useMemo(
    () => dailyLogs.filter((d) => d.overall_pain !== null).length,
    [dailyLogs]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        paddingTop: 16,
        paddingBottom: 24,
        maxWidth: 640,
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

      {/* Getting Started callout when few pain logs exist */}
      {daysWithPainData < 7 && (
        <div
          style={{
            margin: "0 16px",
            padding: 16,
            borderRadius: 12,
            background: "var(--accent-sage-muted)",
            border: "1px solid var(--accent-sage-border)",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Sparkles
              size={18}
              style={{ color: "var(--accent-sage)", flexShrink: 0, marginTop: 1 }}
              strokeWidth={2}
            />
            <div>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Start logging your daily symptoms to see pain and energy trends alongside your Oura
                biometrics. The more you log, the more patterns the AI can find.
              </p>
              <Link
                href="/log"
                style={{
                  display: "inline-block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--accent-sage)",
                  textDecoration: "none",
                  marginTop: 8,
                }}
              >
                Log today &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

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

      {/* Sleep Overview */}
      <section style={{ padding: "0 16px" }}>
        <SleepOverview
          data={ouraData.map(d => ({
            date: d.date,
            sleep_score: d.sleep_score ?? null,
            sleep_total: (d as unknown as Record<string, unknown>).sleep_total as number ?? null,
            sleep_deep: (d as unknown as Record<string, unknown>).sleep_deep as number ?? null,
            sleep_rem: (d as unknown as Record<string, unknown>).sleep_rem as number ?? null,
            sleep_light: (d as unknown as Record<string, unknown>).sleep_light as number ?? null,
            sleep_efficiency: (d as unknown as Record<string, unknown>).sleep_efficiency as number ?? null,
            hr_lowest: (d as unknown as Record<string, unknown>).hr_lowest as number ?? null,
            hrv_avg: d.hrv_avg ?? null,
            breath_rate: (d as unknown as Record<string, unknown>).breath_rate as number ?? null,
            temp_deviation: d.body_temp_deviation ?? null,
          }))}
          painScores={new Map(dailyLogs.filter(l => l.overall_pain !== null).map(l => [l.date, l.overall_pain!]))}
          cyclePhases={new Map(dailyLogs.filter(l => l.cycle_phase).map(l => [l.date, l.cycle_phase!]))}
        />
      </section>

      {/* Nutrient Dashboard */}
      <section style={{ padding: "0 16px" }}>
        <NutrientDashboard
          data={(() => {
            // Aggregate food entries by date for the dashboard
            const byDate = new Map<string, { calories: number; protein: number; fat: number; carbs: number; fiber: number; iron: number; vitaminC: number; calcium: number }>();
            for (const entry of foodEntries) {
              const date = typeof entry.logged_at === 'string' ? entry.logged_at.slice(0, 10) : '';
              if (!date) continue;
              const day = byDate.get(date) ?? { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, iron: 0, vitaminC: 0, calcium: 0 };
              day.calories += (entry as unknown as Record<string, unknown>).calories as number ?? 0;
              day.protein += (entry as unknown as Record<string, unknown>).protein as number ?? 0;
              day.fat += (entry as unknown as Record<string, unknown>).fat as number ?? 0;
              day.carbs += (entry as unknown as Record<string, unknown>).carbs as number ?? 0;
              day.fiber += (entry as unknown as Record<string, unknown>).fiber as number ?? 0;
              byDate.set(date, day);
            }
            return Array.from(byDate.entries())
              .map(([date, nutrients]) => ({ date, ...nutrients }))
              .sort((a, b) => a.date.localeCompare(b.date));
          })()}
        />
      </section>

      {/* Food-Symptom Correlations */}
      <section style={{ padding: "0 16px" }}>
        <FoodSymptomCorrelation
          foodEntries={foodEntries.map(e => ({
            date: typeof e.logged_at === 'string' ? e.logged_at.slice(0, 10) : '',
            food_items: e.food_items ?? '',
            flagged_triggers: e.flagged_triggers ?? [],
          }))}
          dailyLogs={dailyLogs}
        />
      </section>

      {/* AGP Chart for Heart Rate */}
      {ouraData.length >= 7 && (
        <section style={{ padding: "0 16px" }}>
          <AGPChart
            title="Heart Rate Profile"
            unit="bpm"
            data={ouraData
              .filter(d => d.resting_hr !== null)
              .map(d => ({ date: d.date, value: d.resting_hr! }))}
            targetLow={50}
            targetHigh={70}
            targetLabel="Healthy Range"
          />
        </section>
      )}

      {/* AGP Chart for HRV */}
      {ouraData.filter(d => d.hrv_avg !== null).length >= 7 && (
        <section style={{ padding: "0 16px" }}>
          <AGPChart
            title="HRV Profile"
            unit="ms"
            data={ouraData
              .filter(d => d.hrv_avg !== null)
              .map(d => ({ date: d.date, value: d.hrv_avg! }))}
          />
        </section>
      )}

      {/* Correlation Cards */}
      <section style={{ padding: "0 16px" }}>
        <CorrelationCards correlations={correlations} />
      </section>

      {/* Medication Adherence */}
      <section style={{ padding: "0 16px" }}>
        <AdherenceDisplay />
      </section>

      <ScrollToTop />
    </div>
  );
}
