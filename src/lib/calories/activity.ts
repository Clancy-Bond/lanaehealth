/**
 * Daily activity reader.
 *
 * Reads Oura's daily_activity payload from oura_daily.raw_json.oura
 * .daily_activity. Exposes just the fields the /calories dashboard
 * cares about:
 *   - steps
 *   - active_calories
 *   - total_calories
 *
 * If activity hasn't synced yet (sync route processed it starting
 * 2026-04-18), returns nulls so the UI shows a "sync needed" hint.
 */

import { createServiceClient } from "@/lib/supabase";

export interface DailyActivity {
  date: string;
  steps: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
  /** Distance in meters if Oura provided it. */
  equivalentWalkingDistanceM: number | null;
}

export async function loadActivityForDate(date: string): Promise<DailyActivity> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("oura_daily")
      .select("date, raw_json")
      .eq("date", date)
      .maybeSingle();
    if (!data) {
      return { date, steps: null, activeCalories: null, totalCalories: null, equivalentWalkingDistanceM: null };
    }
    const raw = ((data as { raw_json: unknown }).raw_json ?? {}) as Record<string, unknown>;
    const oura = ((raw.oura ?? {}) as Record<string, unknown>);
    const activity = oura.daily_activity as Record<string, unknown> | undefined;
    if (!activity) {
      return { date, steps: null, activeCalories: null, totalCalories: null, equivalentWalkingDistanceM: null };
    }
    return {
      date,
      steps: toNum(activity.steps),
      activeCalories: toNum(activity.active_calories),
      totalCalories: toNum(activity.total_calories),
      equivalentWalkingDistanceM: toNum(activity.equivalent_walking_distance),
    };
  } catch {
    return { date, steps: null, activeCalories: null, totalCalories: null, equivalentWalkingDistanceM: null };
  }
}

export async function loadActivityRange(startDate: string, endDate: string): Promise<DailyActivity[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("oura_daily")
      .select("date, raw_json")
      .gte("date", startDate)
      .lte("date", endDate);
    const rows = ((data ?? []) as unknown) as Array<{ date: string; raw_json: Record<string, unknown> | null }>;
    return rows.map((r) => {
      const raw = (r.raw_json ?? {}) as Record<string, unknown>;
      const oura = ((raw.oura ?? {}) as Record<string, unknown>);
      const a = oura.daily_activity as Record<string, unknown> | undefined;
      return {
        date: r.date,
        steps: a ? toNum(a.steps) : null,
        activeCalories: a ? toNum(a.active_calories) : null,
        totalCalories: a ? toNum(a.total_calories) : null,
        equivalentWalkingDistanceM: a ? toNum(a.equivalent_walking_distance) : null,
      };
    });
  } catch {
    return [];
  }
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
