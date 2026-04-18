/**
 * Pattern-based daily diet analysis for Lanae's conditions.
 *
 * Pure function: takes aggregated macros + goals and returns a set of
 * actionable, non-diagnostic insights. Each insight is keyed by
 * category so the UI can render them in a stable order.
 *
 * v1 uses rule-based checks; v2 can swap in CIE reasoning for the
 * "why this matters for you" paragraphs.
 */

import type { NutritionGoals } from "./goals";

export type InsightLevel = "good" | "info" | "watch" | "flag";

export interface Insight {
  id: string;
  level: InsightLevel;
  title: string;
  detail: string;
  category:
    | "calories"
    | "macros"
    | "sodium"
    | "fiber"
    | "triggers"
    | "iron"
    | "consistency";
}

export interface AnalysisInput {
  calories: number;
  goals: NutritionGoals;
  macros: {
    carbs: number;
    protein: number;
    fat: number;
    fiber: number;
    sodium: number;
    iron?: number;
  };
  triggerFoodsToday: string[];
  loggedEntryCount: number;
  sevenDayCaloriesByDate: Map<string, number>;
  hasCyclePhase: "menstrual" | "follicular" | "ovulatory" | "luteal" | null;
}

export function analyze(input: AnalysisInput): Insight[] {
  const insights: Insight[] = [];

  const { calories, goals, macros, triggerFoodsToday, loggedEntryCount } = input;
  const target = goals.calorieTarget;

  // ── Calories vs target ─────────────────────────────────────────────
  if (loggedEntryCount === 0) {
    insights.push({
      id: "cal-none",
      level: "info",
      category: "calories",
      title: "Nothing logged yet",
      detail:
        "Food analysis kicks in once you log at least 400 calories. Until then, add a meal from the Food tab.",
    });
  } else if (calories < 400) {
    insights.push({
      id: "cal-low-input",
      level: "info",
      category: "calories",
      title: "Log a bit more",
      detail: `You're at ${Math.round(calories)} cal so far. Analysis opens up past 400 cal of logged food.`,
    });
  } else if (calories < target * 0.8) {
    insights.push({
      id: "cal-under",
      level: "watch",
      category: "calories",
      title: "Running light on calories",
      detail: `You're ${Math.round(target - calories)} cal under your ${target}-cal target. Under-fueling is a common driver of next-day POTS fatigue.`,
    });
  } else if (calories > target * 1.15) {
    insights.push({
      id: "cal-over",
      level: "watch",
      category: "calories",
      title: "Over target today",
      detail: `${Math.round(calories - target)} cal above your ${target}-cal target. One day is noise. Watch the 7-day trend if this repeats.`,
    });
  } else {
    insights.push({
      id: "cal-on",
      level: "good",
      category: "calories",
      title: "On target",
      detail: `${Math.round(calories)} of ${target} cal. Macro balance and micros are where the story lives today.`,
    });
  }

  // ── Macro balance ──────────────────────────────────────────────────
  const macroChecks: Array<[keyof AnalysisInput["macros"], number, string]> = [
    ["carbs", goals.macros.carbsG, "Carbs"],
    ["protein", goals.macros.proteinG, "Protein"],
    ["fat", goals.macros.fatG, "Fat"],
  ];
  for (const [key, targetG, label] of macroChecks) {
    const grams = macros[key] ?? 0;
    if (grams < targetG * 0.6) {
      insights.push({
        id: `macro-${key}-low`,
        level: "info",
        category: "macros",
        title: `${label} running under`,
        detail: `${Math.round(grams)}g vs ${targetG}g target. Not necessarily a problem, but worth noting if this is a pattern.`,
      });
    } else if (grams > targetG * 1.3 && targetG > 0) {
      insights.push({
        id: `macro-${key}-high`,
        level: "info",
        category: "macros",
        title: `${label} over target`,
        detail: `${Math.round(grams)}g vs ${targetG}g target. One day of over is fine.`,
      });
    }
  }

  // ── Sodium (POTS-specific) ─────────────────────────────────────────
  const sodiumTarget = goals.macros.sodiumMg;
  const sodium = macros.sodium ?? 0;
  if (sodium < sodiumTarget * 0.5 && loggedEntryCount >= 3) {
    insights.push({
      id: "sodium-low-pots",
      level: "flag",
      category: "sodium",
      title: "Sodium below your POTS target",
      detail: `${Math.round(sodium)} mg logged; target is ${sodiumTarget} mg. POTS patients often need 3000-10000 mg/day to support blood volume. Salt tabs, electrolyte drinks, and salty snacks are the usual boosters.`,
    });
  } else if (sodium >= sodiumTarget * 0.8 && sodium <= sodiumTarget * 1.2) {
    insights.push({
      id: "sodium-on",
      level: "good",
      category: "sodium",
      title: "Sodium on target",
      detail: `${Math.round(sodium)} mg of ${sodiumTarget} mg. Good POTS support today.`,
    });
  }

  // ── Fiber ──────────────────────────────────────────────────────────
  const fiberTarget = goals.macros.fiberG;
  const fiber = macros.fiber ?? 0;
  if (fiber < fiberTarget * 0.5 && loggedEntryCount >= 3) {
    insights.push({
      id: "fiber-low",
      level: "watch",
      category: "fiber",
      title: "Fiber under target",
      detail: `${Math.round(fiber)}g vs ${fiberTarget}g target. Fruit, vegetables, legumes, whole grains, chia/flax all add up fast.`,
    });
  }

  // ── Migraine / flare triggers ──────────────────────────────────────
  if (triggerFoodsToday.length > 0) {
    const unique = [...new Set(triggerFoodsToday)];
    insights.push({
      id: "triggers-today",
      level: "watch",
      category: "triggers",
      title: `Trigger food${unique.length === 1 ? "" : "s"} flagged`,
      detail: `${unique.join(", ")}. Not a prediction -- watch for symptoms in the next 24-48 hours and log a headache if one hits.`,
    });
  }

  // ── Iron (endo context) ────────────────────────────────────────────
  const iron = macros.iron ?? 0;
  if (iron > 0 && iron < 5 && input.hasCyclePhase === "menstrual" && loggedEntryCount >= 3) {
    insights.push({
      id: "iron-menstrual",
      level: "watch",
      category: "iron",
      title: "Iron low on a menstrual day",
      detail: `Only ${iron.toFixed(1)} mg iron logged. Period days are the most important time to lean into iron-rich meals. Pair with vitamin C for better absorption.`,
    });
  }

  // ── 7-day consistency ──────────────────────────────────────────────
  const sevenEntries = [...input.sevenDayCaloriesByDate.values()].filter((v) => v > 0);
  if (sevenEntries.length >= 5) {
    const avg = sevenEntries.reduce((a, b) => a + b, 0) / sevenEntries.length;
    const low = Math.min(...sevenEntries);
    const high = Math.max(...sevenEntries);
    const spread = high - low;
    if (spread > target * 0.5) {
      insights.push({
        id: "consistency-wide",
        level: "info",
        category: "consistency",
        title: "Wide day-to-day calorie spread",
        detail: `Last 7 days ranged from ${Math.round(low)} to ${Math.round(high)} cal (avg ${Math.round(avg)}). A more consistent intake helps autonomic symptoms settle.`,
      });
    } else {
      insights.push({
        id: "consistency-steady",
        level: "good",
        category: "consistency",
        title: "Steady week",
        detail: `7-day avg ${Math.round(avg)} cal with only ${Math.round(spread)} cal spread. Your body likes predictability.`,
      });
    }
  }

  return insights;
}
