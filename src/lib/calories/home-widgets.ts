/**
 * Home-widget registration for the Calories tab.
 *
 * This file is a one-time SIDE-EFFECT import. The tab layout imports
 * it so the three widgets are registered exactly once when a page
 * under /calories is first rendered. Do not import from elsewhere.
 *
 * Each widget is a React server component accepting HomeWidgetContext
 * ({ date }). They render inside <RegisteredWidgets /> on the home
 * page, after the legacy inline cards. Home's Customize sheet lists
 * them under the "calories" category.
 *
 * The legacy "calorie-card" stays registered separately in
 * src/lib/home/legacy-widgets.ts. Users can toggle either or both on
 * or off from the Customize sheet; we don't force an upgrade path.
 */

import { registerWidget } from "@/lib/home/widgets";
import { CaloriesTodayRing } from "@/components/calories/home/CaloriesTodayRing";
import { MacrosToday } from "@/components/calories/home/MacrosToday";
import { WeeklyCalorieDelta } from "@/components/calories/home/WeeklyCalorieDelta";

// Guard against double-registration if this module is evaluated twice
// in development (HMR) or under Jest. registerWidget throws on duplicate
// ids; catching silently keeps the user-facing home working.
function registerOnce<P extends { id: string }>(descriptor: P, register: (d: P) => void) {
  try {
    register(descriptor);
  } catch (err) {
    if (err instanceof Error && /Duplicate home widget id/.test(err.message)) {
      return;
    }
    throw err;
  }
}

registerOnce(
  {
    id: "calories-today-ring",
    label: "Calories today (ring)",
    category: "calories" as const,
    defaultEnabled: true,
    defaultOrder: 240,
    Component: CaloriesTodayRing,
  },
  registerWidget,
);

registerOnce(
  {
    id: "macros-today",
    label: "Macros today",
    category: "calories" as const,
    defaultEnabled: true,
    defaultOrder: 250,
    Component: MacrosToday,
  },
  registerWidget,
);

registerOnce(
  {
    id: "weekly-calorie-delta",
    label: "Weekly calorie delta",
    category: "calories" as const,
    defaultEnabled: true,
    defaultOrder: 260,
    Component: WeeklyCalorieDelta,
  },
  registerWidget,
);
