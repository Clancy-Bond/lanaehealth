/**
 * Weekly digest card for Home.
 *
 * Consumes the output of buildWeeklyDigest() and renders a small,
 * unobtrusive summary. Mirrors the Whoop / Bearable weekly-email
 * pattern but inline on Home so Lanae sees it every session.
 */

import type { Digest } from "@/lib/intelligence/weekly-digest";

interface Props {
  digest: Digest;
}

export function WeeklyDigestCard({ digest }: Props) {
  const completion = digest.streak.window > 0 ? digest.streak.logged / digest.streak.window : 0;

  return (
    <div style={{ padding: "0 16px" }}>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Week at a glance
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Last 7 days, rolling
            </div>
          </div>
          <div
            className="tabular"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--accent-sage)",
            }}
          >
            {digest.streak.logged}/{digest.streak.window}
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginLeft: 3,
                fontWeight: 600,
              }}
            >
              check-ins
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: "var(--border-light)",
            overflow: "hidden",
          }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(completion * 100)}
        >
          <div
            style={{
              width: `${Math.round(completion * 100)}%`,
              height: "100%",
              background: "var(--accent-sage)",
            }}
          />
        </div>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {digest.summaries.map((s, i) => (
            <li
              key={i}
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                display: "flex",
                gap: 6,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent-sage)",
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
