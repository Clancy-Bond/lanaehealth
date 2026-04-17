"use client";

import { useMemo } from "react";
import { Lightbulb, FlaskConical, ArrowUp, ArrowDown, Minus, Zap } from "lucide-react";
import type { DoctorPageData } from "@/app/doctor/page";
import {
  generateHypotheses,
  filterForSpecialist,
  type Hypothesis,
} from "@/lib/doctor/hypotheses";
import type {
  KBHypothesis,
  KBConfidenceCategory,
} from "@/lib/doctor/kb-hypotheses";
import { bucketVisible, type SpecialistView } from "@/lib/doctor/specialist-config";

interface HypothesesPanelProps {
  data: DoctorPageData;
  view: SpecialistView;
}

// ---------------------------------------------------------------------------
// Confidence category visuals
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<
  KBConfidenceCategory | "high" | "moderate" | "low",
  { bg: string; fg: string }
> = {
  ESTABLISHED: { bg: "rgba(107, 144, 128, 0.18)", fg: "var(--accent-sage)" },
  PROBABLE:    { bg: "rgba(107, 144, 128, 0.12)", fg: "var(--accent-sage)" },
  POSSIBLE:    { bg: "rgba(212, 160, 80, 0.16)",  fg: "#CA8A04" },
  SPECULATIVE: { bg: "rgba(107, 114, 128, 0.14)", fg: "#6B7280" },
  INSUFFICIENT:{ bg: "rgba(107, 114, 128, 0.10)", fg: "#8B8F96" },
  // Heuristic fallback (when KB has no tracker yet)
  high:     { bg: "rgba(107, 144, 128, 0.16)", fg: "var(--accent-sage)" },
  moderate: { bg: "rgba(212, 160, 80, 0.16)",  fg: "#CA8A04" },
  low:      { bg: "rgba(107, 114, 128, 0.16)", fg: "#6B7280" },
};

function DirectionGlyph({ d }: { d: "rising" | "falling" | "stable" }) {
  if (d === "rising") return <ArrowUp size={11} style={{ color: "#DC2626" }} />;
  if (d === "falling") return <ArrowDown size={11} style={{ color: "var(--accent-sage)" }} />;
  return <Minus size={11} style={{ color: "var(--text-muted)" }} />;
}

// ---------------------------------------------------------------------------
// KB-backed card (full CIE output)
// ---------------------------------------------------------------------------

function KBHypothesisCard({ h }: { h: KBHypothesis }) {
  const c = CATEGORY_COLORS[h.confidence];
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
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <DirectionGlyph d={h.direction} />
          <span
            className="tabular"
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              background: c.bg,
              color: c.fg,
            }}
          >
            {h.confidence}
            {h.score !== null ? ` ${h.score}` : ""}
          </span>
        </div>
      </div>

      {h.supporting.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-sage)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 6 }}>
            Supporting
          </div>
          <ul style={{ listStyle: "disc", paddingLeft: 18, margin: "2px 0 8px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {h.supporting.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      {h.contradicting.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Contradicting (challenger)
          </div>
          <ul style={{ listStyle: "disc", paddingLeft: 18, margin: "2px 0 8px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {h.contradicting.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      {h.whatWouldChange.length > 0 && (
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
            What would change this
          </div>
          <ul style={{ listStyle: "disc", paddingLeft: 18, margin: 0, fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>
            {h.whatWouldChange.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {h.alternatives.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.5 }}>
          Alternatives: {h.alternatives.join(" | ")}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heuristic fallback card (pre-CIE shape, kept so the brief degrades gracefully)
// ---------------------------------------------------------------------------

function HeuristicHypothesisCard({ h }: { h: Hypothesis }) {
  const c = CATEGORY_COLORS[h.confidence];
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
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1.35 }}>
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
        <ul style={{ listStyle: "disc", paddingLeft: 18, margin: "0 0 10px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {h.supporting.map((s, i) => <li key={i}>{s}</li>)}
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
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
          {h.nextTest}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>
          {h.nextTestRationale}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

function specialistFilterForKB(
  hypothesis: KBHypothesis,
  view: SpecialistView
): boolean {
  const name = hypothesis.name.toLowerCase();
  if (view === "obgyn") {
    return /endo|menstru|cycl|reproduct|dysp|ovari|uter/.test(name);
  }
  if (view === "cardiology") {
    return /pots|orthostat|autonom|cardia|dys(auto|lipid)|heart|syncope/.test(name);
  }
  return true; // pcp sees all
}

export function HypothesesPanel({ data, view }: HypothesesPanelProps) {
  const kb = data.kbHypotheses;

  const kbSlice = useMemo(() => {
    if (!kb || kb.hypotheses.length === 0) return [];
    return kb.hypotheses
      .filter((h) => specialistFilterForKB(h, view))
      .slice(0, 4);
  }, [kb, view]);

  const heuristics = useMemo(() => {
    const all = generateHypotheses(data);
    return filterForSpecialist(all, view).slice(0, 3);
  }, [data, view]);

  // Decide which source to render. Prefer KB; fall back to heuristics if the
  // KB doc has no hypotheses for this specialist.
  const usingKB = kbSlice.length > 0;
  const items: Array<{ kind: "kb"; h: KBHypothesis } | { kind: "heuristic"; h: Hypothesis }> = usingKB
    ? kbSlice.map((h) => ({ kind: "kb" as const, h }))
    : heuristics.map((h) => ({ kind: "heuristic" as const, h }));

  if (items.length === 0 || !bucketVisible(view, "activeProblems")) {
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lightbulb size={18} style={{ color: "#CA8A04" }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Working Hypotheses
            </h2>
          </div>
          {usingKB && (
            <span
              title={`Generated by ${kb?.sourcePersona ?? "CIE"} on ${kb?.generatedAt ?? "unknown"}`}
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
              <Zap size={10} />
              {kb?.stale ? "CIE (stale)" : "CIE"}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
          {usingKB
            ? "From the Clinical Intelligence Engine. Supporting and contradicting evidence, with what would change each category."
            : "Heuristic fallback. Run the Clinical Intelligence Engine to generate formal evidence-scored hypotheses."}
        </p>
      </div>

      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) =>
          item.kind === "kb" ? (
            <KBHypothesisCard key={i} h={item.h} />
          ) : (
            <HeuristicHypothesisCard key={i} h={item.h} />
          )
        )}
      </div>
    </section>
  );
}
