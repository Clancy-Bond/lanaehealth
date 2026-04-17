"use client";

import { useMemo } from "react";
import { Lightbulb, FlaskConical } from "lucide-react";
import type { DoctorPageData } from "@/app/doctor/page";
import {
  generateHypotheses,
  filterForSpecialist,
  type Hypothesis,
  type ConfidenceLevel,
} from "@/lib/doctor/hypotheses";
import { bucketVisible, type SpecialistView } from "@/lib/doctor/specialist-config";

interface HypothesesPanelProps {
  data: DoctorPageData;
  view: SpecialistView;
}

function confidenceColor(c: ConfidenceLevel): { bg: string; fg: string } {
  switch (c) {
    case "high":
      return { bg: "rgba(107, 144, 128, 0.16)", fg: "var(--accent-sage)" };
    case "moderate":
      return { bg: "rgba(212, 160, 80, 0.16)", fg: "#CA8A04" };
    case "low":
      return { bg: "rgba(107, 114, 128, 0.16)", fg: "#6B7280" };
  }
}

function HypothesisCard({ h }: { h: Hypothesis }) {
  const c = confidenceColor(h.confidence);
  return (
    <div
      className="card"
      style={{
        padding: "14px 16px",
        border: "1px solid var(--border-light)",
        pageBreakInside: "avoid",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <h4
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          {h.name}
        </h4>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            background: c.bg,
            color: c.fg,
            flexShrink: 0,
          }}
        >
          {h.confidence}
        </span>
      </div>

      {h.supporting.length > 0 && (
        <ul
          style={{
            listStyle: "disc",
            paddingLeft: 18,
            margin: "0 0 10px",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.55,
          }}
        >
          {h.supporting.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}

      <div
        style={{
          marginTop: 8,
          padding: "8px 10px",
          background: "var(--bg-primary)",
          borderRadius: 8,
          borderLeft: "3px solid var(--accent-sage)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--accent-sage)",
          }}
        >
          <FlaskConical size={12} />
          Single most uncertainty-reducing test
        </div>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: "0 0 4px",
          }}
        >
          {h.nextTest}
        </p>
        <p
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            margin: 0,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          {h.nextTestRationale}
        </p>
      </div>
    </div>
  );
}

export function HypothesesPanel({ data, view }: HypothesesPanelProps) {
  const hypotheses = useMemo(() => {
    const all = generateHypotheses(data);
    return filterForSpecialist(all, view).slice(0, 3);
  }, [data, view]);

  // Hide panel entirely if no hypotheses for this specialist or active problems bucket hidden
  if (hypotheses.length === 0 || !bucketVisible(view, "activeProblems")) {
    return null;
  }

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
      <div style={{ padding: "16px 20px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Lightbulb size={18} style={{ color: "#CA8A04" }} />
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Working Hypotheses
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
          Ranked by confidence. Each names the single test that would most reduce uncertainty.
        </p>
      </div>

      <div
        style={{
          padding: "0 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {hypotheses.map((h, i) => (
          <HypothesisCard key={i} h={h} />
        ))}
      </div>
    </section>
  );
}
