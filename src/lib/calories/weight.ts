/**
 * Weight log persistence.
 *
 * Stored in health_profile.section='weight_log' as a jsonb array:
 *   [
 *     { date: "2026-04-17", kg: 90.7, lb: 200.0, notes: "post breakfast" },
 *     ...
 *   ]
 *
 * Keeping this in health_profile avoids a schema migration overnight.
 * When the weight log grows past a few hundred entries we'll split it
 * into a dedicated `weight_entries` table (migration 028 plan filed
 * in the overnight log). For Lanae's use case, daily-or-less entries
 * over months fits comfortably in jsonb.
 */

import { createServiceClient } from "@/lib/supabase";

export interface WeightEntry {
  /** ISO YYYY-MM-DD */
  date: string;
  /** Weight in kilograms. */
  kg: number;
  /** Optional note. */
  notes?: string | null;
}

export interface WeightLog {
  entries: WeightEntry[];
}

export const EMPTY_LOG: WeightLog = { entries: [] };

function sanitize(entry: unknown): WeightEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const date = typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
  const kg = Number(e.kg);
  if (!date || !Number.isFinite(kg) || kg < 20 || kg > 400) return null;
  const notes = typeof e.notes === "string" ? e.notes : null;
  return { date, kg, notes };
}

export async function loadWeightLog(): Promise<WeightLog> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "weight_log")
      .maybeSingle();
    if (error || !data) return EMPTY_LOG;
    const raw = (data as { content: unknown }).content;
    if (Array.isArray(raw)) {
      return {
        entries: raw
          .map(sanitize)
          .filter((e): e is WeightEntry => e !== null)
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    if (raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries)) {
      return {
        entries: ((raw as { entries: unknown[] }).entries ?? [])
          .map(sanitize)
          .filter((e): e is WeightEntry => e !== null)
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    return EMPTY_LOG;
  } catch {
    return EMPTY_LOG;
  }
}

/**
 * Upsert a single day's weight entry. Replaces any existing entry on
 * the same date (so the UI's "Weigh-In" always writes the current day
 * without duplicating). Returns the new log.
 */
export async function addWeightEntry(entry: WeightEntry): Promise<{ ok: boolean; log?: WeightLog; error?: string }> {
  const sanitized = sanitize(entry);
  if (!sanitized) {
    return { ok: false, error: "Invalid weight entry: kg must be 20-400 and date must be YYYY-MM-DD." };
  }
  try {
    const current = await loadWeightLog();
    const next: WeightEntry[] = current.entries.filter((e) => e.date !== sanitized.date);
    next.push(sanitized);
    next.sort((a, b) => a.date.localeCompare(b.date));
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert(
        { section: "weight_log", content: { entries: next } },
        { onConflict: "section" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, log: { entries: next } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

/** Convert kg -> lb for display. 1 kg = 2.20462 lb. */
export function kgToLb(kg: number): number {
  return kg * 2.20462;
}

export function lbToKg(lb: number): number {
  return lb / 2.20462;
}

/**
 * Return the most recent entry, or null if no entries.
 */
export function latestEntry(log: WeightLog): WeightEntry | null {
  if (log.entries.length === 0) return null;
  return log.entries[log.entries.length - 1];
}

/**
 * Return the entry N days before the latest, or null if not enough
 * history. Used for "vs last week" / "vs last month" comparison.
 */
export function entryDaysAgo(log: WeightLog, days: number): WeightEntry | null {
  if (log.entries.length === 0) return null;
  const latest = log.entries[log.entries.length - 1];
  const latestDate = new Date(latest.date + "T00:00:00").getTime();
  const target = latestDate - days * 86400000;
  // Find the closest entry on or before the target date.
  let chosen: WeightEntry | null = null;
  for (const e of log.entries) {
    const t = new Date(e.date + "T00:00:00").getTime();
    if (t <= target) chosen = e;
    else break;
  }
  return chosen;
}
