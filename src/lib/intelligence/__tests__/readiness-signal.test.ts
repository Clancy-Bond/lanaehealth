import { describe, it, expect } from 'vitest';
import {
  buildContributors,
  buildReadinessSignal,
  computeReadiness,
  topContributors,
  type OuraRow,
  type ReadinessInputs,
} from '../readiness-signal';

/**
 * These tests cover the pure logic only. The UI card has its own
 * rendering story. The computeReadiness() function is deliberately
 * covered at a shape level here (returns a number in 0-100 or null)
 * because Clancy is writing the actual weighted formula as a Learning
 * Mode contribution. When that formula lands, add value-specific
 * assertions below.
 */

function row(
  date: string,
  overrides: Partial<OuraRow> = {},
): OuraRow {
  return {
    date,
    hrv_avg: 40,
    resting_hr: 62,
    sleep_score: 80,
    body_temp_deviation: 0,
    respiratory_rate: 14.5,
    readiness_score: 75,
    ...overrides,
  };
}

describe('buildContributors', () => {
  it('returns one contributor per metric', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17'),
      trend: [row('2026-04-16'), row('2026-04-15'), row('2026-04-14')],
    };
    const c = buildContributors(inputs);
    expect(c.map((x) => x.id).sort()).toEqual(
      ['hrv', 'respiratory', 'rhr', 'sleep', 'temp'].sort(),
    );
  });

  it('marks missing metrics with direction=missing', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', { hrv_avg: null, resting_hr: null }),
      trend: [row('2026-04-16'), row('2026-04-15')],
    };
    const c = buildContributors(inputs);
    const hrv = c.find((x) => x.id === 'hrv');
    const rhr = c.find((x) => x.id === 'rhr');
    expect(hrv?.direction).toBe('missing');
    expect(rhr?.direction).toBe('missing');
  });

  it('flags a high HRV today as direction=up', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', { hrv_avg: 80 }),
      trend: [
        row('2026-04-16', { hrv_avg: 40 }),
        row('2026-04-15', { hrv_avg: 42 }),
        row('2026-04-14', { hrv_avg: 38 }),
        row('2026-04-13', { hrv_avg: 41 }),
      ],
    };
    const c = buildContributors(inputs);
    const hrv = c.find((x) => x.id === 'hrv');
    expect(hrv?.direction).toBe('up');
    expect((hrv?.zScore ?? 0)).toBeGreaterThan(0.5);
  });

  it('flags a low RHR today as direction=down', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', { resting_hr: 52 }),
      trend: [
        row('2026-04-16', { resting_hr: 63 }),
        row('2026-04-15', { resting_hr: 64 }),
        row('2026-04-14', { resting_hr: 61 }),
        row('2026-04-13', { resting_hr: 62 }),
      ],
    };
    const c = buildContributors(inputs);
    const rhr = c.find((x) => x.id === 'rhr');
    expect(rhr?.direction).toBe('down');
    expect((rhr?.zScore ?? 0)).toBeLessThan(-0.5);
  });
});

describe('topContributors', () => {
  it('sorts by absolute z-score desc and caps at n', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', {
        hrv_avg: 80, // big positive z
        resting_hr: 62, // near median -> small z
        body_temp_deviation: -0.8, // big negative z
      }),
      trend: [
        row('2026-04-16', { hrv_avg: 40, resting_hr: 62, body_temp_deviation: 0.0 }),
        row('2026-04-15', { hrv_avg: 41, resting_hr: 63, body_temp_deviation: 0.1 }),
        row('2026-04-14', { hrv_avg: 39, resting_hr: 61, body_temp_deviation: -0.1 }),
      ],
    };
    const c = buildContributors(inputs);
    const top2 = topContributors(c, 2);
    expect(top2).toHaveLength(2);
    const ids = top2.map((x) => x.id);
    expect(ids).toContain('hrv');
    expect(ids).toContain('temp');
  });
});

