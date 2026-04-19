/**
 * POST /api/activity/log
 *
 * Record a manual workout entry to health_profile.workouts. Mirrors
 * MyNetDiary's Exercise tab log but stored locally and complementary
 * to Oura's daily_activity totals.
 *
 * Body: { date: YYYY-MM-DD, type, durationMin, calories, notes? }
 */

import { NextRequest, NextResponse } from "next/server";
import { addWorkout } from "@/lib/calories/workouts";

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

  const result = await addWorkout({
    date: String(body.date ?? ""),
    type: String(body.type ?? ""),
    durationMin: Number(body.durationMin),
    calories: Number(body.calories),
    notes: String(body.notes ?? ""),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not log." }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/activity", req.url), 303);
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
}
