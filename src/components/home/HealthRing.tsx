"use client";

import { useMemo } from "react";

interface HealthRingProps {
  cycleDay: number | null;
  cyclePhase: string | null;
  overallPain: number | null;
  sleepScore: number | null;
  hasLoggedToday: boolean;
  todayFormatted: string;
  ncDataStale?: boolean;
}

/** Map cycle phase to a CSS variable color name */
function getPhaseColor(phase: string | null): string {
  switch (phase?.toLowerCase()) {
    case "menstrual":
      return "var(--phase-menstrual)";
    case "follicular":
      return "var(--phase-follicular)";
    case "ovulatory":
      return "var(--phase-ovulatory)";
    case "luteal":
      return "var(--phase-luteal)";
    default:
      return "var(--text-muted)";
  }
}

/**
 * Determine the ring color based on today's data.
 * Sage = good, Amber = moderate, Rose = rough, Grey = no data.
 */
function getRingColor(
  pain: number | null,
  sleep: number | null,
  hasLogged: boolean
): string {
  if (!hasLogged && pain === null && sleep === null) {
    return "#9CA3AF"; // grey - no data
  }
  const painHigh = pain !== null && pain >= 6;
  const painMod = pain !== null && pain >= 3 && pain < 6;
  const sleepBad = sleep !== null && sleep < 60;
  const sleepOk = sleep !== null && sleep >= 60 && sleep < 75;

  if (painHigh || sleepBad) return "#D4A0A0"; // rose
  if (painMod || sleepOk) return "#E8A849"; // amber
  return "#6B9080"; // sage
}

function getStatusMessage(
  pain: number | null,
  sleep: number | null,
  hasLogged: boolean
): { text: string; color: string } {
  if (!hasLogged && pain === null) {
    return {
      text: "Tap + to log your morning check-in",
      color: "var(--accent-sage)",
    };
  }
  const painHigh = pain !== null && pain >= 6;
  const sleepBad = sleep !== null && sleep < 60;

  if (painHigh || sleepBad) {
    return {
      text: "Tough day - take it easy",
      color: "var(--accent-blush)",
    };
  }
  return {
    text: "Looking good today",
    color: "var(--accent-sage)",
  };
}

export function HealthRing({
  cycleDay,
  cyclePhase,
  overallPain,
  sleepScore,
  hasLoggedToday,
  todayFormatted,
  ncDataStale = false,
}: HealthRingProps) {
  const ringColor = useMemo(
    () => getRingColor(overallPain, sleepScore, hasLoggedToday),
    [overallPain, sleepScore, hasLoggedToday]
  );

  const phaseColor = useMemo(() => getPhaseColor(cyclePhase), [cyclePhase]);
  const status = useMemo(
    () => getStatusMessage(overallPain, sleepScore, hasLoggedToday),
    [overallPain, sleepScore, hasLoggedToday]
  );

  const noData = !hasLoggedToday && overallPain === null && sleepScore === null;

  // SVG circle dimensions
  const size = 180;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Phase label for display
  const phaseLabel = cyclePhase
    ? cyclePhase.charAt(0).toUpperCase() + cyclePhase.slice(1)
    : null;

  return (
    <div className="flex flex-col items-center gap-3 pt-6 pb-2">
      <div
        style={{ position: "relative", width: size, height: size }}
        aria-label={
          cycleDay
            ? `Cycle day ${cycleDay}, ${phaseLabel || "unknown"} phase`
            : `Today is ${todayFormatted}`
        }
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth={strokeWidth}
          />
          {/* Colored ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={0}
            style={{
              transition: "stroke 600ms ease",
              ...(noData
                ? {
                    animation: "ringPulse 2.5s ease-in-out infinite",
                  }
                : {}),
            }}
          />
        </svg>

        {/* Center text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          {cycleDay !== null ? (
            <>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 1.1,
                }}
              >
                CD {cycleDay}
              </span>
              {phaseLabel && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: phaseColor,
                    lineHeight: 1.2,
                  }}
                >
                  {phaseLabel}
                </span>
              )}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "0 16px",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  lineHeight: 1.3,
                  textAlign: "center",
                }}
              >
                {todayFormatted}
              </span>
              {ncDataStale && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    lineHeight: 1.3,
                    textAlign: "center",
                  }}
                >
                  Connect Natural Cycles for cycle tracking
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status message below ring */}
      <p
        style={{
          fontSize: 14,
          color: status.color,
          fontWeight: 500,
          textAlign: "center",
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {status.text}
      </p>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes ringPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