describe('computeReadiness (placeholder formula)', () => {
  it('returns null when fewer than 3 metrics have values', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', {
        hrv_avg: null,
        resting_hr: null,
        sleep_score: null,
      }),
      trend: [row('2026-04-16'), row('2026-04-15')],
    };
    const c = buildContributors(inputs);
    expect(computeReadiness(c)).toBeNull();
  });

  it('returns a number in 0-100 when metrics are present', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17'),
      trend: [
        row('2026-04-16', { hrv_avg: 42, resting_hr: 63, sleep_score: 78 }),
        row('2026-04-15', { hrv_avg: 39, resting_hr: 61, sleep_score: 82 }),
        row('2026-04-14', { hrv_avg: 41, resting_hr: 64, sleep_score: 79 }),
      ],
    };
    const c = buildContributors(inputs);
    const score = computeReadiness(c);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0);
    expect(score!).toBeLessThanOrEqual(100);
  });

  /**
   * When Clancy ships the real formula, uncomment this and pick the
   * inputs that reflect her clinical judgement. The test below just
   * shows the shape of a meaningful assertion.
   */
  it.skip('rates a clean high-HRV low-RHR day above 70', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', { hrv_avg: 70, resting_hr: 52, sleep_score: 90 }),
      trend: [
        row('2026-04-16', { hrv_avg: 40, resting_hr: 63, sleep_score: 75 }),
        row('2026-04-15', { hrv_avg: 41, resting_hr: 64, sleep_score: 78 }),
        row('2026-04-14', { hrv_avg: 39, resting_hr: 61, sleep_score: 80 }),
      ],
    };
    const c = buildContributors(inputs);
    expect(computeReadiness(c)!).toBeGreaterThan(70);
  });
});

describe('buildReadinessSignal', () => {
  it('falls back to oura readiness_score when our formula is null', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', {
        hrv_avg: null,
        resting_hr: null,
        sleep_score: null,
        readiness_score: 78,
      }),
      trend: [row('2026-04-16'), row('2026-04-15')],
    };
    const signal = buildReadinessSignal(inputs);
    expect(signal.score).toBe(78);
    expect(signal.source).toBe('oura');
  });

  it('sources from lanaehealth when we have enough data', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17'),
      trend: [
        row('2026-04-16', { hrv_avg: 42, resting_hr: 63, sleep_score: 78 }),
        row('2026-04-15', { hrv_avg: 39, resting_hr: 61, sleep_score: 82 }),
        row('2026-04-14', { hrv_avg: 41, resting_hr: 64, sleep_score: 79 }),
      ],
    };
    const signal = buildReadinessSignal(inputs);
    expect(signal.source).toBe('lanaehealth');
    expect(signal.score).not.toBeNull();
  });

  it('produces a narrative only when a contributor is up or down', () => {
    const flatInputs: ReadinessInputs = {
      today: row('2026-04-17'),
      trend: [
        row('2026-04-16', { hrv_avg: 40, resting_hr: 62 }),
        row('2026-04-15', { hrv_avg: 40, resting_hr: 62 }),
        row('2026-04-14', { hrv_avg: 40, resting_hr: 62 }),
      ],
    };
    const flat = buildReadinessSignal(flatInputs);
    expect(flat.narrative).toBeNull();

    const flaredInputs: ReadinessInputs = {
      today: row('2026-04-17', { hrv_avg: 20, resting_hr: 80 }),
      trend: [
        row('2026-04-16', { hrv_avg: 40, resting_hr: 62 }),
        row('2026-04-15', { hrv_avg: 41, resting_hr: 63 }),
        row('2026-04-14', { hrv_avg: 39, resting_hr: 61 }),
      ],
    };
    const flared = buildReadinessSignal(flaredInputs);
    expect(flared.narrative).not.toBeNull();
    expect(flared.narrative!.length).toBeGreaterThan(0);
  });
});
