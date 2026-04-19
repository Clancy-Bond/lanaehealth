/**
 * Manual workout log (MFN parity GAP #14).
 *
 * MyNetDiary's Exercise tab logs workouts with a type, duration, and
 * calories-burned estimate. Oura already gives us passive active
 * minutes + active calories per day; this log is for discrete,
 * user-entered bouts (e.g. "30 min walk with the dog, 150 cal") that
 * Oura may miss (indoor workouts without HR, yoga, pilates).
 *
 * Stored in health_profile.section='workouts' as jsonb:
 *   { entries: [ { id, date, type, durationMin, calories, notes, loggedAt } ] }
 */

import { createServiceClient } from "@/lib/supabase";

export type WorkoutType =
  | "walking"
  | "running"
  | "cycling"
  | "swimming"
  | "yoga"
  | "pilates"
  | "strength"
  | "hiit"
  | "pt"
  | "dance"
  | "housework"
  | "other";

export const WORKOUT_TYPES: Array<{ key: WorkoutType; label: string }> = [
  { key: "walking", label: "Walking" },
  { key: "running", label: "Running" },
  { key: "cycling", label: "Cycling" },
  { key: "swimming", label: "Swimming" },
  { key: "yoga", label: "Yoga" },
  { key: "pilates", label: "Pilates" },
  { key: "strength", label: "Strength training" },
  { key: "hiit", label: "HIIT / cardio" },
  { key: "pt", label: "Physical therapy" },
  { key: "dance", label: "Dance" },
  { key: "housework", label: "Housework" },
  { key: "other", label: "Other" },
];

const VALID_TYPES = new Set<WorkoutType>(WORKOUT_TYPES.map((w) => w.key));

export interface Workout {
  id: string;
  date: string;
  type: WorkoutType;
  durationMin: number;
  calories: number;
  notes: string;
  loggedAt: string;
}

export interface WorkoutsLog {
  entries: Workout[];
}

const EMPTY: WorkoutsLog = { entries: [] };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitize(raw: unknown): Workout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : null;
  const date = typeof r.date === "string" ? r.date.trim() : null;
  const type = typeof r.type === "string" ? (r.type.trim().toLowerCase() as WorkoutType) : null;
  const durationMin = Number(r.durationMin);
  const calories = Number(r.calories);
  if (!id || !date || !DATE_RE.test(date)) return null;
  if (!type || !VALID_TYPES.has(type)) return null;
  if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 480) return null;
  if (!Number.isFinite(calories) || calories < 0 || calories > 5000) return null;
  return {
    id,
    date,
    type,
    durationMin: Math.round(durationMin),
    calories: Math.round(calories),
    notes: typeof r.notes === "string" ? r.notes.trim().slice(0, 280) : "",
    loggedAt: typeof r.loggedAt === "string" ? r.loggedAt : new Date().toISOString(),
  };
}

export async function loadWorkouts(): Promise<WorkoutsLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("health_profile")
      .select("content")
      .eq("section", "workouts")
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
        .filter((e): e is Workout => e !== null)
        .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)),
    };
  } catch {
    return EMPTY;
  }
}

function newId(): string {
  return `wk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addWorkout(input: {
  date: string;
  type: string;
  durationMin: number;
  calories: number;
  notes?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const candidate = sanitize({
    id: newId(),
    date: input.date,
    type: input.type,
    durationMin: input.durationMin,
    calories: input.calories,
    notes: input.notes ?? "",
    loggedAt: new Date().toISOString(),
  });
  if (!candidate) {
    return { ok: false, error: "Invalid workout payload." };
  }
  try {
    const current = await loadWorkouts();
    const next = [candidate, ...current.entries];
    const sb = createServiceClient();
    const { error } = await sb.from("health_profile").upsert(
      { section: "workouts", content: { entries: next } },
      { onConflict: "section" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: candidate.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function deleteWorkout(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "id required." };
  try {
    const current = await loadWorkouts();
    const next = current.entries.filter((e) => e.id !== id);
    if (next.length === current.entries.length) return { ok: false, error: "Not found." };
    const sb = createServiceClient();
    const { error } = await sb.from("health_profile").upsert(
      { section: "workouts", content: { entries: next } },
      { onConflict: "section" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export function workoutLabel(type: WorkoutType): string {
  return WORKOUT_TYPES.find((w) => w.key === type)?.label ?? "Other";
}
