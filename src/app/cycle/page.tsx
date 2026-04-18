/**
 * /cycle - Natural Cycles-equivalent dedicated landing
 *
 * Signature UX ported from Natural Cycles:
 *   - Big today-fertile-status card (green / red / yellow)
 *   - BBT entry (inline morning-temp log)
 *   - 30-day fertility calendar (green/red day strip)
 *   - Period prediction countdown
 *
 * Not contraception. Awareness only. Copy calls this out explicitly.
 * For actual contraception, the user should use Natural Cycles or a
 * method with FDA clearance.
 */

import { createServiceClient } from "@/lib/supabase";
import { format, addDays, startOfDay } from "date-fns";
import { getCurrentCycleDay } from "@/lib/cycle/current-day";
import { classifyFertileWindow, type FertileSignal } from "@/lib/cycle/fertile-window";
import { loadBbtLog, detectOvulationShift } from "@/lib/cycle/bbt-log";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<FertileSignal["status"], { bg: string; ring: string; label: string }> = {
  green: {
    bg: "linear-gradient(180deg, #E8F0EB 0%, #D2E2D6 100%)",
    ring: "var(--accent-sage)",
    label: "Low",
  },
  red: {
    bg: "linear-gradient(180deg, #F6E0E0 0%, #EDC9C9 100%)",
    ring: "var(--accent-blush)",
    label: "High",
  },
  yellow: {
    bg: "linear-gradient(180deg, #F6EEDE 0%, #EDE1C9 100%)",
    ring: "var(--phase-luteal)",
    label: "Uncertain",
  },
};

