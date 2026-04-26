/**
 * Recent foods loader for the MFN-grade quick-log strip.
 *
 * Reads the user's last 14 days of food_entries, dedupes by name (the
 * closest stable identity we have, since food_entries does not store
 * an fdcId column), and returns the most recently logged version of
 * each unique name. The QuickLog UI uses this list to surface "tap to
 * re-log" rows above the meal sections.
 *
 * Why dedupe by name?
 *   - food_entries has no fdcId/source column.
 *   - The display name is denormalised at insert time (e.g. "Apple,
 *     raw (1× 1 medium 118g)"), so the same USDA food eaten at
 *     different portions counts as different "recent" rows. That is
 *     intentional: re-logging at the previous portion is the win, so
 *     the same food at two portions deserves two separate quick-log
 *     rows.
 *
 * The macros + calories from the most recent log are returned verbatim;
 * the API consumer (POST /api/food/log/recent) will copy them into a
 * fresh food_entries row scoped to the chosen meal + date.
 */

import { createServiceClient } from "@/lib/supabase";
import { resolveUserId, UserIdUnresolvableError } from "@/lib/auth/resolve-user-id";
import { addDays, format } from "date-fns";

export interface RecentFoodEntry {
  /** food_entries.id of the most recent log for this name. The quick-log
   * route reads this row's macros + calories to clone the entry. */
  sourceId: string;
  /** Display name as logged. Already includes portion suffix. */
  name: string;
  /** Calories from the most recent log. */
  calories: number;
  /** Macros JSON from the most recent log. */
  macros: Record<string, number>;
  /** Last meal_type the user logged this under (helps preselect a
   * sensible default in the meal-picker sheet). */
  lastMealType: "breakfast" | "lunch" | "dinner" | "snack";
  /** Logged_at timestamp from the most recent log. */
  loggedAt: string;
}

interface RawRow {
  id: string;
  food_items: string | null;
  calories: number | null;
  macros: Record<string, number> | null;
  meal_type: string | null;
  logged_at: string | null;
}

/**
 * Load up to `limit` distinct recent foods, ordered most-recent first.
 * Returns an empty array when there is no session or no data.
 */
export async function loadRecentFoods(limit = 10): Promise<RecentFoodEntry[]> {
  let userId: string;
  try {
    userId = (await resolveUserId()).userId;
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) return [];
    return [];
  }

  const sb = createServiceClient();
  const fourteenDaysAgo = format(addDays(new Date(), -14), "yyyy-MM-dd");

  const { data, error } = await sb
    .from("food_entries")
    .select("id, food_items, calories, macros, meal_type, logged_at")
    .eq("user_id", userId)
    .gte("logged_at", `${fourteenDaysAgo}T00:00:00Z`)
    .order("logged_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  const seen = new Set<string>();
  const out: RecentFoodEntry[] = [];
  for (const raw of data as RawRow[]) {
    const name = raw.food_items?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const mealType = (raw.meal_type ?? "snack").toLowerCase();
    const safeMeal: RecentFoodEntry["lastMealType"] =
      mealType === "breakfast" || mealType === "lunch" || mealType === "dinner"
        ? (mealType as RecentFoodEntry["lastMealType"])
        : "snack";
    out.push({
      sourceId: raw.id,
      name,
      calories: typeof raw.calories === "number" ? raw.calories : 0,
      macros: raw.macros ?? {},
      lastMealType: safeMeal,
      loggedAt: raw.logged_at ?? new Date().toISOString(),
    });
    if (out.length >= limit) break;
  }
  return out;
}
