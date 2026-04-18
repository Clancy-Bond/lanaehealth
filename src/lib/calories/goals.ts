/**
 * Nutrition goals loader / writer.
 *
 * Persists editable targets to health_profile.section='nutrition_goals'.
 * health_profile is a row-per-section jsonb table; adding a new
 * section is fully additive and doesn't touch any existing data.
 *
 * When the section is absent, defaults to MyNetDiary's 1761/198/88/68
 * baseline for Lanae so the app always has working numbers.
 */

import { createServiceClient } from "@/lib/supabase";

export interface NutritionGoals {
  calorieTarget: number;
  macros: {
    carbsG: number;
    proteinG: number;
    fatG: number;
    fiberG: number;
    sodiumMg: number;
    calciumMg: number;
  };
  weight: {
    currentKg: number | null;
    targetKg: number | null;
    targetDate: string | null; // YYYY-MM-DD
  };
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  /** Override flag: when true, macros bypass auto-recalc from calories. */
  macrosManual: boolean;
}

export const DEFAULT_GOALS: NutritionGoals = {
  calorieTarget: 1761,
  macros: {
    carbsG: 198,
    proteinG: 88,
    fatG: 68,
    fiberG: 25,
    sodiumMg: 3000, // POTS-adjusted (normal: 2300mg)
    calciumMg: 1200,
  },
  weight: {
    currentKg: null,
    targetKg: null,
    targetDate: null,
  },
  activityLevel: "moderate",
  macrosManual: false,
};

/**
 * Load nutrition goals from health_profile. Returns defaults on any
 * error so the app never blocks on goal lookup.
 */
export async function loadNutritionGoals(): Promise<NutritionGoals> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "nutrition_goals")
      .maybeSingle();
    if (error || !data) return DEFAULT_GOALS;
    const parsed = ((data as { content: unknown }).content ?? null) as Partial<NutritionGoals> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_GOALS;
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_GOALS;
  }
}

/**
 * Save nutrition goals to health_profile. Upserts on (section) so the
 * same helper handles first-save and update.
 */
export async function saveNutritionGoals(goals: NutritionGoals): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert({ section: "nutrition_goals", content: goals }, { onConflict: "section" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}

function mergeWithDefaults(partial: Partial<NutritionGoals>): NutritionGoals {
  return {
    calorieTarget: numOr(partial.calorieTarget, DEFAULT_GOALS.calorieTarget, 800, 5000),
    macros: {
      carbsG: numOr(partial.macros?.carbsG, DEFAULT_GOALS.macros.carbsG, 0, 600),
      proteinG: numOr(partial.macros?.proteinG, DEFAULT_GOALS.macros.proteinG, 0, 400),
      fatG: numOr(partial.macros?.fatG, DEFAULT_GOALS.macros.fatG, 0, 300),
      fiberG: numOr(partial.macros?.fiberG, DEFAULT_GOALS.macros.fiberG, 0, 100),
      sodiumMg: numOr(partial.macros?.sodiumMg, DEFAULT_GOALS.macros.sodiumMg, 500, 15000),
      calciumMg: numOr(partial.macros?.calciumMg, DEFAULT_GOALS.macros.calciumMg, 0, 3000),
    },
    weight: {
      currentKg:
        partial.weight?.currentKg !== null && partial.weight?.currentKg !== undefined
          ? numOr(partial.weight.currentKg, 0, 20, 400)
          : null,
      targetKg:
        partial.weight?.targetKg !== null && partial.weight?.targetKg !== undefined
          ? numOr(partial.weight.targetKg, 0, 20, 400)
          : null,
      targetDate:
        typeof partial.weight?.targetDate === "string" ? partial.weight.targetDate : null,
    },
    activityLevel: validActivity(partial.activityLevel) ?? DEFAULT_GOALS.activityLevel,
    macrosManual: Boolean(partial.macrosManual),
  };
}

function numOr(v: unknown, d: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return d;
  return n;
}

function validActivity(v: unknown): NutritionGoals["activityLevel"] | null {
  const allowed: NutritionGoals["activityLevel"][] = [
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ];
  if (typeof v === "string" && (allowed as string[]).includes(v)) {
    return v as NutritionGoals["activityLevel"];
  }
  return null;
}

/**
 * When macrosManual is false, regenerate macro grams from the calorie
 * target using MFN's default split (45% carbs, 20% protein, 35% fat).
 * Callers that want to auto-rebalance after changing calories use this.
 */
export function recalcMacrosFromCalories(calorieTarget: number): NutritionGoals["macros"] {
  const carbsG = Math.round((calorieTarget * 0.45) / 4);
  const proteinG = Math.round((calorieTarget * 0.2) / 4);
  const fatG = Math.round((calorieTarget * 0.35) / 9);
  return {
    ...DEFAULT_GOALS.macros,
    carbsG,
    proteinG,
    fatG,
  };
}
