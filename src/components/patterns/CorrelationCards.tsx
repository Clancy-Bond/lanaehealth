"use client";

import type { CorrelationResult } from "./PatternsClient";

interface CorrelationCardsProps {
  correlations: CorrelationResult[];
}

const CONFIDENCE_STYLES: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  suggestive: {
    bg: "rgba(232, 168, 73, 0.12)",
    color: "#E8A849",
    label: "Suggestive",
  },
  moderate: {
    bg: "rgba(107, 144, 128, 0.12)",
    color: "#6B9080",
    label: "Moderate",
  },
  strong: {
    bg: "rgba(107, 191, 89, 0.12)",
    color: "#6BBF59",
    label: "Strong",
  },
};

function MiniSparkline({
  coefficient,
  color,
}: {
  coefficient: number | null;
  color: string;
}) {
  if (coefficient === null) return null;

  // Simple visual indicator of correlation direction/strength
  const width = 48;
  const height = 24;
  const absCoeff = Math.abs(coefficient);
  const isPositive = coefficient >= 0;

  // Generate a simple trend line
  const points: string[] = [];
  for (let i = 0; i <= 6; i++) {
    const x = (i / 6) * width;
    const baseY = height / 2;
    const slope = isPositive ? -absCoeff * 8 : absCoeff * 8;
    const y = baseY + ((i - 3) / 3) * slope;
    const clampedY = Math.max(2, Math.min(height - 2, y));
    points.push(`${x},${clampedY}`);
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ flexShrink: 0 }}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CorrelationCards({ correlations }: CorrelationCardsProps) {
  if (correlations.length === 0) {
    return (
      <div
        style={{
          border: "1.5px dashed var(--accent-sage)",
          borderRadius: 16,
          padding: 24,
          textAlign: "center",
          background: "rgba(107, 144, 128, 0.04)",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-sage)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: "0 auto" }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
          </svg>
        </div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-secondary)",
            margin: "0 0 4px 0",
          }}
        >
          No patterns analyzed yet
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          The correlation engine will find patterns across your health data once
          enough data has been collected and analyzed.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 12px 0",
        }}
      >
        Discovered Patterns
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {correlations.map((corr) => {
          const conf = CONFIDENCE_STYLES[corr.confidence_level] ||
            CONFIDENCE_STYLES.suggestive;
          return (
            <div
              key={corr.id}
              className="card"
              style={{ padding: "14px 16px" }}
            >
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {corr.factor_a}{" "}
                    <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                      vs
                    </span>{" "}
                    {corr.factor_b}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MiniSparkline
                    coefficient={corr.coefficient}
                    color={conf.color}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 8,
                      background: conf.bg,
                      color: conf.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conf.label}
                  </span>
                </div>
              </div>

              {/* Description */}
              {corr.effect_description && (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    margin: "0 0 8px 0",
                    lineHeight: 1.5,
                  }}
                >
                  {corr.effect_description}
                </p>
              )}

              {/* Metadata row */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                {corr.sample_size !== null && (
                  <span>n = {corr.sample_size}</span>
                )}
                {corr.lag_days !== null && corr.lag_days > 0 && (
                  <span>
                    {corr.lag_days}d lag
                  </span>
                )}
                {corr.cycle_phase && (
                  <span
                    style={{ textTransform: "capitalize" }}
                  >
                    {corr.cycle_phase} phase
                  </span>
                )}
                {corr.correlation_type && (
                  <span style={{ textTransform: "capitalize" }}>
                    {corr.correlation_type.replace("_", " ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
