/**
 * POST /api/calories/meal-templates/delete
 *
 * Remove a saved meal template. Only removes the template record
 * itself — does not touch any food_entries rows that were previously
 * applied from it.
 *
 * Body: { templateId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { deleteMealTemplate } from "@/lib/calories/meal-templates";

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

  const templateId = String(body.templateId ?? "");
  const result = await deleteMealTemplate(templateId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not delete." }, { status: 400 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(
      new URL("/calories/search?view=my-meals", req.url),
      303,
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
