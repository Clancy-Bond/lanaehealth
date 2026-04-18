"use client";

import { Clock, AlertOctagon } from "lucide-react";
import { format } from "date-fns";
import type { StaleTest } from "@/lib/doctor/stale-tests";

interface StaleTestsPanelProps {
  tests: StaleTest[];
}

function severityStyle(s: StaleTest["severity"]): { bg: string; fg: string; label: string } {
  // Warm-modern palette: blush carries the "needs attention" weight without
  // the shouty red the contract forbids on user dashboards (Rule 5 + 7).
  switch (s) {
    case "urgent":
      return {
        bg: "var(--accent-blush-muted)",
        fg: "var(--text-primary)",
        label: "Urgent",
      };
    case "overdue":
      return {
        bg: "var(--accent-blush-muted)",
        fg: "var(--text-secondary)",
        label: "Overdue",
      };
    case "watch":
      return {
        bg: "var(--bg-elevated)",
        fg: "var(--text-secondary)",
        label: "Watch",
      };
  }
}

export function StaleTestsPanel({ tests }: StaleTestsPanelProps) {
  if (tests.length === 0) return null;

  const urgent = tests.filter((t) => t.severity === "urgent").length;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        borderLeftWidth: 2,
        borderLeftStyle: "solid",
        borderLeftColor: "var(--accent-blush)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {urgent > 0 ? (
            <AlertOctagon size={18} style={{ color: "var(--accent-blush)" }} />
          ) : (
            <Clock size={18} style={{ color: "var(--text-secondary)" }} />
          )}
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Pending tests not yet resulted
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
          Ordered more than a week ago with no matching result on file. Chase the lab or the ordering clinician.
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
        {tests.map((t) => {
          const s = severityStyle(t.severity);
          return (
            <li
              key={t.timelineEventId + "-" + t.testName}
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
                <strong
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1.35,
                  }}
                >
                  {t.testName}
                </strong>
                <span
                  className="tabular"
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: s.bg,
                    color: s.fg,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {t.daysPending}d · {s.label}
                </span>
              </div>
              <div
                className="tabular"
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                  marginBottom: 4,
                }}
              >
                Ordered {format(new Date(t.orderedOn + "T00:00:00"), "MMM d, yyyy")}
                {t.orderedBy ? ` by ${t.orderedBy}` : ""}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                {t.source}
              </div>
              <div
                className="cite"
                style={{
                  fontSize: 9,
                  color: "var(--text-muted)",
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
                title={`medical_timeline.id=${t.timelineEventId}`}
              >
                medical_timeline.id={t.timelineEventId.slice(0, 8)}...
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
