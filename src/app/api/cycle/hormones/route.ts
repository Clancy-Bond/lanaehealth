/**
 * POST /api/cycle/hormones - add a hormone entry.
 *
 * Body: { date, hormone, value, unit?, source? }
 * If unit is omitted, the default for the hormone is used.
 */

import { NextRequest, NextResponse } from "next/server";
import { addHormoneEntry, HORMONE_META, type HormoneEntry, type HormoneId } from "@/lib/cycle/hormones";
import { format } from "date-fns";

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

  const hormone = String(body.hormone ?? "") as HormoneId;
  if (!(hormone in HORMONE_META)) {
    return NextResponse.json({ error: `Unknown hormone: ${hormone}` }, { status: 400 });
  }
  const value = Number(body.value);
  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: "value is required." }, { status: 400 });
  }
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? (body.date as string)
      : format(new Date(), "yyyy-MM-dd");
  const unit = typeof body.unit === "string" && body.unit.length > 0 ? (body.unit as string) : HORMONE_META[hormone].defaultUnit;
  const source = (String(body.source ?? "self") as HormoneEntry["source"]);

  const result = await addHormoneEntry({ date, hormone, value, unit, source });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/topics/cycle/hormones?saved=1", req.url), 303);
  }
  return NextResponse.json({ ok: true, log: result.log }, { status: 200 });
}
