/**
 * POST /api/weight/log
 *
 * Add or replace a weight entry for a date. Accepts either JSON or
 * form-encoded body. 303-redirect for form posts so plain forms
 * work without JS.
 *
 * Body:
 *   date: YYYY-MM-DD (defaults to today)
 *   kg:   number     required if lb is absent
 *   lb:   number     optional; converted to kg if kg absent
 *   notes: string    optional
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addWeightEntry, lbToKg } from "@/lib/calories/weight";
import { format } from "date-fns";
import { jsonError } from "@/lib/api/json-error";
import { zIsoDate, zOptionalPositiveNumber } from "@/lib/api/zod-forms";

const BodySchema = z
  .object({
    date: zIsoDate.optional(),
    kg: zOptionalPositiveNumber,
    lb: zOptionalPositiveNumber,
    notes: z.string().nullish(),
  })
  .refine((v) => v.kg !== undefined || v.lb !== undefined, {
    message: "kg or lb is required.",
    path: ["kg"],
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
    return jsonError(400, "weight_log_invalid", parsed.error);
  }
  const { date: d, kg: kgIn, lb, notes } = parsed.data;
  const date = d ?? format(new Date(), "yyyy-MM-dd");
  const kg = kgIn ?? lbToKg(lb as number);

  const result = await addWeightEntry({ date, kg, notes: notes ?? null });
  if (!result.ok) {
    return jsonError(500, "weight_entry_failed", result.error);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/calories?weigh_in=1", req.url), 303);
  }

  return NextResponse.json({ ok: true, log: result.log }, { status: 200 });
}
