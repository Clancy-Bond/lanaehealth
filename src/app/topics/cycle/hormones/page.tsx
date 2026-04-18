/**
 * Cycle &raquo; Hormones
 *
 * Stardust-pattern explicit hormone-level tracking. Accepts manual
 * entries from lab results, wearable (if supported), or self-report.
 *
 * Shows the history grouped by hormone with a small sparkline per
 * hormone that has at least 2 entries.
 */

import { loadHormoneLog, HORMONE_META, entriesByHormone, type HormoneId } from "@/lib/cycle/hormones";
import Link from "next/link";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function HormonesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const saved = sp.saved === "1";
  const log = await loadHormoneLog();
  const byHormone = entriesByHormone(log);
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const orderedIds = (Object.keys(HORMONE_META) as HormoneId[]).filter((id) => byHormone[id].length > 0);
  const unloggedIds = (Object.keys(HORMONE_META) as HormoneId[]).filter((id) => byHormone[id].length === 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 16,
        maxWidth: 820,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <Link
        href="/topics/cycle"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        &lsaquo; Cycle
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Cycle &middot; Hormones
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Hormone log</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          Explicit tracking of estrogen, progesterone, testosterone, LH,
          FSH, TSH, prolactin, DHEA-S, and cortisol. Most tracking apps
          show cycle phase; few surface the actual hormone values your
          labs come back with. Add entries from your most recent bloodwork
          to see how they move relative to your cycle.
        </p>
      </div>

      {saved && (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--accent-sage-muted)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid var(--accent-sage)",
          }}
        >
          Saved. Entry added to your hormone log.
        </div>
      )}

      {/* Add-entry form */}
      <form
        action="/api/cycle/hormones"
        method="post"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          alignItems: "end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Hormone</span>
          <select
            name="hormone"
            defaultValue="estrogen"
            style={inputStyle}
          >
            {(Object.keys(HORMONE_META) as HormoneId[]).map((id) => (
              <option key={id} value={id}>
                {HORMONE_META[id].label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Value</span>
          <input type="number" step="0.01" name="value" required style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Unit (optional)</span>
          <input type="text" name="unit" placeholder="default per hormone" style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Date</span>
          <input type="date" name="date" defaultValue={todayISO} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={labelStyle}>Source</span>
          <select name="source" defaultValue="lab" style={inputStyle}>
            <option value="lab">Lab result</option>
            <option value="self">Self-reported</option>
            <option value="wearable">Wearable</option>
          </select>
        </label>
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            fontSize: 13,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          Add entry
        </button>
      </form>

      {/* Logged hormones */}
      {orderedIds.map((id) => {
        const entries = byHormone[id];
        const meta = HORMONE_META[id];
        const latest = entries[entries.length - 1];
        return (
          <div
            key={id}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                  {meta.typicalRange}
                </span>
              </div>
              <span className="tabular" style={{ fontSize: 18, fontWeight: 700 }}>
                {latest.value}
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4, fontWeight: 600 }}>
                  {latest.unit}
                </span>
              </span>
            </div>
            {entries.length >= 2 && <Sparkline entries={entries} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[...entries].reverse().slice(0, 8).map((e, i) => (
                <div
                  key={`${e.date}-${i}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "var(--bg-primary)",
                  }}
                >
                  <span>{format(new Date(e.date + "T00:00:00"), "MMM d, yyyy")}</span>
                  <span className="tabular" style={{ fontWeight: 600 }}>
                    {e.value} {e.unit}{" "}
                    <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 10 }}>
                      {e.source}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty states for unlogged hormones */}
      {orderedIds.length === 0 && (
        <div
          style={{
            padding: "20px",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>No entries yet</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Add one above to seed the log.
          </p>
        </div>
      )}

      {unloggedIds.length > 0 && orderedIds.length > 0 && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--bg-primary)",
            border: "1px dashed var(--border-light)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          Not logged yet: {unloggedIds.map((id) => HORMONE_META[id].label).join(", ")}.
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border-light)",
  background: "white",
  fontSize: 14,
};

function Sparkline({ entries }: { entries: import("@/lib/cycle/hormones").HormoneEntry[] }) {
  const width = 560;
  const height = 60;
  const padding = 8;
  const values = entries.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const xStep = (width - 2 * padding) / Math.max(1, entries.length - 1);
  const pts = entries.map((e, i) => {
    const x = padding + i * xStep;
    const y = height - padding - ((e.value - min) / range) * (height - 2 * padding);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={pts.join(" ")} fill="none" stroke="var(--accent-sage)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
