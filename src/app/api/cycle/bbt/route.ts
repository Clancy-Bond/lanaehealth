/**
 * POST /api/cycle/bbt
 *
 * Log a basal body temperature reading. Accepts either temp_c or
 * temp_f; the lib canonicalizes to both.
 */

import { NextRequest, NextResponse } from "next/server";
import { addBbtEntry } from "@/lib/cycle/bbt-log";
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

  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? (body.date as string)
      : format(new Date(), "yyyy-MM-dd");
  const temp_c = Number(body.temp_c);
  const temp_f = Number(body.temp_f);
  const source = (String(body.source ?? "manual")) as "manual" | "oura" | "wearable";

  const result = await addBbtEntry({
    date,
    temp_c: Number.isFinite(temp_c) ? temp_c : 0,
    temp_f: Number.isFinite(temp_f) ? temp_f : 0,
    source,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/cycle?bbt=1", req.url), 303);
  }
  return NextResponse.json({ ok: true, log: result.log }, { status: 200 });
}
