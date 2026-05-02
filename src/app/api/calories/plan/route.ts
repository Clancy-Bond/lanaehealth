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
import {
  loadNutritionGoals,
  saveNutritionGoals,
  recalcMacrosFromCalories,
  type NutritionGoals,
} from "@/lib/calories/goals";
import { requireUser } from "@/lib/api/require-user";
import { safeErrorResponse } from "@/lib/api/safe-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function num(v: unknown): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
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
    return NextResponse.json({ error: "Bad body." }, { status: 400 });
  }

  const current = await loadNutritionGoals();

  const macrosManual = body.macrosManual === "true" || body.macrosManual === true;
  const calorieTarget = num(body.calorieTarget) ?? current.calorieTarget;

  // If macrosManual is false and the calorie target changed, recalc macros.
  let nextMacros = current.macros;
  if (!macrosManual) {
    nextMacros = recalcMacrosFromCalories(calorieTarget);
  } else {
    nextMacros = {
      ...current.macros,
      carbsG: num(body.carbsG) ?? current.macros.carbsG,
      proteinG: num(body.proteinG) ?? current.macros.proteinG,
      fatG: num(body.fatG) ?? current.macros.fatG,
      fiberG: num(body.fiberG) ?? current.macros.fiberG,
      sodiumMg: num(body.sodiumMg) ?? current.macros.sodiumMg,
      calciumMg: num(body.calciumMg) ?? current.macros.calciumMg,
    };
  }

  const activityLevel = (() => {
    const v = String(body.activityLevel ?? "").toLowerCase();
    const allowed: NutritionGoals["activityLevel"][] = [
      "sedentary",
      "light",
      "moderate",
      "active",
      "very_active",
    ];
    return (allowed as string[]).includes(v)
      ? (v as NutritionGoals["activityLevel"])
      : current.activityLevel;
  })();

  const next: NutritionGoals = {
    calorieTarget,
    macros: nextMacros,
    weight: {
      currentKg: num(body.currentKg) ?? current.weight.currentKg,
      targetKg: num(body.targetKg) ?? current.weight.targetKg,
      targetDate:
        typeof body.targetDate === "string" && body.targetDate.length > 0
          ? (body.targetDate as string)
          : current.weight.targetDate,
    },
    activityLevel,
    macrosManual,
  };

  const result = await saveNutritionGoals(next);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/calories/plan?saved=1`, req.url), 303);
  }
  return NextResponse.json({ ok: true, goals: next }, { status: 200 });
}
