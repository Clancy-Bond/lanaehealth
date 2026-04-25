/**
 * POST /api/symptoms/quick-log
 *
 * One-tap symptom logging from Home. Creates a symptoms row linked
 * to today's daily_logs row (creating the daily_log if needed).
 *
 * Body:
 *   symptom:  string                required
 *   category: SymptomCategory       required
 *   severity: mild|moderate|severe  optional (defaults to moderate)
 *
 * Matches the Bearable quick-tap pattern: the whole UI is a grid of
 * symptom chips; tapping one inserts a row with severity='moderate'
 * and returns you to Home.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveUserId, UserIdUnresolvableError } from "@/lib/auth/resolve-user-id";
import { format } from "date-fns";
import { jsonError } from "@/lib/api/json-error";
import { safeReturnPath } from "@/lib/api/safe-redirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_CATEGORIES = new Set(["digestive", "menstrual", "mental", "physical", "urinary"]);
const VALID_SEVERITIES = new Set(["mild", "moderate", "severe"]);

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

  const symptom = String(body.symptom ?? "").trim();
  const category = String(body.category ?? "").toLowerCase();
  const severity = String(body.severity ?? "moderate").toLowerCase();

  if (!symptom) {
    return NextResponse.json({ error: "symptom is required." }, { status: 400 });
  }
  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "invalid category." }, { status: 400 });
  }
  if (!VALID_SEVERITIES.has(severity)) {
    return NextResponse.json({ error: "invalid severity." }, { status: 400 });
  }

  const sb = createServiceClient();
  const today = format(new Date(), "yyyy-MM-dd");

  // Resolve or create today's daily_log row (symptoms is linked via log_id).
  const { data: existing } = await sb
    .from("daily_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();
  let logId = (existing as { id: string } | null)?.id ?? null;
  if (!logId) {
    const { data: inserted, error } = await sb
      .from("daily_logs")
      .insert({ date: today, user_id: userId })
      .select("id")
      .single();
    if (error || !inserted) {
      return jsonError(500, "daily_log_insert_failed", error, "Could not create daily_log.");
    }
    logId = (inserted as { id: string }).id;
  }

  const { error: insErr } = await sb.from("symptoms").insert({
    log_id: logId,
    user_id: userId,
    category,
    symptom,
    severity,
  });
  if (insErr) {
    return jsonError(500, "symptom_insert_failed", insErr, "Could not log symptom.");
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    const returnTo = safeReturnPath(body.returnTo) ?? "/";
    return NextResponse.redirect(new URL(returnTo, req.url), 303);
  }
  return NextResponse.json({ ok: true, logId }, { status: 200 });
}
