"use client";

import { useMemo } from "react";
import { DayChip, type DayChipPhase, type DayChipVariant } from "./DayChip";
import type { EngineSummary, EnginePrediction } from "@/lib/intelligence/cycle-engine/engine";

/**
 * CyclePredictionCard -- Uncertainty-honest cycle prediction UI.
 *
 * Contract with the engine:
 *   - Consumes the EngineSummary output of runCycleEngine() in
 *     src/lib/intelligence/cycle-engine/engine.ts (Wave 2a).
 *   - Uses the per-cycle EnginePrediction.confidence number from
 *     signal-fusion. Threshold < 0.7 flips the UI into range-mode.
 *   - Reads cycle-length variability (sdCycleLength) off the summary to
 *     pick the plain-language reason. NO re-derivation of stats here.
 *
 * Contract with the page:
 *   - Pure presentational component. Parent fetches NC + Oura and calls
 *     runCycleEngine() server-side, then passes the EngineSummary down.
 *   - Standalone: does not assume a specific mount point. Brief B3 owner
 *     defers mounting to /patterns if the file is contested by parallel
 *     B2 and C2 subagents on the same branch.
 *
 * Visual contract:
 *   - Dashed chips = predicted days (future).
 *   - Solid chips = confirmed days (past, from historical data).
 *   - When confidence < 0.7, shows a +/- range rather than a single date
 *     and surfaces a plain-language reason. Clue's Feature 1 notes show
 *     that users overtrust single-date predictions when cycles vary.
 *
 * Copy policy:
 *   - No em dashes anywhere. Uses regular hyphens or the word "to".
 *   - Plain-language: "Cycle length varies" not "algorithmic uncertainty".
 */

export interface CyclePredictionCardProps {
  /** EngineSummary returned by runCycleEngine(). */
  summary: EngineSummary | null;
  /** Optional "today" override for deterministic tests. */
  now?: Date;
}

const CONFIDENCE_THRESHOLD = 0.7;

interface UiPrediction {
  cycleStart: string;
  predictedStart: string;
  uncertaintyDays: number;
  confidence: number;
  rangeStart: string;
  rangeEnd: string;
  reason: string | null;
  confidenceLabel: "high" | "medium" | "low";
  pastDays: UiDay[];
  futureDays: UiDay[];
}

interface UiDay {
  date: string;
  phase: DayChipPhase;
  variant: DayChipVariant;
  label: string;
}

export function CyclePredictionCard({ summary, now }: CyclePredictionCardProps) {
  const ui = useMemo<UiPrediction | null>(
    () => (summary ? buildUiPrediction(summary, now ?? new Date()) : null),
    [summary, now]
  );

  if (!summary || summary.predictions.length === 0) {
    return (
      <div className="card" style={{ padding: 20, textAlign: "center" }}>
        <h2 style={cardTitleStyle()}>Next Period Prediction</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 8 }}>
          Not enough cycle data yet. Keep logging and a prediction will appear.
        </p>
      </div>
    );
  }

  if (!ui) {
    return null;
  }

  // Confidence that rounds to 0% is self-undermining. Treat as insufficient data.
  if (Math.round(ui.confidence * 100) === 0) {
    return (
      <div className="card" style={{ padding: 20, textAlign: "center" }}>
        <h2 style={cardTitleStyle()}>Next Period Prediction</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 8 }}>
          Log one more cycle for a prediction.
        </p>
      </div>
    );
  }

  return (
    <div className="card" data-testid="cycle-prediction-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={cardTitleStyle()}>Next Period Prediction</h2>
        <ConfidencePill label={ui.confidenceLabel} value={ui.confidence} />
      </div>

      {/* Primary prediction: range or single date */}
      <div style={{ marginTop: 14 }}>
        {ui.confidence < CONFIDENCE_THRESHOLD ? (
          <div>
            <div
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.2,
              }}
              data-testid="prediction-range"
            >
              {formatFriendlyDate(ui.rangeStart)} to {formatFriendlyDate(ui.rangeEnd)}
            </div>
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                marginTop: 4,
              }}
            >
              Most likely around {formatFriendlyDate(ui.predictedStart)}
              {" "}(plus or minus {ui.uncertaintyDays} days)
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: 1.2,
              }}
              data-testid="prediction-single"
            >
              {formatFriendlyDate(ui.predictedStart)}
            </div>
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                marginTop: 4,
              }}
            >
              plus or minus {ui.uncertaintyDays} day{ui.uncertaintyDays === 1 ? "" : "s"}
            </div>
          </div>
        )}
      </div>

      {/* Plain-language reason, only on low confidence */}
      {ui.reason && (
        <div
          data-testid="prediction-reason"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--accent-blush-muted)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {ui.reason}
        </div>
      )}

      {/* Day row: solid past, dashed future */}
      <div style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {ui.pastDays.length > 0 && (
            <DayRow title="Last 7 days" days={ui.pastDays} />
          )}
          {ui.futureDays.length > 0 && (
            <DayRow title="Next 7 days" days={ui.futureDays} />
          )}
        </div>
      </div>

      <Legend />
    </div>
  );
}

