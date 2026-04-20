/**
 * Trigger-vs-symptom correlation view for /patterns/symptoms.
 *
 * This is intentionally cheaper than the full Spearman + FDR pipeline in
 * src/lib/intelligence. It is a co-occurrence heatmap: for each
 * (trigger, symptom-type) pair we count how many days contained both
 * inside the window, divided by the number of days containing the
 * trigger. The result is a conditional-probability view the user can
 * scan at a glance. The narrative line includes the sample size so
 * nothing is over-claimed.
 */

import { format, subDays } from "date-fns";

interface DayBundle {
  date: string;
  triggers: Set<string>;
  symptoms: Set<string>;
}

export interface CellInput {
  /** Daily food/pain entries expanded to day-level triggers. */
  triggersByDate: Map<string, Set<string>>;
  /** Daily symptom labels (lower-cased). */
  symptomsByDate: Map<string, Set<string>>;
  /** The list of dates to consider. */
  dateRange: string[];
}

export interface CorrelationCell {
  trigger: string;
  symptom: string;
  daysWithTrigger: number;
  daysWithBoth: number;
  coOccurrenceRate: number;
  sampleSize: number;
}

export function buildCorrelationGrid(input: CellInput): CorrelationCell[] {
  const bundles: DayBundle[] = input.dateRange.map((d) => ({
    date: d,
    triggers: input.triggersByDate.get(d) ?? new Set(),
    symptoms: input.symptomsByDate.get(d) ?? new Set(),
  }));

  const triggerSet = new Set<string>();
  const symptomSet = new Set<string>();
  for (const b of bundles) {
    b.triggers.forEach((t) => triggerSet.add(t));
    b.symptoms.forEach((s) => symptomSet.add(s));
  }

  const out: CorrelationCell[] = [];
  for (const trigger of triggerSet) {
    for (const symptom of symptomSet) {
      let daysWithTrigger = 0;
      let daysWithBoth = 0;
      for (const b of bundles) {
        const hasT = b.triggers.has(trigger);
        const hasS = b.symptoms.has(symptom);
        if (hasT) {
          daysWithTrigger += 1;
          if (hasS) daysWithBoth += 1;
        }
      }
      if (daysWithTrigger === 0) continue;
      out.push({
        trigger,
        symptom,
        daysWithTrigger,
        daysWithBoth,
        coOccurrenceRate: daysWithBoth / daysWithTrigger,
        sampleSize: bundles.length,
      });
    }
  }

  out.sort((a, b) => {
    if (b.coOccurrenceRate !== a.coOccurrenceRate) {
      return b.coOccurrenceRate - a.coOccurrenceRate;
    }
    return b.daysWithBoth - a.daysWithBoth;
  });

  return out;
}

export function buildDateRange(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
  }
  return out;
}
