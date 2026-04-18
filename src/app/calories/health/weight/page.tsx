/**
 * Calories &raquo; Health &raquo; Weight
 *
 * Weigh-in form + trend chart. Mirrors MyNetDiary's Weight page
 * plus their "maintained / gained / lost since" callout.
 */

import { loadWeightLog, kgToLb, latestEntry, entryDaysAgo } from "@/lib/calories/weight";
import { CaloriesSubNav } from "@/components/calories/SubNav";
import { loadNutritionGoals } from "@/lib/calories/goals";
import { format } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WeightPage() {
  const [log, goals] = await Promise.all([loadWeightLog(), loadNutritionGoals()]);
  const latest = latestEntry(log);
  const weekAgo = entryDaysAgo(log, 7);
  const monthAgo = entryDaysAgo(log, 30);

  const todayISO = format(new Date(), "yyyy-MM-dd");

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
        href="/calories"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        &lsaquo; Calories
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
          Calories &middot; Health
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Weight</h1>
        <CaloriesSubNav current="dashboard" />
      </div>

      {/* Current weight + deltas */}
      {latest ? (
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 16,
            background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
            }}
          >
            Current weight
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="tabular" style={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
              {kgToLb(latest.kg).toFixed(1)}
            </span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
              lb &middot; {latest.kg.toFixed(1)} kg
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Last weighed{" "}
            {latest.date === todayISO
              ? "today"
              : format(new Date(latest.date + "T00:00:00"), "EEE MMM d")}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 8,
              marginTop: 14,
            }}
          >
            <Delta label="vs last week" from={weekAgo?.kg ?? null} to={latest.kg} />
            <Delta label="vs last month" from={monthAgo?.kg ?? null} to={latest.kg} />
            {goals.weight.targetKg !== null && (
              <Delta
                label="to target"
                from={latest.kg}
                to={goals.weight.targetKg}
                positiveLabel="to go"
              />
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>No weigh-ins yet</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Enter your first weight below.
          </p>
        </div>
      )}

      {/* Weigh-in form */}
      <form
        action="/api/weight/log"
        method="post"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "flex-end",
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted)" }}>
            Pounds
          </span>
          <input
            type="number"
            step="0.1"
            min="40"
            max="880"
            name="lb"
            defaultValue={latest ? kgToLb(latest.kg).toFixed(1) : ""}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-light)",
              fontSize: 15,
              fontWeight: 600,
            }}
          />
        </label>
        <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 4px 10px" }}>or</div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted)" }}>
            Kilograms
          </span>
          <input
            type="number"
            step="0.1"
            min="20"
            max="400"
            name="kg"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-light)",
              fontSize: 15,
              fontWeight: 600,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "2 1 200px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted)" }}>
            Note (optional)
          </span>
          <input
            type="text"
            name="notes"
            placeholder="morning, post-workout, etc."
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border-light)",
              fontSize: 14,
            }}
          />
        </label>
        <button
          type="submit"
          style={{
            padding: "10px 18px",
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
          Weigh-in
        </button>
      </form>

      {/* Trend chart */}
      {log.entries.length >= 2 && <WeightChart log={log} goalKg={goals.weight.targetKg} />}

      {/* History list */}
      {log.entries.length > 0 && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 8,
            }}
          >
            History ({log.entries.length} weigh-ins)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[...log.entries].reverse().slice(0, 20).map((e) => (
              <div
                key={e.date}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: "var(--bg-primary)",
                  fontSize: 13,
                }}
              >
                <span>{format(new Date(e.date + "T00:00:00"), "EEE MMM d")}</span>
                <span className="tabular" style={{ fontWeight: 600 }}>
                  {kgToLb(e.kg).toFixed(1)} lb
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Delta({
  label,
  from,
  to,
  positiveLabel,
}: {
  label: string;
  from: number | null;
  to: number;
  positiveLabel?: string;
}) {
  if (from === null || from === to) {
    return (
      <div
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          fontSize: 12,
        }}
      >
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em", fontWeight: 700 }}>
          {label}
        </div>
        <div style={{ color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>
          {from === null ? "not enough history" : "no change"}
        </div>
      </div>
    );
  }
  const deltaKg = to - from;
  const deltaLb = kgToLb(deltaKg);
  const color = deltaKg > 0 ? "var(--accent-blush)" : "var(--accent-sage)";
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        fontSize: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ color, fontWeight: 700, marginTop: 2, fontSize: 13 }}>
        <span className="tabular">
          {deltaKg > 0 ? "+" : ""}
          {deltaLb.toFixed(1)} lb
        </span>{" "}
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
          {positiveLabel ?? ""}
        </span>
      </div>
    </div>
  );
}

function WeightChart({ log, goalKg }: { log: import("@/lib/calories/weight").WeightLog; goalKg: number | null }) {
  const width = 680;
  const height = 140;
  const padding = 16;
  const entries = log.entries;
  const lbs = entries.map((e) => kgToLb(e.kg));
  const rawMax = Math.max(...lbs, goalKg ? kgToLb(goalKg) : 0);
  const rawMin = Math.min(...lbs, goalKg ? kgToLb(goalKg) : Infinity);
  const max = rawMax + (rawMax - rawMin) * 0.1 + 1;
  const min = Math.max(0, rawMin - (rawMax - rawMin) * 0.1 - 1);
  const range = Math.max(1, max - min);

  const xStep = (width - 2 * padding) / Math.max(1, entries.length - 1);
  const points = entries.map((e, i) => {
    const x = padding + i * xStep;
    const y = height - padding - ((kgToLb(e.kg) - min) / range) * (height - 2 * padding);
    return { x, y, date: e.date, lb: kgToLb(e.kg) };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const goalY = goalKg !== null
    ? height - padding - ((kgToLb(goalKg) - min) / range) * (height - 2 * padding)
    : null;

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
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
          Trend
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {entries.length} weigh-ins
        </span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Weight trend"
      >
        {goalY !== null && (
          <>
            <line
              x1={padding}
              x2={width - padding}
              y1={goalY}
              y2={goalY}
              stroke="var(--accent-sage)"
              strokeDasharray="4 3"
              strokeWidth="1.5"
            />
            <text
              x={width - padding}
              y={goalY - 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--accent-sage)"
            >
              goal {kgToLb(goalKg!).toFixed(0)} lb
            </text>
          </>
        )}
        <path d={path} fill="none" stroke="var(--accent-sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r="3" fill="var(--accent-sage)" />
        ))}
      </svg>
    </div>
  );
}
