/**
 * POST /api/calories/food-entries/move
 *
 * MyNetDiary "Move Food entries" semantic: re-assign selected
 * food_entries rows to a different date + meal. Additive-style edit
 * — moves existing rows, never deletes data.
 *
 * Body:
 *   ids[]         array of food_entries ids (required)
 *   targetDate    YYYY-MM-DD (required)
 *   targetMeal    breakfast|lunch|dinner|snack (required)
 *
 * Creates a daily_logs row for targetDate if one does not exist.
 * Returns 200 with the moved count.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  try {
    if (ct.includes("application/json")) {
      body = (await req.json()) as Record<string, unknown>;
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        const key = k;
        if (key.endsWith("[]")) {
          const base = key.slice(0, -2);
          const existing = Array.isArray(body[base]) ? (body[base] as string[]) : [];
          existing.push(typeof v === "string" ? v : v.name);
          body[base] = existing;
        } else if (key === "ids") {
          const existing = Array.isArray(body[key]) ? (body[key] as string[]) : [];
          existing.push(typeof v === "string" ? v : v.name);
          body[key] = existing;
        } else {
          body[key] = typeof v === "string" ? v : v.name;
        }
      }
    }
  } catch {
    return NextResponse.json({ error: "Bad body." }, { status: 400 });
  }

  const rawIds = body.ids;
  const ids = Array.isArray(rawIds)
    ? rawIds.map((x) => String(x).trim()).filter(Boolean)
    : typeof rawIds === "string"
      ? rawIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const targetDate = String(body.targetDate ?? "");
  const targetMeal = String(body.targetMeal ?? "").toLowerCase();

  if (ids.length === 0) return NextResponse.json({ error: "At least one id required." }, { status: 400 });
  if (!DATE_RE.test(targetDate)) return NextResponse.json({ error: "targetDate must be YYYY-MM-DD." }, { status: 400 });
  if (!VALID_MEALS.has(targetMeal)) return NextResponse.json({ error: "targetMeal must be breakfast|lunch|dinner|snack." }, { status: 400 });

  const sb = createServiceClient();

  // Resolve (or create) target daily_log
  const { data: existing } = await sb
    .from("daily_logs")
    .select("id")
    .eq("date", targetDate)
    .maybeSingle();
  let targetLogId = (existing as { id: string } | null)?.id ?? null;
  if (!targetLogId) {
    const { data: inserted, error } = await sb
      .from("daily_logs")
      .insert({ date: targetDate })
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

  const { error: updErr, count } = await sb
    .from("food_entries")
    .update({ log_id: targetLogId, meal_type: targetMeal }, { count: "exact" })
    .in("id", ids);
  if (updErr) {
    return NextResponse.json({ error: `Could not move: ${updErr.message}` }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(
      new URL(`/calories/food?date=${targetDate}#${targetMeal}`, req.url),
      303,
    );
  }
  return NextResponse.json({ ok: true, moved: count ?? ids.length }, { status: 200 });
}
