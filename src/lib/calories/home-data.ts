/**
 * Shared data loaders for the Calories home widgets.
 *
 * Each widget calls the tiny loader it needs. We keep loaders small
 * and focused so React Server Components can still parallelize widget
 * fetches. Nothing here caches across widgets - if two widgets want
 * the same data on the same render, that's two cheap indexed reads
 * and the added simplicity is worth it.
 *
 * Multi-user scoping (PR #115 follow-up): callers pass `userId`. The
 * filter applies to `daily_logs` (the parent row); food_entries is
 * already gated by the resulting log_id list so it inherits the scope.
 * Pre-migration 035 the filter falls back to unfiltered via
 * `runScopedQuery`; post-migration a wrong / missing id returns an
 * empty result. NEVER does user A see user B's calorie totals.
 */

import { createServiceClient } from "@/lib/supabase";
import { runScopedQuery } from "@/lib/auth/scope-query";
import { format, addDays } from "date-fns";

export interface DayTotals {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  entryCount: number;
}

interface FoodEntryRow {
  log_id: string;
  calories: number | null;
  macros: Record<string, number> | null;
}

interface DailyLogLite {
  id: string;
  date: string;
}

function zeroDay(date: string): DayTotals {
  return { date, calories: 0, protein: 0, carbs: 0, fat: 0, entryCount: 0 };
}

/**
 * Totals for a single date. Returns all-zero when there's no log yet.
 *
 * @param date   ISO date YYYY-MM-DD.
 * @param userId Supabase auth user id. Optional for the legacy single-user
 *               and cron paths; required to keep multi-user reads safe.
 */
export async function getDayTotals(
  date: string,
  userId?: string | null,
): Promise<DayTotals> {
  const sb = createServiceClient();
  const logResult = await runScopedQuery({
    table: "daily_logs",
    userId,
    withFilter: () =>
      sb
        .from("daily_logs")
        .select("id, date")
        .eq("date", date)
        .eq("user_id", userId as string)
        .maybeSingle(),
    withoutFilter: () =>
      sb
        .from("daily_logs")
        .select("id, date")
        .eq("date", date)
        .maybeSingle(),
  });
  const log = logResult.data;
  if (!log) return zeroDay(date);
  const logLite = log as DailyLogLite;
  const { data: entries } = await sb
    .from("food_entries")
    .select("log_id, calories, macros")
    .eq("log_id", logLite.id);
  return rollUp(date, ((entries ?? []) as unknown) as FoodEntryRow[]);
}

/**
 * Totals for each day in [startDate .. endDate], inclusive. Missing
 * days are returned as zero rows so callers get a complete window.
 */
export async function getDailyTotalsRange(
  startDate: string,
  endDate: string,
  userId?: string | null,
): Promise<DayTotals[]> {
  const sb = createServiceClient();
  const logsResult = await runScopedQuery({
    table: "daily_logs",
    userId,
    withFilter: () =>
      sb
        .from("daily_logs")
        .select("id, date")
        .gte("date", startDate)
        .lte("date", endDate)
        .eq("user_id", userId as string),
    withoutFilter: () =>
      sb
        .from("daily_logs")
        .select("id, date")
        .gte("date", startDate)
        .lte("date", endDate),
  });
  const dailyLogs = ((logsResult.data ?? []) as unknown) as DailyLogLite[];
  const byId = new Map(dailyLogs.map((l) => [l.id, l.date]));
  const logIds = dailyLogs.map((l) => l.id);

  const { data: entries } =
    logIds.length > 0
      ? await sb
          .from("food_entries")
          .select("log_id, calories, macros")
          .in("log_id", logIds)
      : { data: [] };
  const rows = ((entries ?? []) as unknown) as FoodEntryRow[];

  const grouped = new Map<string, FoodEntryRow[]>();
  for (const r of rows) {
    const d = byId.get(r.log_id);
    if (!d) continue;
    const bucket = grouped.get(d) ?? [];
    bucket.push(r);
    grouped.set(d, bucket);
  }

  const out: DayTotals[] = [];
  const cursor = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (cursor.getTime() <= end.getTime()) {
    const iso = format(cursor, "yyyy-MM-dd");
    out.push(rollUp(iso, grouped.get(iso) ?? []));
    cursor.setTime(addDays(cursor, 1).getTime());
  }
  return out;
}

function rollUp(date: string, entries: FoodEntryRow[]): DayTotals {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const e of entries) {
    calories += e.calories ?? 0;
    if (e.macros) {
      protein += Number(e.macros.protein ?? 0) || 0;
      carbs += Number(e.macros.carbs ?? 0) || 0;
      fat += Number(e.macros.fat ?? 0) || 0;
    }
  }
  return {
    date,
    calories,
    protein,
    carbs,
    fat,
    entryCount: entries.length,
  };
}
