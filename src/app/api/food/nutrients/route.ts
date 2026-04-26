/**
 * GET /api/food/nutrients?fdcId=12345
 *
 * Resolve a single USDA food's nutrient panel for the recipe builder
 * ingredient picker. Returns the per-100g (or per-serving for branded)
 * macros so the builder can scale by user-entered grams without a
 * round-trip to /api/food/log.
 *
 * Cached server-side via the existing `getFoodNutrients` path
 * (`food_nutrient_cache` row, 7-day TTL). No PHI, no auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getFoodNutrients,
  UsdaApiError,
  UsdaFoodNotFoundError,
} from "@/lib/api/usda-food";
import { jsonError } from "@/lib/api/json-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const fdcIdRaw = req.nextUrl.searchParams.get("fdcId");
  const fdcId = Number(fdcIdRaw);
  if (!Number.isFinite(fdcId) || fdcId <= 0) {
    return NextResponse.json({ error: "fdcId required" }, { status: 400 });
  }

  try {
    const n = await getFoodNutrients(fdcId);
    return NextResponse.json({
      fdcId: n.fdcId,
      description: n.description,
      brandName: n.brandName,
      calories: n.calories,
      protein: n.protein,
      carbs: n.carbs,
      fat: n.fat,
      fiber: n.fiber,
      sodium: n.sodium,
      servingSize: n.servingSize,
      servingUnit: n.servingUnit,
    });
  } catch (e) {
    if (e instanceof UsdaFoodNotFoundError) {
      return NextResponse.json(
        { error: "USDA no longer has that food.", code: "usda_food_not_found" },
        { status: 404 },
      );
    }
    if (e instanceof UsdaApiError) {
      return NextResponse.json(
        { error: "USDA is temporarily unavailable.", code: "usda_unavailable" },
        { status: 503 },
      );
    }
    return jsonError(500, "nutrient_lookup_failed", e);
  }
}
