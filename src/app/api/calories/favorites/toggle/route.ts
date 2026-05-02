/**
 * POST /api/calories/favorites/toggle
 *
 * Star or unstar a USDA food. Body: { fdcId, name }. Returns the
 * new favorited state.
 */

import { NextRequest, NextResponse } from "next/server";
import { toggleFavorite } from "@/lib/calories/favorites";
import { requireUser } from "@/lib/api/require-user";
import { safeErrorResponse } from "@/lib/api/safe-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
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

  const fdcId = Number(body.fdcId);
  const name = String(body.name ?? "").trim();
  if (!Number.isFinite(fdcId) || fdcId <= 0 || !name) {
    return NextResponse.json({ error: "fdcId and name required." }, { status: 400 });
  }

  const result = await toggleFavorite(fdcId, name);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    // Redirect back to the referrer if provided, otherwise food detail.
    const returnTo = typeof body.returnTo === "string" ? body.returnTo : `/calories/food/${fdcId}`;
    return NextResponse.redirect(new URL(returnTo, req.url), 303);
  }
  return NextResponse.json({ ok: true, favorited: result.favorited }, { status: 200 });
}
