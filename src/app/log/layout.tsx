/**
 * /log layout.
 *
 * Exists purely to side-effect import src/lib/symptoms/home-widgets.ts
 * which registers the three Symptoms-tab widgets into the home grid.
 * Node module caching ensures a single registration even when both this
 * layout and /symptoms/layout.tsx import the module.
 */

import "@/lib/symptoms/home-widgets";

export default function LogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
