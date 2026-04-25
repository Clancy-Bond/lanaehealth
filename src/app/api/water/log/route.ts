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
import { z } from "zod";
import { setWaterForDate, incrementGlasses } from "@/lib/calories/water";
import { format } from "date-fns";
import { jsonError } from "@/lib/api/json-error";
import { safeReturnPath } from "@/lib/api/safe-redirect";
import { zIsoDate, zOptionalNumber } from "@/lib/api/zod-forms";

const BodySchema = z
  .object({
    date: zIsoDate.optional(),
    glasses: zOptionalNumber,
    delta: zOptionalNumber,
    returnTo: z.string().optional(),
  })
  .refine((v) => v.glasses !== undefined || v.delta !== undefined, {
    message: "glasses or delta is required.",
    path: ["glasses"],
  });

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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "water_log_invalid", parsed.error);
  }
  const { date: d, glasses, delta, returnTo } = parsed.data;
  const date = d ?? format(new Date(), "yyyy-MM-dd");

  const result =
    glasses !== undefined
      ? await setWaterForDate(date, glasses)
      : await incrementGlasses(date, delta as number);

  if (!result.ok) {
    return jsonError(500, "water_log_failed", result.error);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    const safe = safeReturnPath(returnTo) ?? "/calories";
    return NextResponse.redirect(new URL(safe, req.url), 303);
  }
  return NextResponse.json({ ok: true, log: result.log }, { status: 200 });
}
