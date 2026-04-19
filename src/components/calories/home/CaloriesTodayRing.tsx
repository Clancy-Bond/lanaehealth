/**
 * Home widget: condensed MyNetDiary-parity calorie ring.
 *
 * Smaller than the legacy CalorieCard ring — designed to sit in the
 * registered-widgets grid below the main hero. Shows the ratio as a
 * filled ring and the headline number (remaining or "on plan"), with
 * one link to the full /calories dashboard.
 *
 * Server component. Fetches today's totals + nutrition goals in
 * parallel so it renders in a single round trip.
 */

import { getDayTotals } from "@/lib/calories/home-data";
import { loadNutritionGoals } from "@/lib/calories/goals";

interface Props {
  date: string;
}

export async function CaloriesTodayRing({ date }: Props) {
  const [totals, goals] = await Promise.all([
    getDayTotals(date),
    loadNutritionGoals(),
  ]);

  const target = goals.calorieTarget;
  const eaten = Math.round(totals.calories);
  const overTarget = eaten > target;
  const ratio = target > 0 ? Math.min(1, eaten / target) : 0;
  const remaining = Math.max(0, target - eaten);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - ratio);
  const ringColor = overTarget ? "var(--accent-blush)" : "var(--accent-sage)";
  const ringMuted = overTarget
    ? "var(--accent-blush-light)"
    : "var(--accent-sage-muted)";

  const isEmpty = eaten === 0;
  const headline = isEmpty
    ? "No meals yet"
    : overTarget
      ? `${eaten - target} over`
      : `${remaining} left`;

  const subCopy = isEmpty
    ? "Tap to log your first meal."
    : `${eaten} of ${target} cal \u00B7 ${totals.entryCount} item${
        totals.entryCount === 1 ? "" : "s"
      }`;

  return (
    <div style={{ padding: "0 16px" }}>
      <a
        href="/calories"
        className="press-feedback"
        aria-label="Open calories dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
          border: "1px solid var(--border-light)",
          borderLeftWidth: 3,
          borderLeftStyle: "solid",
          borderLeftColor: ringMuted,
          boxShadow: "var(--shadow-sm)",
          textDecoration: "none",
          color: "var(--text-primary)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 80,
            height: 80,
            flexShrink: 0,
          }}
        >
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            role="img"
            aria-label={
              isEmpty
                ? `No calories logged yet; target ${target}.`
                : overTarget
                  ? `Over target: ${eaten} of ${target}.`
                  : `${eaten} of ${target} calories logged.`
            }
          >
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="var(--border-light)"
              strokeWidth="5"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${dashoffset}`}
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "center",
              }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            <span
              className="tabular"
              style={{ fontSize: 18, fontWeight: 700, color: ringColor }}
            >
              {isEmpty ? "0" : eaten}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginTop: 3,
              }}
            >
              cal
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: ringColor,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Today&rsquo;s calories
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            <span className="tabular">{headline.split(" ")[0]}</span>{" "}
            {headline.split(" ").slice(1).join(" ")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {subCopy}
          </div>
        </div>

        <svg
          width="18"
          height="18"
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
    </div>
  );
}
