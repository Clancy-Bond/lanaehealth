"use client";

import Link from "next/link";

interface MetricCard {
  label: string;
  value: string;
  unit?: string;
  status: "good" | "ok" | "bad" | "none";
  href: string;
}

interface QuickStatusStripProps {
  overallPain: number | null;
  fatigue: number | null;
  sleepScore: number | null;
  hrvAvg: number | null;
  cyclePhaseLabel: string | null;
}

function getStatusDotColor(status: "good" | "ok" | "bad" | "none"): string {
  switch (status) {
    case "good":
      return "var(--accent-sage)";
    case "ok":
      return "#E8A849";
    case "bad":
      return "var(--accent-blush)";
    default:
      return "var(--text-muted)";
  }
}

function painStatus(val: number | null): "good" | "ok" | "bad" | "none" {
  if (val === null) return "none";
  if (val <= 2) return "good";
  if (val <= 5) return "ok";
  return "bad";
}

function energyStatus(val: number | null): "good" | "ok" | "bad" | "none" {
  if (val === null) return "none";
  // Energy is inverted fatigue: 10 - fatigue
  if (val >= 7) return "good";
  if (val >= 4) return "ok";
  return "bad";
}

function sleepStatus(val: number | null): "good" | "ok" | "bad" | "none" {
  if (val === null) return "none";
  if (val >= 75) return "good";
  if (val >= 60) return "ok";
  return "bad";
}

function hrvStatus(val: number | null): "good" | "ok" | "bad" | "none" {
  if (val === null) return "none";
  // HRV is very individual; use rough thresholds
  if (val >= 40) return "good";
  if (val >= 25) return "ok";
  return "bad";
}

export function QuickStatusStrip({
  overallPain,
  fatigue,
  sleepScore,
  hrvAvg,
  cyclePhaseLabel,
}: QuickStatusStripProps) {
  const energyVal = fatigue !== null ? 10 - fatigue : null;

  const metrics: MetricCard[] = [
    {
      label: "PAIN",
      value: overallPain !== null ? String(overallPain) : "Log",
      unit: overallPain !== null ? "/10" : undefined,
      status: painStatus(overallPain),
      href: overallPain !== null ? "/patterns?metric=pain" : "/log",
    },
    {
      label: "ENERGY",
      value: energyVal !== null ? String(energyVal) : "Log",
      unit: energyVal !== null ? "/10" : undefined,
      status: energyStatus(energyVal),
      href: energyVal !== null ? "/patterns?metric=energy" : "/log",
    },
    {
      label: "SLEEP",
      value: sleepScore !== null ? String(sleepScore) : "...",
      status: sleepStatus(sleepScore),
      href: "/patterns?metric=sleep",
    },
    {
      label: "HRV",
      value: hrvAvg !== null ? String(Math.round(hrvAvg)) : "...",
      unit: hrvAvg !== null ? "ms" : undefined,
      status: hrvStatus(hrvAvg),
      href: "/patterns?metric=hrv",
    },
    // Phase removed - shown in cycle indicator card
  ].filter(m => cyclePhaseLabel !== null || m.label !== "PHASE");

  return (
    <div
      className="hide-scrollbar"
      style={{
        overflowX: "auto",
        flex: 1,
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          paddingBottom: 4,
        }}
      >
        {metrics.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="touch-target"
            style={{
              flex: 1,
              minWidth: 60,
              height: 70,
              borderRadius: 14,
              background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
              border: "none",
              boxShadow: "0 1px 2px rgba(107,144,128,0.04), 0 4px 12px rgba(26,26,46,0.05)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              textDecoration: "none",
              flexShrink: 0,
              padding: "10px 12px",
              transition: "transform 150ms ease, box-shadow 150ms ease",
            }}
          >
            {/* Label */}
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                fontWeight: 400,
                lineHeight: 1,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              {m.label}
            </span>

            {/* Value row */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: m.value === "Log" || m.value === "..." ? 13 : 18,
                  fontWeight: m.value === "Log" ? 600 : 700,
                  color: m.value === "Log"
                    ? "var(--accent-sage)"
                    : m.value === "..."
                    ? "var(--text-muted)"
                    : "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {m.value}
              </span>
              {m.unit && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontWeight: 400,
                  }}
                >
                  {m.unit}
                </span>
              )}
            </div>

            {/* Status dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: getStatusDotColor(m.status),
              }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
