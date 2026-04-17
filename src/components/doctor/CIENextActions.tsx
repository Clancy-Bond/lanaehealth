"use client";

import { useMemo } from "react";
import { Target, Zap } from "lucide-react";
import type { KBAction, KBActionsPayload } from "@/lib/doctor/kb-actions";
import type { SpecialistView } from "@/lib/doctor/specialist-config";

interface CIENextActionsProps {
  payload: KBActionsPayload | null;
  view: SpecialistView;
}

function urgencyStyle(u: KBAction["urgency"]): { bg: string; fg: string; label: string } {
  switch (u) {
    case "Urgent":
      return { bg: "rgba(220, 38, 38, 0.12)", fg: "#DC2626", label: "Urgent" };
    case "Soon":
      return { bg: "rgba(234, 179, 8, 0.14)", fg: "#CA8A04", label: "Soon" };
    case "Routine":
      return { bg: "rgba(107, 144, 128, 0.12)", fg: "var(--accent-sage)", label: "Routine" };
    case "Low priority":
      return { bg: "rgba(107, 114, 128, 0.12)", fg: "#6B7280", label: "Low priority" };
    default:
      return { bg: "rgba(107, 114, 128, 0.10)", fg: "#8B8F96", label: "Priority TBD" };
  }
}

function relevantToView(a: KBAction, view: SpecialistView): boolean {
  if (view === "pcp") return true;
  const joined = (a.title + " " + a.affects.join(" ") + " " + a.rationale).toLowerCase();
  if (view === "obgyn") return /endo|menstru|cycl|dysp|ovari|uter|menorrhag|tvus|reproduct/.test(joined);
  if (view === "cardiology") return /pots|orthostat|autonom|cardia|heart|syncope|hrv|chiari/.test(joined);
  return true;
}

export function CIENextActions({ payload, view }: CIENextActionsProps) {
  const actions = useMemo(() => {
    if (!payload || payload.actions.length === 0) return [];
    return payload.actions.filter((a) => relevantToView(a, view)).slice(0, 4);
  }, [payload, view]);

  if (!payload || actions.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: "#8B5CF6",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Target size={18} style={{ color: "#8B5CF6" }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Next best actions
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
            <Zap size={10} />
            {payload.stale ? "CIE (stale)" : "CIE"}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
          Ranked by expected uncertainty reduction. Each action lists which hypotheses it shifts and by how much.
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
        {actions.map((a) => {
          const u = urgencyStyle(a.urgency);
          return (
            <li
              key={a.rank}
              style={{
                padding: "12px 14px",
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
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                    #{a.rank}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.35, marginTop: 2 }}>
                    {a.title}
                  </div>
                </div>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    background: u.bg,
                    color: u.fg,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {u.label}
                </span>
              </div>

              {a.affects.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Affects:{" "}
                  <span className="tabular" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {a.affects.join(" | ")}
                  </span>
                </div>
              )}
              {a.potentialSwing && (
                <div className="tabular" style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  Potential swing: {a.potentialSwing}
                  {a.difficulty !== "Unknown" ? ` | Difficulty: ${a.difficulty}` : ""}
                </div>
              )}
              {a.rationale && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    margin: "6px 0 0",
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}
                >
                  {a.rationale.length > 400 ? a.rationale.slice(0, 400) + "..." : a.rationale}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
