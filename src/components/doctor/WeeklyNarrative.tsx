"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ScrollText, RefreshCw } from "lucide-react";
import type { SpecialistView } from "@/lib/doctor/specialist-config";

interface NarrativePayload {
  content: string | null;
  generatedAt: string | null;
  stale: boolean;
  view?: SpecialistView;
  error?: string;
}

interface WeeklyNarrativeProps {
  view?: SpecialistView;
}

export function WeeklyNarrative({ view = "pcp" }: WeeklyNarrativeProps) {
  const [state, setState] = useState<NarrativePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/narrative/weekly?view=${view}`)
      .then((r) => r.json())
      .then((d: NarrativePayload) => setState(d))
      .catch(() => setState({ content: null, generatedAt: null, stale: true }))
      .finally(() => setLoading(false));
  }, [view]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/narrative/weekly?view=${view}`, { method: "POST" });
      const data = (await res.json()) as NarrativePayload;
      setState(data);
    } catch {
      // no-op, stale state remains
    } finally {
      setRegenerating(false);
    }
  };

  const hasContent = state?.content != null && state.content.length > 0;
  const ts = state?.generatedAt ? new Date(state.generatedAt) : null;

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        border: "1px solid var(--border-light)",
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ScrollText size={18} style={{ color: "var(--accent-sage)" }} />
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Health Story ({view.toUpperCase()} variant)
          </h2>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="no-print press-feedback"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "var(--accent-sage)",
            background: "transparent",
            border: "1px solid var(--border)",
            padding: "4px 8px",
            borderRadius: 6,
            cursor: regenerating ? "wait" : "pointer",
            opacity: regenerating ? 0.6 : 1,
            transition: "all var(--duration-fast) var(--ease-standard)",
          }}
        >
          <RefreshCw size={12} />
          {regenerating ? "Regenerating" : hasContent ? "Refresh" : "Generate"}
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="shimmer-bar" aria-hidden="true" />
          <div className="skeleton" style={{ height: 12, width: "92%" }} />
          <div className="skeleton" style={{ height: 12, width: "78%" }} />
          <div className="skeleton" style={{ height: 12, width: "85%" }} />
          <span className="sr-only">One moment, pulling your story.</span>
        </div>
      ) : hasContent ? (
        <>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.65,
              margin: "0 0 8px",
            }}
          >
            {state!.content}
          </p>
          {ts && (
            <p
              className="tabular"
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              Generated {format(ts, "MMM d, yyyy h:mm a")}
              {state!.stale ? " (stale, consider refreshing)" : ""}
            </p>
          )}
        </>
      ) : (
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            margin: 0,
            fontStyle: "italic",
          }}
        >
          Your health story appears here once generated. Tap Generate for a 200-word summary.
        </p>
      )}
    </section>
  );
}
