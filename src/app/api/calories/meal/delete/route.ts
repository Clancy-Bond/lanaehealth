/**
 * POST /api/calories/meal/delete
 *
 * Delete every food_entries row for (date, meal). MyNetDiary-parity
 * "Delete meal" action on the Food tab overflow menu.
 *
 * Body: { date: YYYY-MM-DD, meal: breakfast|lunch|dinner|snack,
 *         confirm: "yes" }
 *
 * Honors the project-level ZERO-data-loss rule by requiring an
 * explicit `confirm=yes` body field. The UI routes the Delete button
 * through /calories/meal-delete first so users see exactly what will
 * be removed before submitting.
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
        body[k] = typeof v === "string" ? v : v.name;
      }
    }
  } catch {
    return NextResponse.json({ error: "Bad body." }, { status: 400 });
  }

  const date = String(body.date ?? "");
  const meal = String(body.meal ?? "").toLowerCase();
  const confirm = String(body.confirm ?? "").toLowerCase();
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }
  if (!VALID_MEALS.has(meal)) {
    return NextResponse.json({ error: "meal must be breakfast|lunch|dinner|snack." }, { status: 400 });
  }
  if (confirm !== "yes") {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }

  const sb = createServiceClient();

  const { data: log } = await sb
    .from("daily_logs")
    .select("id")
    .eq("date", date)
    .maybeSingle();
  const logId = (log as { id: string } | null)?.id ?? null;
  if (!logId) {
    return NextResponse.json({ error: "Nothing to delete." }, { status: 404 });
  }

  const { error: delErr, count } = await sb
    .from("food_entries")
    .delete({ count: "exact" })
    .eq("log_id", logId)
    .eq("meal_type", meal);
  if (delErr) {
    return NextResponse.json({ error: `Could not delete: ${delErr.message}` }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(
      new URL(`/calories/food?date=${date}#${meal}`, req.url),
      303,
    );
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0 }, { status: 200 });
}
