/**
 * Body composition metrics log persistence (Migration 037).
 *
 * Stored in health_profile.section='body_metrics_log' as jsonb:
 *   { entries: [ { id, date, weight_kg, body_fat_pct, waist_cm, hip_cm,
 *                  neck_cm, visceral_fat_rating, bone_mass_kg,
 *                  muscle_mass_kg, bmd_t_score, body_fat_method,
 *                  notes, loggedAt }, ... ] }
 *
 * Separate from weight_log so the legacy weigh-in dataset keeps its
 * shape; the v2 composition surface writes here. The page surfaces
 * combine both signals when displaying current state.
 */

import { createServiceClient } from "@/lib/supabase";

export type BodyFatMethod = 'navy' | 'bia' | 'dexa' | 'skinfold' | 'manual';

export interface BodyMetricsEntry {
  id: string;
  date: string;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  neck_cm?: number | null;
  visceral_fat_rating?: number | null;
  bone_mass_kg?: number | null;
  muscle_mass_kg?: number | null;
  bmd_t_score?: number | null;
  body_fat_method?: BodyFatMethod | null;
  notes: string;
  loggedAt: string;
}

export interface BodyMetricsLog {
  entries: BodyMetricsEntry[];
}

const EMPTY: BodyMetricsLog = { entries: [] };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_METHODS: ReadonlySet<BodyFatMethod> = new Set([
  'navy', 'bia', 'dexa', 'skinfold', 'manual',
]);

function numOrNull(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function sanitize(raw: unknown): BodyMetricsEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : null;
  const date = typeof r.date === 'string' ? r.date.trim() : null;
  if (!id || !date || !DATE_RE.test(date)) return null;

  const methodRaw = typeof r.body_fat_method === 'string'
    ? (r.body_fat_method.trim().toLowerCase() as BodyFatMethod)
    : null;
  const method: BodyFatMethod | null =
    methodRaw && VALID_METHODS.has(methodRaw) ? methodRaw : null;

  return {
    id,
    date,
    weight_kg: numOrNull(r.weight_kg, 20, 400),
    body_fat_pct: numOrNull(r.body_fat_pct, 2, 70),
    waist_cm: numOrNull(r.waist_cm, 30, 200),
    hip_cm: numOrNull(r.hip_cm, 40, 200),
    neck_cm: numOrNull(r.neck_cm, 20, 70),
    visceral_fat_rating: numOrNull(r.visceral_fat_rating, 1, 30),
    bone_mass_kg: numOrNull(r.bone_mass_kg, 0.5, 10),
    muscle_mass_kg: numOrNull(r.muscle_mass_kg, 5, 200),
    bmd_t_score: numOrNull(r.bmd_t_score, -5, 5),
    body_fat_method: method,
    notes: typeof r.notes === 'string' ? r.notes.trim().slice(0, 280) : '',
    loggedAt: typeof r.loggedAt === 'string' ? r.loggedAt : new Date().toISOString(),
  };
}

export async function loadBodyMetricsLog(): Promise<BodyMetricsLog> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from('health_profile')
      .select('content')
      .eq('section', 'body_metrics_log')
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
        .filter((e): e is BodyMetricsEntry => e !== null)
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
  return `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addBodyMetricsEntry(input: {
  date: string;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  neck_cm?: number | null;
  visceral_fat_rating?: number | null;
  bone_mass_kg?: number | null;
  muscle_mass_kg?: number | null;
  bmd_t_score?: number | null;
  body_fat_method?: BodyFatMethod | null;
  notes?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const candidate = sanitize({
    id: newId(),
    date: input.date,
    weight_kg: input.weight_kg ?? null,
    body_fat_pct: input.body_fat_pct ?? null,
    waist_cm: input.waist_cm ?? null,
    hip_cm: input.hip_cm ?? null,
    neck_cm: input.neck_cm ?? null,
    visceral_fat_rating: input.visceral_fat_rating ?? null,
    bone_mass_kg: input.bone_mass_kg ?? null,
    muscle_mass_kg: input.muscle_mass_kg ?? null,
    bmd_t_score: input.bmd_t_score ?? null,
    body_fat_method: input.body_fat_method ?? null,
    notes: input.notes ?? '',
    loggedAt: new Date().toISOString(),
  });
  if (!candidate) {
    return { ok: false, error: 'Invalid body metrics entry.' };
  }
  // At least one signal must be present.
  const hasSignal =
    candidate.weight_kg !== null ||
    candidate.body_fat_pct !== null ||
    candidate.waist_cm !== null ||
    candidate.hip_cm !== null ||
    candidate.neck_cm !== null ||
    candidate.visceral_fat_rating !== null ||
    candidate.bone_mass_kg !== null ||
    candidate.muscle_mass_kg !== null ||
    candidate.bmd_t_score !== null;
  if (!hasSignal) {
    return { ok: false, error: 'Add at least one measurement.' };
  }

  try {
    const current = await loadBodyMetricsLog();
    const next: BodyMetricsEntry[] = [...current.entries, candidate];
    next.sort((a, b) =>
      a.date !== b.date
        ? b.date.localeCompare(a.date)
        : b.loggedAt.localeCompare(a.loggedAt),
    );
    const sb = createServiceClient();
    const { error } = await sb
      .from('health_profile')
      .upsert(
        { section: 'body_metrics_log', content: { entries: next } },
        { onConflict: 'section' },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: candidate.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

/**
 * Most-recent non-null value for a given field, scanning entries
 * newest-first. Useful for building "current state" snapshots when
 * the latest entry only logged a subset of metrics.
 */
export function latestValue<K extends keyof BodyMetricsEntry>(
  log: BodyMetricsLog,
  key: K,
): BodyMetricsEntry[K] | null {
  for (const e of log.entries) {
    const v = e[key];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}
