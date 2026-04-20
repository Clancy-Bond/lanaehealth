import { createServiceClient } from "@/lib/supabase";
import { loadPainSparkline } from "@/lib/symptoms/queries";
import Link from "next/link";

function painColor(v: number | null): string {
  if (v === null) return "var(--text-muted)";
  if (v <= 2) return "var(--pain-none)";
  if (v <= 4) return "var(--pain-low)";
  if (v <= 6) return "var(--pain-moderate)";
  return "var(--pain-severe)";
}

function weekdayLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export default async function Pain7dSparkline() {
  const sb = createServiceClient();
  const points = await loadPainSparkline(sb, 7);

  const loggedPoints = points.filter((p) => p.overallPain !== null);
  const average =
    loggedPoints.length > 0
      ? loggedPoints.reduce((sum, p) => sum + (p.overallPain ?? 0), 0) /
        loggedPoints.length
      : null;

  return (
    <section
      aria-label="Pain trend for the last seven days"
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
          Pain this week
        </h3>
        <Link
          href="/patterns/symptoms"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--accent-sage)",
            textDecoration: "none",
          }}
        >
          See details
        </Link>
      </header>

      {loggedPoints.length === 0 ? (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            margin: "0.25rem 0 0",
          }}
        >
          No pain entries yet for this window. Come back when you are up for it.
        </p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${points.length}, 1fr)`,
              alignItems: "end",
              gap: 4,
              height: 72,
            }}
            role="img"
            aria-label={`Seven-day pain. Average ${average?.toFixed(1) ?? "no data"} out of ten.`}
          >
            {points.map((p) => {
              const pct =
                p.overallPain !== null ? (p.overallPain / 10) * 100 : 8;
              return (
                <div
                  key={p.date}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(pct, 8)}%`,
                      borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                      background:
                        p.overallPain === null
                          ? "rgba(139,143,150,0.18)"
                          : painColor(p.overallPain),
                      transition: "background var(--duration-fast) var(--ease-standard)",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${points.length}, 1fr)`,
              marginTop: 4,
              gap: 4,
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            {points.map((p) => (
              <span key={p.date}>{weekdayLabel(p.date)}</span>
            ))}
          </div>
          {average !== null && (
            <p
              style={{
                margin: "0.75rem 0 0",
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
              }}
            >
              Average {average.toFixed(1)} of 10 across {loggedPoints.length} logged day
              {loggedPoints.length === 1 ? "" : "s"}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
