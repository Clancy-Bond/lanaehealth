import type { CorrelationCell } from "@/lib/symptoms/correlation";

interface TriggerCorrelationGridProps {
  cells: CorrelationCell[];
  windowDays: number;
}

function cellColor(rate: number): string {
  if (rate >= 0.7) return "var(--accent-blush)";
  if (rate >= 0.5) return "var(--accent-blush-light)";
  if (rate >= 0.3) return "var(--accent-blush-muted)";
  return "rgba(139,143,150,0.18)";
}

function cellConfidenceLabel(sample: number): string {
  if (sample >= 30) return "Strong signal";
  if (sample >= 14) return "Moderate signal";
  return "Suggestive only";
}

export default function TriggerCorrelationGrid({
  cells,
  windowDays,
}: TriggerCorrelationGridProps) {
  const triggers = [...new Set(cells.map((c) => c.trigger))];
  const symptoms = [...new Set(cells.map((c) => c.symptom))];
  const confidence = cellConfidenceLabel(windowDays);

  if (cells.length === 0) {
    return (
      <section
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          padding: "1rem",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-base)",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Trigger-by-symptom
        </h2>
        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
          }}
        >
          Not enough overlapping data yet. Log a few more trigger + symptom days
          and this grid will fill in.
        </p>
      </section>
    );
  }

  return (
    <section
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem",
        boxShadow: "var(--shadow-sm)",
      }}
      aria-label="Trigger and symptom co-occurrence"
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.75rem",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-base)",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Trigger-by-symptom, last {windowDays} days
        </h2>
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
          }}
        >
          {confidence}
        </span>
      </header>
      <div style={{ overflowX: "auto" }}>
        <table
          role="table"
          style={{
            borderCollapse: "separate",
            borderSpacing: 4,
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
          }}
        >
          <thead>
            <tr>
              <th
                scope="col"
                style={{
                  textAlign: "left",
                  padding: "0.25rem 0.5rem",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                }}
              >
                Trigger \ Symptom
              </th>
              {symptoms.map((s) => (
                <th
                  key={s}
                  scope="col"
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {triggers.map((t) => (
              <tr key={t}>
                <th
                  scope="row"
                  style={{
                    textAlign: "left",
                    padding: "0.25rem 0.5rem",
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t}
                </th>
                {symptoms.map((s) => {
                  const cell = cells.find(
                    (c) => c.trigger === t && c.symptom === s,
                  );
                  if (!cell) {
                    return (
                      <td
                        key={s}
                        style={{
                          padding: 0,
                          width: 56,
                          height: 36,
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg-input)",
                          }}
                          aria-label="No shared days"
                        />
                      </td>
                    );
                  }
                  const pct = Math.round(cell.coOccurrenceRate * 100);
                  return (
                    <td
                      key={s}
                      style={{
                        padding: 0,
                        width: 56,
                        height: 36,
                        textAlign: "center",
                      }}
                    >
                      <div
                        title={`${t} + ${s}: ${cell.daysWithBoth} of ${cell.daysWithTrigger} days (${pct}%)`}
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "var(--radius-sm)",
                          background: cellColor(cell.coOccurrenceRate),
                          color: pct >= 50 ? "#fff" : "var(--text-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 600,
                        }}
                        aria-label={`${t} and ${s} together on ${cell.daysWithBoth} of ${cell.daysWithTrigger} days`}
                      >
                        {pct}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p
        style={{
          marginTop: "0.75rem",
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
        }}
      >
        Conditional rate: out of days where the trigger occurred, the share that
        also had the symptom. Not a causal claim. See /patterns for lag-aware
        correlation with r-values.
      </p>
    </section>
  );
}
