import { createServiceClient } from "@/lib/supabase";
import { loadTopTriggers } from "@/lib/symptoms/queries";
import Link from "next/link";

function sourceLabel(source: string): string {
  switch (source) {
    case "food":
      return "food";
    case "pain-trigger":
      return "pain log";
    case "symptom":
      return "symptom";
    case "medication":
      return "medication";
    default:
      return source;
  }
}

export default async function TopTriggersCard() {
  const sb = createServiceClient();
  const triggers = await loadTopTriggers(sb, 14, 4);

  return (
    <section
      aria-label="Top triggers this week"
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
          Possible triggers, last 2 weeks
        </h3>
        <Link
          href="/patterns/symptoms"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--accent-sage)",
            textDecoration: "none",
          }}
        >
          Correlations
        </Link>
      </header>

      {triggers.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
          }}
        >
          Not enough data yet to suggest triggers. More entries will sharpen these.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {triggers.map((t) => (
            <li
              key={`${t.source}-${t.label}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-input)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {t.label}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                  }}
                >
                  {t.occurrences}x from {sourceLabel(t.source)}
                </span>
              </div>
              <span
                aria-label={`Co-occurred on ${t.linkedSymptomDays} symptom day${t.linkedSymptomDays === 1 ? "" : "s"}`}
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  padding: "0.25rem 0.5rem",
                  borderRadius: "var(--radius-full)",
                  background:
                    t.linkedSymptomDays > 0
                      ? "var(--accent-blush-muted)"
                      : "rgba(139,143,150,0.15)",
                  color:
                    t.linkedSymptomDays > 0
                      ? "var(--accent-blush)"
                      : "var(--text-secondary)",
                }}
              >
                {t.linkedSymptomDays} match{t.linkedSymptomDays === 1 ? "" : "es"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p
        style={{
          margin: "0.75rem 0 0",
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
        }}
      >
        Based on same-day co-occurrence. Not a causal claim.
      </p>
    </section>
  );
}
