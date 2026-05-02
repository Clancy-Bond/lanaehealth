/**
 * POST /api/calories/custom-foods/log
 *
 * Add a previously-created custom food to today's food_entries.
 * Lightweight version of /api/food/log since we skip USDA lookup.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { findCustomFood } from "@/lib/calories/custom-foods";
import { requireUser } from "@/lib/api/require-user";
import { safeErrorMessage, safeErrorResponse } from "@/lib/api/safe-error";
import { format } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  const ct = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  try {
    if (ct.includes("application/json")) {
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

  const customId = String(body.customId ?? "");
  const mealType = String(body.meal_type ?? "").toLowerCase();
  if (!customId) return NextResponse.json({ error: "customId required." }, { status: 400 });
  if (!VALID_MEALS.has(mealType)) {
    return NextResponse.json({ error: "meal_type must be breakfast|lunch|dinner|snack." }, { status: 400 });
  }

  const food = await findCustomFood(customId);
  if (!food) return NextResponse.json({ error: "Custom food not found." }, { status: 404 });

  const sb = createServiceClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: existing } = await sb
    .from("daily_logs")
    .select("id")
    .eq("date", today)
    .maybeSingle();
  let logId = (existing as { id: string } | null)?.id ?? null;
  if (!logId) {
    const { data: inserted, error } = await sb
      .from("daily_logs")
      .insert({ date: today })
      .select("id")
      .single();
    if (error || !inserted) {
      return NextResponse.json(
        { error: safeErrorMessage(error, "could_not_create_daily_log") },
        { status: 500 },
      );
    }
    logId = (inserted as { id: string }).id;
  }

  const macros: Record<string, number> = {};
  for (const [k, v] of Object.entries(food.macros)) {
    if (typeof v === "number" && Number.isFinite(v)) macros[k] = v;
  }

  const displayName = `${food.name} (${food.servingLabel})`;

  const { error: insErr } = await sb.from("food_entries").insert({
    log_id: logId,
    meal_type: mealType,
    food_items: displayName,
    calories: Math.round(food.calories),
    macros,
    flagged_triggers: [],
  });

  if (insErr) {
    return NextResponse.json({ error: safeErrorMessage(insErr, "could_not_log") }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/calories", req.url), 303);
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
