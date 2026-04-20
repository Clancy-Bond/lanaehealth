/**
 * Side-effect registration of the three Symptoms-tab home widgets.
 *
 * Imported once from src/app/log/layout.tsx and src/app/symptoms/layout.tsx.
 * Node module caching ensures the registerWidget calls run only once per
 * process; importing from multiple layouts is safe.
 *
 * Widgets registered here:
 *   - "today-symptom-grid"    Quick pill grid for same-day logging
 *   - "pain-7day-sparkline"   7-day overall-pain bar chart
 *   - "top-triggers-this-week" Ranked co-occurrence list, last 14 days
 *
 * Contract: these widgets must render cheaply and handle missing data
 * without throwing. They should not block the home render if a table
 * is empty or a migration is pending.
 */

import { registerWidget } from "@/lib/home/widgets";
import TodaySymptomGrid from "@/components/symptoms/widgets/TodaySymptomGrid";
import Pain7dSparkline from "@/components/symptoms/widgets/Pain7dSparkline";
import TopTriggersCard from "@/components/symptoms/widgets/TopTriggersCard";

let registered = false;
export function ensureSymptomWidgets(): void {
  if (registered) return;
  registered = true;

  registerWidget({
    id: "today-symptom-grid",
    label: "Today symptom grid",
    category: "symptoms",
    defaultEnabled: true,
    defaultOrder: 415,
    Component: TodaySymptomGrid,
  });

  registerWidget({
    id: "pain-7day-sparkline",
    label: "Pain this week",
    category: "symptoms",
    defaultEnabled: true,
    defaultOrder: 420,
    Component: Pain7dSparkline,
  });

  registerWidget({
    id: "top-triggers-this-week",
    label: "Top triggers this week",
    category: "symptoms",
    defaultEnabled: true,
    defaultOrder: 425,
    Component: TopTriggersCard,
  });
}

ensureSymptomWidgets();
