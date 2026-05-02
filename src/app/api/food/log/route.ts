/**
 * POST /api/food/log
 *
 * Add a USDA food to today's food_entries.
 *
 * Accepts either JSON or form-encoded body (so it can be posted from
 * a plain `<form method="post">` on the food detail page).
 *
 * Body fields:
 *   fdcId:     number     required, USDA FoodData Central id
 *   meal_type: string     required: breakfast | lunch | dinner | snack
 *   servings:  number     optional, default 1
 *   date:      YYYY-MM-DD optional, default today (for back-dating from
 *                          the /calories?date= view)
 *
 * Flow:
 *   1. Resolve today's (or specified date's) daily_logs row, creating
 *      a stub when missing.
 *   2. Fetch USDA nutrients for fdcId.
 *   3. Scale by servings, insert into food_entries.
 *   4. Detect trigger foods with existing food-triggers module.
 *   5. 303-redirect back to /calories on success so the form post
 *      completes cleanly.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getFoodNutrients } from "@/lib/api/usda-food";
import { detectTriggers } from "@/lib/food-triggers";
import { requireUser } from "@/lib/api/require-user";
import { safeErrorMessage, safeErrorResponse } from "@/lib/api/safe-error";
import { format } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ParsedInput {
  fdcId: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  date: string;
}

const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);

function clampServings(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(20, Math.max(0.25, n));
}

function parseDate(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return format(new Date(), "yyyy-MM-dd");
  }
  return raw;
}

async function parseBody(req: NextRequest): Promise<ParsedInput | { error: string }> {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return { error: "Invalid JSON body." };
    }
  } else {
    // form-urlencoded or multipart
    try {
      const fd = await req.formData();
      const out: Record<string, unknown> = {};
      for (const [k, v] of fd.entries()) {
        out[k] = typeof v === "string" ? v : v.name;
      }
      body = out;
    } catch {
      return { error: "Failed to parse form body." };
    }
  }

  const fdcId = Number(body.fdcId);
  const mealType = String(body.meal_type ?? "").toLowerCase();
  if (!Number.isFinite(fdcId) || fdcId <= 0) {
    return { error: "fdcId is required." };
  }
  if (!VALID_MEALS.has(mealType)) {
    return { error: "meal_type must be breakfast|lunch|dinner|snack." };
  }

  return {
    fdcId,
    mealType: mealType as ParsedInput["mealType"],
    servings: clampServings(body.servings),
    date: parseDate(body.date),
  };
}

async function getOrCreateDailyLog(supabase: ReturnType<typeof createServiceClient>, date: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("daily_logs")
    .select("id")
    .eq("date", date)
    .maybeSingle();
  if (existing && (existing as { id: string }).id) {
    return (existing as { id: string }).id;
  }
  // Create a stub daily log for the date.
  const { data: inserted, error } = await supabase
    .from("daily_logs")
    .insert({ date })
    .select("id")
    .single();
  if (error || !inserted) return null;
  return (inserted as { id: string }).id;
}

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  const parsed = await parseBody(req);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Resolve today's log.
  const logId = await getOrCreateDailyLog(supabase, parsed.date);
  if (!logId) {
    return NextResponse.json(
      { error: "Could not resolve a daily_logs row for this date." },
      { status: 500 },
    );
  }

  // Fetch USDA nutrients.
  let nutrients;
  try {
    nutrients = await getFoodNutrients(parsed.fdcId);
  } catch (e) {
    return NextResponse.json(
      { error: safeErrorMessage(e, "usda_lookup_failed") },
      { status: 502 },
    );
  }

  // Scale by servings.
  const mult = parsed.servings;
  const foodName = nutrients.description;
  const calories = nutrients.calories !== null ? nutrients.calories * mult : null;

  const macros: Record<string, number> = {};
  const addMacro = (key: string, v: number | null) => {
    if (v !== null) macros[key] = Number((v * mult).toFixed(2));
  };
  addMacro("protein", nutrients.protein);
  addMacro("carbs", nutrients.carbs);
  addMacro("fat", nutrients.fat);
  addMacro("fiber", nutrients.fiber);
  addMacro("sugar", nutrients.sugar);
  addMacro("sodium", nutrients.sodium);
  addMacro("iron", nutrients.iron);
  addMacro("calcium", nutrients.calcium);
  addMacro("vitaminC", nutrients.vitaminC);
  addMacro("vitaminD", nutrients.vitaminD);
  addMacro("vitaminB12", nutrients.vitaminB12);
  addMacro("magnesium", nutrients.magnesium);
  addMacro("zinc", nutrients.zinc);
  addMacro("potassium", nutrients.potassium);
  addMacro("omega3", nutrients.omega3);
  addMacro("folate", nutrients.folate);

  // Detect trigger foods based on the food name.
  let flaggedTriggers: string[] = [];
  try {
    const detected = detectTriggers(foodName);
    flaggedTriggers = Array.isArray(detected)
      ? detected.map((t) => (typeof t === "string" ? t : (t as { name?: string }).name ?? ""))
          .filter(Boolean)
      : [];
  } catch {
    flaggedTriggers = [];
  }

  const servingLabel =
    nutrients.servingSize !== null
      ? `${(nutrients.servingSize * mult).toFixed(0)}${nutrients.servingUnit ?? "g"}`
      : `${parsed.servings} serving${parsed.servings === 1 ? "" : "s"}`;
  const displayName = `${foodName} (${servingLabel})`;

  const { error: insertErr } = await supabase.from("food_entries").insert({
    log_id: logId,
    meal_type: parsed.mealType,
    food_items: displayName,
    calories: calories !== null ? Math.round(calories) : null,
    macros,
    flagged_triggers: flaggedTriggers,
  });

  if (insertErr) {
    return NextResponse.json(
      { error: safeErrorMessage(insertErr, "food_entry_insert_failed") },
      { status: 500 },
    );
  }

  // If the request accepts HTML, 303-redirect back to the dashboard.
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(
      new URL(`/calories?date=${parsed.date}`, req.url),
      303,
    );
  }

  return NextResponse.json({ ok: true, logId }, { status: 200 });
}