export default async function CyclePage({
  searchParams,
}: {
  searchParams: Promise<{ bbt?: string }>;
}) {
  const sp = await searchParams;
  const bbtSaved = sp.bbt === "1";
  const todayISO = format(new Date(), "yyyy-MM-dd");

  const [cycle, bbtLog] = await Promise.all([
    getCurrentCycleDay(todayISO),
    loadBbtLog(),
  ]);

  const confirmedOvulation = detectOvulationShift(bbtLog);
  const signal = classifyFertileWindow({
    cycleDay: cycle.day,
    phase: cycle.phase as "menstrual" | "follicular" | "ovulatory" | "luteal" | null,
    isUnusuallyLong: cycle.isUnusuallyLong ?? false,
    confirmedOvulation,
  });
  const statusStyle = STATUS_COLOR[signal.status];

  // 30-day strip: compute a lightweight fertile classification per day.
  // We only need today's cycleDay to extrapolate the prior/next days.
  const stripDates: Array<{ iso: string; cd: number | null; status: FertileSignal["status"]; label: string }> = [];
  for (let offset = -14; offset <= 15; offset++) {
    const d = format(addDays(startOfDay(new Date(todayISO + "T00:00:00")), offset), "yyyy-MM-dd");
    const cd = cycle.day !== null ? cycle.day + offset : null;
    // Fast heuristic, no re-querying:
    let st: FertileSignal["status"] = "yellow";
    let lbl = "";
    if (cd !== null) {
      if (cd <= 0) {
        st = "yellow";
        lbl = "prior cycle";
      } else if (cd <= 7) {
        st = "green";
        lbl = "low";
      } else if (cd <= 19) {
        st = "red";
        lbl = "fertile window";
      } else if (cd <= 35) {
        st = confirmedOvulation ? "green" : "yellow";
        lbl = "luteal";
      } else {
        st = "yellow";
        lbl = "long cycle";
      }
    }
    stripDates.push({ iso: d, cd, status: st, label: lbl });
  }

  // Next-period projection: if cycle.day is known and cycle length is
  // typical (28), the next period starts ~28 - cycle.day days from today.
  const typicalLength = 28;
  const daysUntilPeriod = cycle.day !== null ? Math.max(0, typicalLength - cycle.day + 1) : null;

  const latestBbt = bbtLog.entries[bbtLog.entries.length - 1] ?? null;

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
        href="/"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
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
          Cycle
        </span>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>Today</h1>
      </div>

      {bbtSaved && (
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
          BBT logged. Ovulation detection refreshed.
        </div>
      )}

      {/* Big fertile status card - Natural Cycles signature */}
      <div
        style={{
          padding: "22px 24px",
          borderRadius: 22,
          background: statusStyle.bg,
          border: `2px solid ${statusStyle.ring}`,
          boxShadow: "var(--shadow-md)",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: "white",
            border: `4px solid ${statusStyle.ring}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="tabular"
              style={{
                fontSize: 28,
                fontWeight: 800,
                lineHeight: 1,
                color: statusStyle.ring,
              }}
            >
              {cycle.day ?? "\u2014"}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              CD
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: statusStyle.ring,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 2,
            }}
          >
            Fertility today &middot; {statusStyle.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            {signal.label}
          </div>
          <p style={{ fontSize: 13, margin: 0, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            {signal.detail}
          </p>
        </div>
      </div>

      {/* 30-day fertility strip */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            30-day window
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            today is centered
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${stripDates.length}, 1fr)`,
            gap: 2,
          }}
        >
          {stripDates.map((d) => (
            <a
              key={d.iso}
              href={`/topics/cycle?date=${d.iso}`}
              title={`${d.iso} ${d.label}`}
              style={{
                aspectRatio: "1 / 2.5",
                borderRadius: 3,
                background:
                  d.status === "green"
                    ? "var(--accent-sage)"
                    : d.status === "red"
                      ? "var(--accent-blush)"
                      : "var(--phase-luteal)",
                opacity: d.iso === todayISO ? 1 : 0.7,
                outline: d.iso === todayISO ? "2px solid var(--text-primary)" : "none",
                outlineOffset: 1,
                display: "block",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-secondary)" }}>
          <Legend color="var(--accent-sage)" label="Low" />
          <Legend color="var(--accent-blush)" label="Possible fertile" />
          <Legend color="var(--phase-luteal)" label="Uncertain" />
        </div>
      </section>

      {/* Countdown card */}
      {daysUntilPeriod !== null && (
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
            }}
          >
            Period projection (assuming {typicalLength}-day cycle)
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
            {daysUntilPeriod === 0 ? "Expected today" : `${daysUntilPeriod} day${daysUntilPeriod === 1 ? "" : "s"} away`}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Projection adjusts as new cycle data logs.
          </div>
        </div>
      )}

      {/* BBT log */}
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
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Basal body temperature
        </div>
        {latestBbt && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Latest:{" "}
            <strong className="tabular">
              {latestBbt.temp_f.toFixed(2)}&deg;F ({latestBbt.temp_c.toFixed(2)}&deg;C)
            </strong>{" "}
            on {format(new Date(latestBbt.date + "T00:00:00"), "MMM d")}
            {confirmedOvulation && (
              <span style={{ marginLeft: 8, color: "var(--accent-sage)", fontWeight: 700 }}>
                Shift detected
              </span>
            )}
          </div>
        )}
        <form
          action="/api/cycle/bbt"
          method="post"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 120px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Fahrenheit
            </span>
            <input
              type="number"
              step="0.01"
              min="86"
              max="113"
              name="temp_f"
              placeholder="97.90"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-light)",
                fontSize: 14,
                fontWeight: 600,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 120px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Celsius
            </span>
            <input
              type="number"
              step="0.01"
              min="30"
              max="45"
              name="temp_c"
              placeholder="36.60"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border-light)",
                fontSize: 14,
                fontWeight: 600,
              }}
            />
          </label>
          <input type="hidden" name="date" value={todayISO} />
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "var(--accent-sage)",
              color: "var(--text-inverse)",
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Log temp
          </button>
        </form>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
          Take BBT first thing in the morning before getting out of
          bed. Consistency matters more than precision.
        </p>
      </section>

      {/* Disclaimer */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--bg-primary)",
          border: "1px dashed var(--border-light)",
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        <strong>This is not a contraception algorithm.</strong> LanaeHealth
        shows fertile-window awareness for cycle insight. For actual
        contraception, use Natural Cycles (FDA-cleared) or consult a
        clinician. Our algorithm is conservative and not validated for
        birth control.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/topics/cycle"
          className="press-feedback"
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          Cycle phases explainer
        </Link>
        <Link
          href="/topics/cycle/hormones"
          className="press-feedback"
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          Hormone log
        </Link>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
        }}
      />
      {label}
    </span>
  );
}
