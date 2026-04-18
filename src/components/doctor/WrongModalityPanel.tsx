"use client";

import { AlertTriangle, Camera } from "lucide-react";
import { format } from "date-fns";
import type { WrongModalityFlag } from "@/lib/doctor/wrong-modality";

interface WrongModalityPanelProps {
  flags: WrongModalityFlag[];
}

export function WrongModalityPanel({ flags }: WrongModalityPanelProps) {
  if (flags.length === 0) return null;

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
          <AlertTriangle size={18} style={{ color: "var(--accent-blush)" }} />
          <h2
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Imaging modality mismatch
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
          Imaging was done but the modality used cannot answer the hypothesis it was meant to evaluate. The correct study is listed for each.
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
        {flags.map((f, i) => (
          <li
            key={i}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--border-light)",
              background: "var(--bg-elevated)",
              pageBreakInside: "avoid",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 4,
              }}
            >
              <Camera size={12} />
              Hypothesis: {f.hypothesis}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.4,
                marginBottom: 4,
              }}
            >
              Ordered: <span className="tabular">{f.modalityUsed}</span> of {f.bodyPart} on{" "}
              <span className="tabular">{format(new Date(f.studyDate + "T00:00:00"), "MMM d, yyyy")}</span>
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--accent-sage)",
                marginBottom: 4,
              }}
            >
              Order instead: {f.preferredModality}
            </div>
            <p
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                fontStyle: "italic",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {f.rationale}
            </p>
            <div
              className="cite"
              style={{
                fontSize: 9,
                color: "var(--text-muted)",
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
              }}
              title={`imaging_studies.id=${f.imagingStudyId}`}
            >
              imaging_studies.id={f.imagingStudyId.slice(0, 8)}...
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
