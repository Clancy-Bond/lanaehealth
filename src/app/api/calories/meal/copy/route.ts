/**
 * POST /api/calories/meal/copy
 *
 * Duplicate every food_entries row for (date, meal) to targetDate
 * (same meal type). MyNetDiary-parity "Copy meal" action on the Food
 * tab overflow menu. Default targetDate is tomorrow.
 *
 * Body: { date: YYYY-MM-DD, meal: breakfast|lunch|dinner|snack,
 *         targetDate?: YYYY-MM-DD }
 *
 * Additive: never deletes. Creates a fresh daily_log row for the
 * target date if one does not exist.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveUserId, UserIdUnresolvableError } from "@/lib/auth/resolve-user-id";
import { format, addDays } from "date-fns";

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
  const rawTarget = String(body.targetDate ?? "");
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (!VALID_MEALS.has(meal)) {
    return NextResponse.json({ error: "meal must be breakfast|lunch|dinner|snack." }, { status: 400 });
  }
  const targetDate = DATE_RE.test(rawTarget)
    ? rawTarget
    : format(addDays(new Date(date + "T00:00:00"), 1), "yyyy-MM-dd");

  const sb = createServiceClient();

  const { data: srcLog } = await sb
    .from("daily_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  const srcLogId = (srcLog as { id: string } | null)?.id ?? null;
  if (!srcLogId) {
    return NextResponse.json({ error: "No meals logged on source date." }, { status: 404 });
  }

  const { data: rows } = await sb
    .from("food_entries")
    .select("food_items, calories, macros, flagged_triggers, meal_type")
    .eq("user_id", userId)
    .eq("log_id", srcLogId)
    .eq("meal_type", meal);
  const entries = (rows ?? []) as Array<{
    food_items: string | null;
    calories: number | null;
    macros: Record<string, number> | null;
    flagged_triggers: string[] | null;
    meal_type: string | null;
  }>;
  if (entries.length === 0) {
    return NextResponse.json({ error: "No items to copy." }, { status: 404 });
  }

  // Resolve or create target daily_log scoped to this user.
  const { data: existingTarget } = await sb
    .from("daily_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", targetDate)
    .maybeSingle();
  let targetLogId = (existingTarget as { id: string } | null)?.id ?? null;
  if (!targetLogId) {
    const { data: inserted, error } = await sb
      .from("daily_logs")
      .insert({ date: targetDate, user_id: userId })
      .select("id")
      .single();
    if (error || !inserted) {
      return NextResponse.json(
        { error: `Could not create daily_log: ${error?.message ?? "no row"}` },
        { status: 500 },
      );
    }
    targetLogId = (inserted as { id: string }).id;
  }

  const inserts = entries.map((e) => ({
    log_id: targetLogId,
    user_id: userId,
    meal_type: meal,
    food_items: e.food_items,
    calories: e.calories,
    macros: e.macros ?? {},
    flagged_triggers: e.flagged_triggers ?? [],
  }));

  const { error: insErr } = await sb.from("food_entries").insert(inserts);
  if (insErr) {
    return NextResponse.json({ error: `Could not copy: ${insErr.message}` }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(
      new URL(`/calories/food?date=${targetDate}#${meal}`, req.url),
      303,
    );
  }
  return NextResponse.json(
    { ok: true, copied: inserts.length, targetDate, targetMeal: meal },
    { status: 200 },
  );
}
