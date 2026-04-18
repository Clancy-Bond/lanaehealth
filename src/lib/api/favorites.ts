/**
 * Home Favorites API (Wave 2e F5)
 *
 * Manages the user-curated list of "pinned metrics" shown on the home page
 * via FavoritesStrip. Per the 2026-04-16 audit, we avoid a fresh migration
 * and lean on the existing health_profile EAV table:
 *
 *   health_profile row: {
 *     section: 'home_favorites',
 *     content: { items: [{ metric, displayAs? }, ...] }
 *   }
 *
 * A max of 6 items is enforced at the API layer AND the UI layer so the
 * home strip never grows past the designed footprint.
 */
import { createServiceClient } from '@/lib/supabase'
import { parseProfileContent } from '@/lib/profile/parse-content'

// --- metric catalog --------------------------------------------------------

/**
 * The union of metric ids that can be pinned. Keeping this closed lets the
 * renderer stay pure: when we see an unknown id we drop it rather than
 * trying to render a half-broken card.
 */
export type FavoriteMetricId =
  | 'standing_pulse'
  | 'hrv'
  | 'rhr'
  | 'body_temp'
  | 'cycle_day'
  | 'cycle_phase'
  | 'overall_pain'
  | 'fatigue'
  | 'sleep_score'
  | 'readiness'
  | 'top_lab'

export interface FavoriteMetricDefinition {
  id: FavoriteMetricId
  label: string
  /** One-word category for grouping in the editor. */
  category: 'vitals' | 'cycle' | 'symptoms' | 'recovery' | 'labs'
  /** Units rendered next to the value, if any. */
  unit?: string
}

export const FAVORITE_METRIC_DEFINITIONS: FavoriteMetricDefinition[] = [
  { id: 'standing_pulse', label: 'Standing pulse', category: 'vitals', unit: 'bpm' },
  { id: 'hrv', label: 'HRV', category: 'recovery', unit: 'ms' },
  { id: 'rhr', label: 'Resting HR', category: 'vitals', unit: 'bpm' },
  { id: 'body_temp', label: 'Body temp', category: 'vitals', unit: 'F' },
  { id: 'cycle_day', label: 'Cycle day', category: 'cycle' },
  { id: 'cycle_phase', label: 'Cycle phase', category: 'cycle' },
  { id: 'overall_pain', label: 'Overall pain', category: 'symptoms', unit: '/10' },
  { id: 'fatigue', label: 'Fatigue', category: 'symptoms', unit: '/10' },
  { id: 'sleep_score', label: 'Sleep score', category: 'recovery' },
  { id: 'readiness', label: 'Readiness', category: 'recovery' },
  { id: 'top_lab', label: 'Top lab value', category: 'labs' },
]

// --- stored shape ----------------------------------------------------------

export interface FavoriteItem {
  metric: FavoriteMetricId
  /** Optional rename the user can give for the home tile. */
  displayAs?: string
}

export interface FavoritesContent {
  items: FavoriteItem[]
}

export const MAX_FAVORITES = 6
export const HEALTH_PROFILE_SECTION = 'home_favorites'

// --- parsing ---------------------------------------------------------------

/**
 * Coerce whatever came back from health_profile.content into a safe list of
 * items. Drops anything we cannot recognize rather than throwing so a bad
 * row never bricks the home page.
 */
export function coerceFavorites(raw: unknown): FavoriteItem[] {
  const parsed = parseProfileContent(raw)
  if (!parsed || typeof parsed !== 'object') return []
  const maybeItems = (parsed as { items?: unknown }).items
  if (!Array.isArray(maybeItems)) return []

  const knownIds = new Set<string>(FAVORITE_METRIC_DEFINITIONS.map((m) => m.id))
  const seen = new Set<string>()
  const out: FavoriteItem[] = []

  for (const candidate of maybeItems) {
    if (!candidate || typeof candidate !== 'object') continue
    const metric = (candidate as { metric?: unknown }).metric
    if (typeof metric !== 'string' || !knownIds.has(metric)) continue
    if (seen.has(metric)) continue
    seen.add(metric)

    const item: FavoriteItem = { metric: metric as FavoriteMetricId }
    const displayAs = (candidate as { displayAs?: unknown }).displayAs
    if (typeof displayAs === 'string' && displayAs.trim().length > 0) {
      // Keep the rename short so it fits on a home tile.
      item.displayAs = displayAs.trim().slice(0, 24)
    }
    out.push(item)
    if (out.length >= MAX_FAVORITES) break
  }

  return out
}

// --- reads -----------------------------------------------------------------

/**
 * Return the current list of pinned metrics for Lanae. Resilient: a missing
 * row, a malformed row, or a Supabase hiccup all collapse to an empty array
 * so the home page's empty-state CTA kicks in.
 */
export async function getFavorites(): Promise<FavoriteItem[]> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('health_profile')
      .select('content')
      .eq('section', HEALTH_PROFILE_SECTION)
      .maybeSingle()

    if (error || !data) return []
    return coerceFavorites(data.content)
  } catch {
    return []
  }
}

// --- writes ----------------------------------------------------------------

/**
 * Replace the entire favorites list. Upserts into health_profile via the
 * same single-row-per-section shape every other EAV section uses.
 */
export async function setFavorites(items: FavoriteItem[]): Promise<{
  ok: true
  items: FavoriteItem[]
} | {
  ok: false
  error: string
}> {
  // Validate + normalize before touching the DB so callers get a fast fail
  // and we never write junk.
  const normalized = coerceFavorites({ items })
  if (items.length > MAX_FAVORITES) {
    return {
      ok: false,
      error: `Max ${MAX_FAVORITES} favorites allowed; got ${items.length}.`,
    }
  }

  try {
    const sb = createServiceClient()
    const { error } = await sb.from('health_profile').upsert(
      {
        section: HEALTH_PROFILE_SECTION,
        content: { items: normalized },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section' },
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true, items: normalized }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
