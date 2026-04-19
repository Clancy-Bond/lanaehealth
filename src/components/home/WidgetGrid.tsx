/**
 * WidgetGrid -- renders the home page's widget list in user-chosen
 * order, skipping widgets the user has hidden.
 *
 * page.tsx builds inlineWidgets from the data it fetched in parallel,
 * and HOME_WIDGETS (populated by registerWidget in clone code) provides
 * additional self-contained server-component widgets. Both are merged,
 * then resolved against prefs.
 */

import type { ReactNode } from "react";
import { HOME_WIDGETS } from "@/lib/home/widgets";
import { LEGACY_WIDGETS } from "@/lib/home/legacy-widgets";

export interface InlineWidget {
  id: string;
  element: ReactNode;
}

export interface WidgetGridProps {
  inlineWidgets: InlineWidget[];
  explicitOrder: readonly string[];
  hidden: readonly string[];
  date: string;
}

export function WidgetGrid({
  inlineWidgets,
  explicitOrder,
  hidden,
  date,
}: WidgetGridProps) {
  const inlineById = new Map(inlineWidgets.map((w) => [w.id, w]));
  const registeredById = new Map(HOME_WIDGETS.map((w) => [w.id, w]));

  const hiddenSet = new Set(hidden);
  const seen = new Set<string>();
  const ordered: ReactNode[] = [];

  const pushById = (id: string) => {
    if (seen.has(id) || hiddenSet.has(id)) return;
    const inline = inlineById.get(id);
    if (inline) {
      ordered.push(
        <section
          key={inline.id}
          role="listitem"
          data-widget-id={inline.id}
          className="widget-slot"
        >
          {inline.element}
        </section>,
      );
      seen.add(id);
      return;
    }
    const registered = registeredById.get(id);
    if (registered) {
      const { Component } = registered;
      ordered.push(
        <section
          key={registered.id}
          role="listitem"
          data-widget-id={registered.id}
          className="widget-slot"
        >
          <Component date={date} />
        </section>,
      );
      seen.add(id);
    }
  };

  for (const id of explicitOrder) pushById(id);

  // Default order for legacy widgets first (matches historical home),
  // then registered widgets, each filtered by defaultEnabled.
  const legacyDefault = [...LEGACY_WIDGETS]
    .filter((w) => w.defaultEnabled)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
  for (const meta of legacyDefault) pushById(meta.id);

  const registeredDefault = [...HOME_WIDGETS]
    .filter((w) => w.defaultEnabled)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
  for (const w of registeredDefault) pushById(w.id);

  return (
    <div className="widget-grid" role="list">
      {ordered}
    </div>
  );
}
