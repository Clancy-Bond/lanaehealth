import Link from "next/link";
import { createServiceClient } from "@/lib/supabase";
import { loadSymptomIndex } from "@/lib/symptoms/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Symptoms · LanaeHealth",
};

function lastSeenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  const days = Math.floor(diffHours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toSlug(symptom: string): string {
  return encodeURIComponent(symptom.toLowerCase());
}

export default async function SymptomsIndexPage() {
  const sb = createServiceClient();
  const entries = await loadSymptomIndex(sb);

  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = grouped.get(e.category) ?? [];
    arr.push(e);
    grouped.set(e.category, arr);
  }
  const categories = Array.from(grouped.keys()).sort();

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
        <header>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0 0 0.25rem",
            }}
          >
            Symptoms
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            Everything you have ever logged, grouped by category. Tap one to see
            its severity trend and what looked like a trigger.
          </p>
        </header>

        <nav
          aria-label="Quick actions"
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/log/quick"
            style={{
              minHeight: 44,
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-full)",
              background: "var(--accent-sage)",
              color: "#fff",
              textDecoration: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Quick log
          </Link>
          <Link
            href="/log/attack"
            style={{
              minHeight: 44,
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-full)",
              background: "var(--bg-card)",
              color: "var(--accent-sage)",
              border: "1px solid var(--accent-sage)",
              textDecoration: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Attack timer
          </Link>
          <Link
            href="/patterns/symptoms"
            style={{
              minHeight: 44,
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-full)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid rgba(107,144,128,0.2)",
              textDecoration: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Patterns
          </Link>
        </nav>

        {entries.length === 0 ? (
          <section
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              boxShadow: "var(--shadow-sm)",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                margin: "0 0 0.5rem",
              }}
            >
              No symptoms logged yet. Come back when you are up for it.
            </p>
            <Link
              href="/log/quick"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "var(--accent-sage)",
                color: "#fff",
                textDecoration: "none",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
              }}
            >
              Start a quick log
            </Link>
          </section>
        ) : (
          categories.map((cat) => {
            const list = grouped.get(cat) ?? [];
            return (
              <section
                key={cat}
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
                    textTransform: "capitalize",
                  }}
                >
                  {cat}
                </h2>
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
                  {list.map((e) => (
                    <li key={e.symptom}>
                      <Link
                        href={`/symptoms/${toSlug(e.symptom)}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.625rem 0.75rem",
                          borderRadius: "var(--radius-md)",
                          background: "var(--bg-input)",
                          textDecoration: "none",
                          color: "var(--text-primary)",
                          minHeight: 44,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "var(--text-sm)",
                            fontWeight: 600,
                          }}
                        >
                          {e.symptom}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "center",
                            fontSize: "var(--text-xs)",
                            color: "var(--text-muted)",
                          }}
                        >
                          <span>
                            {e.totalEntries} entr
                            {e.totalEntries === 1 ? "y" : "ies"}
                          </span>
                          <span>· {lastSeenLabel(e.lastLoggedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
