/**
 * Quick-tap symptom grid (Bearable pattern).
 *
 * Grid of the most-logged symptoms for Lanae's conditions. Each tile
 * is a tiny <form> that POSTs to /api/symptoms/quick-log — no client
 * JS needed, the browser's native form submit handles it. On submit,
 * the server 303-redirects back to Home.
 *
 * Bearable's insight: 10-second logging beats 60-second logging every
 * time for chronic illness. The barrier to log has to be at floor.
 */

interface SymptomTile {
  label: string;
  symptom: string;
  category: "digestive" | "menstrual" | "mental" | "physical" | "urinary";
  icon: string;
  /** Short rationale shown as a title tooltip. */
  why?: string;
}

const TILES: SymptomTile[] = [
  { label: "Dizzy", symptom: "dizziness", category: "physical", icon: "\u{1F4AB}", why: "POTS orthostatic signal" },
  { label: "Lightheaded", symptom: "lightheadedness", category: "physical", icon: "\u{1F343}", why: "Orthostatic pre-syncope" },
  { label: "Migraine", symptom: "migraine", category: "physical", icon: "\u{1F4A5}", why: "Log attacks on /topics/migraine" },
  { label: "Headache", symptom: "headache", category: "physical", icon: "\u{1F922}" },
  { label: "Fatigue", symptom: "fatigue", category: "physical", icon: "\u{1F634}" },
  { label: "Nausea", symptom: "nausea", category: "digestive", icon: "\u{1F922}" },
  { label: "Bloating", symptom: "bloating", category: "digestive", icon: "\u{1F38F}" },
  { label: "Cramps", symptom: "cramps", category: "menstrual", icon: "\u{1F331}" },
  { label: "Flare pain", symptom: "flare pain", category: "physical", icon: "\u{1F525}" },
  { label: "Brain fog", symptom: "brain fog", category: "mental", icon: "\u{1F32B}\uFE0F" },
  { label: "Anxious", symptom: "anxiety", category: "mental", icon: "\u{1F32A}\uFE0F" },
  { label: "Insomnia", symptom: "insomnia", category: "physical", icon: "\u{1F31B}" },
];

export function QuickSymptomGrid() {
  return (
    <div style={{ padding: "0 16px" }}>
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
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 10,
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
            Quick log
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            one tap &middot; severity = moderate by default
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gap: 6,
          }}
        >
          {TILES.map((t) => (
            <form
              key={t.symptom}
              action="/api/symptoms/quick-log"
              method="post"
              style={{ display: "contents" }}
            >
              <input type="hidden" name="symptom" value={t.symptom} />
              <input type="hidden" name="category" value={t.category} />
              <input type="hidden" name="severity" value="moderate" />
              <input type="hidden" name="returnTo" value="/?logged=1" />
              <button
                type="submit"
                title={t.why ?? `Log ${t.label}`}
                className="press-feedback"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "10px 6px",
                  borderRadius: 10,
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-light)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            </form>
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 8,
            lineHeight: 1.4,
          }}
        >
          Need a different severity or a symptom not shown? Use{" "}
          <a href="/log" style={{ color: "var(--accent-sage)", fontWeight: 700 }}>
            the full log
          </a>
          .
        </div>
      </div>
    </div>
  );
}
