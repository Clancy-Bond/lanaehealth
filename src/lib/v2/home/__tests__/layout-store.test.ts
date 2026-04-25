/**
 * layout-store tests.
 *
 * Verify default-layout derivation and the merge semantics that
 * keep saved layouts in sync with new widgets the registry adds.
 */
import { describe, expect, it } from 'vitest'
import { buildWidgetRegistry } from '../widget-registry'
import { defaultLayoutFromRegistry } from '../layout-store'

const RENDERERS = {
  primaryInsight: null,
  metricStrip: null,
  homeAlerts: null,
  shortcuts: null,
  askAi: null,
}

describe('defaultLayoutFromRegistry', () => {
  it('puts non-reorderable widgets at the top of the order', () => {
    const registry = buildWidgetRegistry(RENDERERS)
    const layout = defaultLayoutFromRegistry(registry)
    expect(layout.order[0]).toBe('primary-insight')
    expect(layout.order[1]).toBe('red-flag-banner')
  })

  it('hides widgets that have defaultVisible:false', () => {
    const registry = buildWidgetRegistry(RENDERERS)
    const layout = defaultLayoutFromRegistry(registry)
    expect(layout.hidden).toContain('oura-disconnect')
    expect(layout.hidden).toContain('missed-log-streak')
  })

  it('orders flexible widgets by descending defaultPriority', () => {
    const registry = buildWidgetRegistry(RENDERERS)
    const layout = defaultLayoutFromRegistry(registry)
    const flexible = layout.order.slice(2) // after the two pinned
    const flexRegistry = registry.filter((w) => w.canReorder)
    const byId = new Map(flexRegistry.map((w) => [w.id, w]))
    for (let i = 0; i < flexible.length - 1; i++) {
      const a = byId.get(flexible[i])!.defaultPriority
      const b = byId.get(flexible[i + 1])!.defaultPriority
      expect(a).toBeGreaterThanOrEqual(b)
    }
  })

  it('includes every widget in either order or hidden', () => {
    const registry = buildWidgetRegistry(RENDERERS)
    const layout = defaultLayoutFromRegistry(registry)
    for (const w of registry) {
      const present = layout.order.includes(w.id)
      // hidden is independent of order: a hidden default widget is
      // still in `order` so the editor knows where to place it.
      expect(present).toBe(true)
    }
  })
})
