/**
 * POST /api/calories/custom-foods
 *
 * Create a custom food (for items USDA doesn't cover). Accepts form
 * or JSON body. Redirect on form post.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addCustomFood } from "@/lib/calories/custom-foods";
import { jsonError } from "@/lib/api/json-error";
import { zOptionalNumber, zRequiredNumber } from "@/lib/api/zod-forms";

const BodySchema = z.object({
  name: z.string().trim().min(1),
  servingLabel: z.string().trim().min(1),
  calories: zRequiredNumber,
  protein: zOptionalNumber,
  carbs: zOptionalNumber,
  fat: zOptionalNumber,
  fiber: zOptionalNumber,
  sugar: zOptionalNumber,
  sodium: zOptionalNumber,
  calcium: zOptionalNumber,
  iron: zOptionalNumber,
  notes: z.string().nullish(),
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
    return jsonError(400, "bad_body");
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "custom_food_invalid", parsed.error);
  }
  const { name, servingLabel, calories, notes, ...macros } = parsed.data;

  const result = await addCustomFood({
    name,
    servingLabel,
    calories,
    macros,
    notes: notes ?? null,
  });

  if (!result.ok) {
    return jsonError(500, "custom_food_create_failed", result.error);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/calories/search?view=custom&saved=${result.food!.id}`, req.url), 303);
  }
  return NextResponse.json({ ok: true, food: result.food }, { status: 200 });
}
