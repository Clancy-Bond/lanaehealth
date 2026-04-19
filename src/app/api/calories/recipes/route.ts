/**
 * POST /api/calories/recipes
 *
 * Create a recipe. Body accepts form or JSON. For form posts we
 * expect repeated `ingredientName[]`, `ingredientCalories[]`, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addRecipe, type RecipeIngredient } from "@/lib/calories/recipes";
import { jsonError } from "@/lib/api/json-error";
import { zOptionalNumber, zRequiredNumber } from "@/lib/api/zod-forms";

const MacroSchema = z
  .object({
    protein: zOptionalNumber,
    carbs: zOptionalNumber,
    fat: zOptionalNumber,
    fiber: zOptionalNumber,
    sodium: zOptionalNumber,
  })
  .partial()
  .optional();

const IngredientSchema = z.object({
  name: z.string().trim().min(1),
  calories: zRequiredNumber,
  macros: MacroSchema,
});

const BodySchema = z.object({
  name: z.string().trim().min(1),
  servings: zRequiredNumber.pipe(z.number().positive()),
  notes: z.string().nullish(),
  ingredients: z.array(IngredientSchema).min(1),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asNums(fd: FormData, key: string): number[] {
  const raw = fd.getAll(key);
  return raw.map((v) => Number(v)).filter((n) => Number.isFinite(n));
}

function asStrings(fd: FormData, key: string): string[] {
  const raw = fd.getAll(key);
  return raw.map((v) => (typeof v === "string" ? v : v.name));
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  let name = "";
  let servings = 1;
  let notes: string | null = null;
  const ingredients: RecipeIngredient[] = [];

  try {
    if (ct.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      name = String(body.name ?? "");
      servings = Number(body.servings) || 1;
      notes = typeof body.notes === "string" ? body.notes : null;
      const ings = Array.isArray(body.ingredients) ? (body.ingredients as unknown[]) : [];
      for (const r of ings) {
        if (!r || typeof r !== "object") continue;
        const ing = r as Record<string, unknown>;
        const cand = {
          name: String(ing.name ?? ""),
          calories: Number(ing.calories),
          macros: (ing.macros ?? {}) as Record<string, number>,
        } as RecipeIngredient;
        if (cand.name && Number.isFinite(cand.calories)) ingredients.push(cand);
      }
    } else {
      const fd = await req.formData();
      name = String(fd.get("name") ?? "");
      servings = Number(fd.get("servings")) || 1;
      notes = typeof fd.get("notes") === "string" ? (fd.get("notes") as string) : null;
      const names = asStrings(fd, "ingredientName");
      const cals = asNums(fd, "ingredientCalories");
      const protein = asNums(fd, "ingredientProtein");
      const carbs = asNums(fd, "ingredientCarbs");
      const fat = asNums(fd, "ingredientFat");
      const fiber = asNums(fd, "ingredientFiber");
      const sodium = asNums(fd, "ingredientSodium");
      for (let i = 0; i < names.length; i++) {
        const n = names[i]?.trim();
        if (!n) continue;
        const c = cals[i];
        if (!Number.isFinite(c)) continue;
        ingredients.push({
          name: n,
          calories: c,
          macros: {
            protein: Number.isFinite(protein[i]) ? protein[i] : undefined,
            carbs: Number.isFinite(carbs[i]) ? carbs[i] : undefined,
            fat: Number.isFinite(fat[i]) ? fat[i] : undefined,
            fiber: Number.isFinite(fiber[i]) ? fiber[i] : undefined,
            sodium: Number.isFinite(sodium[i]) ? sodium[i] : undefined,
          },
        });
      }
    }
  } catch {
    return NextResponse.json({ error: "Bad body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse({ name, servings, notes, ingredients });
  if (!parsed.success) {
    return jsonError(400, "recipe_invalid", parsed.error);
  }

  const result = await addRecipe({
    name: parsed.data.name,
    servings: parsed.data.servings,
    ingredients: parsed.data.ingredients as RecipeIngredient[],
    notes: parsed.data.notes ?? null,
  });
  if (!result.ok) {
    return jsonError(500, "recipe_create_failed", result.error);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/calories/search?view=my-recipes&saved=${result.recipe!.id}`, req.url), 303);
  }
  return NextResponse.json({ ok: true, recipe: result.recipe }, { status: 200 });
}
