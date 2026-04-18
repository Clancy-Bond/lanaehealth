/**
 * Hormone log (Stardust-pattern explicit hormone-level tracking).
 *
 * Stored in health_profile.section='hormone_log' as jsonb:
 *   { entries: [ { date, hormone, value, unit, source }, ... ] }
 *
 * Supported hormones (aligned with common lab panels):
 *   estrogen (pg/mL), progesterone (ng/mL), testosterone (ng/dL),
 *   lh (mIU/mL), fsh (mIU/mL), tsh (mIU/L), prolactin (ng/mL),
 *   dhea_s (ug/dL), cortisol (ug/dL)
 */

import { createServiceClient } from "@/lib/supabase";

export type HormoneId =
  | "estrogen"
  | "progesterone"
  | "testosterone"
  | "lh"
  | "fsh"
  | "tsh"
  | "prolactin"
  | "dhea_s"
  | "cortisol";

export interface HormoneEntry {
  date: string; // YYYY-MM-DD
  hormone: HormoneId;
  value: number;
  unit: string;
  source: "self" | "lab" | "wearable";
}

export interface HormoneLog {
  entries: HormoneEntry[];
}

export const HORMONE_META: Record<HormoneId, { label: string; defaultUnit: string; typicalRange: string }> = {
  estrogen: { label: "Estrogen (E2)", defaultUnit: "pg/mL", typicalRange: "follicular 30-100, mid-cycle 100-400, luteal 50-200" },
  progesterone: { label: "Progesterone", defaultUnit: "ng/mL", typicalRange: "follicular <1, luteal 5-20" },
  testosterone: { label: "Testosterone (total)", defaultUnit: "ng/dL", typicalRange: "female 15-70" },
  lh: { label: "LH", defaultUnit: "mIU/mL", typicalRange: "follicular 2-10, surge 20-80" },
  fsh: { label: "FSH", defaultUnit: "mIU/mL", typicalRange: "follicular 3-10" },
  tsh: { label: "TSH", defaultUnit: "mIU/L", typicalRange: "0.4-4.0 (optimal ~1-2)" },
  prolactin: { label: "Prolactin", defaultUnit: "ng/mL", typicalRange: "non-pregnant female 5-25" },
  dhea_s: { label: "DHEA-S", defaultUnit: "ug/dL", typicalRange: "female 20s 60-350" },
  cortisol: { label: "Cortisol", defaultUnit: "ug/dL", typicalRange: "morning 6-23, evening <10" },
};

function sanitize(entry: unknown): HormoneEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const date = typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : null;
  const hormone = typeof e.hormone === "string" ? (e.hormone as HormoneId) : null;
  const value = Number(e.value);
  const unit = typeof e.unit === "string" ? e.unit : null;
  const source = typeof e.source === "string" ? e.source : "self";
  if (!date || !hormone || !(hormone in HORMONE_META) || !Number.isFinite(value) || !unit) return null;
  if (source !== "self" && source !== "lab" && source !== "wearable") return null;
  return { date, hormone, value, unit, source };
}

export async function loadHormoneLog(): Promise<HormoneLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "hormone_log")
      .maybeSingle();
    const raw = (data as { content: unknown } | null)?.content;
    if (Array.isArray(raw)) {
      return {
        entries: raw
          .map(sanitize)
          .filter((e): e is HormoneEntry => e !== null)
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    if (raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries)) {
      return {
        entries: ((raw as { entries: unknown[] }).entries ?? [])
          .map(sanitize)
          .filter((e): e is HormoneEntry => e !== null)
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }
    return { entries: [] };
  } catch {
    return { entries: [] };
  }
}

export async function addHormoneEntry(entry: HormoneEntry): Promise<{ ok: boolean; log?: HormoneLog; error?: string }> {
  const sanitized = sanitize(entry);
  if (!sanitized) return { ok: false, error: "Invalid hormone entry." };
  try {
    const current = await loadHormoneLog();
    const next: HormoneEntry[] = [
      ...current.entries.filter(
        (e) => !(e.date === sanitized.date && e.hormone === sanitized.hormone),
      ),
      sanitized,
    ];
    next.sort((a, b) => a.date.localeCompare(b.date));
    const sb = createServiceClient();
    const { error } = await sb
      .from("health_profile")
      .upsert(
        { section: "hormone_log", content: { entries: next } },
        { onConflict: "section" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, log: { entries: next } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export function entriesByHormone(log: HormoneLog): Record<HormoneId, HormoneEntry[]> {
  const out = {} as Record<HormoneId, HormoneEntry[]>;
  for (const id of Object.keys(HORMONE_META) as HormoneId[]) out[id] = [];
  for (const e of log.entries) {
    if (e.hormone in out) out[e.hormone].push(e);
  }
  return out;
}
