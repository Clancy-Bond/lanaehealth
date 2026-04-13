"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Image as ImageIcon, Beaker, Activity } from "lucide-react";
import type { DoctorPageData } from "@/app/doctor/page";
import type { LabResult } from "@/lib/types";

interface DataFindingsProps {
  data: DoctorPageData;
  lastAppointmentDate?: string | null;
}

// ── Types ──────────────────────────────────────────────────────────

interface LabTrendGroup {
  testName: string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  points: Array<{
    date: string;
    dateLabel: string;
    value: number;
    flag: string | null;
  }>;
}

// ── Helper: group labs by test name ────────────────────────────────

function groupLabsByTest(labs: LabResult[]): LabTrendGroup[] {
  const groups = new Map<string, LabResult[]>();

  for (const lab of labs) {
    const key = lab.test_name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(lab);
  }

  // Only return tests with 2+ data points (for trends)
  const result: LabTrendGroup[] = [];
  for (const [testName, entries] of groups) {
    if (entries.length < 2) continue;

    // Sort by date ascending
    entries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const first = entries[0];
    result.push({
      testName,
      unit: first.unit,
      refLow: first.reference_range_low,
      refHigh: first.reference_range_high,
      points: entries
        .filter((e) => e.value !== null)
        .map((e) => ({
          date: e.date,
          dateLabel: format(new Date(e.date + "T00:00:00"), "M/d/yy"),
          value: e.value!,
          flag: e.flag,
        })),
    });
  }

  return result;
}

// ── Priority test ordering ─────────────────────────────────────────
// Show ferritin first, then hs-CRP, then others by number of data points

const PRIORITY_TESTS = ["ferritin", "hs-crp", "crp", "hemoglobin", "iron"];

function prioritizeTests(groups: LabTrendGroup[]): LabTrendGroup[] {
  return groups.sort((a, b) => {
    const aPriority = PRIORITY_TESTS.findIndex((t) =>
      a.testName.toLowerCase().includes(t)
    );
    const bPriority = PRIORITY_TESTS.findIndex((t) =>
      b.testName.toLowerCase().includes(t)
    );

    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;

    // More data points = higher priority
    return b.points.length - a.points.length;
  });
}

// ── Custom tooltip for trend charts ────────────────────────────────

interface TooltipPayloadItem {
  value: number;
  payload: { dateLabel: string; flag: string | null };
}

function TrendTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  unit: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0];
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "8px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        fontSize: 13,
        zIndex: 10,
      }}
    >
      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>
        {data.value}
        {unit && (
          <span style={{ fontWeight: 400, color: "var(--text-secondary)", fontSize: 13 }}>
            {" "}{unit}
          </span>
        )}
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
        {data.payload.dateLabel}
        {data.payload.flag && data.payload.flag !== "normal" && (
          <span
            style={{
              marginLeft: 6,
              fontWeight: 700,
              textTransform: "uppercase",
              color:
                data.payload.flag === "critical"
                  ? "#DC2626"
                  : data.payload.flag === "high"
                  ? "#CA8A04"
                  : "#3B82F6",
            }}
          >
            {data.payload.flag}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Lab Trend Chart ────────────────────────────────────────────────

function LabTrendChart({ group }: { group: LabTrendGroup }) {
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

  const hasAbnormal = group.points.some(
    (p) => p.flag && p.flag !== "normal"
  );

  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--border-light)",
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
        <h4
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {group.testName}
          {hasAbnormal && (
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#D4605A",
                marginLeft: 6,
                verticalAlign: "middle",
              }}
            />
          )}
        </h4>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {group.points.length} values
          {group.unit && ` (${group.unit})`}
        </span>
      </div>

      <div ref={chartRef} style={{ width: "100%", height: 200 }}>
        {chartWidth > 0 && (
          <LineChart
            width={chartWidth}
            height={200}
            data={group.points}
            margin={{ top: 8, right: 12, bottom: 4, left: -4 }}
          >
            {/* Reference range as shaded area */}
            {group.refLow !== null && group.refHigh !== null && (
              <ReferenceArea
                y1={group.refLow}
                y2={group.refHigh}
                fill="var(--accent-sage)"
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            )}

            {/* Reference range boundary lines */}
            {group.refLow !== null && (
              <ReferenceLine
                y={group.refLow}
                stroke="var(--accent-sage)"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
            )}
            {group.refHigh !== null && (
              <ReferenceLine
                y={group.refHigh}
                stroke="var(--accent-sage)"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
            )}

            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={<TrendTooltip unit={group.unit} />}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={hasAbnormal ? "#D4605A" : "var(--accent-sage)"}
              strokeWidth={2.5}
              dot={{
                r: 5,
                fill: "var(--bg-card)",
                strokeWidth: 2.5,
              }}
              activeDot={{ r: 7 }}
              label={{
                position: "top",
                offset: 10,
                fontSize: 11,
                fontWeight: 600,
                fill: "var(--text-primary)",
              }}
            />
          </LineChart>
        )}
      </div>

      {/* Reference range label */}
      {group.refLow !== null && group.refHigh !== null && (
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            textAlign: "right",
            marginTop: 2,
          }}
        >
          Ref: {group.refLow} - {group.refHigh} {group.unit}
        </div>
      )}
    </div>
  );
}

