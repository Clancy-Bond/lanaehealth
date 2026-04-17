"use client";

/**
 * DayChip -- single-day visual marker for the cycle prediction row.
 *
 * Visual contract:
 *   - variant="confirmed": solid filled background, no border. Used for
 *     days already observed in historical nc_imported/cycle_entries data
 *     (the user has BLED on this day, the BBT shift was confirmed, etc).
 *   - variant="predicted": dashed border, translucent background. Used
 *     for FUTURE days the cycle engine has forecast but cannot confirm.
 *
 * Why dashed vs solid? Clue's "Feature 1: Uncertainty-honest prediction"
 * notes: when users see the same styling for past and future days they
 * tend to overtrust the prediction. A visual distinction keeps the
 * uncertainty honest without needing a footnote.
 *
 * Phase color is pulled from the existing design tokens so this component
 * inherits the phase palette used by CycleOverview.tsx.
 */

export type DayChipVariant = "confirmed" | "predicted";
export type DayChipPhase = "menstrual" | "follicular" | "ovulatory" | "luteal";

interface DayChipProps {
  date: string;
  phase: DayChipPhase;
  variant: DayChipVariant;
  label?: string;
  size?: number;
}

const PHASE_TOKEN: Record<DayChipPhase, string> = {
  menstrual: "var(--phase-menstrual)",
  follicular: "var(--phase-follicular)",
  ovulatory: "var(--phase-ovulatory)",
  luteal: "var(--phase-luteal)",
};

export function DayChip({
  date,
  phase,
  variant,
  label,
  size = 28,
}: DayChipProps) {
  const color = PHASE_TOKEN[phase];
  const isConfirmed = variant === "confirmed";

  return (
    <div
      data-testid="day-chip"
      data-variant={variant}
      data-phase={phase}
      data-date={date}
      title={`${label ?? date} (${isConfirmed ? "confirmed" : "predicted"})`}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        color: isConfirmed ? "var(--text-inverse)" : color,
        background: isConfirmed ? color : "transparent",
        border: isConfirmed ? "none" : `1.5px dashed ${color}`,
        opacity: isConfirmed ? 1 : 0.85,
      }}
    >
      {label ?? ""}
    </div>
  );
}
