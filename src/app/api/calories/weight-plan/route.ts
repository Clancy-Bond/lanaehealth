/**
 * POST /api/calories/weight-plan
 *
 * Persists a full weight-loss plan (TDEE-based) to
 * health_profile.section='weight_plan' AND syncs the calorie target +
 * macro grams into health_profile.section='nutrition_goals' so the
 * dashboard ring on /v2/calories follows the saved plan.
 *
 * Calculator math lives in src/lib/calories/weight-plan.ts and is
 * cited at docs/research/weight-loss-calculation-methodology.md.
 *
 * Body (JSON):
 *   currentWeightKg, heightCm, ageYears, sex, activityLevel,
 *   goalWeightKg, weeklyRateKg, conditions { POTS?, migraine?, cycle? }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateWeightPlan, type WeightPlanInputs } from "@/lib/calories/weight-plan";
import { saveWeightPlan } from "@/lib/calories/weight-plan-store";
import {
  loadNutritionGoals,
  saveNutritionGoals,
  type NutritionGoals,
} from "@/lib/calories/goals";
import { jsonError } from "@/lib/api/json-error";

const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;

const Body = z.object({
  currentWeightKg: z.number().min(20).max(400),
  heightCm: z.number().min(100).max(260),
  ageYears: z.number().int().min(10).max(120),
  sex: z.enum(["male", "female"]),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  goalWeightKg: z.number().min(20).max(400),
  weeklyRateKg: z.number().min(0).max(2),
  conditions: z
    .object({
      POTS: z.boolean().optional(),
      migraine: z.boolean().optional(),
      cycle: z.boolean().optional(),
    })
    .optional(),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "bad_body");
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "weight_plan_invalid", parsed.error);
  }
  const inputs: WeightPlanInputs = parsed.data;

  // 1. Save the plan (calculator + persistence in one call).
  const result = await saveWeightPlan(inputs);
  if (!result.ok || !result.plan) {
    return jsonError(500, "weight_plan_save_failed", result.error);
  }

  // 2. Sync into nutrition_goals so the dashboard ring follows.
  //    Soft sync : we keep manual overrides if the user already set
  //    macrosManual = true, otherwise we replace calorie + macro grams.
  try {
    const current = await loadNutritionGoals();
    if (!current.macrosManual) {
      const synced: NutritionGoals = {
        ...current,
        calorieTarget: result.plan.targetCalories,
        macros: {
          ...current.macros,
          carbsG: result.plan.macros.carbsG,
          proteinG: result.plan.macros.proteinG,
          fatG: result.plan.macros.fatG,
        },
        weight: {
          currentKg: inputs.currentWeightKg,
          targetKg: inputs.goalWeightKg,
          targetDate: result.plan.targetDate,
        },
        activityLevel: inputs.activityLevel,
      };
      await saveNutritionGoals(synced);
    } else {
      // Manual mode : only refresh weight + activity, leave macros alone.
      const synced: NutritionGoals = {
        ...current,
        weight: {
          currentKg: inputs.currentWeightKg,
          targetKg: inputs.goalWeightKg,
          targetDate: result.plan.targetDate,
        },
        activityLevel: inputs.activityLevel,
      };
      await saveNutritionGoals(synced);
    }
  } catch (e) {
    // Non-fatal : the plan saved, just log the sync failure.
    // eslint-disable-next-line no-console
    console.error("[weight-plan] nutrition_goals sync failed:", e);
  }

  return NextResponse.json({ ok: true, plan: result.plan }, { status: 200 });
}

export async function GET() {
  // Convenience preview : compute without persisting (smoke test).
  const preview = calculateWeightPlan({
    currentWeightKg: 70,
    heightCm: 170,
    ageYears: 30,
    sex: "female",
    activityLevel: "moderate",
    goalWeightKg: 65,
    weeklyRateKg: 0.5,
  });
  return NextResponse.json({ preview }, { status: 200 });
}
