// ARCHIVED: This legacy route is now redirected to /v2/labs via next.config.ts.
// Kept in source for fast revert. To revive: remove the redirect in next.config.ts.
// Cutover landed: 2026-04-25 (legacy → v2 unified merge).

/**
 * /labs - lab result trending overview
 *
 * Surfaces patterns Lanae can bring to her next specialist:
 *   - Abnormal (flagged) results at the top, newest first
 *   - Per-test trend mini-charts grouped by test_name
 *   - Click through to the full /records for context
 *
 * Depends on existing lab_results table. No migrations.
 */

import { createServiceClient } from "@/lib/supabase";
import type { LabResult } from "@/lib/types";
import Link from "next/link";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface Group {
  name: string;
  unit: string | null;
  entries: LabResult[];
}

export default async function LabsPage() {
  const sb = createServiceClient();
  const { data } = await sb
    .from("lab_results")
    .select("*")
    .order("date", { ascending: true });
  const all = ((data ?? []) as unknown) as LabResult[];

  // Group by test_name.
  const groups = new Map<string, Group>();
  for (const r of all) {
    const key = (r.test_name ?? "").trim();
    if (!key) continue;
    const g = groups.get(key) ?? { name: key, unit: r.unit, entries: [] };
    g.entries.push(r);
    g.unit = g.unit ?? r.unit;
    groups.set(key, g);
  }

  // Abnormal = flag != null and not 'normal'.
  const abnormal = all
    .filter((r) => r.flag && r.flag !== "normal")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  // Multi-test groups first (those with 2+ entries get a chart).
  const trendGroups = [...groups.values()]
    .filter((g) => g.entries.length >= 2)
    .sort((a, b) => b.entries.length - a.entries.length);

  const totalTests = all.length;
  const uniqueTests = groups.size;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 16,
        maxWidth: 920,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        &lsaquo; Home
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Labs
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Lab trends</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          <span className="tabular">{totalTests}</span> lab values logged across{" "}
          <span className="tabular">{uniqueTests}</span> unique tests. Flagged
          (abnormal) results surface at the top. Tests with multiple readings
          show a trend sparkline so you can see direction at a glance.
        </p>
      </div>

      {/* Abnormal results */}
      <section
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
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
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Flagged (abnormal)
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {abnormal.length} recent
          </span>
        </div>
        {abnormal.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            No flagged results logged. Either everything has been in range, or
            the lab source hasn't populated reference ranges. Check{" "}
            <Link href="/records" style={{ color: "var(--accent-sage)" }}>
              Records
            </Link>{" "}
            for full history.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {abnormal.map((r) => (
              <LabRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>

      {/* Trends grouped by test */}
      {trendGroups.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-muted)",
              margin: 0,
              padding: "0 4px",
            }}
          >
            Trends
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 10,
            }}
          >
            {trendGroups.map((g) => (
              <TestTrendCard key={g.name} group={g} />
            ))}
          </div>
        </section>
      )}

      {/* Records link */}
      <Link
        href="/records"
        className="press-feedback"
        style={{
          padding: "14px 18px",
          borderRadius: 14,
          background: "linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)",
          color: "var(--text-inverse)",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "var(--shadow-md)",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        Open full records &rarr;
      </Link>
    </div>
  );
}

function LabRow({ row }: { row: LabResult }) {
  const flagColor =
    row.flag === "high" || row.flag === "critical"
      ? "var(--accent-blush)"
      : row.flag === "low"
        ? "var(--phase-follicular)"
        : "var(--text-muted)";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--bg-primary)",
        borderLeft: `3px solid ${flagColor}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.test_name}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {format(new Date(row.date + "T00:00:00"), "MMM d, yyyy")}
          {row.reference_range_low !== null && row.reference_range_high !== null && (
            <>
              {" \u00B7 ref "}
              <span className="tabular">
                {row.reference_range_low}&ndash;{row.reference_range_high}
              </span>
              {row.unit ? ` ${row.unit}` : ""}
            </>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <div
          className="tabular"
          style={{ fontSize: 16, fontWeight: 700, color: flagColor }}
        >
          {row.value ?? "\u2014"}
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 3, fontWeight: 600 }}>
            {row.unit ?? ""}
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: flagColor,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {row.flag}
        </div>
      </div>
    </div>
  );
}

function TestTrendCard({ group }: { group: Group }) {
  const values = group.entries
    .map((r) => r.value)
    .filter((v): v is number => v !== null);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const latest = group.entries[group.entries.length - 1];
  const prior = group.entries[group.entries.length - 2];
  const delta = latest.value !== null && prior.value !== null ? latest.value - prior.value : null;
  const trendIsRising = delta !== null && delta > 0;

  const width = 300;
  const height = 60;
  const padding = 8;
  const step = (width - 2 * padding) / Math.max(1, group.entries.length - 1);
  const points = group.entries
    .filter((r) => r.value !== null)
    .map((r, i) => {
      const x = padding + i * step;
      const y = height - padding - (((r.value as number) - min) / range) * (height - 2 * padding);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

  const refLow = latest.reference_range_low;
  const refHigh = latest.reference_range_high;
  const latestInRange =
    refLow !== null &&
    refHigh !== null &&
    latest.value !== null &&
    latest.value >= refLow &&
    latest.value <= refHigh;

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {group.name}
        </span>
        <span className="tabular" style={{ fontSize: 14, fontWeight: 700 }}>
          {latest.value ?? "\u2014"}
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 3, fontWeight: 600 }}>
            {group.unit ?? ""}
          </span>
        </span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${group.name} trend`}
      >
        <path
          d={points.join(" ")}
          fill="none"
          stroke="var(--accent-sage)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--text-muted)",
        }}
      >
        <span>
          <span className="tabular">{group.entries.length}</span> readings,{" "}
          first {format(new Date(group.entries[0].date + "T00:00:00"), "MMM yyyy")}
        </span>
        {delta !== null && (
          <span
            style={{
              color: trendIsRising ? "var(--accent-blush)" : "var(--accent-sage)",
              fontWeight: 700,
            }}
          >
            {trendIsRising ? "+" : ""}
            {delta.toFixed(2)} vs prior
          </span>
        )}
      </div>
      {refLow !== null && refHigh !== null && (
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
          ref{" "}
          <span className="tabular">
            {refLow}&ndash;{refHigh}
          </span>
          {group.unit ? ` ${group.unit}` : ""}{" "}
          &middot;{" "}
          {latestInRange ? (
            <span style={{ color: "var(--accent-sage)", fontWeight: 700 }}>latest in range</span>
          ) : (
            <span style={{ color: "var(--accent-blush)", fontWeight: 700 }}>latest outside range</span>
          )}
        </div>
      )}
    </div>
  );
}
