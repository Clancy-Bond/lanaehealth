"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Check, X, Minus } from "lucide-react";
import type { ResearchStudy, ResearchPayload, EvidenceGrade } from "@/lib/doctor/kb-research";
import type { SpecialistView } from "@/lib/doctor/specialist-config";

interface ResearchContextPanelProps {
  payload: ResearchPayload | null;
  view: SpecialistView;
}

function gradeColor(g: EvidenceGrade): { bg: string; fg: string } {
  switch (g) {
    case "A":
      return { bg: "rgba(107, 144, 128, 0.18)", fg: "var(--accent-sage)" };
    case "B":
      return { bg: "rgba(107, 144, 128, 0.12)", fg: "var(--accent-sage)" };
    case "C":
      return { bg: "rgba(234, 179, 8, 0.14)", fg: "#CA8A04" };
    case "D":
      return { bg: "rgba(212, 96, 90, 0.14)", fg: "#B45250" };
    case "E":
    case "F":
      return { bg: "rgba(220, 38, 38, 0.12)", fg: "#DC2626" };
    default:
      return { bg: "rgba(107, 114, 128, 0.14)", fg: "#6B7280" };
  }
}

function SupportsGlyph({ s }: { s: ResearchStudy["supports"] }) {
  if (s === "for") return <Check size={12} style={{ color: "var(--accent-sage)" }} />;
  if (s === "against") return <X size={12} style={{ color: "#DC2626" }} />;
  return <Minus size={12} style={{ color: "var(--text-muted)" }} />;
}

function matchesSpecialist(s: ResearchStudy, view: SpecialistView): boolean {
  if (view === "pcp") return true;
  const haystack = (s.title + " " + s.impact + " " + (s.question ?? "")).toLowerCase();
  if (view === "obgyn") return /endo|menstru|dysp|uter|ovari|pelvic|menorrhag|n80|n92|tvus/.test(haystack);
  if (view === "cardiology") return /pots|orthostat|autonom|cardio|heart|syncope|chiari|craniocervical|hrv|tilt/.test(haystack);
  return true;
}

export function ResearchContextPanel({ payload, view }: ResearchContextPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const studies = useMemo(() => {
    if (!payload) return [];
    return payload.studies
      .filter((s) => matchesSpecialist(s, view))
      .sort((a, b) => {
        // Higher evidence grade first, "for" before "against"
        const order = ["A", "B", "C", "D", "E", "F", "Unknown"];
        const ga = order.indexOf(a.evidenceGrade);
        const gb = order.indexOf(b.evidenceGrade);
        if (ga !== gb) return ga - gb;
        return a.supports === b.supports ? 0 : a.supports === "for" ? -1 : 1;
      });
  }, [payload, view]);

  if (!payload || studies.length === 0) return null;
  const visible = expanded ? studies : studies.slice(0, 3);

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: "#2563EB",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={18} style={{ color: "#2563EB" }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Research context
            </h2>
          </div>
          <span
            title={`Generated ${payload.generatedAt ?? "unknown"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(139, 92, 246, 0.12)",
              color: "#8B5CF6",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {payload.stale ? "CIE (stale)" : "CIE"}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
          Evidence-graded studies from the Research Librarian. Top by grade, relevance-filtered for this specialist.
        </p>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: "0 16px 8px",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {visible.map((s, i) => {
          const g = gradeColor(s.evidenceGrade);
          return (
            <li
              key={i}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--bg-primary)",
                border: "1px solid var(--border-light)",
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
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1.35,
                  }}
                >
                  {s.title}
                </strong>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    background: g.bg,
                    color: g.fg,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  <SupportsGlyph s={s.supports} />
                  Grade {s.evidenceGrade}
                </span>
              </div>
              <div
                className="tabular"
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                {s.type} | {s.sample} | {s.journal}
              </div>
              {s.relevance && (
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  {s.relevance}
                </p>
              )}
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                }}
              >
                {s.impact}
              </p>
            </li>
          );
        })}
      </ul>

      {studies.length > 3 && (
        <div style={{ padding: "0 16px 16px" }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="no-print press-feedback"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              fontSize: 12,
              color: "var(--accent-sage)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expanded ? "Show top 3" : `Show ${studies.length - 3} more`}
          </button>
        </div>
      )}
    </section>
  );
}
