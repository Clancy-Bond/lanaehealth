import { createServiceClient } from "@/lib/supabase";
import { DEFAULT_PILLS } from "@/lib/symptoms/types";
import { loadTodaySymptoms } from "@/lib/symptoms/queries";
import Link from "next/link";

/**
 * "today-symptom-grid" home widget.
 *
 * Lets Lanae tap a pill from Home to log a symptom without navigating
 * into the Symptoms tab. Posts to /api/symptoms/quick-log which creates
 * or reuses today's daily_log row. Each pill shows a dot when already
 * logged today.
 */
export default async function TodaySymptomGrid({ date }: { date: string }) {
  const sb = createServiceClient();
  const todays = await loadTodaySymptoms(sb, date);
  const activeLabels = new Set(todays.map((s) => s.symptom.toLowerCase()));

  return (
    <section
      aria-label="Quick symptom log"
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <h3
          style={{
            fontSize: "var(--text-base)",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          How are you right now?
        </h3>
        <Link
          href="/log"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--accent-sage)",
            textDecoration: "none",
          }}
        >
          Full log
        </Link>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {DEFAULT_PILLS.slice(0, 8).map((p) => {
          const active = activeLabels.has(p.symptom.toLowerCase());
          return (
            <form key={p.id} action="/api/symptoms/quick-log" method="post">
              <input type="hidden" name="symptom" value={p.symptom} />
              <input type="hidden" name="category" value={p.category} />
              <input type="hidden" name="severity" value="moderate" />
              <input type="hidden" name="returnTo" value="/" />
              <button
                type="submit"
                aria-pressed={active}
                aria-label={
                  active
                    ? `${p.symptom} already logged today, tap to log another`
                    : `Log ${p.symptom}`
                }
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: "0.625rem 0.25rem",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${
                    active ? "var(--accent-blush)" : "rgba(107,144,128,0.18)"
                  }`,
                  background: active ? "var(--accent-blush-muted)" : "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: "var(--text-xs)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <span aria-hidden style={{ fontSize: 20 }}>
                  {p.icon}
                </span>
                <span style={{ lineHeight: 1.15 }}>{p.symptom}</span>
                {active && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent-blush)",
                    }}
                  />
                )}
              </button>
            </form>
          );
        })}
      </div>
      <p
        style={{
          marginTop: "0.75rem",
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
        }}
      >
        Each tap saves an entry with the exact time. Dots mean already logged today.
      </p>
    </section>
  );
}
