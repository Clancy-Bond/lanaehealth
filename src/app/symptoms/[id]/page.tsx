import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import {
  loadSymptomHistory,
  loadTopTriggers,
} from "@/lib/symptoms/queries";

export const dynamic = "force-dynamic";

interface SymptomDetailProps {
  params: Promise<{ id: string }>;
}

function severityColor(sev: string | null): string {
  switch (sev) {
    case "severe":
      return "var(--pain-severe)";
    case "moderate":
      return "var(--pain-moderate)";
    case "mild":
      return "var(--pain-mild)";
    default:
      return "var(--text-muted)";
  }
}

function severityHeight(sev: string | null): number {
  switch (sev) {
    case "severe":
      return 100;
    case "moderate":
      return 66;
    case "mild":
      return 33;
    default:
      return 12;
  }
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export async function generateMetadata({ params }: SymptomDetailProps) {
  const { id } = await params;
  const label = decodeURIComponent(id);
  return {
    title: `${label} · LanaeHealth`,
  };
}

export default async function SymptomDetailPage({ params }: SymptomDetailProps) {
  const { id } = await params;
  const raw = decodeURIComponent(id).trim();
  if (!raw) notFound();
  const sb = createServiceClient();

  const [history, triggers] = await Promise.all([
    loadSymptomHistory(sb, raw, 60),
    loadTopTriggers(sb, 14, 5),
  ]);

  const latest = history[0] ?? null;

  let medsRows: Array<{
    name: string;
    effectiveness: number | null;
    latest: string | null;
  }> = [];
  try {
    const { data } = await sb
      .from("medications")
      .select("name, effectiveness_rating, last_effectiveness_at")
      .order("last_effectiveness_at", { ascending: false })
      .limit(5);
    medsRows = (data ?? []).map((r) => ({
      name: (r as { name: string }).name,
      effectiveness: (r as { effectiveness_rating: number | null })
        .effectiveness_rating,
      latest: (r as { last_effectiveness_at: string | null })
        .last_effectiveness_at,
    }));
  } catch {
    medsRows = [];
  }

  const severityCounts = { mild: 0, moderate: 0, severe: 0 } as Record<string, number>;
  for (const h of history) {
    if (h.severity && h.severity in severityCounts) {
      severityCounts[h.severity] += h.count;
    }
  }
  const totalLogged = history.reduce((sum, h) => sum + h.count, 0);

  return (
    <main
      style={{
        background: "var(--bg-primary)",
        minHeight: "100vh",
        paddingBottom: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          marginInline: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            gap: "0.5rem",
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          <Link href="/symptoms" style={{ color: "var(--accent-sage)", textDecoration: "none" }}>
            Symptoms
          </Link>
          <span>/</span>
          <span style={{ textTransform: "capitalize" }}>{raw}</span>
        </nav>

        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              textTransform: "capitalize",
            }}
          >
            {raw}
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            Last 60 days · {totalLogged} total entries
            {latest ? ` · latest ${prettyDate(latest.date)}` : ""}
          </p>
        </header>

        <section
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
          aria-label="Severity trend"
        >
          <h2
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 0.5rem",
            }}
          >
            Severity trend
          </h2>
          {history.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              No entries in the last 60 days. Past days with no data show as
              absence, not shame. Come back when you are up for it.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 3,
                height: 96,
                alignItems: "flex-end",
                overflowX: "auto",
              }}
            >
              {history
                .slice()
                .reverse()
                .map((h) => (
                  <div
                    key={h.date}
                    title={`${h.date}: ${h.severity ?? "unknown"} (${h.count})`}
                    style={{
                      flex: "0 0 10px",
                      height: `${severityHeight(h.severity)}%`,
                      background: severityColor(h.severity),
                      borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                    }}
                  />
                ))}
            </div>
          )}
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              gap: "0.75rem",
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
              flexWrap: "wrap",
            }}
          >
            {Object.entries(severityCounts).map(([sev, count]) => (
              <span
                key={sev}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: severityColor(sev),
                    display: "inline-block",
                  }}
                />
                {sev} · {count}
              </span>
            ))}
          </div>
        </section>

        <section
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
          aria-label="Possible triggers"
        >
          <h2
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 0.5rem",
            }}
          >
            Possible triggers
          </h2>
          {triggers.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              Not enough data yet to suggest triggers. More entries sharpen this.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
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
                    {t.linkedSymptomDays}/{t.occurrences} days w/ symptoms
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
            }}
          >
            Same-day co-occurrence only. /patterns/symptoms runs the lag-aware
            correlation engine.
          </p>
        </section>

        <section
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
          aria-label="Medications that helped"
        >
          <h2
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 0.5rem",
            }}
          >
            Medications rated recently
          </h2>
          {medsRows.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              No medication-effectiveness ratings yet. Rate a PRN med the next
              time you log one to start building the picture.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
              }}
            >
              {medsRows.map((m) => (
                <li
                  key={m.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-input)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-sm)",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {m.name}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      color:
                        m.effectiveness !== null && m.effectiveness >= 4
                          ? "var(--accent-sage)"
                          : m.effectiveness !== null && m.effectiveness <= 2
                            ? "var(--accent-blush)"
                            : "var(--text-secondary)",
                    }}
                  >
                    {m.effectiveness !== null ? `${m.effectiveness}/5` : "unrated"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href="/log"
            style={{
              flex: 1,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-md)",
              background: "var(--accent-sage)",
              color: "#fff",
              textDecoration: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
            }}
          >
            Log another
          </Link>
          <Link
            href="/symptoms"
            style={{
              flex: 1,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(107,144,128,0.25)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              textDecoration: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
            }}
          >
            All symptoms
          </Link>
        </div>
      </div>
    </main>
  );
}
