/**
 * POST /api/calories/plan
 *
 * Accepts a form or JSON body with nutrition goals and persists them
 * to health_profile.section='nutrition_goals'. Redirects back to the
 * plan page on form submit.
 *
 * Body fields (all optional; omitted fields keep their prior value):
 *   calorieTarget, carbsG, proteinG, fatG, fiberG, sodiumMg,
 *   calciumMg, currentKg, targetKg, targetDate, activityLevel,
 *   macrosManual
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  loadNutritionGoals,
  saveNutritionGoals,
  recalcMacrosFromCalories,
  type NutritionGoals,
} from "@/lib/calories/goals";
import { jsonError } from "@/lib/api/json-error";
import { zIsoDate, zOptionalNumber } from "@/lib/api/zod-forms";

const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;

const BodySchema = z.object({
  calorieTarget: zOptionalNumber,
  carbsG: zOptionalNumber,
  proteinG: zOptionalNumber,
  fatG: zOptionalNumber,
  fiberG: zOptionalNumber,
  sodiumMg: zOptionalNumber,
  calciumMg: zOptionalNumber,
  currentKg: zOptionalNumber,
  targetKg: zOptionalNumber,
  targetDate: z.union([zIsoDate, z.literal("")]).optional(),
  activityLevel: z
    .preprocess((v) => (typeof v === "string" ? v.toLowerCase() : v), z.enum(ACTIVITY_LEVELS))
    .optional(),
  macrosManual: z
    .preprocess((v) => (v === "true" ? true : v === "false" || v === undefined ? false : v), z.boolean())
    .optional(),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/json")) {
      body = (await req.json()) as Record<string, unknown>;
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        body[k] = typeof v === "string" ? v : v.name;
      }
    }
  } catch {
    return jsonError(400, "bad_body");
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "nutrition_goals_invalid", parsed.error);
  }
  const p = parsed.data;

  const current = await loadNutritionGoals();
  const macrosManual = p.macrosManual ?? false;
  const calorieTarget = p.calorieTarget ?? current.calorieTarget;

  const nextMacros = macrosManual
    ? {
        ...current.macros,
        carbsG: p.carbsG ?? current.macros.carbsG,
        proteinG: p.proteinG ?? current.macros.proteinG,
        fatG: p.fatG ?? current.macros.fatG,
        fiberG: p.fiberG ?? current.macros.fiberG,
        sodiumMg: p.sodiumMg ?? current.macros.sodiumMg,
        calciumMg: p.calciumMg ?? current.macros.calciumMg,
      }
    : recalcMacrosFromCalories(calorieTarget);

  const next: NutritionGoals = {
    calorieTarget,
    macros: nextMacros,
    weight: {
      currentKg: p.currentKg ?? current.weight.currentKg,
      targetKg: p.targetKg ?? current.weight.targetKg,
      targetDate: p.targetDate && p.targetDate.length > 0 ? p.targetDate : current.weight.targetDate,
    },
    activityLevel: p.activityLevel ?? current.activityLevel,
    macrosManual,
  };

  const result = await saveNutritionGoals(next);
  if (!result.ok) {
    return jsonError(500, "nutrition_goals_save_failed", result.error);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/calories/plan?saved=1`, req.url), 303);
  }
  return NextResponse.json({ ok: true, goals: next }, { status: 200 });
}
