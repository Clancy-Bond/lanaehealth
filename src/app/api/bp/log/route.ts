/**
 * POST /api/bp/log
 *
 * Append a blood-pressure reading to health_profile.blood_pressure_log.
 */

import { NextRequest, NextResponse } from "next/server";
import { addBloodPressureEntry } from "@/lib/calories/blood-pressure";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const pulseRaw = body.pulse;
  const pulse = pulseRaw === "" || pulseRaw === null || pulseRaw === undefined
    ? null
    : Number(pulseRaw);

  const result = await addBloodPressureEntry({
    date: String(body.date ?? ""),
    time: String(body.time ?? ""),
    systolic: Number(body.systolic),
    diastolic: Number(body.diastolic),
    pulse,
    position: String(body.position ?? "unknown"),
    notes: String(body.notes ?? ""),
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
