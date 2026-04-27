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
import { resolveUserId, UserIdUnresolvableError } from "@/lib/auth/resolve-user-id";
import { trace } from "@/lib/observability/tracing";
import { logError } from "@/lib/observability/log";
import {
  getFoodNutrients,
  UsdaApiError,
  UsdaFoodNotFoundError,
} from "@/lib/api/usda-food";
import { scaleNutrientsToGrams } from "@/lib/api/usda-portions";
import { detectTriggers } from "@/lib/food-triggers";
import { format } from "date-fns";
import { safeReturnPath } from "@/lib/api/safe-redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ParsedInput {
  fdcId: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  /** Optional: grams per unit (e.g. 118 for "1 medium banana"). When
   * missing, the server falls back to nutrients.servingSize. */
  gramsPerUnit: number | null;
  /** Optional: portion label surfaced to the user in the food entry
   * name, e.g. "1 medium". Display only. */
  portionLabel: string | null;
  date: string;
  /** Optional: where to redirect after a successful HTML post. Must be
   * a site-relative path starting with a single `/`. Used by v2 food
   * detail to bounce back to `/v2/calories?date=...` instead of the
   * legacy `/calories` page. Additive: legacy callers omit this. */
  returnTo: string | null;
}

const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);

function clampServings(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(20, Math.max(0.25, n));
}

function clampGrams(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10000, n);
}

function parseDate(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return format(new Date(), "yyyy-MM-dd");
  }
  return raw;
}

// returnTo sanitisation lives in src/lib/api/safe-redirect.ts as
// `safeReturnPath` so multiple routes share one well-tested guard.

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
    gramsPerUnit: clampGrams(body.gramsPerUnit),
    portionLabel: typeof body.portionLabel === "string" ? body.portionLabel.trim().slice(0, 80) || null : null,
    date: parseDate(body.date),
    returnTo: safeReturnPath(body.returnTo),
  };
}

