/**
 * Read Lanae's med list from health_profile.medications and normalize.
 *
 * The on-disk shape (managed by scripts/update-lanae-meds.mjs):
 *   {
 *     scheduled: [{ slug, name, slots: ['morning'|'night'|...], indication?, dose_text? }],
 *     as_needed: [{ slug, name, indication, default_dose_text? }]
 *   }
 *
 * We tolerate the legacy shape (`{ as_needed: [...] }` only, no `scheduled`)
 * so deploys do not break before scripts/update-lanae-meds.mjs runs.
 *
 * Reads route through runScopedQuery so a pre-035 schema (no user_id
 * column on health_profile yet) still returns the legacy single-tenant
 * row. Same pattern as PR #116.
 */
import { createServiceClient } from '@/lib/supabase'
import { runScopedQuery } from '@/lib/auth/scope-query'
import { parseProfileContent } from '@/lib/profile/parse-content'
import {
  EMPTY_MEDS_CONFIG,
  type MedsConfig,
  type MedSlot,
  type PrnMed,
  type ScheduledMed,
} from './types'

const VALID_SLOTS: ReadonlySet<MedSlot> = new Set(['morning', 'midday', 'night'])

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function normalizeScheduled(raw: unknown): ScheduledMed[] {
  if (!Array.isArray(raw)) return []
  const out: ScheduledMed[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const slug = typeof o.slug === 'string' && o.slug.trim() ? o.slug.trim() : null
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : null
    if (!slug || !name) continue
    const rawSlots = isStringArray(o.slots) ? o.slots : []
    const slots = rawSlots
      .map((s) => s.toLowerCase() as MedSlot)
      .filter((s): s is MedSlot => VALID_SLOTS.has(s))
    if (slots.length === 0) continue
    out.push({
      slug,
      name,
      slots,
      indication: typeof o.indication === 'string' ? o.indication : undefined,
      dose_text: typeof o.dose_text === 'string' ? o.dose_text : undefined,
    })
  }
  return out
}

function normalizePrn(raw: unknown): PrnMed[] {
  if (!Array.isArray(raw)) return []
  const out: PrnMed[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : null
    if (!name) continue
    // Slug is optional in legacy data; derive from name when missing.
    const slug =
      typeof o.slug === 'string' && o.slug.trim()
        ? o.slug.trim()
        : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    out.push({
      slug,
      name,
      indication: typeof o.indication === 'string' ? o.indication : 'as-needed',
      default_dose_text:
        typeof o.default_dose_text === 'string' ? o.default_dose_text : undefined,
    })
  }
  return out
}

export async function loadMedsConfig(userId: string | null): Promise<MedsConfig> {
  try {
    const sb = createServiceClient()
    const result = await runScopedQuery({
      table: 'health_profile',
      userId,
      withFilter: () =>
        sb
          .from('health_profile')
          .select('content')
          .eq('user_id', userId as string)
          .eq('section', 'medications')
          .maybeSingle(),
      withoutFilter: () =>
        sb
          .from('health_profile')
          .select('content')
          .eq('section', 'medications')
          .maybeSingle(),
    })
    const data = result.data as { content?: unknown } | null
    if (result.error || !data) return EMPTY_MEDS_CONFIG
    const parsed = parseProfileContent(data.content) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') return EMPTY_MEDS_CONFIG
    return {
      scheduled: normalizeScheduled(parsed.scheduled),
      as_needed: normalizePrn(parsed.as_needed),
    }
  } catch {
    return EMPTY_MEDS_CONFIG
  }
}
