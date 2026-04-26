/**
 * Calories » Health » Heart rate
 *
 * MyNetDiary parity (GAP #16). Ad-hoc heart-rate spot-checks. Oura
 * already tracks resting HR each night; this log is for standing
 * HR, post-orthostatic HR, palpitation moments, etc. - the signals
 * that matter for POTS management.
 */

import Link from "next/link";
import { format } from "date-fns";
import {
  loadHeartRateLog,
  hrContextLabel,
  HR_CONTEXTS,
} from "@/lib/calories/heart-rate";

export const dynamic = "force-dynamic";

export default async function HeartRatePage() {
  const log = await loadHeartRateLog();
  const latest = log.entries[0] ?? null;
  const defaultDate = format(new Date(), "yyyy-MM-dd");

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        paddingBottom: 96,
      }}
    >
      <Link
        href="/calories"
        style={{
          fontSize: 12,
          color: "var(--accent-sage)",
          textDecoration: "none",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        &lsaquo; Calories
      </Link>

      <div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Health &middot; Heart rate
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Heart rate log</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 0", lineHeight: 1.5 }}>
          Spot-checks for standing HR, post-orthostatic HR, palpitation
          events. Resting HR from Oura is under{" "}
          <Link href="/activity" style={{ color: "var(--accent-sage)" }}>
            Activity
          </Link>
          .
        </p>
      </div>

      {latest && (
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderLeft: "3px solid var(--accent-sage)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Most recent
            </div>
            <div className="tabular" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
              {latest.bpm}
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>bpm</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {format(new Date(latest.date + "T00:00:00"), "EEE MMM d")}
              {latest.time ? ` · ${latest.time}` : ""} · {hrContextLabel(latest.context)}
            </div>
          </div>
        </div>
      )}

      <form
        action="/api/hr/log"
        method="post"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "16px 18px",
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
          Log a reading
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <label style={labelStyle}>
            <span>Date</span>
            <input type="date" name="date" defaultValue={defaultDate} required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>Time (optional)</span>
            <input type="time" name="time" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>bpm</span>
            <input type="number" name="bpm" min={20} max={250} step={1} required placeholder="80" style={inputStyle} />
          </label>
        </div>
        <label style={labelStyle}>
          <span>Context</span>
          <select name="context" defaultValue="standing" style={inputStyle}>
            {HR_CONTEXTS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          <span>Notes (optional)</span>
          <input type="text" name="notes" maxLength={280} placeholder="e.g. right after standing" style={inputStyle} />
        </label>
        <button
          type="submit"
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginTop: 4,
          }}
        >
          Save reading
        </button>
      </form>

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Recent readings
        </div>
        {log.entries.length === 0 ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            No readings yet.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {log.entries.slice(0, 20).map((e) => (
              <li
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-light)",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                  {format(new Date(e.date + "T00:00:00"), "MMM d")}
                  {e.time ? ` · ${e.time}` : ""}
                </span>
                <span>
                  <span style={{ color: "var(--text-muted)" }}>{hrContextLabel(e.context)}</span>
                  {e.notes ? (
                    <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                      {e.notes}
                    </span>
                  ) : null}
                </span>
                <span className="tabular" style={{ fontWeight: 700, color: "var(--accent-sage)" }}>
                  {e.bpm}
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 3 }}>bpm</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-light)",
  background: "var(--bg-primary)",
  fontSize: 14,
  color: "var(--text-primary)",
};
