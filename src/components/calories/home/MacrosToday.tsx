/**
 * Home widget: today's macros as three stacked progress bars.
 *
 * Shows protein / carbs / fat consumed vs the user's macro targets in
 * grams. Each bar fills toward 100%; going over doesn't turn the bar
 * red (no shame) - it just caps at 100% and the label reads "+N g".
 * Non-shaming voice rule: facts, no alarm.
 *
 * Links to /calories for the full macro breakdown.
 */

import { getDayTotals } from "@/lib/calories/home-data";
import { loadNutritionGoals } from "@/lib/calories/goals";

interface Props {
  date: string;
}

type MacroKey = "protein" | "carbs" | "fat";

interface Row {
  key: MacroKey;
  label: string;
  accent: string;
  current: number;
  target: number;
}

export async function MacrosToday({ date }: Props) {
  const [totals, goals] = await Promise.all([
    getDayTotals(date),
    loadNutritionGoals(),
  ]);

  const rows: Row[] = [
    {
      key: "protein",
      label: "Protein",
      accent: "var(--accent-sage)",
      current: Math.round(totals.protein),
      target: goals.macros.proteinG,
    },
    {
      key: "carbs",
      label: "Carbs",
      accent: "var(--accent-blush-light)",
      current: Math.round(totals.carbs),
      target: goals.macros.carbsG,
    },
    {
      key: "fat",
      label: "Fat",
      accent: "var(--phase-luteal)",
      current: Math.round(totals.fat),
      target: goals.macros.fatG,
    },
  ];

  const anyLogged = totals.entryCount > 0;

  return (
    <div style={{ padding: "0 16px" }}>
      <a
        href="/calories"
        className="press-feedback"
        aria-label="Open today's macro breakdown"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "14px 18px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          textDecoration: "none",
          color: "var(--text-primary)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent-sage)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Today&rsquo;s macros
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {anyLogged
                ? "Targets are soft - adjust them on /calories/plan."
                : "Log a meal to start filling the bars."}
            </div>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          >
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}
        >
          {rows.map((row) => {
            const ratio = row.target > 0 ? row.current / row.target : 0;
            const overByG = row.current > row.target ? row.current - row.target : 0;
            const fillPct = Math.max(2, Math.min(100, ratio * 100));
            const statusCopy =
              row.target === 0
                ? `${row.current} g`
                : overByG > 0
                  ? `${row.current} / ${row.target} g \u00B7 +${overByG} g`
                  : `${row.current} / ${row.target} g`;
            return (
              <div
                key={row.key}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="tabular"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {statusCopy}
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    borderRadius: 4,
                    background: "var(--border-light)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${fillPct}%`,
                      height: "100%",
                      background: row.accent,
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </a>
    </div>
  );
}
