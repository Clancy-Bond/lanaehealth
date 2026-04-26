/**
 * Blood pressure log persistence (MFN parity GAP #16).
 *
 * Stored in health_profile.section='blood_pressure_log' as jsonb:
 *   { entries: [ { date, time, systolic, diastolic, pulse, position, notes }, ... ] }
 *
 * BP is a first-class POTS signal for Lanae - the orthostatic tests
 * already capture standing deltas, but a casual spot-check belongs
 * here. MFN's Health tab has the same.
 */

import { createServiceClient } from "@/lib/supabase";

export type BPPosition = "sitting" | "standing" | "lying" | "unknown";

export interface BloodPressureEntry {
  id: string;
  date: string;
  time: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  position: BPPosition;
  notes: string;
  loggedAt: string;
}

export interface BloodPressureLog {
  entries: BloodPressureEntry[];
}

const EMPTY: BloodPressureLog = { entries: [] };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const VALID_POSITIONS = new Set<BPPosition>(["sitting", "standing", "lying", "unknown"]);

function sanitize(raw: unknown): BloodPressureEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : null;
  const date = typeof r.date === "string" ? r.date.trim() : null;
  const time = typeof r.time === "string" ? r.time.trim() : "";
  const systolic = Number(r.systolic);
  const diastolic = Number(r.diastolic);
  const pulseRaw = r.pulse;
  const pulse = pulseRaw === null || pulseRaw === undefined || pulseRaw === ""
    ? null
    : Number(pulseRaw);
  const positionRaw = typeof r.position === "string" ? (r.position.trim().toLowerCase() as BPPosition) : "unknown";
  const position: BPPosition = VALID_POSITIONS.has(positionRaw) ? positionRaw : "unknown";

  if (!id || !date || !DATE_RE.test(date)) return null;
  if (!Number.isFinite(systolic) || systolic < 50 || systolic > 260) return null;
  if (!Number.isFinite(diastolic) || diastolic < 30 || diastolic > 180) return null;
  if (pulse !== null && (!Number.isFinite(pulse) || pulse < 20 || pulse > 250)) return null;
  const finalTime = TIME_RE.test(time) ? time : "";

  return {
    id,
    date,
    time: finalTime,
    systolic: Math.round(systolic),
    diastolic: Math.round(diastolic),
    pulse: pulse !== null ? Math.round(pulse) : null,
    position,
    notes: typeof r.notes === "string" ? r.notes.trim().slice(0, 280) : "",
    loggedAt: typeof r.loggedAt === "string" ? r.loggedAt : new Date().toISOString(),
  };
}

export async function loadBloodPressureLog(): Promise<BloodPressureLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "blood_pressure_log")
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
        .filter((e): e is BloodPressureEntry => e !== null)
        .sort((a, b) =>
          a.date !== b.date
            ? b.date.localeCompare(a.date)
            : b.loggedAt.localeCompare(a.loggedAt),
        ),
    };
  } catch {
    return EMPTY;
  }
}

function newId(): string {
  return `bp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addBloodPressureEntry(input: {
  date: string;
  time?: string;
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  position?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const candidate = sanitize({
    id: newId(),
    date: input.date,
    time: input.time ?? "",
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulse: input.pulse ?? null,
    position: input.position ?? "unknown",
    notes: input.notes ?? "",
    loggedAt: new Date().toISOString(),
  });
  if (!candidate) {
    return { ok: false, error: "Invalid BP reading. Systolic 50-260, diastolic 30-180." };
  }
  try {
    const current = await loadBloodPressureLog();
    const next = [candidate, ...current.entries];
    const sb = createServiceClient();
    const { error } = await sb.from("health_profile").upsert(
      { section: "blood_pressure_log", content: { entries: next } },
      { onConflict: "section" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: candidate.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function deleteBloodPressureEntry(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "id required." };
  try {
    const current = await loadBloodPressureLog();
    const next = current.entries.filter((e) => e.id !== id);
    if (next.length === current.entries.length) return { ok: false, error: "Not found." };
    const sb = createServiceClient();
    const { error } = await sb.from("health_profile").upsert(
      { section: "blood_pressure_log", content: { entries: next } },
      { onConflict: "section" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export function classifyBP(sys: number, dia: number): { label: string; color: string } {
  if (sys < 90 || dia < 60) return { label: "Low", color: "var(--phase-luteal)" };
  if (sys < 120 && dia < 80) return { label: "Normal", color: "var(--accent-sage)" };
  if (sys < 130 && dia < 80) return { label: "Elevated", color: "var(--accent-blush-light)" };
  if (sys < 140 || dia < 90) return { label: "Stage 1", color: "var(--accent-blush-light)" };
  return { label: "Stage 2+", color: "var(--accent-blush)" };
}
