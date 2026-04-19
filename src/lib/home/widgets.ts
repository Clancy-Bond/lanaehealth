/**
 * Home widget registry.
 *
 * Each home widget registers itself via registerWidget(). The widget
 * grid on src/app/page.tsx reads HOME_WIDGETS, applies per-user
 * order/hidden preferences, and renders the resulting list.
 *
 * Clone sessions (calories/cycle/symptoms/sleep) add their widgets by
 * importing registerWidget in their own registration file -- they do
 * NOT edit this file directly beyond that side-effect import.
 */

import type { ComponentType } from "react";
import type { NavTabId } from "@/lib/nav/config";

export interface HomeWidgetContext {
  /** Today in YYYY-MM-DD, server-computed so SSR matches client. */
  date: string;
}

export interface HomeWidget {
  /** Stable id. Used as the React key and persisted in user prefs. */
  id: string;
  /** User-facing label for the customize sheet. */
  label: string;
  /** Which clone tab owns this widget, for the customize sheet grouping. */
  category: NavTabId | "general";
  /** Whether the widget is on for a brand-new user with no prefs. */
  defaultEnabled: boolean;
  /** Ascending order among widgets with the same category; gaps allowed. */
  defaultOrder: number;
  /** The server component that renders the widget body. */
  Component: ComponentType<HomeWidgetContext>;
}

const REGISTRY: HomeWidget[] = [];
const REGISTERED_IDS = new Set<string>();

export function registerWidget(widget: HomeWidget): void {
  if (REGISTERED_IDS.has(widget.id)) {
    throw new Error(`Duplicate home widget id: ${widget.id}`);
  }
  REGISTERED_IDS.add(widget.id);
  REGISTRY.push(widget);
}

export const HOME_WIDGETS: readonly HomeWidget[] = REGISTRY;

export interface ResolveOpts {
  /** User-chosen order of widget ids. Ids not listed fall through to defaults. */
  explicitOrder: readonly string[];
  /** Widget ids the user has hidden. */
  hidden: readonly string[];
}

/**
 * Given a user's preferences, produce the ordered list of widgets to
 * render on home. User-ordered widgets come first (in their order),
 * then the remaining default-enabled widgets sorted by defaultOrder.
 * Hidden widgets are filtered out in both passes.
 */
export function resolveWidgetOrder(opts: ResolveOpts): HomeWidget[] {
  const byId = new Map(REGISTRY.map((w) => [w.id, w]));
  const hidden = new Set(opts.hidden);
  const seen = new Set<string>();
  const ordered: HomeWidget[] = [];

  for (const id of opts.explicitOrder) {
    if (seen.has(id) || hidden.has(id)) continue;
    const w = byId.get(id);
    if (w) {
      ordered.push(w);
      seen.add(id);
    }
  }

  const rest = REGISTRY.filter(
    (w) => !seen.has(w.id) && !hidden.has(w.id) && w.defaultEnabled,
  ).sort((a, b) => a.defaultOrder - b.defaultOrder);

  return [...ordered, ...rest];
}

/**
 * Test helper: reset the registry between tests. Not exported publicly
 * so production code can't call it.
 */
export function __resetRegistryForTests(): void {
  REGISTRY.length = 0;
  REGISTERED_IDS.clear();
}
