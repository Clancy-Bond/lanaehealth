/**
 * POST /api/calories/favorites/toggle
 *
 * Star or unstar a USDA food. Body: { fdcId, name }. Returns the
 * new favorited state.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toggleFavorite } from "@/lib/calories/favorites";
import { jsonError } from "@/lib/api/json-error";
import { zRequiredPositiveNumber } from "@/lib/api/zod-forms";

const BodySchema = z.object({
  fdcId: zRequiredPositiveNumber,
  name: z.string().trim().min(1),
  returnTo: z.string().optional(),
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
    return jsonError(400, "favorite_toggle_invalid", parsed.error);
  }
  const { fdcId, name, returnTo } = parsed.data;

  const result = await toggleFavorite(fdcId, name);
  if (!result.ok) {
    return jsonError(500, "favorite_toggle_failed", result.error);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(
      new URL(returnTo ?? `/calories/food/${fdcId}`, req.url),
      303,
    );
  }
  return NextResponse.json({ ok: true, favorited: result.favorited }, { status: 200 });
}
