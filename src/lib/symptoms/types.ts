/**
 * Shared types for the Symptoms tab (Bearable-clone build).
 *
 * The canonical Symptom row lives in src/lib/types.ts. These types model
 * view-level shapes we use repeatedly in the Symptoms tab so we don't
 * re-derive them in every component.
 */

import type { Severity, SymptomCategory } from "@/lib/types";

/** A single symptom entry for the carousel: category + label + severity + exact timestamp. */
export interface SymptomEntryView {
  id: string;
  category: SymptomCategory;
  symptom: string;
  severity: Severity | null;
  loggedAt: string;
}

/** One day of aggregate pain signal used by the 7-day sparkline widget. */
export interface PainDayPoint {
  date: string;
  overallPain: number | null;
  fatigue: number | null;
}

/** Bearable-style trigger attribution used by the top-triggers widget. */
export interface TriggerAttribution {
  label: string;
  source: "food" | "symptom" | "medication" | "pain-trigger";
  occurrences: number;
  linkedSymptomDays: number;
}

/** A pill definition in the /log carousel. */
export interface SymptomPillDef {
  id: string;
  category: SymptomCategory;
  symptom: string;
  icon: string;
}

/** Default pill library used for first-time users with no custom trackables yet. */
export const DEFAULT_PILLS: readonly SymptomPillDef[] = [
  { id: "p-headache", category: "physical", symptom: "Headache", icon: "🤕" },
  { id: "p-fatigue", category: "physical", symptom: "Fatigue", icon: "🥱" },
  { id: "p-dizziness", category: "physical", symptom: "Dizziness", icon: "😵‍💫" },
  { id: "p-nausea", category: "digestive", symptom: "Nausea", icon: "🤢" },
  { id: "p-bloating", category: "digestive", symptom: "Bloating", icon: "🎈" },
  { id: "p-cramps", category: "menstrual", symptom: "Cramps", icon: "🩸" },
  { id: "p-anxiety", category: "mental", symptom: "Anxiety", icon: "💭" },
  { id: "p-brain-fog", category: "mental", symptom: "Brain fog", icon: "🌫️" },
  { id: "p-joint-pain", category: "physical", symptom: "Joint pain", icon: "🦴" },
  { id: "p-back-pain", category: "physical", symptom: "Back pain", icon: "🫥" },
  { id: "p-urinary", category: "urinary", symptom: "Urinary urgency", icon: "💧" },
  { id: "p-insomnia", category: "physical", symptom: "Insomnia", icon: "🌙" },
] as const;
