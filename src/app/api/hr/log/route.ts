/**
 * POST /api/hr/log
 *
 * Append a heart-rate spot-check to health_profile.heart_rate_log.
 */

import { NextRequest, NextResponse } from "next/server";
import { addHeartRateEntry } from "@/lib/calories/heart-rate";

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

  const result = await addHeartRateEntry({
    date: String(body.date ?? ""),
    time: String(body.time ?? ""),
    bpm: Number(body.bpm),
    context: String(body.context ?? "other"),
    notes: String(body.notes ?? ""),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not log." }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/calories/health/heart-rate", req.url), 303);
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
}
