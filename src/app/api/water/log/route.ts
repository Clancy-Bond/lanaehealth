/**
 * POST /api/water/log
 *
 * Sets or increments today's water intake.
 *
 * Body:
 *   date: YYYY-MM-DD (default today)
 *   glasses: number  (absolute count, takes precedence)
 *   delta:   number  (relative, +/-1 for glass-up/glass-down UI)
 */

import { NextRequest, NextResponse } from "next/server";
import { setWaterForDate, incrementGlasses } from "@/lib/calories/water";
import { format } from "date-fns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/json")) {
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

  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? (body.date as string)
      : format(new Date(), "yyyy-MM-dd");

  const glasses = Number(body.glasses);
  const delta = Number(body.delta);

  let result;
  if (Number.isFinite(glasses)) {
    result = await setWaterForDate(date, glasses);
  } else if (Number.isFinite(delta)) {
    result = await incrementGlasses(date, delta);
  } else {
    return NextResponse.json({ error: "glasses or delta is required." }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    const returnTo = typeof body.returnTo === "string" ? body.returnTo : "/calories";
    return NextResponse.redirect(new URL(returnTo, req.url), 303);
  }
  return NextResponse.json({ ok: true, log: result.log }, { status: 200 });
}
