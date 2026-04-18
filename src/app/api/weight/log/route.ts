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
import { addWeightEntry, lbToKg } from "@/lib/calories/weight";
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

  let kg: number | null = null;
  const kgRaw = Number(body.kg);
  const lbRaw = Number(body.lb);
  if (Number.isFinite(kgRaw) && kgRaw > 0) kg = kgRaw;
  else if (Number.isFinite(lbRaw) && lbRaw > 0) kg = lbToKg(lbRaw);

  if (kg === null) {
    return NextResponse.json({ error: "kg or lb is required." }, { status: 400 });
  }

  const notes = typeof body.notes === "string" ? body.notes : null;

  const result = await addWeightEntry({ date, kg, notes });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/calories?weigh_in=1", req.url), 303);
  }

  return NextResponse.json({ ok: true, log: result.log }, { status: 200 });
}
