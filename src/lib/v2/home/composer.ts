/**
 * Home layout composer.
 *
 * Merges the registry, the user's saved layout, and the live
 * HomeContext into an ordered list of widgets to render.
 *
 * Algorithm:
 *   1. Start with the user's saved order.
 *   2. Drop any widget the user has hidden.
 *   3. Run each remaining widget's condition function.
 *   4. Sort: elevated widgets first by elevation priority,
 *      then unelevated widgets in the user's saved order.
 *   5. Pinned widgets (canReorder=false) always come at the
 *      very top regardless of elevation, so the daily anchor
 *      and red-flag banner are never pushed below another card.
 */
import type { HomeContext } from '@/lib/v2/load-home-context'
import type { HomeLayout } from './layout-store'
import type { HomeWidget, ElevationResult } from './widget-registry'

export interface ComposedWidget {
  widget: HomeWidget
  /** Final elevation result; { elevate:false } when not bubbled. */
  elevation: ElevationResult
  /** True when the user has not customized this widget. */
  isDefault: boolean
}

export function composeHomeLayout(
  registry: HomeWidget[],
  layout: HomeLayout,
  ctx: HomeContext,
): ComposedWidget[] {
  const byId = new Map(registry.map((w) => [w.id, w]))
  const hidden = new Set(layout.hidden)

  // Pinned widgets: always at the top, in registry order.
  const pinned: ComposedWidget[] = registry
    .filter((w) => !w.canReorder)
    .map((w) => ({
      widget: w,
      elevation: w.conditions ? w.conditions(ctx) : { elevate: false, priority: 0, reason: '' },
      isDefault: !layout.order.includes(w.id),
    }))

  // Flexible widgets: the user has authority over order, but
  // elevation still applies on top.
  const flexibleIds = layout.order.filter((id) => {
    if (hidden.has(id)) return false
    const w = byId.get(id)
    return w !== undefined && w.canReorder
  })

  const flexible: ComposedWidget[] = flexibleIds
    .map((id) => byId.get(id)!)
    .map((w) => ({
      widget: w,
      elevation: w.conditions ? w.conditions(ctx) : { elevate: false, priority: 0, reason: '' },
      isDefault: false,
    }))

  // Stable sort: elevated first by descending priority, then
  // unelevated in the user's saved order.
  const elevated = flexible
    .filter((c) => c.elevation.elevate)
    .sort((a, b) => b.elevation.priority - a.elevation.priority)

  const normal = flexible.filter((c) => !c.elevation.elevate)

  return [...pinned, ...elevated, ...normal]
}

/**
 * Returns the list of widgets the user has hidden, paired with
 * their registry metadata. Used by the "More" sheet on the home
 * screen so hidden widgets remain reachable.
 */
export function listHiddenWidgets(
  registry: HomeWidget[],
  layout: HomeLayout,
): HomeWidget[] {
  const hidden = new Set(layout.hidden)
  return registry.filter((w) => hidden.has(w.id) && w.canHide)
}
