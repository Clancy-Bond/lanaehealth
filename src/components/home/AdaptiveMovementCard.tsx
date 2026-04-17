/**
 * Adaptive Movement Suggestion Card
 *
 * Observation pattern from Oura: movement guidance that SCALES with
 * recovery rather than a fixed step/calorie goal. For a POTS patient,
 * hitting a generic activity target on a low-readiness day makes
 * symptoms worse. This card is explicitly anti-streak, anti-ring,
 * anti-"goal met" and instead translates today's readiness_score
 * into a capacity category with a warm, second-person rationale.
 *
 * Categories:
 *   readiness < 55   -> Rest day
 *   readiness 55-69  -> Gentle day
 *   readiness 70-84  -> Moderate day
 *   readiness >= 85  -> Full capacity
 *
 * Null / missing ring data -> neutral "go by how you feel" fallback.
 *
 * Data source: latest row of oura_daily. Read-only. No writes.
 */

import {
  classifyMovement,
  type MovementSuggestion,
} from "@/lib/intelligence/adaptive-movement";

interface Props {
  /** Today's readiness score, 0-100, or null if ring did not sync. */
  readinessScore: number | null;
  /** Date of the reading (YYYY-MM-DD). Shown only if not today, so the user knows. */
  readingDate: string | null;
  /** Today's date in the user's locale, YYYY-MM-DD. */
  today: string;
  /** Optional 7-day readiness mean for the delta-from-typical disclosure. */
  sevenDayAvg: number | null;
}

function phraseForReadingDate(
  readingDate: string | null,
  today: string,
): string | null {
  if (!readingDate) return null;
  if (readingDate === today) return null;
  const d = new Date(readingDate + "T00:00:00");
  const t = new Date(today + "T00:00:00");
  const diffDays = Math.round((t.getTime() - d.getTime()) / 86400000);
  if (diffDays === 1) return "Based on yesterday's reading";
  if (diffDays > 1) return `Based on your reading ${diffDays} days ago`;
  return null;
}

/**
 * Server component wrapper. Renders the movement suggestion card on
 * the Home page. No state, no effects — safe to stay in the Server
 * Components tree to avoid an unnecessary hydration boundary.
 */
export function AdaptiveMovementCard({
  readinessScore,
  readingDate,
  today,
  sevenDayAvg,
}: Props) {
  const suggestion: MovementSuggestion = classifyMovement(
    readinessScore,
    sevenDayAvg,
  );

  const staleLabel = phraseForReadingDate(readingDate, today);

  return (
    <div style={{ padding: "0 16px" }}>
      <section
        aria-labelledby="movement-title"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "14px 16px",
          borderRadius: "var(--radius-md)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: "var(--radius-full)",
            background: "var(--accent-sage-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "var(--accent-sage)",
          }}
        >
          {suggestion.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h2
              id="movement-title"
              style={{
                fontSize: "var(--text-base)",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {suggestion.label}
            </h2>
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              {suggestion.capacityBand}
            </span>
          </div>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              margin: "4px 0 0 0",
            }}
          >
            {suggestion.rationale}
          </p>
          {(suggestion.subtleContext || staleLabel) && (
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                marginTop: 6,
                marginBottom: 0,
                lineHeight: 1.4,
              }}
            >
              {[staleLabel, suggestion.subtleContext]
                .filter(Boolean)
                .join(" \u00B7 ")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
