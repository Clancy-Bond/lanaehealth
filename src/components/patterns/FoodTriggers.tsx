"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import type { FoodEntry } from "@/lib/types";
import type { TimeRange } from "./PatternsClient";

interface FoodTriggersProps {
  foodEntries: FoodEntry[];
  timeRange: TimeRange;
}

interface TriggerCount {
  trigger: string;
  count: number;
  percentage: number;
  color: string;
}

const TRIGGER_COLORS: Record<string, string> = {
  dairy: "#5B9BD5",
  gluten: "#E8A849",
  sugar: "#E8506A",
  caffeine: "#8B5CF6",
  alcohol: "#DC2626",
  soy: "#6B9080",
  spicy: "#F97316",
  processed: "#9CA3AF",
  fried: "#D97706",
  nightshade: "#06B6D4",
};

function getColorForTrigger(trigger: string): string {
  const key = trigger.toLowerCase();
  for (const [pattern, color] of Object.entries(TRIGGER_COLORS)) {
    if (key.includes(pattern)) return color;
  }
  // Default sage gradient
  return "var(--accent-sage)";
}

function TriggerTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TriggerCount }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E5DC",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "0 4px 12px rgba(26, 26, 46, 0.08)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, color: "#1A1A2E" }}>
        {data.trigger}
      </div>
      <div style={{ color: "#6B7280", marginTop: 2 }}>
        {data.count} {data.count === 1 ? "time" : "times"} ({data.percentage}% of
        meals)
      </div>
    </div>
  );
}

export function FoodTriggers({ foodEntries, timeRange }: FoodTriggersProps) {
  // Measure parent width after mount instead of ResponsiveContainer
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

  const totalMeals = foodEntries.length;

  // Count trigger frequency
  const triggerData = useMemo((): TriggerCount[] => {
    const counts = new Map<string, number>();

    for (const entry of foodEntries) {
      if (entry.flagged_triggers && Array.isArray(entry.flagged_triggers)) {
        for (const trigger of entry.flagged_triggers) {
          if (trigger && trigger.trim()) {
            const normalized = trigger.trim();
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
          }
        }
      }
    }

    return Array.from(counts.entries())
      .map(([trigger, count]) => ({
        trigger,
        count,
        percentage: totalMeals > 0 ? Math.round((count / totalMeals) * 100) : 0,
        color: getColorForTrigger(trigger),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [foodEntries, totalMeals]);

  // Recent meals with triggers
  const recentTriggerMeals = useMemo(() => {
    return foodEntries
      .filter(
        (e) =>
          e.flagged_triggers &&
          Array.isArray(e.flagged_triggers) &&
          e.flagged_triggers.length > 0
      )
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
      .slice(0, 3);
  }, [foodEntries]);

  const rangeLabel =
    timeRange === "7d" ? "7 days" : timeRange === "30d" ? "30 days" : "90 days";

  if (triggerData.length === 0) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 8px 0",
          }}
        >
          Food Triggers
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {totalMeals === 0
            ? `No food entries logged in the last ${rangeLabel}`
            : "No flagged triggers found in recent meals"}
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Food Triggers
        </h2>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {totalMeals} meals in {rangeLabel}
        </span>
      </div>

      {/* Horizontal bar chart - measured width, no ResponsiveContainer */}
      <div ref={chartRef} style={{ width: "100%", height: triggerData.length * 36 + 20 }}>
        {chartWidth > 0 && (
          <BarChart
            width={chartWidth}
            height={triggerData.length * 36 + 20}
            data={triggerData}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="trigger"
              width={80}
              tick={{ fontSize: 12, fill: "#6B7280" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<TriggerTooltipContent />} cursor={false} />
            <Bar
              dataKey="count"
              radius={[0, 6, 6, 0]}
              barSize={18}
            >
              {triggerData.map((entry, index) => (
                <Cell key={index} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        )}
      </div>

      {/* Recent trigger meals */}
      {recentTriggerMeals.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              margin: "0 0 8px 0",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Recent Trigger Meals
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentTriggerMeals.map((meal) => {
              const dateStr = (() => {
                try {
                  const d = new Date(meal.logged_at);
                  return d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                } catch {
                  return "";
                }
              })();
              return (
                <div
                  key={meal.id}
                  style={{
                    background: "var(--bg-elevated)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {meal.meal_type || "Meal"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                      }}
                    >
                      {dateStr}
                    </span>
                  </div>
                  {meal.food_items && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginBottom: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      {meal.food_items.length > 80
                        ? meal.food_items.slice(0, 80) + "..."
                        : meal.food_items}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {meal.flagged_triggers.map((t, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: `${getColorForTrigger(t)}18`,
                          color: getColorForTrigger(t),
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
