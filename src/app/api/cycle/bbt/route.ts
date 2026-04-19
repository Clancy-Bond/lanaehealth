/**
 * POST /api/cycle/bbt
 *
 * Log a basal body temperature reading. Accepts either temp_c or
 * temp_f; the lib canonicalizes to both.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addBbtEntry } from "@/lib/cycle/bbt-log";
import { format } from "date-fns";
import { jsonError } from "@/lib/api/json-error";
import { zIsoDate, zOptionalNumber } from "@/lib/api/zod-forms";

const BodySchema = z
  .object({
    date: zIsoDate.optional(),
    temp_c: zOptionalNumber,
    temp_f: zOptionalNumber,
    source: z.enum(["manual", "oura", "wearable"]).optional(),
  })
  .refine((v) => v.temp_c !== undefined || v.temp_f !== undefined, {
    message: "temp_c or temp_f is required.",
    path: ["temp_c"],
  });

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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "bbt_entry_invalid", parsed.error);
  }
  const { date: d, temp_c, temp_f, source } = parsed.data;

  const result = await addBbtEntry({
    date: d ?? format(new Date(), "yyyy-MM-dd"),
    temp_c: temp_c ?? 0,
    temp_f: temp_f ?? 0,
    source: source ?? "manual",
  });
  if (!result.ok) {
    return jsonError(500, "bbt_entry_failed", result.error);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/cycle?bbt=1", req.url), 303);
  }
  return NextResponse.json({ ok: true, log: result.log }, { status: 200 });
}
