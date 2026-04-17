"use client";

import { SPECIALIST_CONFIG, type SpecialistView } from "@/lib/doctor/specialist-config";

interface SpecialistToggleProps {
  view: SpecialistView;
  onChange: (v: SpecialistView) => void;
}

const VIEWS: SpecialistView[] = ["pcp", "obgyn", "cardiology"];

export function SpecialistToggle({ view, onChange }: SpecialistToggleProps) {
  return (
    <section
      className="no-print"
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--border-light)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        Brief view
      </p>
      <div
        role="tablist"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${VIEWS.length}, 1fr)`,
          gap: 6,
          background: "var(--bg-primary)",
          borderRadius: 10,
          padding: 4,
        }}
      >
        {VIEWS.map((v) => {
          const cfg = SPECIALIST_CONFIG[v];
          const active = v === view;
          return (
            <button
              key={v}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(v)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                background: active ? "var(--accent-sage)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                alignItems: "flex-start",
                textAlign: "left",
              }}
            >
              <span>{cfg.label}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 400,
                  opacity: active ? 0.85 : 0.6,
                }}
              >
                {cfg.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
