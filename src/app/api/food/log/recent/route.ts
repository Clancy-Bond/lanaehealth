/**
 * POST /api/food/log/recent
 *
 * MFN-grade quick-log: clone a previous food_entries row into a fresh
 * row scoped to the chosen meal + date. The UI sends the source row id
 * (from the recents strip on /v2/calories) and the user's chosen meal
 * type. We copy the display name, calories, macros, and trigger flags
 * verbatim because the user's intent is "log the same thing again".
 *
 * Body (JSON):
 *   sourceId: string  required, food_entries.id to clone
 *   meal:     string  required, breakfast|lunch|dinner|snack
 *   date:     YYYY-MM-DD  optional, defaults to today
 *
 * Authorization: source row must belong to the calling user.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveUserId, UserIdUnresolvableError } from "@/lib/auth/resolve-user-id";
import { format } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getOrCreateDailyLog(
  supabase: ReturnType<typeof createServiceClient>,
  date: string,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("daily_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (existing && (existing as { id: string }).id) {
    return (existing as { id: string }).id;
  }
  const { data: inserted, error } = await supabase
    .from("daily_logs")
    .insert({ date, user_id: userId })
    .select("id")
    .single();
  if (error || !inserted) return null;
  return (inserted as { id: string }).id;
}

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

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sourceId = String(body.sourceId ?? "").trim();
  const meal = String(body.meal ?? "").toLowerCase();
  const dateRaw = typeof body.date === "string" ? body.date : "";
  const date = DATE_RE.test(dateRaw) ? dateRaw : format(new Date(), "yyyy-MM-dd");

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId required" }, { status: 400 });
  }
  if (!VALID_MEALS.has(meal)) {
    return NextResponse.json(
      { error: "meal must be breakfast|lunch|dinner|snack" },
      { status: 400 },
    );
  }

  const sb = createServiceClient();

  // Fetch source row scoped to the calling user. Belt and suspenders:
  // service role bypasses RLS, so the explicit user_id filter is the
  // gate that prevents cloning another user's entries.
  const { data: source, error: srcErr } = await sb
    .from("food_entries")
    .select("food_items, calories, macros, flagged_triggers")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (srcErr) {
    return NextResponse.json(
      { error: `Lookup failed: ${srcErr.message}` },
      { status: 500 },
    );
  }
  if (!source) {
    return NextResponse.json({ error: "Source entry not found" }, { status: 404 });
  }

  const logId = await getOrCreateDailyLog(sb, date, userId);
  if (!logId) {
    return NextResponse.json(
      { error: "Could not resolve a daily_logs row for this date." },
      { status: 500 },
    );
  }

  const row = source as {
    food_items: string | null;
    calories: number | null;
    macros: Record<string, number> | null;
    flagged_triggers: string[] | null;
  };

  const { error: insertErr, data: inserted } = await sb
    .from("food_entries")
    .insert({
      log_id: logId,
      user_id: userId,
      meal_type: meal,
      food_items: row.food_items,
      calories: row.calories,
      macros: row.macros ?? {},
      flagged_triggers: row.flagged_triggers ?? [],
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: `Could not insert food entry: ${insertErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, id: (inserted as { id: string }).id, meal, date },
    { status: 200 },
  );
}