// ── Confidence badge ───────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    suggestive: { bg: "rgba(107, 114, 128, 0.12)", color: "#6B7280" },
    moderate: { bg: "rgba(212, 160, 80, 0.12)", color: "#D4A050" },
    strong: { bg: "rgba(107, 144, 128, 0.12)", color: "var(--accent-sage)" },
  };
  const s = styles[level] ?? styles.suggestive;

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 4,
        background: s.bg,
        color: s.color,
        letterSpacing: "0.04em",
      }}
    >
      {level}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function DataFindings({ data, lastAppointmentDate }: DataFindingsProps) {
  const { allLabs, correlations, imagingStudies, timelineEvents } = data;

  // Group and prioritize lab trends
  const labTrends = useMemo(() => {
    const groups = groupLabsByTest(allLabs);
    return prioritizeTests(groups).slice(0, 6); // Show top 6 trend charts
  }, [allLabs]);

  // Compute changes since last appointment
  const recentChanges = useMemo(() => {
    if (!lastAppointmentDate) return null;

    const cutoff = lastAppointmentDate;

    const newLabs = allLabs.filter((l) => l.date > cutoff);
    const newImaging = imagingStudies.filter(
      (s) => s.study_date > cutoff
    );
    const newEvents = timelineEvents.filter(
      (e) => e.event_date > cutoff
    );

    // Deduplicate lab test names
    const labTestNames = [...new Set(newLabs.map((l) => l.test_name))];
    // Count abnormal labs
    const abnormalNew = newLabs.filter(
      (l) => l.flag && l.flag !== "normal"
    );

    const hasChanges =
      labTestNames.length > 0 ||
      newImaging.length > 0 ||
      newEvents.length > 0;

    if (!hasChanges) return null;

    return { labTestNames, abnormalNew, newImaging, newEvents, cutoff };
  }, [allLabs, imagingStudies, timelineEvents, lastAppointmentDate]);

  return (
    <section>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 4,
            height: 20,
            borderRadius: 2,
            background: "var(--accent-sage)",
            flexShrink: 0,
          }}
        />
        Data & Findings
      </h2>

      {/* Recent Changes Since Last Visit */}
      {recentChanges && (
        <div style={{ marginBottom: 20 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Activity size={16} />
            Changes Since Last Visit
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: "var(--text-muted)",
                marginLeft: 4,
              }}
            >
              (since{" "}
              {format(
                new Date(recentChanges.cutoff + "T00:00:00"),
                "MMM d, yyyy"
              )}
              )
            </span>
          </h3>

          <div
            className="card"
            style={{
              padding: "14px 16px",
              border: "1px solid var(--accent-sage)",
              background:
                "linear-gradient(135deg, rgba(107, 144, 128, 0.04) 0%, transparent 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* New lab results */}
              {recentChanges.labTestNames.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--accent-sage-muted)",
                      color: "var(--accent-sage)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Labs
                  </span>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                    {recentChanges.labTestNames.length} new result
                    {recentChanges.labTestNames.length !== 1 ? "s" : ""}
                    {recentChanges.abnormalNew.length > 0 && (
                      <span style={{ color: "#D4605A", fontWeight: 600 }}>
                        {" "}
                        ({recentChanges.abnormalNew.length} flagged)
                      </span>
                    )}
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      {recentChanges.labTestNames.slice(0, 5).join(", ")}
                      {recentChanges.labTestNames.length > 5 &&
                        ` +${recentChanges.labTestNames.length - 5} more`}
                    </div>
                  </div>
                </div>
              )}

              {/* New imaging */}
              {recentChanges.newImaging.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(6, 182, 212, 0.12)",
                      color: "#06B6D4",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Imaging
                  </span>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                    {recentChanges.newImaging.length} new stud
                    {recentChanges.newImaging.length !== 1 ? "ies" : "y"}
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      {recentChanges.newImaging
                        .map(
                          (s) =>
                            `${s.modality} - ${s.body_part} (${format(
                              new Date(s.study_date + "T00:00:00"),
                              "M/d"
                            )})`
                        )
                        .join(", ")}
                    </div>
                  </div>
                </div>
              )}

              {/* New timeline events */}
              {recentChanges.newEvents.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(249, 115, 22, 0.12)",
                      color: "#F97316",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Events
                  </span>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                    {recentChanges.newEvents.length} new event
                    {recentChanges.newEvents.length !== 1 ? "s" : ""}
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      {recentChanges.newEvents
                        .slice(0, 3)
                        .map((e) => e.title)
                        .join(", ")}
                      {recentChanges.newEvents.length > 3 &&
                        ` +${recentChanges.newEvents.length - 3} more`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lab Trends */}
      {labTrends.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <TrendingUp size={16} />
            Key Lab Trends
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {labTrends.map((group) => (
              <LabTrendChart key={group.testName} group={group} />
            ))}
          </div>
        </div>
      )}

      {/* Correlations */}
      <div style={{ marginBottom: 20 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Beaker size={16} />
          Correlations Found
        </h3>

        {correlations.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {correlations.map((c, i) => (
              <div
                key={i}
                className="card"
                style={{ padding: "12px 16px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {c.factorA} / {c.factorB}
                  </span>
                  <ConfidenceBadge level={c.confidenceLevel} />
                </div>
                {c.effectDescription && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {c.effectDescription}
                  </p>
                )}
                {c.sampleSize !== null && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      marginTop: 4,
                      display: "inline-block",
                    }}
                  >
                    n={c.sampleSize}
                    {c.coefficient !== null &&
                      ` | r=${c.coefficient.toFixed(2)}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: "16px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              No correlations found yet.
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--accent-sage)",
                margin: "6px 0 0",
              }}
            >
              Tap &apos;Analyze Patterns&apos; in Settings to discover correlations across your data
            </p>
          </div>
        )}
      </div>

      {/* Imaging Summary */}
      {imagingStudies.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ImageIcon size={16} />
            Imaging Studies
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {imagingStudies.map((study) => (
              <div
                key={study.id}
                className="card"
                style={{ padding: "12px 16px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {study.modality} - {study.body_part}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    {format(
                      new Date(study.study_date + "T00:00:00"),
                      "MMM d, yyyy"
                    )}
                  </span>
                </div>
                {study.indication && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginBottom: 4,
                      fontStyle: "italic",
                    }}
                  >
                    Indication: {study.indication}
                  </div>
                )}
                {study.findings_summary && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {study.findings_summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
