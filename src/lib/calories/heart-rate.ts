/**
 * Heart rate spot-check log (MFN parity GAP #16).
 *
 * Stored in health_profile.section='heart_rate_log' as jsonb:
 *   { entries: [ { id, date, time, bpm, context, notes, loggedAt }, ... ] }
 *
 * Oura gives us resting heart rate each night. This log is for ad-hoc
 * spot-checks (post-meal, post-orthostatic, during palpitations) that
 * matter for POTS tracking.
 */

import { createServiceClient } from "@/lib/supabase";

export type HRContext =
  | "resting"
  | "standing"
  | "post_orthostatic"
  | "post_meal"
  | "post_exercise"
  | "palpitations"
  | "other";

export const HR_CONTEXTS: Array<{ key: HRContext; label: string }> = [
  { key: "resting", label: "Resting" },
  { key: "standing", label: "Standing" },
  { key: "post_orthostatic", label: "Post orthostatic" },
  { key: "post_meal", label: "Post-meal" },
  { key: "post_exercise", label: "Post-exercise" },
  { key: "palpitations", label: "Palpitations" },
  { key: "other", label: "Other" },
];

const VALID_CONTEXTS = new Set<HRContext>(HR_CONTEXTS.map((c) => c.key));

export interface HeartRateEntry {
  id: string;
  date: string;
  time: string;
  bpm: number;
  context: HRContext;
  notes: string;
  loggedAt: string;
}

export interface HeartRateLog {
  entries: HeartRateEntry[];
}

const EMPTY: HeartRateLog = { entries: [] };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function sanitize(raw: unknown): HeartRateEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : null;
  const date = typeof r.date === "string" ? r.date.trim() : null;
  const time = typeof r.time === "string" ? r.time.trim() : "";
  const bpm = Number(r.bpm);
  const context = typeof r.context === "string" ? (r.context.trim().toLowerCase() as HRContext) : "other";
  if (!id || !date || !DATE_RE.test(date)) return null;
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 250) return null;
  const finalContext: HRContext = VALID_CONTEXTS.has(context) ? context : "other";
  const finalTime = TIME_RE.test(time) ? time : "";
  return {
    id,
    date,
    time: finalTime,
    bpm: Math.round(bpm),
    context: finalContext,
    notes: typeof r.notes === "string" ? r.notes.trim().slice(0, 280) : "",
    loggedAt: typeof r.loggedAt === "string" ? r.loggedAt : new Date().toISOString(),
  };
}

export async function loadHeartRateLog(): Promise<HeartRateLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "heart_rate_log")
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
        .filter((e): e is HeartRateEntry => e !== null)
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
  return `hr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addHeartRateEntry(input: {
  date: string;
  time?: string;
  bpm: number;
  context?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const candidate = sanitize({
    id: newId(),
    date: input.date,
    time: input.time ?? "",
    bpm: input.bpm,
    context: input.context ?? "other",
    notes: input.notes ?? "",
    loggedAt: new Date().toISOString(),
  });
  if (!candidate) {
    return { ok: false, error: "Invalid HR reading. bpm must be 20-250." };
  }
  try {
    const current = await loadHeartRateLog();
    const next = [candidate, ...current.entries];
    const sb = createServiceClient();
    const { error } = await sb.from("health_profile").upsert(
      { section: "heart_rate_log", content: { entries: next } },
      { onConflict: "section" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: candidate.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function deleteHeartRateEntry(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "id required." };
  try {
    const current = await loadHeartRateLog();
    const next = current.entries.filter((e) => e.id !== id);
    if (next.length === current.entries.length) return { ok: false, error: "Not found." };
    const sb = createServiceClient();
    const { error } = await sb.from("health_profile").upsert(
      { section: "heart_rate_log", content: { entries: next } },
      { onConflict: "section" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export function hrContextLabel(c: HRContext): string {
  return HR_CONTEXTS.find((x) => x.key === c)?.label ?? "Other";
}