async function getOrCreateDailyLog(
  supabase: ReturnType<typeof createServiceClient>,
  date: string,
  userId: string,
): Promise<string | null> {
  // Pre-/post-migration graceful path: try with user_id first
  // (multi-tenant); if the column does not exist on this DB (pre-035
  // schema), fall back to date-only (legacy single-tenant). Same
  // pattern as PR #125's scope-upsert / scope-query.
  const isMissingUserIdError = (err: { message?: string; code?: string } | null | undefined) => {
    if (!err) return false;
    if (err.code === "42703" || err.code === "PGRST204") return true;
    return /column\s+(?:"|`)?user_id(?:"|`)?\s+(?:does\s+not\s+exist|not\s+found)/i.test(err.message ?? "")
      || /could\s+not\s+find\s+(?:the\s+)?(?:'user_id'\s+)?column/i.test(err.message ?? "");
  };

  // 1. Look for an existing row scoped to this user.
  const scopedSelect = await supabase
    .from("daily_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (scopedSelect.data && (scopedSelect.data as { id: string }).id) {
    return (scopedSelect.data as { id: string }).id;
  }
  // Column missing -> retry without the user_id filter.
  if (isMissingUserIdError(scopedSelect.error)) {
    const legacySelect = await supabase
      .from("daily_logs")
      .select("id")
      .eq("date", date)
      .maybeSingle();
    if (legacySelect.data && (legacySelect.data as { id: string }).id) {
      return (legacySelect.data as { id: string }).id;
    }
    // Insert without user_id (single-tenant legacy schema).
    const legacyInsert = await supabase
      .from("daily_logs")
      .insert({ date })
      .select("id")
      .single();
    if (legacyInsert.error || !legacyInsert.data) return null;
    console.warn(
      `[food/log] daily_logs.user_id missing - inserted legacy single-tenant row. ` +
        `Apply migration 035 to enable per-user scoping.`,
    );
    return (legacyInsert.data as { id: string }).id;
  }

  // 2. Create the multi-tenant row.
  const scopedInsert = await supabase
    .from("daily_logs")
    .insert({ date, user_id: userId })
    .select("id")
    .single();
  if (scopedInsert.data) {
    return (scopedInsert.data as { id: string }).id;
  }
  // Edge case: SELECT succeeded with the user_id column present but
  // INSERT lost the column (impossible under normal schemas, but the
  // graceful path keeps us writing instead of 500ing). Strip user_id
  // and try once more.
  if (isMissingUserIdError(scopedInsert.error)) {
    const legacyInsert = await supabase
      .from("daily_logs")
      .insert({ date })
      .select("id")
      .single();
    if (legacyInsert.error || !legacyInsert.data) return null;
    return (legacyInsert.data as { id: string }).id;
  }
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return trace({ name: "POST /api/food/log", op: "http.server" }, async () => {
    return handleFoodLog(req);
  });
}

async function handleFoodLog(req: NextRequest): Promise<NextResponse> {
  let userId: string;
  try {
    userId = (await resolveUserId()).userId;
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    logError({ context: "food/log:auth", error: err });
    return NextResponse.json({ error: "auth check failed" }, { status: 500 });
  }

  const parsed = await parseBody(req);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Resolve today's log scoped to this user.
  const logId = await getOrCreateDailyLog(supabase, parsed.date, userId);
  if (!logId) {
    return NextResponse.json(
      { error: "Could not resolve a daily_logs row for this date." },
      { status: 500 },
    );
  }

  // Fetch USDA nutrients. Distinguish 404 (retired fdcId) from API
  // outage so the client can decide whether to retry.
  let nutrients;
  try {
    nutrients = await getFoodNutrients(parsed.fdcId);
  } catch (e) {
    if (e instanceof UsdaFoodNotFoundError) {
      return NextResponse.json(
        {
          error:
            "That food is no longer available from USDA. Search for it again to pick a fresh match.",
          code: "usda_food_not_found",
        },
        { status: 404 },
      );
    }
    if (e instanceof UsdaApiError) {
      return NextResponse.json(
        {
          error: "USDA is temporarily unavailable. Please try again in a moment.",
          code: "usda_unavailable",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error: `USDA lookup failed: ${e instanceof Error ? e.message : "unknown"}`,
        code: "usda_lookup_failed",
      },
      { status: 502 },
    );
  }

  // Scale by portion × amount. If the caller supplied gramsPerUnit
  // (from the portion picker), total grams eaten is gramsPerUnit ×
  // servings. Otherwise fall back to servings × nutrients.servingSize
  // for legacy URLs that only pass ?servings=N.
  const servingSizeG = nutrients.servingSize ?? 100;
  const perUnitG = parsed.gramsPerUnit ?? servingSizeG;
  const gramsEaten = perUnitG * parsed.servings;

  const scaled = scaleNutrientsToGrams(
    {
      calories: nutrients.calories,
      protein: nutrients.protein,
      fat: nutrients.fat,
      satFat: nutrients.satFat,
      transFat: nutrients.transFat,
      cholesterol: nutrients.cholesterol,
      carbs: nutrients.carbs,
      fiber: nutrients.fiber,
      sugar: nutrients.sugar,
      sodium: nutrients.sodium,
      iron: nutrients.iron,
      calcium: nutrients.calcium,
      vitaminC: nutrients.vitaminC,
      vitaminD: nutrients.vitaminD,
      vitaminB12: nutrients.vitaminB12,
      magnesium: nutrients.magnesium,
      zinc: nutrients.zinc,
      potassium: nutrients.potassium,
      omega3: nutrients.omega3,
      folate: nutrients.folate,
    },
    servingSizeG,
    gramsEaten,
  );

  const foodName = nutrients.description;
  const calories = scaled.calories;

  const macros: Record<string, number> = {};
  const addMacro = (key: string, v: number | null | undefined) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      macros[key] = Number(v.toFixed(2));
    }
  };
  addMacro("protein", scaled.protein);
  addMacro("carbs", scaled.carbs);
  addMacro("fat", scaled.fat);
  addMacro("satFat", scaled.satFat);
  addMacro("transFat", scaled.transFat);
  addMacro("cholesterol", scaled.cholesterol);
  addMacro("fiber", scaled.fiber);
  addMacro("sugar", scaled.sugar);
  addMacro("sodium", scaled.sodium);
  addMacro("iron", scaled.iron);
  addMacro("calcium", scaled.calcium);
  addMacro("vitaminC", scaled.vitaminC);
  addMacro("vitaminD", scaled.vitaminD);
  addMacro("vitaminB12", scaled.vitaminB12);
  addMacro("magnesium", scaled.magnesium);
  addMacro("zinc", scaled.zinc);
  addMacro("potassium", scaled.potassium);
  addMacro("omega3", scaled.omega3);
  addMacro("folate", scaled.folate);

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

  // Display label: prefer the portion the user picked ("1 medium"),
  // fall back to total grams, fall back to serving count.
  const amountLabel = `${parsed.servings === Math.floor(parsed.servings) ? parsed.servings : parsed.servings.toFixed(2)}`;
  const servingLabel = parsed.portionLabel
    ? `${amountLabel}× ${parsed.portionLabel} ${Math.round(gramsEaten)}g`
    : `${Math.round(gramsEaten)}${nutrients.servingUnit ?? "g"}`;
  const displayName = `${foodName} (${servingLabel})`;

  const baseRow = {
    log_id: logId,
    meal_type: parsed.mealType,
    food_items: displayName,
    calories: calories !== null ? Math.round(calories) : null,
    macros,
    flagged_triggers: flaggedTriggers,
  };

  // Try multi-tenant insert first; fall back to legacy single-tenant
  // when food_entries.user_id is missing (pre-035 schema). Same
  // graceful pattern as daily_logs above. See PR #125 for the read-
  // side counterpart.
  const { error: scopedInsertErr } = await supabase
    .from("food_entries")
    .insert({ ...baseRow, user_id: userId });

  let insertErr = scopedInsertErr;
  if (
    scopedInsertErr &&
    (scopedInsertErr.code === "42703" ||
      scopedInsertErr.code === "PGRST204" ||
      /column\s+(?:"|`)?user_id(?:"|`)?\s+(?:does\s+not\s+exist|not\s+found)/i.test(
        scopedInsertErr.message ?? "",
      ) ||
      /could\s+not\s+find\s+(?:the\s+)?(?:'user_id'\s+)?column/i.test(
        scopedInsertErr.message ?? "",
      ))
  ) {
    const legacy = await supabase.from("food_entries").insert(baseRow);
    insertErr = legacy.error;
    if (!legacy.error) {
      console.warn(
        "[food/log] food_entries.user_id missing - inserted legacy single-tenant row. " +
          "Apply migration 035 to enable per-user scoping.",
      );
    }
  }

  if (insertErr) {
    return NextResponse.json(
      { error: `Could not insert food entry: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // If the request accepts HTML, 303-redirect back. Honors a sanitized
  // returnTo when provided (v2 callers), falls back to legacy path.
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    const destination = parsed.returnTo ?? `/calories?date=${parsed.date}`;
    return NextResponse.redirect(new URL(destination, req.url), 303);
  }

  return NextResponse.json({ ok: true, logId }, { status: 200 });
}

/*
 * PATCH /api/food/log
 *
 * Edit-in-place support for an existing food_entries row. Lanae taps a
 * meal row, the MealItemEditSheet posts here with the new servings count
 * and the previous servings count. We scale calories + every macro field
 * by (next / prev) and persist. No USDA roundtrip needed.
 *
 * Body (JSON only, this is a programmatic call from the sheet):
 *   id:           string  required, food_entries.id
 *   nextServings: number  required, > 0
 *   prevServings: number  required, > 0
 *
 * Why scale instead of refetching nutrients?  food_entries has no fdcId
 * column, so we cannot replay /api/food/log without losing the original
 * portion label. Scaling preserves the displayed name and trigger flags
 * unchanged, which matches MFN behavior: the "Apple, 1 medium" row stays
 * named that way; only the numbers move.
 *
 * Authorization: scoped by user_id from the session.
 */
export async function PATCH(req: NextRequest) {
  let userId: string;
  try {
    userId = (await resolveUserId()).userId;
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "auth check failed" }, { status: 500 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const nextServings = Number(body.nextServings);
  const prevServings = Number(body.prevServings);
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (!Number.isFinite(nextServings) || nextServings <= 0 || nextServings > 20) {
    return NextResponse.json({ error: "nextServings out of range" }, { status: 400 });
  }
  if (!Number.isFinite(prevServings) || prevServings <= 0) {
    return NextResponse.json({ error: "prevServings out of range" }, { status: 400 });
  }
  const ratio = nextServings / prevServings;

  const supabase = createServiceClient();

  // Fetch current row, scoped to this user. Service role bypasses RLS,
  // so the explicit user_id filter is the gate that prevents one user
  // editing another's entries.
  const { data: existing, error: fetchErr } = await supabase
    .from("food_entries")
    .select("id, calories, macros")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json(
      { error: `Lookup failed: ${fetchErr.message}` },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const row = existing as { id: string; calories: number | null; macros: Record<string, unknown> | null };
  const nextCalories = row.calories != null ? Math.round(row.calories * ratio) : null;
  const macros: Record<string, number> = {};
  if (row.macros && typeof row.macros === "object") {
    for (const [k, v] of Object.entries(row.macros)) {
      const n = Number(v);
      if (Number.isFinite(n)) macros[k] = Number((n * ratio).toFixed(2));
    }
  }

  const { error: updateErr } = await supabase
    .from("food_entries")
    .update({ calories: nextCalories, macros })
    .eq("id", id)
    .eq("user_id", userId);
  if (updateErr) {
    return NextResponse.json(
      { error: `Update failed: ${updateErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, id, calories: nextCalories, macros },
    { status: 200 },
  );
}
