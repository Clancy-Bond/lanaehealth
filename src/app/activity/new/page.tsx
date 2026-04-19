/**
 * /activity/new — Log a manual workout
 *
 * MyNetDiary parity (GAP #14). Oura already auto-logs steps + active
 * calories, but not every session shows up there (indoor, no HR, PT
 * sessions, etc). This form writes to health_profile.workouts so the
 * /activity dashboard can surface both sources together.
 */

import Link from "next/link";
import { WORKOUT_TYPES } from "@/lib/calories/workouts";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function NewWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const defaultDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : format(new Date(), "yyyy-MM-dd");

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 560,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Link
        href="/activity"
        style={{
          fontSize: 12,
          color: "var(--accent-sage)",
          textDecoration: "none",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        &lsaquo; Back to Activity
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Log a workout</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
        Complements Oura. Use this for anything Oura may miss: indoor
        cycling, PT sessions, yoga without HR, strength training at
        bodyweight. The calories field is your best estimate — not a
        hard science. The entry lands under the Activity dashboard
        alongside Oura totals.
      </p>
      <form
        action="/api/activity/log"
        method="post"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "16px 18px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <label style={labelStyle}>
          <span>Date</span>
          <input
            type="date"
            name="date"
            defaultValue={defaultDate}
            required
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>Type</span>
          <select name="type" required style={inputStyle} defaultValue="walking">
            {WORKOUT_TYPES.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={labelStyle}>
            <span>Duration (min)</span>
            <input
              type="number"
              name="durationMin"
              min={1}
              max={480}
              step={1}
              required
              placeholder="30"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Calories burned</span>
            <input
              type="number"
              name="calories"
              min={0}
              max={5000}
              step={1}
              required
              placeholder="150"
              style={inputStyle}
            />
          </label>
        </div>

        <label style={labelStyle}>
          <span>Notes (optional)</span>
          <textarea
            name="notes"
            maxLength={280}
            rows={3}
            placeholder="How it felt, pace, anything worth remembering"
            style={{
              ...inputStyle,
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: 60,
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="submit"
            className="press-feedback"
            style={{
              flex: 1,
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
            }}
          >
            Save workout
          </button>
          <Link
            href="/activity"
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              border: "1px solid var(--border-light)",
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
      <div
        style={{
          padding: 12,
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "var(--text-secondary)" }}>POTS note:</strong>{" "}
        high-intensity cardio is not always the right call on low-
        readiness days. Check the Activity dashboard for readiness
        context before committing to a hard session.
      </div>
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
