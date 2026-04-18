/**
 * Recipe builder.
 *
 * Stored in health_profile.section='recipes'. A recipe is a set of
 * ingredients (custom foods or plain { name, calories, macros })
 * that totals into one food with per-serving macros.
 *
 * Intentionally simple v1: user enters name, total servings, and a
 * list of ingredient lines; we total calories + macros and divide
 * by servings. Ingredients are plain entries for now (not USDA-
 * linked) because the input flow is hand-entered on a single page.
 *
 * When recipes grow, the logger will accept ingredient rows that
 * reference custom_foods by id so the aggregation stays honest.
 */

import { createServiceClient } from "@/lib/supabase";
import { randomUUID } from "node:crypto";

export interface RecipeIngredient {
  name: string;
  calories: number;
  macros: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    calcium?: number;
    iron?: number;
  };
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  /** Totals per serving, computed at save time. */
  perServing: {
    calories: number;
    macros: RecipeIngredient["macros"];
  };
  notes?: string | null;
  createdAt: string;
}

export interface RecipeLog {
  entries: Recipe[];
}

const EMPTY: RecipeLog = { entries: [] };

function sanitizeIngredient(raw: unknown): RecipeIngredient | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" && r.name.trim().length > 0 ? r.name.trim() : null;
  const cal = Number(r.calories);
  if (!name || !Number.isFinite(cal) || cal < 0) return null;
  const macros = (r.macros ?? {}) as Record<string, unknown>;
  const m: RecipeIngredient["macros"] = {};
  for (const key of ["protein", "carbs", "fat", "fiber", "sugar", "sodium", "calcium", "iron"] as const) {
    const v = Number(macros[key]);
    if (Number.isFinite(v) && v >= 0) m[key] = v;
  }
  return { name, calories: cal, macros: m };
}

function computePerServing(ingredients: RecipeIngredient[], servings: number): Recipe["perServing"] {
  const totals = { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, calcium: 0, iron: 0 };
  let calories = 0;
  for (const i of ingredients) {
    calories += i.calories;
    for (const k of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[k] += Number(i.macros[k] ?? 0) || 0;
    }
  }
  const s = Math.max(1, servings);
  const perMacros: RecipeIngredient["macros"] = {};
  for (const k of Object.keys(totals) as Array<keyof typeof totals>) {
    perMacros[k] = Number((totals[k] / s).toFixed(2));
  }
  return { calories: Number((calories / s).toFixed(2)), macros: perMacros };
}

function sanitizeRecipe(raw: unknown): Recipe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const name = typeof r.name === "string" && r.name.trim().length > 0 ? r.name.trim() : null;
  const servings = Number(r.servings);
  if (!id || !name || !Number.isFinite(servings) || servings <= 0) return null;
  const ingredientsRaw = Array.isArray(r.ingredients) ? r.ingredients : [];
  const ingredients = ingredientsRaw.map(sanitizeIngredient).filter((i): i is RecipeIngredient => i !== null);
  if (ingredients.length === 0) return null;
  const perServing = computePerServing(ingredients, servings);
  const notes = typeof r.notes === "string" ? r.notes : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  return { id, name, servings, ingredients, perServing, notes, createdAt };
}

export async function loadRecipes(): Promise<RecipeLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "recipes")
      .maybeSingle();
    const raw = (data as { content: unknown } | null)?.content;
    if (!raw) return EMPTY;
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { entries?: unknown }).entries)
        ? ((raw as { entries: unknown[] }).entries ?? [])
        : [];
    return {
      entries: (arr as unknown[])
        .map(sanitizeRecipe)
        .filter((e): e is Recipe => e !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  } catch {
    return EMPTY;
  }
}

export async function addRecipe(input: {
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  notes?: string | null;
}): Promise<{ ok: boolean; recipe?: Recipe; error?: string }> {
  const candidate = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    perServing: computePerServing(input.ingredients, input.servings),
    ...input,
  } as Recipe;
  const sanitized = sanitizeRecipe(candidate);
  if (!sanitized) return { ok: false, error: "Need name, servings >= 1, and at least one ingredient." };
  try {
    const current = await loadRecipes();
    const next = [sanitized, ...current.entries];
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert(
        { section: "recipes", content: { entries: next } },
        { onConflict: "section" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, recipe: sanitized };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function findRecipe(id: string): Promise<Recipe | null> {
  const log = await loadRecipes();
  return log.entries.find((r) => r.id === id) ?? null;
}
