"use client";

import { useMemo } from "react";
import { FlaskConical, AlertTriangle } from "lucide-react";
import type { DoctorPageData } from "@/app/doctor/page";
import { findOutstanding, sortByUrgency } from "@/lib/doctor/outstanding-tests";
import type { SpecialistView } from "@/lib/doctor/specialist-config";

interface OutstandingTestsProps {
  data: DoctorPageData;
  view: SpecialistView;
}

function urgencyColor(u: "high" | "medium" | "low"): { bg: string; fg: string; label: string } {
  switch (u) {
    case "high":
      return { bg: "rgba(220, 38, 38, 0.12)", fg: "#DC2626", label: "Order today" };
    case "medium":
      return { bg: "rgba(234, 179, 8, 0.16)", fg: "#CA8A04", label: "Within weeks" };
    case "low":
      return { bg: "rgba(107, 114, 128, 0.12)", fg: "#6B7280", label: "When convenient" };
  }
}

export function OutstandingTests({ data, view }: OutstandingTestsProps) {
  const tests = useMemo(
    () => sortByUrgency(findOutstanding(data, view)).slice(0, 6),
    [data, view]
  );

  if (tests.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: "#CA8A04",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={18} style={{ color: "#CA8A04" }} />
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Outstanding workup
          </h2>
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            margin: "4px 0 0",
            lineHeight: 1.4,
          }}
        >
          Tests indicated by active hypotheses but not yet on file.
        </p>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: "0 16px 16px",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {tests.map((t, i) => {
          const c = urgencyColor(t.urgency);
          return (
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
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <FlaskConical size={14} style={{ color: c.fg, flexShrink: 0 }} />
                  <strong style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {t.testName}
                  </strong>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: c.bg,
                    color: c.fg,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {c.label}
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  margin: "0 0 4px",
                  fontStyle: "italic",
                }}
              >
                Clarifies: {t.clarifies}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {t.rationale}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
