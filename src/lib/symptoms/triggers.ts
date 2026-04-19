/**
 * Trigger attribution logic for the Symptoms tab.
 *
 * Bearable reviewers complain that "trigger" attribution is opaque. This
 * module turns per-day logs into a ranked list of plausible triggers by
 * counting co-occurrence with symptom-days, weighted by how many days
 * contained the trigger. No stats magic here -- a full correlation
 * engine already exists in src/lib/intelligence. This is the cheap,
 * always-on counter used on Home and /patterns.
 */

import type { TriggerAttribution } from "./types";

interface FoodEntryRow {
  logged_at: string;
  food_items: string | null;
  flagged_triggers: string[] | null;
}

interface PainPointRow {
  logged_at: string;
  triggers: string[] | null;
}

interface SymptomDayRow {
  date: string;
  hasSymptom: boolean;
}

export interface TriggerInputs {
  foodEntries: FoodEntryRow[];
  painPoints: PainPointRow[];
  symptomDays: SymptomDayRow[];
}

function toDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Build a ranked trigger attribution list for the last windowDays days.
 * A trigger "counts" toward a symptom day when the trigger logged_at
 * falls on the same calendar day as a symptom-bearing daily log.
 */
export function attributeTriggers(
  inputs: TriggerInputs,
  windowDays = 14,
): TriggerAttribution[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const symptomByDate = new Map<string, boolean>();
  for (const d of inputs.symptomDays) {
    if (d.date >= cutoffIso) symptomByDate.set(d.date, d.hasSymptom);
  }

  const tally = new Map<
    string,
    {
      source: TriggerAttribution["source"];
      occurrences: number;
      linkedSymptomDays: Set<string>;
    }
  >();

  const bump = (
    label: string,
    source: TriggerAttribution["source"],
    date: string,
  ) => {
    const clean = label.trim();
    if (!clean) return;
    const normalized = clean.toLowerCase();
    const entry =
      tally.get(normalized) ??
      { source, occurrences: 0, linkedSymptomDays: new Set<string>() };
    entry.occurrences += 1;
    if (symptomByDate.get(date)) entry.linkedSymptomDays.add(date);
    tally.set(normalized, entry);
  };

  for (const f of inputs.foodEntries) {
    const d = toDate(f.logged_at);
    if (d < cutoffIso) continue;
    for (const t of f.flagged_triggers ?? []) bump(t, "food", d);
  }

  for (const p of inputs.painPoints) {
    const d = toDate(p.logged_at);
    if (d < cutoffIso) continue;
    for (const t of p.triggers ?? []) bump(t, "pain-trigger", d);
  }

  const results: TriggerAttribution[] = [];
  for (const [label, info] of tally.entries()) {
    results.push({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      source: info.source,
      occurrences: info.occurrences,
      linkedSymptomDays: info.linkedSymptomDays.size,
    });
  }

  results.sort((a, b) => {
    if (b.linkedSymptomDays !== a.linkedSymptomDays) {
      return b.linkedSymptomDays - a.linkedSymptomDays;
    }
    return b.occurrences - a.occurrences;
  });

  return results;
}
