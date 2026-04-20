/**
 * Server-side queries that power the Symptoms tab widgets, detail pages,
 * and /patterns/symptoms.
 *
 * These functions all accept a Supabase client so the caller decides
 * between service role (server components) and anon key (edge).
 * Every query is additive: nothing mutates state. Missing tables (e.g.,
 * pending migrations) return empty arrays rather than throwing, so the
 * pages gracefully empty-state.
 */

import { format, subDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyLog,
  FoodEntry,
  Symptom,
  SymptomCategory,
} from "@/lib/types";
import { attributeTriggers } from "./triggers";
import type { PainDayPoint, TriggerAttribution } from "./types";

export interface SymptomsDashboardData {
  todaySymptoms: Symptom[];
  painSeries: PainDayPoint[];
  topTriggers: TriggerAttribution[];
  todayHasAnything: boolean;
}

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  try {
    const { data } = await run();
    return (data ?? []) as T[];
  } catch {
    return [] as T[];
  }
}

export async function loadTodaySymptoms(
  sb: SupabaseClient,
  dateIso: string,
): Promise<Symptom[]> {
  const { data: log } = await sb
    .from("daily_logs")
    .select("id")
    .eq("date", dateIso)
    .maybeSingle();
  const logId = (log as { id: string } | null)?.id ?? null;
  if (!logId) return [];
  return safeSelect<Symptom>(() =>
    sb
      .from("symptoms")
      .select("*")
      .eq("log_id", logId)
      .order("logged_at", { ascending: true }),
  );
}

export async function loadPainSparkline(
  sb: SupabaseClient,
  days = 7,
): Promise<PainDayPoint[]> {
  const today = format(new Date(), "yyyy-MM-dd");
  const cutoff = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  const rows = await safeSelect<Pick<DailyLog, "date" | "overall_pain" | "fatigue">>(
    () =>
      sb
        .from("daily_logs")
        .select("date, overall_pain, fatigue")
        .gte("date", cutoff)
        .lte("date", today)
        .order("date", { ascending: true }),
  );

  const byDate = new Map<string, { overallPain: number | null; fatigue: number | null }>();
  for (const r of rows) {
    byDate.set(r.date, { overallPain: r.overall_pain, fatigue: r.fatigue });
  }

  const out: PainDayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    const entry = byDate.get(date) ?? { overallPain: null, fatigue: null };
    out.push({ date, overallPain: entry.overallPain, fatigue: entry.fatigue });
  }
  return out;
}

export async function loadTopTriggers(
  sb: SupabaseClient,
  days = 14,
  limit = 4,
): Promise<TriggerAttribution[]> {
  const today = format(new Date(), "yyyy-MM-dd");
  const cutoffDate = format(subDays(new Date(), days), "yyyy-MM-dd");
  const cutoffIso = `${cutoffDate}T00:00:00.000Z`;

  const [logs, foodEntries, symptomRows] = await Promise.all([
    safeSelect<Pick<DailyLog, "id" | "date" | "overall_pain">>(() =>
      sb
        .from("daily_logs")
        .select("id, date, overall_pain")
        .gte("date", cutoffDate)
        .lte("date", today)
        .order("date", { ascending: true }),
    ),
    safeSelect<Pick<FoodEntry, "logged_at" | "food_items" | "flagged_triggers">>(() =>
      sb
        .from("food_entries")
        .select("logged_at, food_items, flagged_triggers")
        .gte("logged_at", cutoffIso),
    ),
    safeSelect<{ log_id: string; severity: string | null }>(() =>
      sb
        .from("symptoms")
        .select("log_id, severity"),
    ),
  ]);

  const symptomLogIds = new Set(symptomRows.map((s) => s.log_id));
  const symptomDays = logs.map((l) => ({
    date: l.date,
    hasSymptom: symptomLogIds.has(l.id) || (l.overall_pain ?? 0) >= 4,
  }));

  const triggers = attributeTriggers(
    {
      foodEntries: foodEntries.map((f) => ({
        logged_at: f.logged_at,
        food_items: f.food_items,
        flagged_triggers: f.flagged_triggers,
      })),
      painPoints: [],
      symptomDays,
    },
    days,
  );

  return triggers.slice(0, limit);
}

export interface SymptomHistoryRow {
  date: string;
  severity: string | null;
  count: number;
  logged_at: string;
}

/**
 * For /symptoms/[id], load the history of a specific symptom label across
 * daily logs. Returns newest first.
 */
export async function loadSymptomHistory(
  sb: SupabaseClient,
  symptomLabel: string,
  days = 60,
): Promise<SymptomHistoryRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();

  const rows = await safeSelect<Symptom>(() =>
    sb
      .from("symptoms")
      .select("*")
      .ilike("symptom", symptomLabel)
      .gte("logged_at", cutoffIso)
      .order("logged_at", { ascending: false }),
  );

  const byDate = new Map<string, { severity: string | null; count: number; logged_at: string }>();
  for (const r of rows) {
    const date = r.logged_at.slice(0, 10);
    const existing = byDate.get(date);
    if (existing) {
      existing.count += 1;
      if (
        severityRank(r.severity) > severityRank(existing.severity as Symptom["severity"])
      ) {
        existing.severity = r.severity;
      }
    } else {
      byDate.set(date, {
        severity: r.severity,
        count: 1,
        logged_at: r.logged_at,
      });
    }
  }

  const out: SymptomHistoryRow[] = [];
  for (const [date, info] of byDate.entries()) {
    out.push({ date, severity: info.severity, count: info.count, logged_at: info.logged_at });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

function severityRank(s: Symptom["severity"]): number {
  switch (s) {
    case "severe":
      return 3;
    case "moderate":
      return 2;
    case "mild":
      return 1;
    default:
      return 0;
  }
}

export interface SymptomIndexEntry {
  symptom: string;
  category: SymptomCategory;
  lastLoggedAt: string;
  totalEntries: number;
}

/**
 * For /symptoms, list every distinct symptom label Lanae has ever logged,
 * newest first by last-logged timestamp.
 */
export async function loadSymptomIndex(
  sb: SupabaseClient,
): Promise<SymptomIndexEntry[]> {
  const rows = await safeSelect<Symptom>(() =>
    sb
      .from("symptoms")
      .select("*")
      .order("logged_at", { ascending: false })
      .limit(500),
  );

  const map = new Map<string, SymptomIndexEntry>();
  for (const r of rows) {
    const key = r.symptom.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.totalEntries += 1;
      if (r.logged_at > existing.lastLoggedAt) {
        existing.lastLoggedAt = r.logged_at;
      }
    } else {
      map.set(key, {
        symptom: r.symptom,
        category: r.category,
        lastLoggedAt: r.logged_at,
        totalEntries: 1,
      });
    }
  }

  return [...map.values()].sort((a, b) =>
    a.lastLoggedAt < b.lastLoggedAt ? 1 : -1,
  );
}
