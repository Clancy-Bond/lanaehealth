import { describe, it, expect } from 'vitest';
import {
  classifyTest,
  computeDiagnosticProgress,
  summarize,
  THRESHOLDS,
  type OrthostaticTest,
  type ClassifiedTest,
} from '../orthostatic';

function test(
  date: string,
  peak: number | null,
  overrides: Partial<OrthostaticTest> = {},
): OrthostaticTest {
  return {
    id: `t-${date}-${peak}`,
    test_date: date,
    resting_hr_bpm: 70,
    resting_bp_systolic: null,
    resting_bp_diastolic: null,
    standing_hr_1min: null,
    standing_hr_3min: null,
    standing_hr_5min: null,
    standing_hr_10min: null,
    standing_bp_systolic_10min: null,
    standing_bp_diastolic_10min: null,
    peak_rise_bpm: peak,
    symptoms_experienced: null,
    notes: null,
    hydration_ml: null,
    caffeine_mg: null,
    ...overrides,
  };
}

describe('classifyTest', () => {
  it('returns positive for peak rise >= 30', () => {
    expect(classifyTest(test('2026-04-01', 30))).toBe('positive');
    expect(classifyTest(test('2026-04-01', 45))).toBe('positive');
  });

  it('returns borderline for peak rise 20-29', () => {
    expect(classifyTest(test('2026-04-01', 20))).toBe('borderline');
    expect(classifyTest(test('2026-04-01', 29))).toBe('borderline');
  });

  it('returns negative for peak rise < 20', () => {
    expect(classifyTest(test('2026-04-01', 12))).toBe('negative');
  });

  it('returns incomplete when peak_rise_bpm is null', () => {
    expect(classifyTest(test('2026-04-01', null))).toBe('incomplete');
  });
});

describe('computeDiagnosticProgress', () => {
  function classify(tests: OrthostaticTest[]): ClassifiedTest[] {
    return tests.map((t) => ({ ...t, classification: classifyTest(t) }));
  }

  it('returns 0 qualifying positives when there are none', () => {
    const progress = computeDiagnosticProgress(
      classify([test('2026-04-01', 15), test('2026-04-15', 22)]),
    );
    expect(progress.qualifyingPositives).toBe(0);
    expect(progress.remainingNeeded).toBe(3);
  });

  it('counts only positives separated by at least 14 days', () => {
    const progress = computeDiagnosticProgress(
      classify([
        test('2026-04-01', 35), // first positive
        test('2026-04-05', 40), // too soon, does not count
        test('2026-04-16', 32), // 15 days later, counts
        test('2026-05-01', 38), // 15 days later, counts
      ]),
    );
    expect(progress.qualifyingPositives).toBe(3);
    expect(progress.remainingNeeded).toBe(0);
    expect(progress.qualifyingDates).toEqual([
      '2026-04-01',
      '2026-04-16',
      '2026-05-01',
    ]);
  });

  it('reports earliest next qualifying date when below threshold', () => {
    const progress = computeDiagnosticProgress(
      classify([test('2026-04-01', 35)]),
    );
    expect(progress.qualifyingPositives).toBe(1);
    expect(progress.remainingNeeded).toBe(2);
    expect(progress.earliestNextQualifyingDate).toBe('2026-04-15');
  });

  it('returns null earliestNextQualifyingDate when already at threshold', () => {
    const progress = computeDiagnosticProgress(
      classify([
        test('2026-04-01', 35),
        test('2026-04-16', 32),
        test('2026-05-01', 38),
      ]),
    );
    expect(progress.earliestNextQualifyingDate).toBeNull();
  });
});

describe('summarize', () => {
  it('returns latest test first in sort order', () => {
    const summary = summarize(
      [test('2026-04-01', 35), test('2026-04-16', 28), test('2026-03-15', 22)],
      '2026-04-17',
    );
    expect(summary.latest?.test_date).toBe('2026-04-16');
  });

  it('computes median peak rise over 30-day window only', () => {
    const summary = summarize(
      [
        test('2026-04-16', 30),
        test('2026-04-10', 40),
        test('2026-04-05', 20),
        test('2026-02-01', 100), // outside 30-day window
      ],
      '2026-04-17',
    );
    expect(summary.median30dPeakRise).toBe(30);
  });

  it('counts positives in last 60 days', () => {
    const summary = summarize(
      [
        test('2026-04-10', 35),
        test('2026-03-20', 40),
        test('2025-12-01', 50), // outside 60-day window
      ],
      '2026-04-17',
    );
    expect(summary.positiveLast60Days).toBe(2);
  });

  it('returns null median and zero positives when no tests', () => {
    const summary = summarize([], '2026-04-17');
    expect(summary.latest).toBeNull();
    expect(summary.median30dPeakRise).toBeNull();
    expect(summary.positiveLast60Days).toBe(0);
    expect(summary.diagnosticProgress.qualifyingPositives).toBe(0);
  });
});

describe('THRESHOLDS', () => {
  it('exports the canonical numbers so other modules do not copy magic', () => {
    expect(THRESHOLDS.POSITIVE_BPM).toBe(30);
    expect(THRESHOLDS.MIN_DAYS_BETWEEN_QUALIFYING_TESTS).toBe(14);
    expect(THRESHOLDS.REQUIRED_POSITIVES).toBe(3);
  });
});
