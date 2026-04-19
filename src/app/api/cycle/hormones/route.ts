/**
 * POST /api/cycle/hormones - add a hormone entry.
 *
 * Body: { date, hormone, value, unit?, source? }
 * If unit is omitted, the default for the hormone is used.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addHormoneEntry, HORMONE_META, type HormoneId } from "@/lib/cycle/hormones";
import { format } from "date-fns";
import { jsonError } from "@/lib/api/json-error";
import { zIsoDate, zRequiredNumber } from "@/lib/api/zod-forms";

const HORMONE_IDS = Object.keys(HORMONE_META) as [HormoneId, ...HormoneId[]];

const BodySchema = z.object({
  hormone: z.enum(HORMONE_IDS),
  value: zRequiredNumber,
  date: zIsoDate.optional(),
  unit: z.string().min(1).optional(),
  source: z.enum(["self", "lab", "wearable"]).optional(),
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
    return jsonError(400, "hormone_entry_invalid", parsed.error);
  }
  const { hormone, value, date: d, unit, source } = parsed.data;

  const result = await addHormoneEntry({
    date: d ?? format(new Date(), "yyyy-MM-dd"),
    hormone,
    value,
    unit: unit ?? HORMONE_META[hormone].defaultUnit,
    source: source ?? "self",
  });
  if (!result.ok) {
    return jsonError(500, "hormone_entry_failed", result.error);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/topics/cycle/hormones?saved=1", req.url), 303);
  }
  return NextResponse.json({ ok: true, log: result.log }, { status: 200 });
}
