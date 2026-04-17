"use client";

import { AlertOctagon } from "lucide-react";
import type { RedFlag } from "@/lib/doctor/red-flags";

interface RedFlagsBannerProps {
  flags: RedFlag[];
}

export function RedFlagsBanner({ flags }: RedFlagsBannerProps) {
  if (flags.length === 0) return null;

  return (
    <section
      role="alert"
      aria-live="assertive"
      style={{
        background: "rgba(220, 38, 38, 0.08)",
        border: "2px solid #DC2626",
        borderRadius: 16,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AlertOctagon size={20} style={{ color: "#DC2626" }} />
        <h2
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#DC2626",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {flags.length === 1
            ? "Red flag: contact a doctor"
            : `${flags.length} red flags: contact a doctor`}
        </h2>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {flags.map((f) => (
          <li
            key={f.id}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "10px 12px",
              border: "1px solid rgba(220, 38, 38, 0.25)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7F1D1D", marginBottom: 4 }}>
              {f.headline}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 4 }}>
              {f.detail}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#DC2626",
                background: "rgba(220, 38, 38, 0.08)",
                padding: "4px 8px",
                borderRadius: 6,
                display: "inline-block",
              }}
            >
              Action: {f.action}
            </div>
            <div
              className="cite"
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
              }}
              title={f.dataRef}
            >
              {f.dataRef}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
