"use client";

import { useMemo, useState } from "react";
import { Swords, AlertTriangle, ChevronDown, ChevronRight, Search } from "lucide-react";
import type {
  ChallengerAttack,
  ChallengerPayload,
} from "@/lib/doctor/kb-challenger";
import type { SpecialistView } from "@/lib/doctor/specialist-config";

interface ChallengerPanelProps {
  payload: ChallengerPayload | null;
  view: SpecialistView;
}

// -----------------------------------------------------------------------------
// Relevance filters per specialist. Each attack references a hypothesis name.
// PCP sees everything. Specialists see only the attacks that touch their
// domain plus the three global items (stagnation, echo, missing diagnoses).
// -----------------------------------------------------------------------------

function specialistMatchesAttack(
  attack: ChallengerAttack,
  view: SpecialistView,
): boolean {
  if (view === "pcp") return true;
  const name = (attack.targetHypothesis ?? "").toLowerCase();
  if (view === "obgyn") return /endo|menstru|dysp|uter|ovari|pelvic/.test(name);
  if (view === "cardiology")
    return /pots|orthostat|autonom|cardio|heart|syncope|chiari|craniocervical/.test(name);
  return true;
}

// -----------------------------------------------------------------------------
// Collapsed subsection
// -----------------------------------------------------------------------------

function Collapsible({
  title,
  count,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="press-feedback no-print"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          background: "var(--bg-primary)",
          border: "1px solid var(--border-light)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {icon}
          {title}
          <span
            className="tabular"
            style={{
              fontWeight: 500,
              color: "var(--text-muted)",
              marginLeft: 4,
            }}
          >
            ({count})
          </span>
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Keep content in DOM when collapsed on screen but expanded for print */}
      <div
        className={open ? "" : "print-only"}
        style={{ display: open ? "block" : undefined, padding: "8px 4px 0" }}
      >
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Panel
// -----------------------------------------------------------------------------

export function ChallengerPanel({ payload, view }: ChallengerPanelProps) {
  const filtered = useMemo(() => {
    if (!payload) return null;
    const challenges = payload.challenges.filter((a) =>
      specialistMatchesAttack(a, view),
    );
    return {
      ...payload,
      challenges,
    };
  }, [payload, view]);

  if (!payload) return null;

  const total =
    (filtered?.challenges.length ?? 0) +
    payload.stagnation.length +
    payload.echoCheck.length +
    payload.missingDiagnoses.length;
  if (total === 0) return null;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: "#DC2626",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Swords size={18} style={{ color: "#DC2626" }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Challenger: the opposition case
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
          Anti-anchoring notes: what the engine would argue *against* each hypothesis, and diagnoses not yet on the tracker.
        </p>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        {/* Attacks */}
        {filtered && filtered.challenges.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#DC2626",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: 6,
                marginBottom: 6,
              }}
            >
              Attacks ({filtered.challenges.length})
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {filtered.challenges.map((a, i) => (
                <li
                  key={i}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(220, 38, 38, 0.06)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
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
                        color: "#7F1D1D",
                        lineHeight: 1.35,
                      }}
                    >
                      {a.targetHypothesis ?? "Unknown target"}
                    </strong>
                    {a.targetConfidence && a.targetScore !== null && (
                      <span
                        className="tabular"
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "rgba(220, 38, 38, 0.14)",
                          color: "#7F1D1D",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        was {a.targetScore} {a.targetConfidence}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.55,
                    }}
                  >
                    {a.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Collapsible
          title="Hypotheses stalled with no new evidence"
          count={payload.stagnation.length}
          icon={<AlertTriangle size={12} style={{ color: "#CA8A04" }} />}
        >
          <ul style={{ listStyle: "disc", paddingLeft: 18, margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {payload.stagnation.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </Collapsible>

        <Collapsible
          title="Echo chamber (where the analysts anchored)"
          count={payload.echoCheck.length}
          icon={<AlertTriangle size={12} style={{ color: "#8B5CF6" }} />}
        >
          <ul style={{ listStyle: "disc", paddingLeft: 18, margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {payload.echoCheck.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </Collapsible>

        <Collapsible
          title="Missing diagnoses not yet tracked"
          count={payload.missingDiagnoses.length}
          icon={<Search size={12} style={{ color: "var(--accent-sage)" }} />}
          defaultOpen
        >
          <ul style={{ listStyle: "disc", paddingLeft: 18, margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            {payload.missingDiagnoses.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </Collapsible>
      </div>
    </section>
  );
}
