/**
 * Renders every widget registered via registerWidget() (src/lib/home/widgets.ts).
 * Used as a trailing block on src/app/page.tsx so clone sessions can add new
 * widgets without editing page.tsx.
 *
 * Honors the user's hiddenHomeWidgets preference. Ordering follows each
 * widget's defaultOrder within the registry until a reorder UI ships.
 */

import { HOME_WIDGETS } from "@/lib/home/widgets";

export interface RegisteredWidgetsProps {
  date: string;
  hidden: readonly string[];
  explicitOrder: readonly string[];
}

export function RegisteredWidgets({
  date,
  hidden,
  explicitOrder,
}: RegisteredWidgetsProps) {
  const hiddenSet = new Set(hidden);
  const byId = new Map(HOME_WIDGETS.map((w) => [w.id, w]));
  const seen = new Set<string>();
  const ordered = [] as typeof HOME_WIDGETS[number][];

  for (const id of explicitOrder) {
    if (seen.has(id) || hiddenSet.has(id)) continue;
    const w = byId.get(id);
    if (w) {
      ordered.push(w);
      seen.add(id);
    }
  }
  const rest = [...HOME_WIDGETS]
    .filter((w) => !seen.has(w.id) && !hiddenSet.has(w.id) && w.defaultEnabled)
    .sort((a, b) => a.defaultOrder - b.defaultOrder);
  ordered.push(...rest);

  if (ordered.length === 0) return null;

  return (
    <div role="list" className="registered-widgets" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {ordered.map(({ id, Component }) => (
        <section key={id} role="listitem" data-widget-id={id}>
          <Component date={date} />
        </section>
      ))}
    </div>
  );
}
