"use client";

import { format } from "date-fns";
import type { DoctorPageData } from "@/app/doctor/page";

interface ExecutiveSummaryProps {
  data: DoctorPageData;
}

// ── Vitals color coding ────────────────────────────────────────────

type VitalStatus = "normal" | "borderline" | "abnormal";

function getVitalColor(status: VitalStatus): string {
  switch (status) {
    case "normal":
      return "var(--accent-sage)";
    case "borderline":
      return "#D4A050";
    case "abnormal":
      return "#D4605A";
  }
}

function getVitalBg(status: VitalStatus): string {
  switch (status) {
    case "normal":
      return "rgba(107, 144, 128, 0.1)";
    case "borderline":
      return "rgba(212, 160, 80, 0.1)";
    case "abnormal":
      return "rgba(212, 96, 90, 0.1)";
  }
}

function classifyHRV(val: number): VitalStatus {
  if (val >= 30 && val <= 100) return "normal";
  if (val >= 20 || val <= 120) return "borderline";
  return "abnormal";
}

function classifyRestingHR(val: number): VitalStatus {
  if (val >= 50 && val <= 75) return "normal";
  if (val >= 45 && val <= 85) return "borderline";
  return "abnormal";
}

function classifySleep(val: number): VitalStatus {
  if (val >= 70) return "normal";
  if (val >= 55) return "borderline";
  return "abnormal";
}

function classifyTemp(val: number): VitalStatus {
  if (Math.abs(val) <= 0.5) return "normal";
  if (Math.abs(val) <= 1.0) return "borderline";
  return "abnormal";
}

function classifyReadiness(val: number): VitalStatus {
  if (val >= 70) return "normal";
  if (val >= 55) return "borderline";
  return "abnormal";
}

// ── Subsection helper ──────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--text-muted)",
        margin: "16px 0 8px",
        paddingBottom: 4,
        borderBottom: "1px solid var(--border-light)",
      }}
    >
      {children}
    </h3>
  );
}

// ── Flag badge for lab results ─────────────────────────────────────

function LabFlagBadge({ flag }: { flag: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    low: { bg: "rgba(59, 130, 246, 0.12)", color: "#3B82F6" },
    high: { bg: "rgba(234, 179, 8, 0.12)", color: "#CA8A04" },
    critical: { bg: "rgba(220, 38, 38, 0.12)", color: "#DC2626" },
  };
  const style = colors[flag] ?? { bg: "rgba(107, 114, 128, 0.12)", color: "#6B7280" };

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "2px 6px",
        borderRadius: 4,
        background: style.bg,
        color: style.color,
        letterSpacing: "0.04em",
      }}
    >
      {flag}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────

