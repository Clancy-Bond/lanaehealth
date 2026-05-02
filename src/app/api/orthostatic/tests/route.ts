/**
 * POST /api/orthostatic/tests
 *
 * Log an orthostatic test into orthostatic_tests. peak_rise_bpm is
 * computed server-side (GENERATED ALWAYS) so we just send the
 * standing measurements and Postgres does the math.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireUser } from "@/lib/api/require-user";
import { safeErrorMessage, safeErrorResponse } from "@/lib/api/safe-error";
import { format } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function intOrNull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : Math.round(n);
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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

  const resting = Number(body.resting_hr_bpm);
  if (!Number.isFinite(resting) || resting < 30 || resting > 220) {
    return NextResponse.json({ error: "resting_hr_bpm required (30-220)." }, { status: 400 });
  }

  // NOTE: test_time is NOT NULL in the SQL schema (DEFAULT now()::time).
  // If the caller omits it, we omit the column entirely so the DEFAULT
  // kicks in. Passing explicit null violates the constraint.
  const row: Record<string, unknown> = {
    test_date:
      typeof body.test_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.test_date)
        ? (body.test_date as string)
        : format(new Date(), "yyyy-MM-dd"),
    resting_hr_bpm: Math.round(resting),
    resting_bp_systolic: intOrNull(body.resting_bp_systolic),
    resting_bp_diastolic: intOrNull(body.resting_bp_diastolic),
    standing_hr_1min: intOrNull(body.standing_hr_1min),
    standing_hr_3min: intOrNull(body.standing_hr_3min),
    standing_hr_5min: intOrNull(body.standing_hr_5min),
    standing_hr_10min: intOrNull(body.standing_hr_10min),
    standing_bp_systolic_10min: intOrNull(body.standing_bp_systolic_10min),
    standing_bp_diastolic_10min: intOrNull(body.standing_bp_diastolic_10min),
    symptoms_experienced: strOrNull(body.symptoms_experienced),
    notes: strOrNull(body.notes),
    hydration_ml: intOrNull(body.hydration_ml),
    caffeine_mg: intOrNull(body.caffeine_mg),
  };

  // Only include test_time when the caller supplied one (lets the
  // NOT NULL default kick in when omitted).
  if (typeof body.test_time === "string" && body.test_time.length > 0) {
    row.test_time = body.test_time;
  }

  const sb = createServiceClient();
  const { error } = await sb.from("orthostatic_tests").insert(row);
  if (error) {
    return NextResponse.json({ error: safeErrorMessage(error, "orthostatic_test_insert_failed") }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/topics/orthostatic?logged=1", req.url), 303);
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
