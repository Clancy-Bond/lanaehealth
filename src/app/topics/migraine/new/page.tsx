/**
 * Log a new migraine/headache attack. Form-first UX matching
 * Migraine Buddy's quick-log flow but locked to ICHD-3-relevant
 * fields (severity, aura, triggers).
 */

import Link from "next/link";
import { getCurrentCycleDay } from "@/lib/cycle/current-day";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const HEAD_ZONES = [
  "Forehead",
  "Temples",
  "Behind eye",
  "Crown",
  "Back of head",
  "Neck",
  "Face",
  "Whole head",
];

const AURA_CATEGORIES = [
  "Visual (zigzag, flashing, blind spot)",
  "Sensory (tingling, numbness)",
  "Speech (slurred, word-finding)",
  "Motor (hemiplegic)",
  "Brainstem (vertigo, ataxia)",
  "Retinal (one eye)",
];

const COMMON_TRIGGERS = [
  "Cycle / hormonal",
  "Sleep loss",
  "Stress",
  "Weather / barometric",
  "Dehydration",
  "Skipped meal",
  "Aged cheese / cured meats",
  "Alcohol / wine",
  "MSG",
  "Chocolate",
  "Caffeine withdrawal",
  "Bright light",
  "Loud noise",
  "Screens / prolonged phone",
];

const COMMON_MEDS = ["Ketorolac", "Sumatriptan", "Rizatriptan", "Naproxen", "Ibuprofen", "Acetaminophen"];

export default async function NewMigraineAttackPage() {
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const cycle = await getCurrentCycleDay(todayISO).catch(() => null);
  const phase = cycle?.phase ?? null;

  // Default started_at to now, formatted for datetime-local.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultStartLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

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
        href="/topics/migraine"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
      >
        &lsaquo; Migraine
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
          Migraine
        </span>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Log an attack</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
          Every field is optional except severity. Check everything
          that applies. The form prefills started-at to now and your
          current cycle phase so clicks are minimal.
        </p>
      </div>

      <form
        action="/api/migraine/attacks"
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        <Section title="When">
          <Row>
            <DateTimeField label="Started" name="started_at" defaultValue={defaultStartLocal} required />
            <DateTimeField label="Ended (optional)" name="ended_at" />
          </Row>
        </Section>

        <Section title="Severity">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Array.from({ length: 11 }).map((_, i) => (
              <label key={i} style={severityChip(i)}>
                <input type="radio" name="severity" value={i} required={i === 0} style={{ display: "none" }} />
                {i}
              </label>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 4 }}>
            0 = no pain, 10 = worst imaginable. Pick the peak severity of the attack.
          </p>
        </Section>

        <Section title="Head zones">
          <ChipList name="head_zones" options={HEAD_ZONES} csvDelimiter />
        </Section>

        <Section title="Aura (if any)">
          <ChipList name="aura_categories" options={AURA_CATEGORIES} csvDelimiter />
        </Section>

        <Section title="Triggers (best guesses)">
          <ChipList name="triggers" options={COMMON_TRIGGERS} csvDelimiter />
        </Section>

        <Section title="Medications taken">
          <ChipList name="medications_taken" options={COMMON_MEDS} csvDelimiter />
          <Row>
            <NumField
              label="Time to relief"
              name="medication_relief_minutes"
              unit="minutes"
              placeholder="how long after dose?"
            />
          </Row>
        </Section>

        <Section title="Cycle phase">
          <select
            name="cycle_phase"
            defaultValue={phase ?? ""}
            style={selectStyle}
          >
            <option value="">Unknown / not tracked</option>
            <option value="menstrual">Menstrual</option>
            <option value="follicular">Follicular</option>
            <option value="ovulatory">Ovulatory</option>
            <option value="luteal">Luteal</option>
          </select>
          {phase && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 4 }}>
              Detected current phase: <strong>{phase}</strong>
            </p>
          )}
        </Section>

        <Section title="Notes">
          <textarea
            name="notes"
            rows={3}
            placeholder="anything else you want the Patterns engine to correlate on"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Section>

        <button
          type="submit"
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            background: "var(--accent-blush)",
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
          Log attack
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

function DateTimeField({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="datetime-local"
        name={name}
        defaultValue={defaultValue}
        required={required}
        style={inputStyle}
      />
    </label>
  );
}

function NumField({
  label,
  name,
  unit,
  placeholder,
}: {
  label: string;
  name: string;
  unit: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", background: "white" }}>
        <input
          type="number"
          min="0"
          max="1440"
          name={name}
          placeholder={placeholder}
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

function ChipList({
  name,
  options,
  csvDelimiter,
}: {
  name: string;
  options: string[];
  csvDelimiter?: boolean;
}) {
  // We emit a single hidden <input type="text"> on submit by joining
  // the checked values with commas. Instead of JS, use a simple
  // pattern: name-encode each checkbox with name="<name>" and a value;
  // the API route accepts them as csv via getAll. But since we want
  // to keep the POST endpoint simple (csv string), we use a workaround:
  // each checkbox posts its value; the server parses comma-separated
  // via form.getAll and rejoins. Simplest pattern: send each under the
  // SAME name -- but our API expects csv. So we emit a comma via form.
  //
  // Pragmatic: use <select multiple> instead when JS is off? Overkill.
  // Simpler: name each checkbox as the same key; the API handles a
  // string or a csv-string. We join in JS via onchange -> hidden input.
  // Since this is server-only, fall back to a multi-select submit.
  void csvDelimiter;
  return (
    <select
      name={name}
      multiple
      size={Math.min(6, options.length)}
      style={{
        padding: 8,
        borderRadius: 8,
        border: "1px solid var(--border-light)",
        background: "white",
        fontSize: 13,
        width: "100%",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
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

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border-light)",
  background: "white",
  fontSize: 14,
  width: "100%",
  maxWidth: 300,
};

function severityChip(n: number): React.CSSProperties {
  const color =
    n <= 3
      ? "var(--accent-sage)"
      : n <= 6
        ? "var(--phase-luteal)"
        : "var(--accent-blush)";
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "var(--bg-primary)",
    border: `2px solid ${color}`,
    fontSize: 14,
    fontWeight: 800,
    color,
    cursor: "pointer",
  };
}
