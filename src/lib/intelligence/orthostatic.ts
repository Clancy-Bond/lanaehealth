/**
 * Orthostatic / POTS intelligence.
 *
 * Pure helpers for the Orthostatic topic page. Takes raw rows from
 * the orthostatic_tests table and returns the derived facts the UI
 * renders: latest test, diagnostic progress, 30-day trend, and
 * per-test classification.
 *
 * Diagnostic criterion (from 013_orthostatic_tests.sql comment):
 *   POTS diagnosis requires peak_rise_bpm >= 30 sustained for 10 min,
 *   with 3 positive tests on separate days at least 2 weeks apart.
 *
 * This lib does not diagnose. It tracks whether Lanae's own testing
 * is building toward or away from a clinical threshold her doctors
 * can use.
 */

const POTS_POSITIVE_THRESHOLD_BPM = 30;
const POTS_MIN_DAYS_BETWEEN_TESTS = 14;
const POTS_REQUIRED_POSITIVES = 3;

export interface OrthostaticTest {
  id: string;
  test_date: string; // YYYY-MM-DD
  test_time?: string | null;
  resting_hr_bpm: number;
  resting_bp_systolic: number | null;
  resting_bp_diastolic: number | null;
  standing_hr_1min: number | null;
  standing_hr_3min: number | null;
  standing_hr_5min: number | null;
  standing_hr_10min: number | null;
  standing_bp_systolic_10min: number | null;
  standing_bp_diastolic_10min: number | null;
  /** Server-computed: GREATEST(standing_hr_*) - resting_hr_bpm. */
  peak_rise_bpm: number | null;
  symptoms_experienced: string | null;
  notes: string | null;
  hydration_ml: number | null;
  caffeine_mg: number | null;
}

export type TestClassification =
  | 'positive' // peak rise >= 30
  | 'borderline' // 20-29
  | 'negative' // < 20
  | 'incomplete'; // missing peak_rise

export interface ClassifiedTest extends OrthostaticTest {
  classification: TestClassification;
}

export interface DiagnosticProgress {
  /** Positive tests that are far enough apart to count toward criteria. */
  qualifyingPositives: number;
  /** How many are still required. */
  remainingNeeded: number;
  /** Dates of the positives used for the count. */
  qualifyingDates: string[];
  /**
   * Soonest next-test date that, if positive, would qualify.
   * Null when already at the threshold.
   */
  earliestNextQualifyingDate: string | null;
}

export interface OrthostaticSummary {
  tests: ClassifiedTest[];
  latest: ClassifiedTest | null;
  diagnosticProgress: DiagnosticProgress;
  /** Median peak rise of the 30-day window, null if no tests. */
  median30dPeakRise: number | null;
  /** Count of positive tests in last 60 days. */
  positiveLast60Days: number;
}

// ────────────────────────────────────────────────────────────────────
// Classification
// ────────────────────────────────────────────────────────────────────

export function classifyTest(test: OrthostaticTest): TestClassification {
  if (test.peak_rise_bpm === null) return 'incomplete';
  if (test.peak_rise_bpm >= POTS_POSITIVE_THRESHOLD_BPM) return 'positive';
  if (test.peak_rise_bpm >= 20) return 'borderline';
  return 'negative';
}

// ────────────────────────────────────────────────────────────────────
// Diagnostic progress (3 positives at least 2 weeks apart)
// ────────────────────────────────────────────────────────────────────

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + 'T00:00:00').getTime();
  const b = new Date(isoB + 'T00:00:00').getTime();
  return Math.abs(Math.round((b - a) / 86400000));
}

/**
 * Greedy-select qualifying positives by date, requiring ≥14 days between
 * each. Returns up to REQUIRED_POSITIVES qualifying dates.
 */
export function computeDiagnosticProgress(
  classified: ClassifiedTest[],
): DiagnosticProgress {
  const positives = classified
    .filter((t) => t.classification === 'positive')
    .sort((a, b) => a.test_date.localeCompare(b.test_date));

  const qualifying: string[] = [];
  for (const t of positives) {
    if (qualifying.length === 0) {
      qualifying.push(t.test_date);
      continue;
    }
    const last = qualifying[qualifying.length - 1];
    if (daysBetween(t.test_date, last) >= POTS_MIN_DAYS_BETWEEN_TESTS) {
      qualifying.push(t.test_date);
    }
    if (qualifying.length === POTS_REQUIRED_POSITIVES) break;
  }

  const remainingNeeded = Math.max(
    0,
    POTS_REQUIRED_POSITIVES - qualifying.length,
  );

  // Earliest next date that would qualify: 14 days after the latest
  // qualifying positive (or today if we have zero).
  let earliestNextQualifyingDate: string | null = null;
  if (remainingNeeded > 0 && qualifying.length > 0) {
    const latest = new Date(
      qualifying[qualifying.length - 1] + 'T00:00:00',
    );
    latest.setDate(latest.getDate() + POTS_MIN_DAYS_BETWEEN_TESTS);
    earliestNextQualifyingDate = latest.toISOString().slice(0, 10);
  }

  return {
    qualifyingPositives: qualifying.length,
    remainingNeeded,
    qualifyingDates: qualifying,
    earliestNextQualifyingDate,
  };
}

// ────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 1
    ? clean[mid]
    : (clean[mid - 1] + clean[mid]) / 2;
}

function daysAgo(dateStr: string, today: string): number {
  return daysBetween(dateStr, today);
}

export function summarize(
  tests: OrthostaticTest[],
  today: string,
): OrthostaticSummary {
  const classified = tests.map((t) => ({
    ...t,
    classification: classifyTest(t),
  })) as ClassifiedTest[];

  // Sort newest first for UI consumption.
  classified.sort((a, b) => b.test_date.localeCompare(a.test_date));

  const latest = classified[0] ?? null;

  const window30 = classified.filter((t) => daysAgo(t.test_date, today) <= 30);
  const median30dPeakRise = median(
    window30
      .map((t) => t.peak_rise_bpm)
      .filter((v): v is number => v !== null),
  );

  const positiveLast60Days = classified.filter(
    (t) => t.classification === 'positive' && daysAgo(t.test_date, today) <= 60,
  ).length;

  const diagnosticProgress = computeDiagnosticProgress(classified);

  return {
    tests: classified,
    latest,
    diagnosticProgress,
    median30dPeakRise,
    positiveLast60Days,
  };
}

// Exported constants so other modules can reference the thresholds
// without copy-pasting magic numbers.
export const THRESHOLDS = {
  POSITIVE_BPM: POTS_POSITIVE_THRESHOLD_BPM,
  BORDERLINE_BPM: 20,
  MIN_DAYS_BETWEEN_QUALIFYING_TESTS: POTS_MIN_DAYS_BETWEEN_TESTS,
  REQUIRED_POSITIVES: POTS_REQUIRED_POSITIVES,
};
