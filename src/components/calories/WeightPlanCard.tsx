/**
 * WeightPlanCard
 *
 * MyNetDiary parity (GAP #1): dashboard widget showing current
 * weight, goal weight, projected trajectory, and weigh-in / plan /
 * chart action buttons. Mirrors MFN's "Weight Plan: lose 20 lb in
 * 140 days" card with the curve chart.
 *
 * If no weigh-ins exist yet, shows an empty-state with a prominent
 * "Log your first weigh-in" CTA.
 */

import type { WeightLog } from "@/lib/calories/weight";
import { kgToLb, latestEntry } from "@/lib/calories/weight";
import type { NutritionGoals } from "@/lib/calories/goals";
import { format, differenceInCalendarDays } from "date-fns";

interface Props {
  log: WeightLog;
  goals: NutritionGoals;
}

export function WeightPlanCard({ log, goals }: Props) {
  const latest = latestEntry(log);
  const currentLb = latest ? kgToLb(latest.kg) : null;
  const targetLb = goals.weight.targetKg !== null ? kgToLb(goals.weight.targetKg) : null;
  const targetDate = goals.weight.targetDate;
  const daysToTarget =
    targetDate !== null
      ? differenceInCalendarDays(new Date(targetDate + "T00:00:00"), new Date())
      : null;

  const hasPlan = currentLb !== null && targetLb !== null && daysToTarget !== null && daysToTarget > 0;
  const toLose = hasPlan && currentLb > targetLb ? currentLb - targetLb : null;
  const toGain = hasPlan && targetLb > currentLb ? targetLb - currentLb : null;

  return (
    <div style={{ padding: "0 16px" }}>
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Weight plan
          </span>
          <a
            href="/calories/plan"
            style={{
              fontSize: 11,
              color: "var(--accent-sage)",
              textDecoration: "none",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Edit goal &rarr;
          </a>
        </div>

        {hasPlan ? (
          <>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              <strong>
                {toLose !== null
                  ? `Lose ${toLose.toFixed(1)} lb`
                  : toGain !== null
                    ? `Gain ${toGain.toFixed(1)} lb`
                    : "Maintain weight"}
              </strong>{" "}
              in{" "}
              <span className="tabular">{daysToTarget}</span> days.
            </div>
            <TrajectoryChart
              log={log}
              currentLb={currentLb!}
              targetLb={targetLb!}
              targetDate={targetDate!}
            />
          </>
        ) : currentLb !== null ? (
          <div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Current weight:{" "}
              <strong className="tabular">{currentLb.toFixed(1)} lb</strong>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, marginTop: 4 }}>
              Set a goal on the Plan page to see the trajectory.
            </p>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            No weigh-ins logged yet.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ActionLink href="/calories/health/weight" label="Weigh-in" primary />
          <ActionLink href="/calories/plan" label="Plan" />
          <ActionLink href="/calories/health/weight" label="Chart" />
        </div>
      </div>
    </div>
  );
}

function ActionLink({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      className="press-feedback"
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        background: primary ? "var(--accent-sage)" : "var(--bg-card)",
        color: primary ? "var(--text-inverse)" : "var(--text-primary)",
        border: primary ? "none" : "1px solid var(--border-light)",
        textDecoration: "none",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </a>
  );
}

function TrajectoryChart({
  log,
  currentLb,
  targetLb,
  targetDate,
}: {
  log: WeightLog;
  currentLb: number;
  targetLb: number;
  targetDate: string;
}) {
  const width = 420;
  const height = 80;
  const padding = 10;

  const todayDate = new Date();
  const targetDateObj = new Date(targetDate + "T00:00:00");
  const totalDays = Math.max(1, differenceInCalendarDays(targetDateObj, todayDate));

  // Historical points (actual weigh-ins, recent 30).
  const recent = log.entries.slice(-30);
  const firstDate = recent.length > 0 ? new Date(recent[0].date + "T00:00:00") : todayDate;
  const historyDays = Math.max(1, differenceInCalendarDays(todayDate, firstDate));
  const totalSpan = historyDays + totalDays;

  const lbs = [...recent.map((e) => kgToLb(e.kg)), currentLb, targetLb];
  const min = Math.min(...lbs) - 2;
  const max = Math.max(...lbs) + 2;
  const range = Math.max(1, max - min);

  const xFor = (daysFromStart: number) =>
    padding + (daysFromStart / totalSpan) * (width - 2 * padding);
  const yFor = (lb: number) =>
    height - padding - ((lb - min) / range) * (height - 2 * padding);

  const historyPoints = recent.map((e) => {
    const d = differenceInCalendarDays(new Date(e.date + "T00:00:00"), firstDate);
    return { x: xFor(d), y: yFor(kgToLb(e.kg)) };
  });
  const today = { x: xFor(historyDays), y: yFor(currentLb) };
  const target = { x: xFor(totalSpan), y: yFor(targetLb) };

  const historyPath = historyPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Weight trajectory"
    >
      {/* Target line (dashed projection from today to target) */}
      <line
        x1={today.x}
        y1={today.y}
        x2={target.x}
        y2={target.y}
        stroke="var(--accent-sage)"
        strokeDasharray="4 3"
        strokeWidth="1.5"
      />
      {/* Target flag */}
      <circle cx={target.x} cy={target.y} r="4" fill="var(--accent-sage)" />
      <text
        x={target.x}
        y={target.y - 8}
        textAnchor="end"
        fontSize="10"
        fill="var(--accent-sage)"
        fontWeight="600"
      >
        {targetLb.toFixed(0)} lb
      </text>
      {/* History line */}
      {historyPath && (
        <path
          d={historyPath}
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Today marker */}
      <circle cx={today.x} cy={today.y} r="4" fill="var(--text-primary)" />
      <text
        x={today.x}
        y={today.y - 8}
        textAnchor="middle"
        fontSize="10"
        fill="var(--text-primary)"
        fontWeight="700"
      >
        {currentLb.toFixed(1)} lb
      </text>
    </svg>
  );
}
