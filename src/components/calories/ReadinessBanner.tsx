/**
 * Readiness banner (Calories landing).
 *
 * Small, informational strip that surfaces today's Oura readiness score
 * so Lanae sees how her body is doing before planning intake. Voice is
 * strictly non-prescriptive: facts + a gentle nudge, never a demand or
 * shame frame. See docs/plans/2026-04-16-non-shaming-voice-rule.md.
 *
 * Hidden entirely when Oura has not synced a readiness value for the
 * requested date. We never fake it; silence is preferable to guessing.
 */

interface Props {
  /** Today's Oura readiness score (0-100). Null = no data for this date. */
  readinessScore: number | null;
  /** Oura sleep score (0-100) for the same date. Null = no data. */
  sleepScore: number | null;
  /** ISO date the banner describes. Used for the "for {date}" sub-copy. */
  viewDate: string;
  /** Whether the user is looking at today (vs a historical date). */
  isToday: boolean;
}

export function ReadinessBanner({
  readinessScore,
  sleepScore,
  isToday,
}: Props) {
  if (readinessScore == null && sleepScore == null) return null;

  const band = readinessBand(readinessScore);
  const accent =
    band === "high"
      ? "var(--accent-sage)"
      : band === "low"
        ? "var(--accent-blush)"
        : "var(--accent-sage-muted)";
  const accentMuted =
    band === "high"
      ? "var(--accent-sage-muted)"
      : band === "low"
        ? "var(--accent-blush-light)"
        : "var(--border-light)";

  return (
    <a
      href="/sleep"
      className="press-feedback"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
        border: "1px solid var(--border-light)",
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderLeftColor: accentMuted,
        boxShadow: "var(--shadow-sm)",
        textDecoration: "none",
        color: "var(--text-primary)",
      }}
    >
      <div
        aria-hidden
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 52,
          height: 52,
          borderRadius: 12,
          background: accentMuted,
          color: accent,
        }}
      >
        <span
          className="tabular"
          style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}
        >
          {readinessScore ?? "\u2014"}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginTop: 3,
            color: accent,
          }}
        >
          ready
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {isToday ? "Today's body" : "That day's body"}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
          {contextCopy(readinessScore, sleepScore)}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {subCopy(readinessScore, sleepScore)}
        </div>
      </div>

      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        style={{ color: "var(--text-muted)", flexShrink: 0 }}
      >
        <path
          d="M7.5 5L12.5 10L7.5 15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

function readinessBand(score: number | null): "high" | "mid" | "low" | "unknown" {
  if (score == null) return "unknown";
  if (score >= 80) return "high";
  if (score >= 65) return "mid";
  return "low";
}

function contextCopy(readiness: number | null, sleep: number | null): string {
  const band = readinessBand(readiness);
  if (band === "unknown") {
    return sleep != null
      ? `Sleep score ${sleep}. Fuel the day how it feels right.`
      : "Fuel the day how it feels right.";
  }
  if (band === "high") return "Reserves look steady.";
  if (band === "mid") return "Running on a typical day.";
  return "Lower reserve today.";
}

function subCopy(readiness: number | null, sleep: number | null): string {
  const band = readinessBand(readiness);
  if (band === "high") {
    return sleep != null
      ? `Sleep ${sleep}. Eat on your usual rhythm.`
      : "Eat on your usual rhythm.";
  }
  if (band === "mid") {
    return sleep != null
      ? `Sleep ${sleep}. Balanced meals tend to help.`
      : "Balanced meals tend to help.";
  }
  if (band === "low") {
    return sleep != null
      ? `Sleep ${sleep}. Hydration and a little extra protein can ease the day.`
      : "Hydration and a little extra protein can ease the day.";
  }
  return "No ring data yet for this day.";
}
