/**
 * Metadata for the home cards that were historically rendered inline in
 * src/app/page.tsx. Phase 0 keeps their data-fetching centralized in
 * page.tsx (fast parallel Promise.all) but exposes metadata here so the
 * customize sheet can enumerate them for toggle/reorder.
 *
 * Each entry MUST line up with a {id, element} pair that page.tsx
 * produces. If page.tsx stops rendering a widget, remove it here too.
 *
 * Phase 1+ (clone sessions): new widgets register via
 * registerWidget() in src/lib/home/widgets.ts, not here. This file is
 * only for the legacy inline-rendered cards.
 */

import type { NavTabId } from "@/lib/nav/config";

export interface LegacyWidgetMeta {
  id: string;
  label: string;
  category: NavTabId | "general";
  defaultEnabled: boolean;
  defaultOrder: number;
}

export const LEGACY_WIDGETS: readonly LegacyWidgetMeta[] = [
  // Banners / alerts -- always top of page
  { id: "health-alerts", label: "Health alerts", category: "general", defaultEnabled: true, defaultOrder: 10 },
  { id: "appointment-prep-nudge", label: "Appointment prep nudge", category: "doctor", defaultEnabled: true, defaultOrder: 20 },
  { id: "appointment-banner", label: "Next appointment", category: "doctor", defaultEnabled: true, defaultOrder: 30 },
  { id: "prn-effectiveness-poll", label: "PRN effectiveness polls", category: "symptoms", defaultEnabled: true, defaultOrder: 40 },

  // Primary dashboard strip
  { id: "quick-status-strip", label: "Today's status strip", category: "general", defaultEnabled: true, defaultOrder: 100 },
  { id: "favorites-strip", label: "Favorites strip", category: "general", defaultEnabled: true, defaultOrder: 110 },
  { id: "quick-actions", label: "Quick actions", category: "general", defaultEnabled: true, defaultOrder: 120 },

  // Morning signals + guidance
  { id: "morning-signal", label: "Morning signal", category: "sleep", defaultEnabled: true, defaultOrder: 200 },
  { id: "phase-guidance", label: "Cycle phase guidance", category: "cycle", defaultEnabled: true, defaultOrder: 210 },
  { id: "adaptive-movement", label: "Adaptive movement", category: "symptoms", defaultEnabled: true, defaultOrder: 220 },
  { id: "calorie-card", label: "Calories today", category: "calories", defaultEnabled: true, defaultOrder: 230 },

  // Intelligence / smart
  { id: "smart-cards", label: "Smart cards", category: "general", defaultEnabled: true, defaultOrder: 300 },
  { id: "baseline-card", label: "Baseline (28-day Oura)", category: "sleep", defaultEnabled: true, defaultOrder: 310 },
  { id: "weekly-digest", label: "Weekly digest", category: "general", defaultEnabled: true, defaultOrder: 320 },

  // Symptom grid + topic tiles
  { id: "quick-symptom-grid", label: "Quick symptom grid", category: "symptoms", defaultEnabled: true, defaultOrder: 400 },
  { id: "topics-grid", label: "Topics grid", category: "general", defaultEnabled: true, defaultOrder: 410 },

  // Longer views
  { id: "calendar-heatmap", label: "Calendar heatmap (month)", category: "general", defaultEnabled: true, defaultOrder: 500 },
  { id: "year-in-pixels", label: "Year in pixels (pain)", category: "symptoms", defaultEnabled: true, defaultOrder: 510 },
  { id: "data-completeness", label: "Data completeness", category: "general", defaultEnabled: true, defaultOrder: 600 },
];
