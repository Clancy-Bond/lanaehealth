import Link from "next/link";
import { createServiceClient } from "@/lib/supabase";
import { buildCycleReport } from "@/lib/reports/cycle-report";
import CycleReportPrintActions from "./print-actions";

// Always fetch fresh data; this powers an OB/GYN visit.
export const dynamic = "force-dynamic";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const SHORT_LUTEAL_DAYS = 10;

export default async function CycleReportPage() {
  const sb = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const report = await buildCycleReport(sb, today);

  const {
    patient,
    cycleLength,
    luteal,
    periodPattern,
    recentSymptomsByPhase,
    painByPhase,
    recentChanges,
    medications,
    supplements,
    nextAppointment,
    flags,
    notes,
  } = report;

  const flowOrder = ["SPOTTING", "LIGHT", "MEDIUM", "HEAVY", "UNKNOWN"];
  const flowEntries = flowOrder
    .filter((k) => (periodPattern.flowBreakdown[k] ?? 0) > 0)
    .map((k) => [k, periodPattern.flowBreakdown[k]] as const);

  // Questions Lanae may want to raise. Neutral, non-leading phrasing.
  const questions = [
    "Given my cycle history and heavy flow, what is the next step in evaluating for endometriosis?",
    "Are there labs or imaging you would like to order today (pelvic ultrasound, AMH, FSH/LH, CA-125)?",
    "How would you like me to track pain patterns and bleeding between now and my follow-up?",
    "Are any of my current medications or supplements worth adjusting given cycle symptoms?",
    "If the pain escalates before our follow-up, when should I contact your office?",
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <div className="cycle-report" style={{
        maxWidth: 820, margin: "0 auto", padding: "24px 20px 80px",
      }}>
        <header className="no-print" style={{ marginBottom: 24 }}>
          <Link
            href="/doctor"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            &larr; Back to Doctor Mode
          </Link>
        </header>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "28px 28px 32px",
          }}
        >
          {/* Print header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              borderBottom: "1px solid var(--border)",
              paddingBottom: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Cycle Health Report
              </h1>
              <p
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-secondary)",
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                {patient.name}
                {patient.age != null ? `, age ${patient.age}` : ""}
                {patient.sex ? `, ${patient.sex}` : ""}
              </p>
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  marginTop: 2,
                  marginBottom: 0,
                }}
              >
                Generated {formatDate(today)}
                {nextAppointment?.date
                  ? ` for visit on ${formatDate(nextAppointment.date)}${nextAppointment.specialty ? ` (${nextAppointment.specialty})` : ""}`
                  : ""}
              </p>
            </div>
            <CycleReportPrintActions />
          </div>

          {/* Flags banner (print-safe) */}
          {(flags.shortLuteal || flags.irregularCycles || flags.heavyFlow) && (
            <section style={{
              borderRadius: "var(--radius-md)",
              background: "var(--accent-blush-muted)",
              border: "1px solid var(--accent-blush-light)",
              padding: "12px 14px",
              marginBottom: 24,
            }}>
              <p style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                color: "var(--text-primary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: 0,
              }}>
                Items to discuss
              </p>
              <ul style={{
                margin: "6px 0 0 18px",
                padding: 0,
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
                lineHeight: 1.6,
              }}>
                {flags.shortLuteal && (
                  <li>
                    One or more of the last 6 cycles had an estimated luteal
                    phase under {SHORT_LUTEAL_DAYS} days. May be worth
                    discussing with your provider.
                  </li>
                )}
                {flags.irregularCycles && (
                  <li>
                    Cycle length variability is above typical for your history.
                  </li>
                )}
                {flags.heavyFlow && (
                  <li>
                    Heavy-flow days documented in recent cycles. Iron status
                    and period-management options may be worth discussing.
                  </li>
                )}
              </ul>
            </section>
          )}

          {/* Section: Cycle length */}
          <Section title="Cycle length history" subtitle="Last 12 complete cycles from your Natural Cycles record.">
            {cycleLength.n === 0 ? (
              <EmptyNote>Not enough cycle data yet.</EmptyNote>
            ) : (
              <>
                <StatRow>
                  <Stat label="Average" value={`${cycleLength.avgLength} days`} />
                  <Stat label="Range" value={`${cycleLength.minLength} to ${cycleLength.maxLength} days`} />
                  <Stat label="Variability (SD)" value={`${cycleLength.sdLength} days`} />
                  <Stat label="Count" value={`${cycleLength.n} cycles`} />
                </StatRow>
                <Regularity flag={cycleLength.regularityFlag} />
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="cr-table">
                    <thead>
                      <tr>
                        <th>Cycle #</th>
                        <th>Started</th>
                        <th>Length (days)</th>
                        <th>Period (days)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cycleLength.cycles.slice().reverse().map((c, i) => (
                        <tr key={i}>
                          <td>{c.cycleNumber ?? "\u2014"}</td>
                          <td>{formatDate(c.startDate)}</td>
                          <td>{c.length}</td>
                          <td>{c.periodDays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>

          {/* Section: Luteal */}
          <Section title="Luteal phase" subtitle="Estimated days between ovulation and next period. A short luteal phase may be worth discussing.">
            {luteal.segments.length === 0 ? (
              <EmptyNote>Not enough cycle data yet.</EmptyNote>
            ) : (
              <>
                <StatRow>
                  <Stat
                    label="Average luteal length"
                    value={
                      luteal.avgLutealDays != null
                        ? `${luteal.avgLutealDays} days`
                        : "\u2014"
                    }
                  />
                  <Stat
                    label="Short-luteal flags"
                    value={
                      luteal.shortLutealCount > 0
                        ? `${luteal.shortLutealCount} cycle${luteal.shortLutealCount === 1 ? "" : "s"}`
                        : "None"
                    }
                  />
                </StatRow>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="cr-table">
                    <thead>
                      <tr>
                        <th>Cycle #</th>
                        <th>Started</th>
                        <th>Ovulation day</th>
                        <th>Luteal days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {luteal.segments.slice().reverse().map((s, i) => (
                        <tr key={i}>
                          <td>{s.cycleNumber ?? "\u2014"}</td>
                          <td>{formatDate(s.startDate)}</td>
                          <td>{s.ovulationDay ?? "not detected"}</td>
                          <td
                            style={
                              s.lutealDays != null && s.lutealDays < SHORT_LUTEAL_DAYS
                                ? {
                                    color: "var(--pain-severe)",
                                    fontWeight: 600,
                                  }
                                : undefined
                            }
                          >
                            {s.lutealDays ?? "estimated from cycle length"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Section>

          {/* Section: Period pattern */}
          <Section title="Period pattern" subtitle="Flow distribution across the last 6 cycles.">
            {periodPattern.avgPeriodDays == null ? (
              <EmptyNote>Not enough period data yet.</EmptyNote>
            ) : (
              <>
                <StatRow>
                  <Stat
                    label="Average period length"
                    value={`${periodPattern.avgPeriodDays} days`}
                  />
                  <Stat
                    label="Clots reported (last year)"
                    value={periodPattern.clotsReported ? "Yes" : "No logged entries"}
                  />
                </StatRow>
                {flowEntries.length > 0 ? (
                  <ul style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "8px 0 0 0",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 6,
                  }}>
                    {flowEntries.map(([label, count]) => (
                      <li key={label} style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--text-secondary)",
                      }}>
                        <strong style={{ color: "var(--text-primary)" }}>
                          {label.charAt(0) + label.slice(1).toLowerCase()}
                        </strong>
                        : {count} day{count === 1 ? "" : "s"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </Section>

          {/* Section: Symptoms by phase */}
          <Section title="Top symptoms by cycle phase" subtitle="From logged symptoms across the last 6 cycles.">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}>
              {(["menstrual", "follicular", "ovulatory", "luteal"] as const).map((phase) => {
                const list = recentSymptomsByPhase[phase] ?? [];
                return (
                  <div key={phase} style={{
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                  }}>
                    <p style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: phaseColor(phase),
                      margin: 0,
                      marginBottom: 6,
                      letterSpacing: "0.05em",
                    }}>
                      {phase}
                    </p>
                    {list.length === 0 ? (
                      <p style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-muted)",
                        margin: 0,
                      }}>
                        No symptoms logged.
                      </p>
                    ) : (
                      <ul style={{
                        margin: 0,
                        paddingLeft: 16,
                        fontSize: "var(--text-sm)",
                        color: "var(--text-primary)",
                        lineHeight: 1.5,
                      }}>
                        {list.map((s) => (
                          <li key={s.symptom}>
                            {s.symptom}
                            <span style={{ color: "var(--text-muted)" }}>
                              {" "}
                              ({s.count}x
                              {s.maxSeverity ? `, max ${s.maxSeverity}` : ""})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Section: Pain by phase */}
          <Section title="Pain pattern by cycle phase" subtitle="Average logged pain score (0-10) per phase, last 6 cycles.">
            <StatRow>
              {(["menstrual", "follicular", "ovulatory", "luteal"] as const).map((phase) => {
                const row = painByPhase[phase];
                return (
                  <Stat
                    key={phase}
                    label={phase[0].toUpperCase() + phase.slice(1)}
                    value={
                      row?.avg != null
                        ? `${row.avg} (n=${row.count})`
                        : "Not logged"
                    }
                  />
                );
              })}
            </StatRow>
          </Section>

          {/* Section: Recent changes */}
          <Section title="Recent changes" subtitle="Important events from your medical timeline, last 3 months.">
            {recentChanges.length === 0 ? (
              <EmptyNote>No significant events logged.</EmptyNote>
            ) : (
              <ul style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: "var(--text-sm)",
                color: "var(--text-primary)",
                lineHeight: 1.6,
              }}>
                {recentChanges.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </Section>

          {/* Section: Medications */}
          <Section title="Medications and supplements">
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}>
              <div>
                <p style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  margin: "0 0 6px 0",
                  letterSpacing: "0.05em",
                }}>
                  Medications
                </p>
                {medications.length === 0 ? (
                  <EmptyNote>No medications on record.</EmptyNote>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
                    {medications.map((m, i) => (
                      <li key={i}>
                        {m.name}
                        {m.dose ? ` (${m.dose})` : ""}
                        {m.indication ? (
                          <span style={{ color: "var(--text-muted)" }}>
                            {" "}
                            for {m.indication}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  margin: "0 0 6px 0",
                  letterSpacing: "0.05em",
                }}>
                  Supplements
                </p>
                {supplements.length === 0 ? (
                  <EmptyNote>No supplements on record.</EmptyNote>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
                    {supplements.map((s, i) => (
                      <li key={i}>
                        {s.name}
                        {s.dose ? ` (${s.dose})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* Section: Questions */}
          <Section title="Questions for your OB/GYN" subtitle="Neutral prompts. Check the ones you want to raise.">
            <ul style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              fontSize: "var(--text-sm)",
              color: "var(--text-primary)",
              lineHeight: 1.7,
            }}>
              {questions.map((q) => (
                <li key={q} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      border: "1.5px solid var(--border)",
                      borderRadius: 3,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </Section>

          {notes.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <p style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                lineHeight: 1.5,
                fontStyle: "italic",
                margin: 0,
              }}>
                {notes.join(" ")}
              </p>
            </section>
          )}
        </div>
      </div>

      <style>{`
        .cr-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: var(--text-sm);
        }
        .cr-table th {
          text-align: left;
          font-weight: 600;
          color: var(--text-secondary);
          padding: 6px 8px;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .cr-table td {
          padding: 6px 8px;
          border-bottom: 1px solid var(--border-light);
          color: var(--text-primary);
        }
        @media print {
          @page { margin: 14mm; }
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          nav[aria-label="Main navigation"] { display: none !important; }
          .cycle-report { padding: 0 !important; max-width: none !important; }
          .cycle-report > div {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
          section, table, tr { page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
        }
      `}</style>
    </div>
  );
}

// ── Small presentational helpers (server-safe) ─────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2
        style={{
          fontSize: "var(--text-lg)",
          fontWeight: 700,
          color: "var(--text-primary)",
          margin: 0,
          marginBottom: 4,
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          margin: 0,
          marginBottom: 10,
        }}>
          {subtitle}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 10px",
      }}
    >
      <p style={{
        fontSize: "var(--text-xs)",
        color: "var(--text-muted)",
        margin: 0,
        marginBottom: 2,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: "var(--text-base)",
        fontWeight: 600,
        color: "var(--text-primary)",
        margin: 0,
      }}>
        {value}
      </p>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: "var(--text-sm)",
      color: "var(--text-muted)",
      fontStyle: "italic",
      margin: 0,
    }}>
      {children}
    </p>
  );
}

function Regularity({
  flag,
}: {
  flag: "regular" | "slightly_irregular" | "irregular" | "insufficient_data";
}) {
  const label =
    flag === "regular"
      ? "Regular"
      : flag === "slightly_irregular"
        ? "Slightly variable"
        : flag === "irregular"
          ? "Variable"
          : "Not enough data";
  return (
    <p style={{
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      margin: "4px 0 0 0",
    }}>
      Regularity: <strong style={{ color: "var(--text-primary)" }}>{label}</strong>
    </p>
  );
}

function phaseColor(phase: "menstrual" | "follicular" | "ovulatory" | "luteal"): string {
  switch (phase) {
    case "menstrual":
      return "var(--phase-menstrual)";
    case "follicular":
      return "var(--phase-follicular)";
    case "ovulatory":
      return "var(--phase-ovulatory)";
    case "luteal":
      return "var(--phase-luteal)";
  }
}