// ── subcomponents ────────────────────────────────────────────────────

function DayRow({ title, days }: { title: string; days: UiDay[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
        }}
      >
        {days.map((d) => (
          <DayChip
            key={d.date}
            date={d.date}
            phase={d.phase}
            variant={d.variant}
            label={d.label}
          />
        ))}
      </div>
    </div>
  );
}

function ConfidencePill({
  label,
  value,
}: {
  label: "high" | "medium" | "low";
  value: number;
}) {
  const bg =
    label === "high"
      ? "var(--accent-sage-muted)"
      : label === "medium"
        ? "var(--accent-blush-muted)"
        : "rgba(139, 143, 150, 0.15)";
  const fg =
    label === "high"
      ? "var(--accent-sage)"
      : label === "medium"
        ? "var(--accent-blush)"
        : "var(--text-muted)";
  return (
    <div
      data-testid="confidence-pill"
      data-confidence-label={label}
      style={{
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: "var(--radius-full)",
        background: bg,
        color: fg,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {label} confidence
      <span
        style={{
          marginLeft: 6,
          opacity: 0.7,
          fontWeight: 500,
        }}
      >
        ({Math.round(value * 100)}%)
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        gap: 14,
        fontSize: "var(--text-xs)",
        color: "var(--text-muted)",
      }}
    >
      <LegendItem label="Confirmed">
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "var(--radius-sm)",
            background: "var(--phase-menstrual)",
          }}
        />
      </LegendItem>
      <LegendItem label="Predicted">
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "var(--radius-sm)",
            border: "1.5px dashed var(--phase-menstrual)",
          }}
        />
      </LegendItem>
    </div>
  );
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {children}
      {label}
    </span>
  );
}

function cardTitleStyle(): React.CSSProperties {
  return {
    fontSize: "var(--text-lg)",
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: 0,
  };
}

// ── pure helpers (exported for tests) ────────────────────────────────

/**
 * Build the UI prediction from the engine summary. Picks the most
 * recent cycle with a usable periodPrediction. Falls back to the last
 * cycle when no predictions fit.
 */
export function buildUiPrediction(
  summary: EngineSummary,
  now: Date
): UiPrediction | null {
  const todayIso = now.toISOString().slice(0, 10);

  // Prefer the open cycle (cycleEnd === null) or the latest closed one.
  const openCycle = summary.predictions.find(
    (p) => p.cycleEnd === null && p.periodPrediction !== null
  );
  const latestClosed = [...summary.predictions]
    .reverse()
    .find((p) => p.periodPrediction !== null);
  const target: EnginePrediction | null = openCycle ?? latestClosed ?? null;

  if (!target || !target.periodPrediction) return null;

  const confidence = clamp01(target.confidence);
  const predictedStart = target.periodPrediction.predictedStart;
  const uncertainty = Math.max(1, target.periodPrediction.uncertaintyDays);
  const rangeStart = addDays(predictedStart, -uncertainty);
  const rangeEnd = addDays(predictedStart, uncertainty);

  const confidenceLabel = deriveConfidenceLabel(confidence);
  const reason = deriveReason({
    confidence,
    confidenceLabel,
    sdCycleLength: summary.sdCycleLength,
    totalCycles: summary.totalCycles,
    confirmedCycles: summary.confirmedOvulatoryCycles,
    signalsUsed: target.signalsUsed.length,
  });

  const pastDays = buildPastDayRow(target, todayIso);
  const futureDays = buildFutureDayRow({
    todayIso,
    predictedStart,
    rangeStart,
    rangeEnd,
  });

  return {
    cycleStart: target.cycleStart,
    predictedStart,
    uncertaintyDays: uncertainty,
    confidence,
    rangeStart,
    rangeEnd,
    reason,
    confidenceLabel,
    pastDays,
    futureDays,
  };
}

