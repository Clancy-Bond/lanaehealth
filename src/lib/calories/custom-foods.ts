/**
 * User-entered custom foods.
 *
 * Stored in health_profile.section='custom_foods' as:
 *   { entries: [ { id, name, servingLabel, calories, macros }, ... ] }
 *
 * Custom foods fill the gap where USDA has no match (restaurant
 * meals, homemade recipes, rare brands). Users enter them from a
 * nutrition-label form, then log them into food_entries directly.
 */

import { createServiceClient } from "@/lib/supabase";
import { randomUUID } from "node:crypto";

export interface CustomFood {
  id: string;
  name: string;
  servingLabel: string; // "1 bowl", "100 g", etc.
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
  notes?: string | null;
  createdAt: string;
}

export interface CustomFoodsLog {
  entries: CustomFood[];
}

const EMPTY: CustomFoodsLog = { entries: [] };

function sanitize(raw: unknown): CustomFood | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const name = typeof r.name === "string" && r.name.trim().length > 0 ? r.name.trim() : null;
  const servingLabel = typeof r.servingLabel === "string" && r.servingLabel.trim().length > 0 ? r.servingLabel.trim() : null;
  const calories = Number(r.calories);
  if (!id || !name || !servingLabel || !Number.isFinite(calories) || calories < 0) return null;
  const macros = (r.macros ?? {}) as Record<string, unknown>;
  const m: CustomFood["macros"] = {};
  for (const key of ["protein", "carbs", "fat", "fiber", "sugar", "sodium", "calcium", "iron"] as const) {
    const v = Number(macros[key]);
    if (Number.isFinite(v) && v >= 0) {
      m[key] = v;
    }
  }
  const notes = typeof r.notes === "string" ? r.notes : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  return { id, name, servingLabel, calories, macros: m, notes, createdAt };
}

export async function loadCustomFoods(): Promise<CustomFoodsLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "custom_foods")
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
        .map(sanitize)
        .filter((e): e is CustomFood => e !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  } catch {
    return EMPTY;
  }
}

export async function addCustomFood(input: Omit<CustomFood, "id" | "createdAt">): Promise<{ ok: boolean; food?: CustomFood; error?: string }> {
  const candidate: CustomFood = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  const sanitized = sanitize(candidate);
  if (!sanitized) return { ok: false, error: "Invalid food: need name, servingLabel, and a non-negative calorie number." };
  try {
    const current = await loadCustomFoods();
    const next = [sanitized, ...current.entries];
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert(
        { section: "custom_foods", content: { entries: next } },
        { onConflict: "section" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, food: sanitized };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function findCustomFood(id: string): Promise<CustomFood | null> {
  const log = await loadCustomFoods();
  return log.entries.find((e) => e.id === id) ?? null;
}
