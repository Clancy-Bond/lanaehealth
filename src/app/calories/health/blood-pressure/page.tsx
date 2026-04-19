/**
 * Calories » Health » Blood pressure
 *
 * MyNetDiary parity (GAP #16). Ad-hoc BP readings with a clinical
 * classification badge (Normal / Elevated / Stage 1 / Stage 2) and
 * POTS-specific context (optional pulse, position at reading).
 */

import Link from "next/link";
import { format } from "date-fns";
import {
  loadBloodPressureLog,
  classifyBP,
} from "@/lib/calories/blood-pressure";

export const dynamic = "force-dynamic";

export default async function BloodPressurePage() {
  const log = await loadBloodPressureLog();
  const latest = log.entries[0] ?? null;
  const latestClass = latest ? classifyBP(latest.systolic, latest.diastolic) : null;
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
          Health &middot; Blood pressure
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Blood pressure log</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0 0", lineHeight: 1.5 }}>
          Spot-checks you take at home. For orthostatic vitals (lying &rarr; standing
          with timed pulse) use{" "}
          <Link href="/topics/orthostatic/new" style={{ color: "var(--accent-sage)" }}>
            Orthostatic test
          </Link>
          .
        </p>
      </div>

      {latest && latestClass && (
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderLeft: `3px solid ${latestClass.color}`,
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
              {latest.systolic}
              <span style={{ fontSize: 18, color: "var(--text-muted)" }}> / </span>
              {latest.diastolic}
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>mmHg</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {format(new Date(latest.date + "T00:00:00"), "EEE MMM d")}
              {latest.time ? ` · ${latest.time}` : ""}
              {latest.position !== "unknown" ? ` · ${latest.position}` : ""}
            </div>
          </div>
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: latestClass.color,
              color: "var(--text-inverse)",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {latestClass.label}
          </div>
          {latest.pulse !== null && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Pulse{" "}
              <span className="tabular" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                {latest.pulse}
              </span>{" "}
              bpm
            </div>
          )}
        </div>
      )}

      <form
        action="/api/bp/log"
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={labelStyle}>
            <span>Date</span>
            <input type="date" name="date" defaultValue={defaultDate} required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>Time (optional)</span>
            <input type="time" name="time" style={inputStyle} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <label style={labelStyle}>
            <span>Systolic</span>
            <input type="number" name="systolic" min={50} max={260} step={1} required placeholder="120" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>Diastolic</span>
            <input type="number" name="diastolic" min={30} max={180} step={1} required placeholder="80" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>Pulse (optional)</span>
            <input type="number" name="pulse" min={20} max={250} step={1} placeholder="70" style={inputStyle} />
          </label>
        </div>
        <label style={labelStyle}>
          <span>Position</span>
          <select name="position" defaultValue="sitting" style={inputStyle}>
            <option value="sitting">Sitting</option>
            <option value="standing">Standing</option>
            <option value="lying">Lying</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label style={labelStyle}>
          <span>Notes (optional)</span>
          <input type="text" name="notes" maxLength={280} placeholder="e.g. morning, post-coffee" style={inputStyle} />
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
            {log.entries.slice(0, 20).map((e) => {
              const c = classifyBP(e.systolic, e.diastolic);
              return (
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
                    <strong className="tabular">{e.systolic}/{e.diastolic}</strong>
                    {e.pulse !== null && (
                      <span style={{ color: "var(--text-muted)" }}> · pulse {e.pulse}</span>
                    )}
                    {e.position !== "unknown" && (
                      <span style={{ color: "var(--text-muted)" }}> · {e.position}</span>
                    )}
                    {e.notes ? (
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                        {e.notes}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: c.color,
                      color: "var(--text-inverse)",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {c.label}
                  </span>
                </li>
              );
            })}
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
