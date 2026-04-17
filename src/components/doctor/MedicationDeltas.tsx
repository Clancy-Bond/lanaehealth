"use client";

import { useMemo } from "react";
import { Pill, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import type { MedicationDelta } from "@/lib/doctor/medication-deltas";

interface MedicationDeltasProps {
  deltas: MedicationDelta[];
}

function directionIcon(d: string) {
  if (d === "worsened") return <TrendingUp size={12} style={{ color: "#DC2626" }} />;
  if (d === "improved") return <TrendingDown size={12} style={{ color: "var(--accent-sage)" }} />;
  if (d === "stable") return <Minus size={12} style={{ color: "var(--text-muted)" }} />;
  return null;
}

function directionColor(d: string): string {
  if (d === "worsened") return "#DC2626";
  if (d === "improved") return "var(--accent-sage)";
  if (d === "stable") return "var(--text-muted)";
  return "var(--text-muted)";
}

export function MedicationDeltas({ deltas }: MedicationDeltasProps) {
  const withFindings = useMemo(
    () =>
      deltas.filter((d) =>
        d.metrics.some((m) => m.noteworthy || (m.direction !== "insufficient" && m.direction !== "stable"))
      ),
    [deltas]
  );

  if (withFindings.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        padding: "14px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Pill size={16} style={{ color: "#8B5CF6" }} />
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Medication-delta correlations
        </h3>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          margin: "0 0 10px",
          lineHeight: 1.4,
        }}
      >
        14 days before vs 14 days after each medication change. Bold = noteworthy shift.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {withFindings.map((d, i) => (
          <div
            key={i}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border-light)",
              background: "var(--bg-primary)",
              pageBreakInside: "avoid",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
              {d.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
              {format(new Date(d.eventDate + "T00:00:00"), "MMM d, yyyy")}{" "}
              (window: {format(new Date(d.windowBeforeStart + "T00:00:00"), "M/d")} -{" "}
              {format(new Date(d.windowAfterEnd + "T00:00:00"), "M/d")})
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {d.metrics
                .filter((m) => m.direction !== "insufficient")
                .map((m, j) => (
                  <li
                    key={j}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: m.noteworthy ? 700 : 400,
                        color: m.noteworthy ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {m.metric}
                    </span>
                    <span
                      className="tabular"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: directionColor(m.direction),
                        fontWeight: m.noteworthy ? 700 : 500,
                      }}
                    >
                      {directionIcon(m.direction)}
                      {m.beforeMean !== null ? m.beforeMean.toFixed(1) : "n/a"}
                      {" → "}
                      {m.afterMean !== null ? m.afterMean.toFixed(1) : "n/a"}
                      {m.delta !== null && (
                        <span>
                          {" "}({m.delta > 0 ? "+" : ""}
                          {m.delta.toFixed(1)})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
