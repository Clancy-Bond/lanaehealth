/**
 * Pure classifier for the adaptive movement suggestion card.
 *
 * Design rules (from docs/competitive/oura/implementation-notes.md §Feature 3):
 *   - Output NEVER uses streak, goal-met, ring-closed language.
 *   - Output is POTS-pacing friendly: a low-readiness day recommends REST,
 *     not "try a lighter workout" (which for POTS still flares symptoms).
 *   - Second person voice, warm, clinical-but-plain. No em dashes.
 *   - Sage accent only; no red/amber/green pass/fail color signal.
 *
 * Category thresholds:
 *   readiness < 55   -> rest
 *   readiness 55-69  -> gentle
 *   readiness 70-84  -> moderate
 *   readiness >= 85  -> full
 *
 * Null readiness (ring did not sync) -> 'unknown'.
 *
 * Kept free of JSX and Supabase so it can be tested in vitest/node env.
 */
export type MovementCategory = "unknown" | "rest" | "gentle" | "moderate" | "full";

export interface MovementSuggestion {
  category: MovementCategory;
  /** Short category name shown as the card headline. */
  label: string;
  /** Plain-language guidance, second person, POTS-safe. */
  rationale: string;
  /** Capacity band shown next to label, e.g. "rest & recover". */
  capacityBand: string;
  /** Optional one-line context about the reading. */
  subtleContext: string | null;
  /** Inline emoji used by the card icon. No text meaning carried here. */
  icon: string;
}

export function categoryForReadiness(score: number | null): MovementCategory {
  if (score == null || Number.isNaN(score)) return "unknown";
  if (score < 55) return "rest";
  if (score < 70) return "gentle";
  if (score < 85) return "moderate";
  return "full";
}

/**
 * Translate today's readiness (+ optional 7-day mean for context) into
 * a movement suggestion. Pure function.
 */
export function classifyMovement(
  readinessScore: number | null,
  sevenDayAvg: number | null = null,
): MovementSuggestion {
  const category = categoryForReadiness(readinessScore);

  let subtleContext: string | null = null;
  if (
    readinessScore != null &&
    sevenDayAvg != null &&
    !Number.isNaN(sevenDayAvg)
  ) {
    const delta = Math.round(readinessScore - sevenDayAvg);
    if (Math.abs(delta) >= 5) {
      const dir = delta > 0 ? "above" : "below";
      subtleContext = `Readiness ${readinessScore} (${Math.abs(delta)} ${dir} your 7-day average).`;
    } else {
      subtleContext = `Readiness ${readinessScore}, close to your 7-day average.`;
    }
  } else if (readinessScore != null) {
    subtleContext = `Readiness ${readinessScore}.`;
  }

  switch (category) {
    case "rest":
      return {
        category,
        label: "Rest day",
        capacityBand: "recover",
        icon: "\u{1F343}", // herb leaf
        rationale:
          "Your body is asking for recovery. Gentle stretching, rest, hydration, and slow breathing are the right call today. No movement is a valid plan.",
        subtleContext,
      };
    case "gentle":
      return {
        category,
        label: "Gentle day",
        capacityBand: "low-impact",
        icon: "\u{1F338}", // cherry blossom
        rationale:
          "Low-impact movement for up to 20 minutes if you feel up to it. A short walk, gentle yoga, or a warm bath count. Stop if pulse climbs or fatigue builds.",
        subtleContext,
      };
    case "moderate":
      return {
        category,
        label: "Moderate day",
        capacityBand: "steady capacity",
        icon: "\u{1F6B6}\u200D\u2640\uFE0F", // woman walking
        rationale:
          "You have capacity for a normal walk, yoga, or easy strength work. Keep intensity conversational. Save short-burst efforts for a day your readiness is higher.",
        subtleContext,
      };
    case "full":
      return {
        category,
        label: "Full capacity",
        capacityBand: "feels-good movement",
        icon: "\u{1F33F}", // herb
        rationale:
          "Your body is ready for whatever feels good today. Listen to early warning signs (pulse spikes, lightheadedness) and pace yourself, then enjoy it.",
        subtleContext,
      };
    case "unknown":
    default:
      return {
        category: "unknown",
        label: "Go by how you feel",
        capacityBand: "no reading yet",
        icon: "\u{1F33F}",
        rationale:
          "We are missing today's readiness signal from your ring. Use your own sense of energy, pulse, and pain as the guide.",
        subtleContext: null,
      };
  }
}
