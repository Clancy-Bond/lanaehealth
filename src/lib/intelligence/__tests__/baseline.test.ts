import { describe, it, expect } from 'vitest';
import {
  percentile,
  computeBaseline,
  computeAllBaselines,
  formatRange,
  formatValue,
  copyForResult,
  MIN_BASELINE_SAMPLES,
  type DailyRow,
} from '@/lib/intelligence/baseline';

/**
 * Pure-function tests. The baseline module is intentionally IO-free so
 * we can cover its full contract without touching Supabase.
 */

describe('percentile', () => {
  it('returns null for empty input', () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it('returns the single value for a one-element array', () => {
    expect(percentile([42], 0.25)).toBe(42);
  });

  it('returns the midpoint for median of even-length array', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 6);
  });

  it('interpolates linearly between adjacent points', () => {
    // Known value: 25th percentile of [1, 2, 3, 4] by linear interp is 1.75
    expect(percentile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 6);
  });

  it('clamps percentile into [0, 1]', () => {
    expect(percentile([1, 2, 3, 4], -0.5)).toBe(1);
    expect(percentile([1, 2, 3, 4], 2)).toBe(4);
  });
});

describe('computeBaseline', () => {
  it('flags insufficient when below minimum samples', () => {
    const result = computeBaseline('resting_hr', [50, 51, 52], 55);
    expect(result.flag).toBe('insufficient');
    expect(result.sampleSize).toBe(3);
    expect(result.median).toBeNull();
  });

  it('emits normal when today sits inside the IQR fence', () => {
    // Tight distribution: median 50, IQR small, today right in the middle.
    const values = [48, 49, 49, 50, 50, 50, 51, 51, 52];
    expect(values.length).toBeGreaterThanOrEqual(MIN_BASELINE_SAMPLES);
    const result = computeBaseline('resting_hr', values, 50);
    expect(result.flag).toBe('normal');
    expect(result.median).toBe(50);
  });

  it('emits higher when today is above the upper fence', () => {
    const values = [48, 49, 49, 50, 50, 50, 51, 51, 52];
    const result = computeBaseline('resting_hr', values, 80);
    expect(result.flag).toBe('higher');
    expect(result.today).toBe(80);
  });

  it('emits lower when today is below the lower fence', () => {
    const values = [48, 49, 49, 50, 50, 50, 51, 51, 52];
    const result = computeBaseline('resting_hr', values, 30);
    expect(result.flag).toBe('lower');
  });

  it('emits no_today when today is null even with a full window', () => {
    const values = [48, 49, 49, 50, 50, 50, 51, 51, 52];
    const result = computeBaseline('resting_hr', values, null);
    expect(result.flag).toBe('no_today');
    expect(result.median).not.toBeNull();
  });

  it('ignores non-finite values in the window', () => {
    const values = [48, 49, 49, 50, 50, 50, 51, 51, 52, NaN, Infinity];
    const result = computeBaseline('resting_hr', values, 50);
    expect(result.flag).toBe('normal');
    expect(result.sampleSize).toBe(9);
  });
});

describe('computeAllBaselines', () => {
  function row(date: string, over: Partial<DailyRow> = {}): DailyRow {
    return {
      date,
      resting_hr: null,
      hrv_avg: null,
      body_temp_deviation: null,
      respiratory_rate: null,
      ...over,
    };
  }

  it('produces exactly four metric results in stable order', () => {
    const results = computeAllBaselines([], null);
    expect(results.map((r) => r.metric)).toEqual([
      'resting_hr',
      'hrv_avg',
      'body_temp_deviation',
      'respiratory_rate',
    ]);
  });

  it('computes per-metric baselines independently', () => {
    const window: DailyRow[] = Array.from({ length: 28 }, (_, i) =>
      row(`2026-03-${String(i + 1).padStart(2, '0')}`, {
        resting_hr: 50 + (i % 3),
        hrv_avg: 40 + (i % 4),
        body_temp_deviation: 0.1,
        respiratory_rate: 14,
      }),
    );
    const today = row('2026-04-17', {
      resting_hr: 90,
      hrv_avg: 42,
      body_temp_deviation: 0.1,
      respiratory_rate: 14,
    });
    const results = computeAllBaselines(window, today);
    const rhr = results.find((r) => r.metric === 'resting_hr');
    const hrv = results.find((r) => r.metric === 'hrv_avg');
    expect(rhr?.flag).toBe('higher');
    expect(hrv?.flag).toBe('normal');
  });

  it('reports no_today when today row lacks the metric', () => {
    const window: DailyRow[] = Array.from({ length: 14 }, (_, i) =>
      row(`2026-03-${String(i + 1).padStart(2, '0')}`, { resting_hr: 50 + (i % 3) }),
    );
    const today = row('2026-04-17', { resting_hr: null });
    const results = computeAllBaselines(window, today);
    const rhr = results.find((r) => r.metric === 'resting_hr');
    expect(rhr?.flag).toBe('no_today');
  });
});

describe('formatting helpers', () => {
  it('formats the usual range as "X to Y" with metric-aware precision', () => {
    expect(formatRange('resting_hr', 48.4, 55.6)).toBe('48 to 56');
    expect(formatRange('body_temp_deviation', -0.12, 0.23)).toBe('-0.1 to 0.2');
  });

  it('formats a single value using metric precision', () => {
    expect(formatValue('resting_hr', 51.7)).toBe('52');
    expect(formatValue('body_temp_deviation', 0.27)).toBe('0.3');
    expect(formatValue('hrv_avg', 42.6)).toBe('43');
    expect(formatValue('respiratory_rate', 14.27)).toBe('14.3');
    expect(formatValue('resting_hr', null)).toBe('--');
  });

  it('emits double-dash when inputs are null', () => {
    expect(formatRange('hrv_avg', null, 60)).toBe('--');
  });

  it('copy is never diagnostic and never empty for actionable flags', () => {
    const higher = copyForResult({
      metric: 'resting_hr',
      today: 80,
      median: 50,
      q1: 48,
      q3: 52,
      lowerFence: 42,
      upperFence: 58,
      sampleSize: 28,
      flag: 'higher',
    });
    expect(higher.length).toBeGreaterThan(0);
    // Guardrails: no diagnostic language
    const forbidden = [
      'elevated',
      'abnormal',
      'sick',
      'ill',
      'concerning',
      'dangerous',
      'diagnosis',
      'symptom',
    ];
    for (const word of forbidden) {
      expect(higher.toLowerCase()).not.toContain(word);
    }
  });

  it('copy is empty for non-actionable flags', () => {
    const res = copyForResult({
      metric: 'resting_hr',
      today: null,
      median: null,
      q1: null,
      q3: null,
      lowerFence: null,
      upperFence: null,
      sampleSize: 0,
      flag: 'insufficient',
    });
    expect(res).toBe('');
  });
});
