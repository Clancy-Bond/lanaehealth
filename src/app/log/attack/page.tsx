import Link from "next/link";
import HeadacheQuickLog from "@/components/log/HeadacheQuickLog";
import { getActiveAttack } from "@/lib/api/headache";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Attack log · LanaeHealth",
};

async function getRecentAttacks() {
  const sb = createServiceClient();
  try {
    const { data } = await sb
      .from("headache_attacks")
      .select("id, started_at, ended_at, severity, cycle_phase, triggers")
      .order("started_at", { ascending: false })
      .limit(5);
    return data ?? [];
  } catch {
    return [];
  }
}

function durationLabel(started: string, ended: string | null): string {
  if (!ended) return "ongoing";
  const ms = new Date(ended).getTime() - new Date(started).getTime();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / 60000)} min`;
  return `${hours.toFixed(1)} hr`;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function AttackLogPage() {
  // Server-fetch is best-effort; the client component refetches if needed.
  let initialActive = null;
  try {
    initialActive = await getActiveAttack();
  } catch {
    initialActive = null;
  }
  const recent = await getRecentAttacks();

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
          maxWidth: 640,
          marginInline: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
            }}
          >
            <Link
              href="/log"
              style={{ color: "var(--accent-sage)", textDecoration: "none" }}
            >
              Log
            </Link>
            <span>/</span>
            <span>Attack</span>
          </div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Attack log
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            One tap starts a timer. Fill in zones, triggers, and medications as it
            unfolds. End the attack when relief hits.
          </p>
        </header>

        <HeadacheQuickLog initialActive={initialActive} />

        <section
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2
            style={{
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 0.5rem",
            }}
          >
            Recent attacks
          </h2>
          {recent.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              No past attacks yet. When you start one it will show up here.
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
              {recent.map((a) => (
                <li
                  key={a.id as string}
                  style={{
                    padding: "0.625rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-input)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
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
                      {dateLabel(a.started_at as string)}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {durationLabel(a.started_at as string, a.ended_at as string | null)}
                      {a.cycle_phase ? ` · ${a.cycle_phase}` : ""}
                      {Array.isArray(a.triggers) && a.triggers.length > 0
                        ? ` · ${(a.triggers as string[]).slice(0, 2).join(", ")}`
                        : ""}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      padding: "0.25rem 0.5rem",
                      borderRadius: "var(--radius-full)",
                      background: "var(--bg-card)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {a.severity !== null && a.severity !== undefined
                      ? `${a.severity}/10`
                      : "-"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p
            style={{
              marginTop: "0.75rem",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
            }}
          >
            Data lives in headache_attacks. See /patterns for migraine-cycle
            correlations.
          </p>
        </section>
      </div>
    </main>
  );
}
