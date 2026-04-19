/**
 * Meal templates "My Meals" (MFN parity GAP #11).
 *
 * MyNetDiary's My Meals lets you save a combo of foods (e.g.
 * "typical Tuesday breakfast") and re-add it with one tap on any
 * future day. We mirror that with a jsonb section on health_profile.
 *
 * Stored in health_profile.section='meal_templates' as:
 *   { entries: [ { id, name, meal, items: [{name, calories, macros, flagged}], createdAt } ] }
 *
 * A template is just a frozen snapshot of the selected meal's
 * food_entries rows at the time of save. Applying a template inserts
 * those same rows onto the target day/meal.
 */

import { createServiceClient } from "@/lib/supabase";

export type TemplateMeal = "breakfast" | "lunch" | "dinner" | "snack";

export interface TemplateItem {
  name: string;
  calories: number;
  macros: Record<string, number>;
  flaggedTriggers: string[];
}

export interface MealTemplate {
  id: string;
  name: string;
  meal: TemplateMeal;
  items: TemplateItem[];
  createdAt: string;
}

export interface MealTemplatesLog {
  entries: MealTemplate[];
}

const EMPTY: MealTemplatesLog = { entries: [] };

const VALID_MEALS = new Set<TemplateMeal>(["breakfast", "lunch", "dinner", "snack"]);

function sanitizeItem(raw: unknown): TemplateItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : null;
  if (!name) return null;
  const calories = Number(r.calories);
  const macrosRaw = r.macros;
  const macros: Record<string, number> = {};
  if (macrosRaw && typeof macrosRaw === "object") {
    for (const [k, v] of Object.entries(macrosRaw as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) macros[k] = n;
    }
  }
  const flaggedRaw = r.flaggedTriggers;
  const flaggedTriggers = Array.isArray(flaggedRaw)
    ? (flaggedRaw as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return {
    name,
    calories: Number.isFinite(calories) ? calories : 0,
    macros,
    flaggedTriggers,
  };
}

function sanitizeTemplate(raw: unknown): MealTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : null;
  const name = typeof r.name === "string" ? r.name.trim() : null;
  const meal = typeof r.meal === "string" ? (r.meal.trim().toLowerCase() as TemplateMeal) : null;
  if (!id || !name || !meal || !VALID_MEALS.has(meal)) return null;
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const items = (itemsRaw as unknown[])
    .map(sanitizeItem)
    .filter((x): x is TemplateItem => x !== null);
  if (items.length === 0) return null;
  return {
    id,
    name,
    meal,
    items,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
  };
}

export async function loadMealTemplates(): Promise<MealTemplatesLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "meal_templates")
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
        .map(sanitizeTemplate)
        .filter((e): e is MealTemplate => e !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  } catch {
    return EMPTY;
  }
}

function newId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addMealTemplateFromEntries(input: {
  name: string;
  meal: string;
  entries: Array<{
    food_items: string | null;
    calories: number | null;
    macros: Record<string, number> | null;
    flagged_triggers: string[] | null;
  }>;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const meal = input.meal.toLowerCase() as TemplateMeal;
  if (!VALID_MEALS.has(meal)) return { ok: false, error: "Invalid meal." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name required." };
  const items: TemplateItem[] = input.entries
    .map((e) =>
      sanitizeItem({
        name: e.food_items ?? "(unnamed)",
        calories: e.calories ?? 0,
        macros: e.macros ?? {},
        flaggedTriggers: e.flagged_triggers ?? [],
      }),
    )
    .filter((x): x is TemplateItem => x !== null);
  if (items.length === 0) return { ok: false, error: "No items to save." };

  const template: MealTemplate = {
    id: newId(),
    name,
    meal,
    items,
    createdAt: new Date().toISOString(),
  };

  try {
    const current = await loadMealTemplates();
    const next = [template, ...current.entries];
    const sb = createServiceClient();
    const { error } = await sb.from("health_profile").upsert(
      { section: "meal_templates", content: { entries: next } },
      { onConflict: "section" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: template.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function deleteMealTemplate(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "id required." };
  try {
    const current = await loadMealTemplates();
    const next = current.entries.filter((e) => e.id !== id);
    if (next.length === current.entries.length) {
      return { ok: false, error: "Not found." };
    }
    const sb = createServiceClient();
    const { error } = await sb.from("health_profile").upsert(
      { section: "meal_templates", content: { entries: next } },
      { onConflict: "section" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function findMealTemplate(id: string): Promise<MealTemplate | null> {
  const log = await loadMealTemplates();
  return log.entries.find((e) => e.id === id) ?? null;
}
