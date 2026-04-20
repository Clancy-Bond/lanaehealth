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

  // Pull real PRN dose + efficacy data from prn_dose_events (migration 022).
  // Rolls up each medication into helped / no_change / worse / unanswered
  // counts so the symptom detail can show "what worked" without inventing
  // a rating scale that doesn't exist in the DB.
  interface PrnEfficacySummary {
    medication: string;
    total: number;
    helped: number;
    noChange: number;
    worse: number;
    unanswered: number;
    lastDose: string | null;
  }
  let medsRows: PrnEfficacySummary[] = [];
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const { data } = await sb
      .from("prn_dose_events")
      .select("medication_name, poll_response, dose_time")
      .gte("dose_time", sixtyDaysAgo.toISOString())
      .order("dose_time", { ascending: false })
      .limit(200);
    const byMed = new Map<string, PrnEfficacySummary>();
    for (const row of (data ?? []) as Array<{
      medication_name: string;
      poll_response: string | null;
      dose_time: string;
    }>) {
      const key = row.medication_name.trim();
      if (!key) continue;
      const entry =
        byMed.get(key) ??
        {
          medication: key,
          total: 0,
          helped: 0,
          noChange: 0,
          worse: 0,
          unanswered: 0,
          lastDose: null,
        };
      entry.total += 1;
      if (row.poll_response === "helped") entry.helped += 1;
      else if (row.poll_response === "no_change") entry.noChange += 1;
      else if (row.poll_response === "worse") entry.worse += 1;
      else entry.unanswered += 1;
      if (!entry.lastDose || row.dose_time > entry.lastDose) {
        entry.lastDose = row.dose_time;
      }
      byMed.set(key, entry);
    }
    medsRows = [...byMed.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
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
            PRN medications, last 60 days
          </h2>
          {medsRows.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              No PRN doses logged in the last 60 days. Next time you log a
              dose, the post-dose poll will ask &ldquo;Did it help?&rdquo; and
              the answers roll up here.
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
              {medsRows.map((m) => {
                const answered = m.helped + m.noChange + m.worse;
                const helpRate =
                  answered > 0 ? Math.round((m.helped / answered) * 100) : null;
                return (
                  <li
                    key={m.medication}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-input)",
                      gap: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--text-sm)",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.medication}
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {m.total} dose{m.total === 1 ? "" : "s"}
                        {answered > 0
                          ? ` · ${answered} rated`
                          : " · none rated yet"}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: 700,
                        padding: "0.25rem 0.5rem",
                        borderRadius: "var(--radius-full)",
                        background:
                          helpRate === null
                            ? "rgba(139,143,150,0.18)"
                            : helpRate >= 60
                              ? "var(--accent-sage-muted)"
                              : helpRate <= 30
                                ? "var(--accent-blush-muted)"
                                : "var(--bg-card)",
                        color:
                          helpRate === null
                            ? "var(--text-secondary)"
                            : helpRate >= 60
                              ? "var(--accent-sage)"
                              : helpRate <= 30
                                ? "var(--accent-blush)"
                                : "var(--text-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {helpRate === null ? "no rating" : `${helpRate}% helped`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
            }}
          >
            From prn_dose_events: every dose gets a 90-minute follow-up &ldquo;Did it
            help?&rdquo; poll. Counts unrated doses separately so you can see
            when an answer is missing without pressure to backfill.
          </p>
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
