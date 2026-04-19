/**
 * POST /api/calories/meal-templates/apply
 *
 * Insert a saved meal template's items onto a target date + meal.
 * Fully additive — never deletes. Creates a daily_log for the target
 * date if one does not exist.
 *
 * Body: { templateId: string, targetMeal?: breakfast|lunch|dinner|snack,
 *         targetDate?: YYYY-MM-DD (defaults to today) }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { findMealTemplate } from "@/lib/calories/meal-templates";
import { format } from "date-fns";

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

  const templateId = String(body.templateId ?? "");
  if (!templateId) return NextResponse.json({ error: "templateId required." }, { status: 400 });
  const template = await findMealTemplate(templateId);
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const rawTargetMeal = String(body.targetMeal ?? template.meal).toLowerCase();
  const targetMeal = VALID_MEALS.has(rawTargetMeal) ? rawTargetMeal : template.meal;

  const rawTargetDate = String(body.targetDate ?? "");
  const targetDate = DATE_RE.test(rawTargetDate)
    ? rawTargetDate
    : format(new Date(), "yyyy-MM-dd");

  const sb = createServiceClient();

  const { data: existing } = await sb
    .from("daily_logs")
    .select("id")
    .eq("date", targetDate)
    .maybeSingle();
  let logId = (existing as { id: string } | null)?.id ?? null;
  if (!logId) {
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
    logId = (inserted as { id: string }).id;
  }

  const rows = template.items.map((i) => ({
    log_id: logId,
    meal_type: targetMeal,
    food_items: i.name,
    calories: Math.round(i.calories),
    macros: i.macros,
    flagged_triggers: i.flaggedTriggers,
  }));
  const { error: insErr } = await sb.from("food_entries").insert(rows);
  if (insErr) {
    return NextResponse.json({ error: `Could not apply: ${insErr.message}` }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(
      new URL(`/calories/food?date=${targetDate}#${targetMeal}`, req.url),
      303,
    );
  }
  return NextResponse.json(
    { ok: true, applied: rows.length, targetDate, targetMeal },
    { status: 200 },
  );
}
