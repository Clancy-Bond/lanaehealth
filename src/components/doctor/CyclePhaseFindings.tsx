"use client";

import { Repeat } from "lucide-react";
import type { CyclePhaseFinding } from "@/lib/doctor/cycle-phase-correlation";

interface CyclePhaseFindingsProps {
  findings: CyclePhaseFinding[];
}

function phaseColor(phase: string): string {
  switch (phase) {
    case "menstrual":
      return "var(--phase-menstrual)";
    case "follicular":
      return "var(--phase-follicular)";
    case "ovulatory":
      return "var(--phase-ovulatory)";
    case "luteal":
      return "var(--phase-luteal)";
    default:
      return "var(--text-muted)";
  }
}

export function CyclePhaseFindings({ findings }: CyclePhaseFindingsProps) {
  const noteworthy = findings.filter((f) => f.noteworthy);
  if (noteworthy.length === 0) return null;

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
        <Repeat size={16} style={{ color: "var(--phase-luteal)" }} />
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Cycle-phase patterns
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
        Symptoms that concentrate in one menstrual phase point to catamenial etiology.
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {noteworthy.map((f, i) => (
          <li
            key={i}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border-light)",
              background: "var(--bg-primary)",
              pageBreakInside: "avoid",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <strong style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {f.metric}
              </strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: phaseColor(f.dominantPhase) + "22",
                  color: phaseColor(f.dominantPhase),
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Worst in {f.dominantPhase}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              +{Math.round(f.relativeIncrease)}% above other phases. Means:{" "}
              <span className="tabular">
                {Object.entries(f.phaseAverages)
                  .filter(([, v]) => v.mean !== null)
                  .map(
                    ([p, v]) =>
                      `${p.slice(0, 3)}: ${(v.mean as number).toFixed(1)} (n=${v.n})`
                  )
                  .join(" | ")}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
