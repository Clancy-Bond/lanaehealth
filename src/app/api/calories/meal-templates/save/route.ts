/**
 * POST /api/calories/meal-templates/save
 *
 * Snapshot the food_entries rows for (date, meal) and save them as a
 * named template in health_profile.meal_templates.
 *
 * Body: { date: YYYY-MM-DD, meal: breakfast|lunch|dinner|snack, name: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveUserId, UserIdUnresolvableError } from "@/lib/auth/resolve-user-id";
import { addMealTemplateFromEntries } from "@/lib/calories/meal-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = (await resolveUserId()).userId;
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: "auth check failed" }, { status: 500 });
  }

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

  const date = String(body.date ?? "");
  const meal = String(body.meal ?? "").toLowerCase();
  const name = String(body.name ?? "").trim();

  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (!VALID_MEALS.has(meal)) {
    return NextResponse.json({ error: "meal must be breakfast|lunch|dinner|snack." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name required." }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: log } = await sb
    .from("daily_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  const logId = (log as { id: string } | null)?.id ?? null;
  if (!logId) {
    return NextResponse.json({ error: "Nothing logged on that date." }, { status: 404 });
  }

  const { data: rows } = await sb
    .from("food_entries")
    .select("food_items, calories, macros, flagged_triggers")
    .eq("user_id", userId)
    .eq("log_id", logId)
    .eq("meal_type", meal);
  const entries = (rows ?? []) as Array<{
    food_items: string | null;
    calories: number | null;
    macros: Record<string, number> | null;
    flagged_triggers: string[] | null;
  }>;
  if (entries.length === 0) {
    return NextResponse.json({ error: "No items in that meal to save." }, { status: 404 });
  }

  const result = await addMealTemplateFromEntries({ name, meal, entries });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not save." }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(
      new URL("/calories/search?view=my-meals", req.url),
      303,
    );
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
}