export function deriveConfidenceLabel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

/**
 * Pick a plain-language reason when confidence is below the threshold.
 * Never returns technical jargon like "algorithmic uncertainty". Returns
 * null when confidence is high and no reason needs to be surfaced.
 */
export function deriveReason(params: {
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  sdCycleLength: number;
  totalCycles: number;
  confirmedCycles: number;
  signalsUsed: number;
}): string | null {
  if (params.confidenceLabel === "high") return null;

  // Thin history dominates. Less than 3 confirmed cycles and NC help docs
  // explicitly say predictions need a learning period.
  if (params.confirmedCycles < 3) {
    return "Still learning your cycle. Predictions will get sharper after a few more cycles are logged.";
  }

  // High variability.
  if (params.sdCycleLength >= 5) {
    return "Cycle length varies a lot, so the predicted window is wider than average.";
  }

  if (params.sdCycleLength >= 3) {
    return "Cycle length varies, so the predicted window is a bit wider than average.";
  }

  // Weak signal.
  if (params.signalsUsed <= 1) {
    return "Only one signal is confirming ovulation right now. Logging BBT or using a wearable improves the prediction.";
  }

  return "Predictions are a bit less certain this cycle. Keep logging and this window will narrow.";
}

// ── day-row construction ─────────────────────────────────────────────

function buildPastDayRow(prediction: EnginePrediction, todayIso: string): UiDay[] {
  const days: UiDay[] = [];
  const last7Start = addDays(todayIso, -6);
  for (let i = 0; i < 7; i++) {
    const date = addDays(last7Start, i);
    if (date > todayIso) break;
    const phase = phaseForPastDay(prediction, date);
    days.push({
      date,
      phase,
      variant: "confirmed",
      label: String(parseIsoDay(date)),
    });
  }
  return days;
}

function buildFutureDayRow(params: {
  todayIso: string;
  predictedStart: string;
  rangeStart: string;
  rangeEnd: string;
}): UiDay[] {
  const days: UiDay[] = [];
  for (let i = 1; i <= 7; i++) {
    const date = addDays(params.todayIso, i);
    const inWindow = date >= params.rangeStart && date <= params.rangeEnd;
    const isCenter = date === params.predictedStart;
    const phase: DayChipPhase = inWindow || isCenter ? "menstrual" : "luteal";
    days.push({
      date,
      phase,
      variant: "predicted",
      label: String(parseIsoDay(date)),
    });
  }
  return days;
}

/**
 * Phase inference for past days. Uses the cycle start as day 1 and the
 * confirmed ovulation date (if present) as the luteal pivot. Keeps the
 * implementation simple because the card's goal is HONESTY about
 * prediction uncertainty, not high-fidelity retrospective phase coding.
 */
function phaseForPastDay(prediction: EnginePrediction, dateIso: string): DayChipPhase {
  if (dateIso < prediction.cycleStart) return "luteal";
  const dayNumber = daysBetween(prediction.cycleStart, dateIso) + 1;
  if (dayNumber <= 5) return "menstrual";
  if (prediction.confirmedOvulationDate) {
    if (dateIso < prediction.confirmedOvulationDate) return "follicular";
    if (dateIso === prediction.confirmedOvulationDate) return "ovulatory";
    return "luteal";
  }
  if (dayNumber <= 13) return "follicular";
  if (dayNumber <= 16) return "ovulatory";
  return "luteal";
}

// ── date helpers ─────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function parseIsoDay(iso: string): number {
  return Number(iso.slice(8, 10));
}

function formatFriendlyDate(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}
