/**
 * BBT (Basal Body Temperature) log. Stored in
 * health_profile.section='bbt_log' as jsonb:
 *   { entries: [ { date, temp_f, temp_c, source }, ... ] }
 *
 * Natural Cycles asks for temp every morning. Ours supports F or C
 * and computes the other. Converts temp_c when source='oura' (Oura
 * provides deviation, not absolute; we skip those for the log itself).
 */

import { createServiceClient } from "@/lib/supabase";

export interface BbtEntry {
  date: string; // YYYY-MM-DD
  temp_c: number; // canonical
  temp_f: number; // mirrored for display
  source: "manual" | "oura" | "wearable";
}

export interface BbtLog {
  entries: BbtEntry[];
}

function fToC(f: number): number {
  return (f - 32) * (5 / 9);
}
function cToF(c: number): number {
  return c * (9 / 5) + 32;
}

function sanitize(entry: unknown): BbtEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const date = typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
  if (!date) return null;
  const c = Number(e.temp_c);
  const f = Number(e.temp_f);
  let canonicalC: number | null = null;
  if (Number.isFinite(c) && c > 30 && c < 45) canonicalC = c;
  else if (Number.isFinite(f) && f > 86 && f < 113) canonicalC = fToC(f);
  if (canonicalC === null) return null;
  const source =
    e.source === "manual" || e.source === "oura" || e.source === "wearable"
      ? (e.source as BbtEntry["source"])
      : "manual";
  return { date, temp_c: Number(canonicalC.toFixed(2)), temp_f: Number(cToF(canonicalC).toFixed(2)), source };
}

export async function loadBbtLog(): Promise<BbtLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "bbt_log")
      .maybeSingle();
    const raw = (data as { content: unknown } | null)?.content;
    if (!raw) return { entries: [] };
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { entries?: unknown }).entries)
        ? ((raw as { entries: unknown[] }).entries ?? [])
        : [];
    return {
      entries: (arr as unknown[])
        .map(sanitize)
        .filter((e): e is BbtEntry => e !== null)
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch {
    return { entries: [] };
  }
}

export async function addBbtEntry(entry: BbtEntry): Promise<{ ok: boolean; log?: BbtLog; error?: string }> {
  const sanitized = sanitize(entry);
  if (!sanitized) return { ok: false, error: "Invalid BBT entry. Provide temp_c in 30-45 or temp_f in 86-113." };
  try {
    const current = await loadBbtLog();
    const next = [...current.entries.filter((e) => e.date !== sanitized.date), sanitized].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert(
        { section: "bbt_log", content: { entries: next } },
        { onConflict: "section" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, log: { entries: next } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Detect a sustained BBT shift (>=0.2°C above 6-day prior baseline,
 * held for 3+ consecutive days). Rough Marquette method.
 */
export function detectOvulationShift(log: BbtLog, withinDays = 14): boolean {
  if (log.entries.length < 10) return false;
  const last = log.entries.slice(-withinDays);
  for (let i = 6; i < last.length; i++) {
    const baseline = last.slice(i - 6, i).map((e) => e.temp_c);
    const baselineAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const current = last.slice(i, i + 3);
    if (current.length < 3) continue;
    const allHigher = current.every((e) => e.temp_c >= baselineAvg + 0.2);
    if (allHigher) return true;
  }
  return false;
}
