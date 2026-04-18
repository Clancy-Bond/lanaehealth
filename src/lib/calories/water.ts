/**
 * Water intake log. Stored in health_profile.section='water_log' as:
 *   { entries: [ { date, glasses }, ... ] }
 *
 * 1 glass = 8 fl oz = 240 ml (MyNetDiary convention).
 */

import { createServiceClient } from "@/lib/supabase";

export const OZ_PER_GLASS = 8;
export const ML_PER_GLASS = 240;

export interface WaterEntry {
  date: string; // YYYY-MM-DD
  glasses: number;
}

export interface WaterLog {
  entries: WaterEntry[];
}

export const EMPTY: WaterLog = { entries: [] };

function sanitize(entry: unknown): WaterEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const date = typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
  const g = Number(e.glasses);
  if (!date || !Number.isFinite(g) || g < 0 || g > 40) return null;
  return { date, glasses: g };
}

export async function loadWaterLog(): Promise<WaterLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "water_log")
      .maybeSingle();
    const raw = (data as { content: unknown } | null)?.content;
    if (Array.isArray(raw)) {
      return {
        entries: raw
          .map(sanitize)
          .filter((e): e is WaterEntry => e !== null)
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    if (raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries)) {
      return {
        entries: ((raw as { entries: unknown[] }).entries ?? [])
          .map(sanitize)
          .filter((e): e is WaterEntry => e !== null)
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    return EMPTY;
  } catch {
    return EMPTY;
  }
}

export async function setWaterForDate(
  date: string,
  glasses: number,
): Promise<{ ok: boolean; log?: WaterLog; error?: string }> {
  const sanitized = sanitize({ date, glasses });
  if (!sanitized) {
    return { ok: false, error: "glasses must be 0-40 and date must be YYYY-MM-DD." };
  }
  try {
    const current = await loadWaterLog();
    const next: WaterEntry[] = current.entries.filter((e) => e.date !== sanitized.date);
    next.push(sanitized);
    next.sort((a, b) => a.date.localeCompare(b.date));
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert(
        { section: "water_log", content: { entries: next } },
        { onConflict: "section" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, log: { entries: next } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function incrementGlasses(
  date: string,
  delta: number,
): Promise<{ ok: boolean; log?: WaterLog; error?: string }> {
  const current = await loadWaterLog();
  const existing = current.entries.find((e) => e.date === date);
  const nextValue = Math.max(0, Math.min(40, (existing?.glasses ?? 0) + delta));
  return setWaterForDate(date, nextValue);
}

export function glassesForDate(log: WaterLog, date: string): number {
  return log.entries.find((e) => e.date === date)?.glasses ?? 0;
}

export function ozFromGlasses(glasses: number): number {
  return glasses * OZ_PER_GLASS;
}
