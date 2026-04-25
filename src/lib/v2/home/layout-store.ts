/**
 * Per-user home layout persistence.
 *
 * The layout is a small JSON document stored under
 * `health_profile.section = 'home_layout'` with the user's
 * `user_id` scoping the row. Schema is additive: the existing
 * health_profile table already has section + content + user_id
 * columns, so no migration is needed.
 *
 * The shape:
 *
 *   {
 *     order: ['primary-insight', 'metric-strip', ...],
 *     hidden: ['oura-disconnect'],
 *     updated_at: '2026-04-24T13:14:00Z',
 *   }
 *
 * Multi-user safe: every read/write filters by user_id. If a
 * user has no saved layout, we return the default derived from
 * the widget registry.
 */
import { createServiceClient } from '@/lib/supabase'
import { buildWidgetRegistry, type HomeWidget } from './widget-registry'

export interface HomeLayout {
  order: string[]
  hidden: string[]
  updated_at: string
}

const SECTION = 'home_layout'

/**
 * Build the default layout for a user with no saved preferences.
 * Order follows the registry's default priority (highest first),
 * with non-hideable, non-reorderable widgets pinned to the top.
 */
export function defaultLayoutFromRegistry(widgets: HomeWidget[]): HomeLayout {
  const fixed = widgets.filter((w) => !w.canReorder).map((w) => w.id)
  const flexible = widgets
    .filter((w) => w.canReorder)
    .slice()
    .sort((a, b) => b.defaultPriority - a.defaultPriority)
    .map((w) => w.id)
  const hidden = widgets.filter((w) => !w.defaultVisible).map((w) => w.id)
  return {
    order: [...fixed, ...flexible],
    hidden,
    updated_at: new Date().toISOString(),
  }
}

/**
 * Returns the user's saved home layout, or the default layout
 * computed from the registry if no row exists yet.
 *
 * Never throws: a database error returns the default so a
 * broken read does not break the home screen.
 */
export async function getUserHomeLayout(userId: string | null | undefined): Promise<HomeLayout> {
  // We need an empty render-side registry to pull defaults; the
  // composer will pass real renderers, but for default ordering
  // only the metadata matters.
  const fallbackRegistry = buildWidgetRegistry({
    primaryInsight: null,
    metricStrip: null,
    homeAlerts: null,
    shortcuts: null,
    askAi: null,
  })
  const fallback = defaultLayoutFromRegistry(fallbackRegistry)

  if (!userId) return fallback

  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('health_profile')
      .select('content')
      .eq('section', SECTION)
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) return fallback

    const content = (data as { content: unknown }).content
    const parsed = parseLayoutContent(content)
    if (!parsed) return fallback

    // Merge: any widget the registry knows about but the saved
    // layout omits gets appended at the end so new releases
    // surface new widgets even for existing users.
    const known = new Set(fallbackRegistry.map((w) => w.id))
    const seen = new Set(parsed.order)
    const missing = fallbackRegistry
      .filter((w) => !seen.has(w.id))
      .sort((a, b) => b.defaultPriority - a.defaultPriority)
      .map((w) => w.id)

    return {
      order: [...parsed.order.filter((id) => known.has(id)), ...missing],
      hidden: parsed.hidden.filter((id) => known.has(id)),
      updated_at: parsed.updated_at,
    }
  } catch {
    return fallback
  }
}

/**
 * Persist the user's home layout. Upserts on (user_id, section).
 * Returns true on success, false otherwise. Never throws.
 */
export async function setUserHomeLayout(userId: string, layout: HomeLayout): Promise<boolean> {
  if (!userId) return false
  try {
    const sb = createServiceClient()
    const payload = {
      user_id: userId,
      section: SECTION,
      content: {
        order: layout.order,
        hidden: layout.hidden,
        updated_at: new Date().toISOString(),
      },
    }
    const { error } = await sb
      .from('health_profile')
      .upsert(payload, { onConflict: 'user_id,section' })
    return !error
  } catch {
    return false
  }
}

function parseLayoutContent(content: unknown): HomeLayout | null {
  if (!content || typeof content !== 'object') return null
  // Some Supabase JSONB columns return strings on certain drivers.
  let obj: Record<string, unknown>
  if (typeof content === 'string') {
    try {
      obj = JSON.parse(content) as Record<string, unknown>
    } catch {
      return null
    }
  } else {
    obj = content as Record<string, unknown>
  }
  const order = Array.isArray(obj.order) ? (obj.order.filter((x) => typeof x === 'string') as string[]) : null
  const hidden = Array.isArray(obj.hidden) ? (obj.hidden.filter((x) => typeof x === 'string') as string[]) : []
  const updated_at = typeof obj.updated_at === 'string' ? obj.updated_at : new Date().toISOString()
  if (!order) return null
  return { order, hidden, updated_at }
}
