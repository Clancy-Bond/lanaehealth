"use client";

import { Info } from "lucide-react";
import type { CompletenessReport } from "@/lib/doctor/completeness";

interface CompletenessFooterProps {
  report: CompletenessReport;
}

export function CompletenessFooter({ report }: CompletenessFooterProps) {
  if (report.warnings.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--bg-primary)",
        borderRadius: 12,
        border: "1px dashed var(--border)",
        padding: "10px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Info size={12} style={{ color: "var(--text-muted)" }} />
        <h4
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Data completeness ({report.windowDays}d)
        </h4>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {report.warnings.map((w, i) => (
          <li
            key={i}
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            • {w}
          </li>
        ))}
      </ul>
      <div
        className="tabular"
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 6,
          lineHeight: 1.5,
        }}
      >
        Logs: {report.dailyLogs.total}/{report.windowDays} days ({report.dailyLogs.coveragePct}%) |{" "}
        Oura: {report.ouraDays.coveragePct}% | NC: {report.cycleDays.total}d |{" "}
        Orthostatic: {report.orthostaticTests.total} test
        {report.orthostaticTests.total === 1 ? "" : "s"} ({report.orthostaticTests.positive} positive)
      </div>
    </section>
  );
}
