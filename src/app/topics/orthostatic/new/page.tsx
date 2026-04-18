/**
 * Log an orthostatic test. Measures resting + standing HR at 1, 3,
 * 5, 10 minutes. peak_rise_bpm is computed by Postgres (GENERATED
 * ALWAYS) from the 4 standing measurements.
 */

import Link from "next/link";
import { format } from "date-fns";

export const metadata = { title: "New orthostatic test - LanaeHealth" };

export default function NewOrthostaticPage() {
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const nowTime = format(new Date(), "HH:mm");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        maxWidth: 760,
        margin: "0 auto",
        paddingBottom: 96,
      }}
    >
      <Link
        href="/topics/orthostatic"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        &lsaquo; Orthostatic
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
          Orthostatic
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>New test</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
          Take a resting reading lying down, then stand up and record
          HR at 1, 3, 5, and 10 minutes. Peak-rise is computed for you.
          30+ bpm sustained = the POTS positive threshold. See{" "}
          <Link href="/topics/orthostatic" style={{ color: "var(--accent-sage)", fontWeight: 700 }}>
            the explainer
          </Link>{" "}
          for full protocol.
        </p>
      </div>

      <form
        action="/api/orthostatic/tests"
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Section title="When">
          <Row>
            <DateField label="Date" name="test_date" defaultValue={todayISO} required />
            <TimeField label="Time" name="test_time" defaultValue={nowTime} />
          </Row>
        </Section>

        <Section title="Resting (lying down 5+ minutes)">
          <Row>
            <NumField label="Heart rate" name="resting_hr_bpm" unit="bpm" min={30} max={220} required />
            <NumField label="BP systolic" name="resting_bp_systolic" unit="mmHg" min={60} max={240} />
            <NumField label="BP diastolic" name="resting_bp_diastolic" unit="mmHg" min={30} max={150} />
          </Row>
        </Section>

        <Section title="Standing heart rate">
          <Row>
            <NumField label="1 min" name="standing_hr_1min" unit="bpm" min={30} max={220} />
            <NumField label="3 min" name="standing_hr_3min" unit="bpm" min={30} max={220} />
            <NumField label="5 min" name="standing_hr_5min" unit="bpm" min={30} max={220} />
            <NumField label="10 min" name="standing_hr_10min" unit="bpm" min={30} max={220} />
          </Row>
        </Section>

        <Section title="Standing BP (at 10 min)">
          <Row>
            <NumField label="BP systolic" name="standing_bp_systolic_10min" unit="mmHg" min={60} max={240} />
            <NumField label="BP diastolic" name="standing_bp_diastolic_10min" unit="mmHg" min={30} max={150} />
          </Row>
        </Section>

        <Section title="Context">
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Symptoms during test</span>
            <input
              type="text"
              name="symptoms_experienced"
              placeholder="lightheaded, palpitations, blurry vision..."
              style={inputStyle}
            />
          </label>
          <Row>
            <NumField label="Hydration (2 hours prior)" name="hydration_ml" unit="ml" min={0} max={5000} />
            <NumField label="Caffeine (2 hours prior)" name="caffeine_mg" unit="mg" min={0} max={600} />
          </Row>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Notes</span>
            <textarea
              name="notes"
              rows={3}
              placeholder="medication changes, illness, recent exertion..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
        </Section>

        <button
          type="submit"
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            background: "var(--accent-sage)",
            color: "var(--text-inverse)",
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            alignSelf: "flex-start",
          }}
        >
          Save test
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
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
      <h2
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>;
}

function NumField({
  label,
  name,
  unit,
  min,
  max,
  required,
}: {
  label: string;
  name: string;
  unit: string;
  min?: number;
  max?: number;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 130px" }}>
      <span style={labelStyle}>{label}</span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-light)",
          background: "white",
        }}
      >
        <input
          type="number"
          name={name}
          min={min}
          max={max}
          step="1"
          required={required}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 14,
            fontWeight: 600,
            background: "transparent",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{unit}</span>
      </div>
    </label>
  );
}

function DateField({ label, name, defaultValue, required }: { label: string; name: string; defaultValue?: string; required?: boolean }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 150px" }}>
      <span style={labelStyle}>{label}</span>
      <input type="date" name={name} defaultValue={defaultValue} required={required} style={inputStyle} />
    </label>
  );
}

function TimeField({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 150px" }}>
      <span style={labelStyle}>{label}</span>
      <input type="time" name={name} defaultValue={defaultValue} style={inputStyle} />
    </label>
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
