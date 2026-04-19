/**
 * POST /api/calories/custom-foods
 *
 * Create a custom food (for items USDA doesn't cover). Accepts form
 * or JSON body. Redirect on form post.
 */

import { NextRequest, NextResponse } from "next/server";
import { addCustomFood } from "@/lib/calories/custom-foods";
import { jsonError } from "@/lib/api/json-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function num(v: unknown): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

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

  const name = String(body.name ?? "").trim();
  const servingLabel = String(body.servingLabel ?? "").trim();
  const calories = num(body.calories);

  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });
  if (!servingLabel) return NextResponse.json({ error: "servingLabel is required." }, { status: 400 });
  if (calories === undefined) return NextResponse.json({ error: "calories is required." }, { status: 400 });

  const result = await addCustomFood({
    name,
    servingLabel,
    calories,
    macros: {
      protein: num(body.protein),
      carbs: num(body.carbs),
      fat: num(body.fat),
      fiber: num(body.fiber),
      sugar: num(body.sugar),
      sodium: num(body.sodium),
      calcium: num(body.calcium),
      iron: num(body.iron),
    },
    notes: typeof body.notes === "string" ? body.notes : null,
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