export function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const {
    patient,
    activeProblems,
    confirmedDiagnoses,
    suspectedConditions,
    medications,
    supplements,
    allergies,
    latestVitals,
    abnormalLabs,
    cycleStatus,
  } = data;

  // Sex abbreviation
  const sexAbbr = patient.sex.charAt(0).toUpperCase();

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
        Executive Summary
      </h2>

      <div className="card" style={{ padding: "20px" }}>
        {/* Patient Header */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 24px",
            alignItems: "baseline",
            paddingBottom: 12,
            borderBottom: "1px solid var(--border-light)",
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {patient.name}
          </span>
          <span
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            {patient.age}{sexAbbr}
          </span>
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Blood Type: {patient.bloodType}
          </span>
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {patient.heightCm}cm / {patient.weightKg}kg
          </span>
        </div>

        {/* Confirmed Diagnoses */}
        {confirmedDiagnoses.length > 0 && (
          <>
            <SectionLabel>Confirmed Diagnoses</SectionLabel>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {confirmedDiagnoses.map((d, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 14,
                    color: "var(--text-primary)",
                    lineHeight: 1.5,
                    marginBottom: 2,
                  }}
                >
                  {d}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Suspected Conditions */}
        {suspectedConditions.length > 0 && (
          <>
            <SectionLabel>Under Investigation</SectionLabel>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {suspectedConditions.map((s, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    fontStyle: "italic",
                    marginBottom: 2,
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Presenting Complaints / Active Problems */}
        <SectionLabel>Presenting Complaints</SectionLabel>
        {activeProblems.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {activeProblems.map((p, i) => (
              <li
                key={i}
                style={{
                  fontSize: 14,
                  color: "var(--text-primary)",
                  lineHeight: 1.6,
                  marginBottom: 4,
                }}
              >
                <strong>{p.problem}</strong>{" "}
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  [{p.status}]
                </span>
                {p.latestData && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      marginTop: 1,
                    }}
                  >
                    {p.latestData}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            No active problems documented
          </p>
        )}

        {/* Current Medications */}
        <SectionLabel>Current Medications</SectionLabel>
        {medications.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {medications.map((m, i) => (
              <li
                key={i}
                style={{
                  fontSize: 14,
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                  marginBottom: 2,
                }}
              >
                {m.name}
                {m.dose && (
                  <span style={{ color: "var(--text-secondary)" }}>
                    {" "}{m.dose}
                  </span>
                )}
                {m.frequency && (
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {" "}({m.frequency})
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            None documented
          </p>
        )}

        {/* Supplements */}
        <SectionLabel>Supplements</SectionLabel>
        {supplements.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {supplements.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 12,
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                }}
              >
                {s.name}
                {s.dose && (
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}{s.dose}
                  </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            None documented
          </p>
        )}

        {/* Allergies */}
        <SectionLabel>Allergies</SectionLabel>
        <p
          style={{
            fontSize: 14,
            color:
              allergies.length > 0
                ? "var(--text-primary)"
                : "var(--text-muted)",
            margin: 0,
            fontWeight: allergies.length > 0 ? 600 : 400,
          }}
        >
          {allergies.length > 0
            ? allergies.join(", ")
            : "None documented (NKDA)"}
        </p>

        {/* Latest Vitals */}
        <SectionLabel>
          Latest Vitals
          {latestVitals.date && (
            <span
              style={{
                fontWeight: 400,
                textTransform: "none" as const,
                letterSpacing: "0",
                marginLeft: 8,
                fontSize: 11,
              }}
            >
              ({format(new Date(latestVitals.date + "T00:00:00"), "MMM d, yyyy")})
            </span>
          )}
        </SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 8,
          }}
        >
          {(
            [
              {
                label: "HRV",
                value: latestVitals.hrvAvg,
                unit: "ms",
                classify: classifyHRV,
              },
              {
                label: "Resting HR",
                value: latestVitals.restingHr,
                unit: "bpm",
                classify: classifyRestingHR,
              },
              {
                label: "Sleep Score",
                value: latestVitals.sleepScore,
                unit: "",
                classify: classifySleep,
              },
              {
                label: "Temp Dev.",
                value: latestVitals.tempDeviation,
                unit: "\u00B0C",
                classify: classifyTemp,
                fmt: (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
              },
              {
                label: "Readiness",
                value: latestVitals.readinessScore,
                unit: "",
                classify: classifyReadiness,
              },
            ] as const
          ).map((vital) => {
            if (vital.value === null) return null;
            const status = vital.classify(vital.value);
            const displayVal = "fmt" in vital && vital.fmt
              ? vital.fmt(vital.value)
              : String(Math.round(vital.value));
            return (
              <div
                key={vital.label}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: getVitalBg(status),
                  border: `1px solid ${getVitalColor(status)}20`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  {vital.label}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: getVitalColor(status),
                    lineHeight: 1,
                  }}
                >
                  {displayVal}
                  <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>
                    {vital.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Abnormal Labs */}
        <SectionLabel>Recent Abnormal Labs</SectionLabel>
        {abnormalLabs.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                fontSize: 13,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    textAlign: "left",
                  }}
                >
                  <th
                    style={{
                      padding: "4px 8px 4px 0",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    Test
                  </th>
                  <th
                    style={{
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      textAlign: "right",
                    }}
                  >
                    Value
                  </th>
                  <th
                    style={{
                      padding: "4px 0 4px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    Flag
                  </th>
                </tr>
              </thead>
              <tbody>
                {abnormalLabs.slice(0, 12).map((lab) => (
                  <tr
                    key={lab.id}
                    style={{
                      borderBottom: "1px solid var(--border-light)",
                    }}
                  >
                    <td
                      style={{
                        padding: "6px 8px 6px 0",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {format(new Date(lab.date + "T00:00:00"), "M/d/yy")}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {lab.test_name}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {lab.value !== null ? lab.value : "--"}
                      {lab.unit && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            fontWeight: 400,
                            marginLeft: 3,
                          }}
                        >
                          {lab.unit}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "6px 0 6px 8px" }}>
                      <LabFlagBadge flag={lab.flag ?? "normal"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {abnormalLabs.length > 12 && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 4,
                  textAlign: "right",
                }}
              >
                +{abnormalLabs.length - 12} more abnormal results
              </p>
            )}
          </div>
        ) : (
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            All recent labs within normal range
          </p>
        )}

        {/* Menstrual / Cycle Status */}
        <SectionLabel>Menstrual / Cycle Status</SectionLabel>
        <div
          style={{
            background: "rgba(212, 96, 90, 0.06)",
            border: "1px solid rgba(212, 96, 90, 0.18)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          {/* Top row: phase, last period, cycle length, period length, regularity */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 3 }}>
                Current Phase
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                {cycleStatus.currentPhase ?? "Unknown"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 3 }}>
                Last Period
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {cycleStatus.lastPeriodDate
                  ? format(new Date(cycleStatus.lastPeriodDate + "T00:00:00"), "MMM d, yyyy")
                  : "Not recorded"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 3 }}>
                Avg Cycle Length
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {cycleStatus.averageCycleLength
                  ? `${cycleStatus.averageCycleLength} days`
                  : "Not calculated"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 3 }}>
                Period Length
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {cycleStatus.periodLengthDays
                  ? `${cycleStatus.periodLengthDays} days`
                  : "Not recorded"}
              </div>
            </div>
            {cycleStatus.regularity && (
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, marginBottom: 3 }}>
                  Regularity
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {cycleStatus.regularity}
                </div>
              </div>
            )}
          </div>

          {/* Detailed menstrual data rows */}
          {(cycleStatus.flow || cycleStatus.clots || cycleStatus.ironLossPerCycle || cycleStatus.padChangesHeavyDay || cycleStatus.pain) && (
            <div
              style={{
                borderTop: "1px solid rgba(212, 96, 90, 0.12)",
                paddingTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {cycleStatus.flow && (
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500, marginRight: 6 }}>Flow:</span>
                  <span style={{ color: "#D4605A", fontWeight: 600 }}>{cycleStatus.flow}</span>
                </div>
              )}
              {cycleStatus.padChangesHeavyDay && (
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500, marginRight: 6 }}>
                    Pad changes (worst day):
                  </span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {cycleStatus.padChangesHeavyDay} per day
                  </span>
                </div>
              )}
              {cycleStatus.clots && (
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500, marginRight: 6 }}>Clots:</span>
                  <span style={{ color: "#D4605A", fontWeight: 600 }}>{cycleStatus.clots}</span>
                </div>
              )}
              {cycleStatus.ironLossPerCycle && (
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500, marginRight: 6 }}>
                    Est. iron loss per cycle:
                  </span>
                  <span style={{ color: "#D4605A", fontWeight: 600 }}>{cycleStatus.ironLossPerCycle}</span>
                </div>
              )}
              {cycleStatus.pain && (
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500, marginRight: 6 }}>Pain:</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{cycleStatus.pain}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
