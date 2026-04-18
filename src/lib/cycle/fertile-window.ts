/**
 * Fertile-window classifier.
 *
 * Natural Cycles' signature UX is the daily green/red/yellow indicator.
 * Theirs uses BBT + calendar + algorithm. Ours approximates:
 *   - Green (likely not fertile): CD 1-7 or CD >=20 with confirmed
 *     ovulation signs (BBT shift, ovulation logged).
 *   - Red (likely fertile): CD 8-19 unless a confirmed post-ovulatory
 *     BBT shift is present.
 *   - Yellow (uncertain): long cycle, no recent period data, or
 *     insufficient BBT history.
 *
 * Deliberately conservative: this is not a contraception algorithm.
 * For contraception, Lanae should use Natural Cycles or a method
 * with FDA clearance. Ours is for cycle awareness only.
 */

export type FertileStatus = "green" | "red" | "yellow";

export interface FertileInputs {
  cycleDay: number | null;
  phase: "menstrual" | "follicular" | "ovulatory" | "luteal" | null;
  isUnusuallyLong: boolean;
  /** Did the user log ovulation signs in the last 3 days? */
  confirmedOvulation?: boolean;
}

export interface FertileSignal {
  status: FertileStatus;
  label: string;
  detail: string;
}

export function classifyFertileWindow(input: FertileInputs): FertileSignal {
  const { cycleDay, phase, isUnusuallyLong, confirmedOvulation } = input;

  if (cycleDay === null) {
    return {
      status: "yellow",
      label: "Unknown",
      detail:
        "No recent period data. Log a period start to begin cycle tracking. This screen is for awareness, not contraception.",
    };
  }

  if (isUnusuallyLong) {
    return {
      status: "yellow",
      label: "Long cycle",
      detail:
        "Cycle is running longer than ACOG's typical 21-35 day window. Ovulation timing is uncertain. Consider logging BBT daily for a clearer picture.",
    };
  }

  if (cycleDay <= 7) {
    return {
      status: "green",
      label: "Unlikely fertile",
      detail: `Day ${cycleDay} of cycle. Menstrual / early follicular. Pregnancy risk is low this week.`,
    };
  }

  if (cycleDay >= 8 && cycleDay <= 19) {
    // Hot zone: fertile window is approximately CD 10-17 depending on
    // cycle length. We conservatively flag 8-19 as red.
    return {
      status: "red",
      label: "Possible fertile window",
      detail:
        confirmedOvulation
          ? `Day ${cycleDay}. Ovulation may have just occurred. High-fertility window closes 24-48h after ovulation.`
          : `Day ${cycleDay}. Fertile window is typically CD 10-17. Ovulation usually happens around mid-cycle.`,
    };
  }

  // CD >= 20: post-ovulatory luteal phase.
  if (confirmedOvulation) {
    return {
      status: "green",
      label: "Post-ovulatory",
      detail: `Day ${cycleDay}. Confirmed post-ovulation (BBT sustained). Pregnancy risk drops sharply after the 24-48h fertile window.`,
    };
  }
  return {
    status: "yellow",
    label: "Luteal, uncertain",
    detail: `Day ${cycleDay}. Likely past ovulation, but without confirmed BBT shift the exact ovulation date is uncertain.`,
  };
}

export function phaseBadgeColor(phase: string | null | undefined): string {
  switch ((phase ?? "").toLowerCase()) {
    case "menstrual":
      return "var(--phase-menstrual)";
    case "follicular":
      return "var(--phase-follicular)";
    case "ovulatory":
      return "var(--phase-ovulatory)";
    case "luteal":
      return "var(--phase-luteal)";
    default:
      return "var(--text-muted)";
  }
}
