/**
 * POST /api/bp/log
 *
 * Append a blood-pressure reading to health_profile.blood_pressure_log.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addBloodPressureEntry } from "@/lib/calories/blood-pressure";
import { jsonError } from "@/lib/api/json-error";
import { zIsoDate, zRequiredPositiveNumber, zOptionalPositiveNumber } from "@/lib/api/zod-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Physiological clamps. Anything outside these bounds is either a sensor
// glitch or a UI bug; we should reject at the boundary rather than write
// garbage into health_profile.blood_pressure_log.
const SYSTOLIC_MIN = 50;
const SYSTOLIC_MAX = 260;
const DIASTOLIC_MIN = 30;
const DIASTOLIC_MAX = 180;
const PULSE_MIN = 25;
const PULSE_MAX = 240;
const NOTES_MAX = 500;

export const BpLogBodySchema = z.object({
  date: zIsoDate,
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "expected HH:MM").optional().default(""),
  systolic: zRequiredPositiveNumber.refine(
    (n) => n >= SYSTOLIC_MIN && n <= SYSTOLIC_MAX,
    `systolic must be ${SYSTOLIC_MIN}-${SYSTOLIC_MAX} mmHg`,
  ),
  diastolic: zRequiredPositiveNumber.refine(
    (n) => n >= DIASTOLIC_MIN && n <= DIASTOLIC_MAX,
    `diastolic must be ${DIASTOLIC_MIN}-${DIASTOLIC_MAX} mmHg`,
  ),
  pulse: zOptionalPositiveNumber.refine(
    (n) => n === undefined || (n >= PULSE_MIN && n <= PULSE_MAX),
    `pulse must be ${PULSE_MIN}-${PULSE_MAX} bpm`,
  ),
  position: z.enum(["sitting", "standing", "supine", "unknown"]).optional().default("unknown"),
  notes: z.string().max(NOTES_MAX).optional().default(""),
});

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  let raw: Record<string, unknown> = {};
  try {
    if (ct.includes("application/json")) {
      raw = (await req.json()) as Record<string, unknown>;
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) {
        raw[k] = typeof v === "string" ? v : v.name;
      }
    }
  } catch {
    return NextResponse.json({ error: "Bad body." }, { status: 400 });
  }

  const parsed = BpLogBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "bp_log_invalid", parsed.error);
  }
  const { date, time, systolic, diastolic, pulse, position, notes } = parsed.data;

  const result = await addBloodPressureEntry({
    date,
    time,
    systolic,
    diastolic,
    pulse: pulse ?? null,
    position,
    notes,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not log." }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/calories/health/blood-pressure", req.url), 303);
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
}
