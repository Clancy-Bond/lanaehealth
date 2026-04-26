/**
 * Layout wrapper for the Calories tab.
 *
 * The only job this file has today is the SIDE-EFFECT import of
 * src/lib/calories/home-widgets.ts, which registers the tab's three
 * home-grid widgets (calories-today-ring, macros-today,
 * weekly-calorie-delta) via registerWidget() on first evaluation.
 *
 * Why here: the shell contract in
 * docs/plans/2026-04-19-compartmentalized-ux-overhaul-design.md
 * dictates that each clone tab registers its widgets from its own
 * layout, not from a shared file - that keeps the four parallel
 * clones collision-free on merge.
 *
 * Phase-2 integrator note: if you want the widgets available on a
 * cold home-page request (before the user has visited /calories),
 * add the same side-effect import to src/app/layout.tsx. Our
 * registerOnce() wrapper already guards against duplicate-id throws
 * under HMR or repeated loads.
 */

// Side-effect import: registers the 3 calories home widgets.
import "@/lib/calories/home-widgets";

export default function CaloriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
