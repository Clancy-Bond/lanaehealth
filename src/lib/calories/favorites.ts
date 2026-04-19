/**
 * Food favorites (MFN parity GAP #10).
 *
 * Stored in health_profile.section='food_favorites' as jsonb:
 *   { entries: [ { fdcId, name, addedAt }, ... ] }
 *
 * A "favorite" is a USDA fdcId the user has starred on the food
 * detail page. Toggling off removes the entry. The Favorites view
 * in /calories/search renders these as tap-to-search rows.
 */

import { createServiceClient } from "@/lib/supabase";

export interface Favorite {
  fdcId: number;
  name: string;
  addedAt: string;
}

export interface FavoritesLog {
  entries: Favorite[];
}

const EMPTY: FavoritesLog = { entries: [] };

function sanitize(raw: unknown): Favorite | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const fdcId = Number(r.fdcId);
  const name = typeof r.name === "string" ? r.name.trim() : null;
  if (!Number.isFinite(fdcId) || fdcId <= 0 || !name) return null;
  return {
    fdcId,
    name,
    addedAt: typeof r.addedAt === "string" ? r.addedAt : new Date().toISOString(),
  };
}

export async function loadFavorites(): Promise<FavoritesLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "food_favorites")
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
        .filter((e): e is Favorite => e !== null)
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    };
  } catch {
    return EMPTY;
  }
}

export async function toggleFavorite(fdcId: number, name: string): Promise<{ ok: boolean; favorited: boolean; error?: string }> {
  const sanitized = sanitize({ fdcId, name });
  if (!sanitized) return { ok: false, favorited: false, error: "Invalid fdcId or name." };
  try {
    const current = await loadFavorites();
    const existingIdx = current.entries.findIndex((e) => e.fdcId === sanitized.fdcId);
    let next: Favorite[];
    let favorited: boolean;
    if (existingIdx >= 0) {
      next = current.entries.filter((_, i) => i !== existingIdx);
      favorited = false;
    } else {
      next = [sanitized, ...current.entries];
      favorited = true;
    }
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert(
        { section: "food_favorites", content: { entries: next } },
        { onConflict: "section" },
      );
    if (error) return { ok: false, favorited: false, error: error.message };
    return { ok: true, favorited };
  } catch (e) {
    return { ok: false, favorited: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function isFavorited(fdcId: number): Promise<boolean> {
  const log = await loadFavorites();
  return log.entries.some((e) => e.fdcId === fdcId);
}
