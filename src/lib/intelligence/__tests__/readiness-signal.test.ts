import { describe, it, expect } from 'vitest';
import {
  buildContributors,
  buildReadinessSignal,
  topContributors,
  type OuraRow,
  type OuraContributors,
  type ReadinessInputs,
} from '../readiness-signal';

/**
 * These tests verify the Oura pass-through. We do NOT reinvent
 * Oura's score; we render the contributors Oura already returns and
 * layer a direction arrow from our 7-day median comparison.
 */

function contribs(overrides: Partial<OuraContributors> = {}): OuraContributors {
  return {
    activity_balance: 80,
    body_temperature: 95,
    hrv_balance: 70,
    previous_day_activity: 75,
    previous_night: 85,
    recovery_index: 90,
    resting_heart_rate: 80,
    sleep_balance: 72,
    ...overrides,
  };
}

function row(
  date: string,
  overrides: Partial<OuraRow> = {},
  contribOverrides?: Partial<OuraContributors>,
): OuraRow {
  return {
    date,
    hrv_avg: 40,
    resting_hr: 62,
    sleep_score: 80,
    body_temp_deviation: 0,
    respiratory_rate: 14.5,
    readiness_score: 78,
    raw_json: {
      oura: {
        readiness: {
          score: 78,
          temperature_deviation: 0.1,
          contributors: contribs(contribOverrides),
        },
      },
    },
    ...overrides,
  };
}

describe('buildContributors', () => {
  it('returns all 8 Oura contributors in display order', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17'),
      trend: [row('2026-04-16'), row('2026-04-15'), row('2026-04-14')],
    };
    const c = buildContributors(inputs);
    expect(c).toHaveLength(8);
    expect(c[0].id).toBe('hrv_balance');
    expect(c[1].id).toBe('resting_heart_rate');
  });

  it('pulls the Oura sub-score directly', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', {}, { hrv_balance: 88 }),
      trend: [row('2026-04-16'), row('2026-04-15'), row('2026-04-14')],
    };
    const c = buildContributors(inputs);
    const hrv = c.find((x) => x.id === 'hrv_balance');
    expect(hrv?.score).toBe(88);
  });

  it('marks direction=up when today is >5 above 7-day median', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', {}, { sleep_balance: 90 }),
      trend: [
        row('2026-04-16', {}, { sleep_balance: 70 }),
        row('2026-04-15', {}, { sleep_balance: 72 }),
        row('2026-04-14', {}, { sleep_balance: 68 }),
      ],
    };
    const c = buildContributors(inputs);
    const sleep = c.find((x) => x.id === 'sleep_balance');
    expect(sleep?.direction).toBe('up');
  });

  it('marks direction=down when today is >5 below 7-day median', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', {}, { recovery_index: 60 }),
      trend: [
        row('2026-04-16', {}, { recovery_index: 85 }),
        row('2026-04-15', {}, { recovery_index: 90 }),
        row('2026-04-14', {}, { recovery_index: 88 }),
      ],
    };
    const c = buildContributors(inputs);
    const recovery = c.find((x) => x.id === 'recovery_index');
    expect(recovery?.direction).toBe('down');
  });

  it('marks direction=flat when today is within 5 of median', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', {}, { hrv_balance: 72 }),
      trend: [
        row('2026-04-16', {}, { hrv_balance: 70 }),
        row('2026-04-15', {}, { hrv_balance: 72 }),
        row('2026-04-14', {}, { hrv_balance: 73 }),
      ],
    };
    const c = buildContributors(inputs);
    const hrv = c.find((x) => x.id === 'hrv_balance');
    expect(hrv?.direction).toBe('flat');
  });

  it('marks missing metrics with direction=missing', () => {
    const today = row('2026-04-17', {}, { hrv_balance: null });
    const inputs: ReadinessInputs = {
      today,
      trend: [row('2026-04-16'), row('2026-04-15'), row('2026-04-14')],
    };
    const c = buildContributors(inputs);
    const hrv = c.find((x) => x.id === 'hrv_balance');
    expect(hrv?.direction).toBe('missing');
    expect(hrv?.score).toBeNull();
  });

  it('handles missing raw_json entirely (empty state)', () => {
    const today: OuraRow = {
      date: '2026-04-17',
      hrv_avg: null,
      resting_hr: null,
      sleep_score: null,
      body_temp_deviation: null,
      respiratory_rate: null,
      readiness_score: null,
      raw_json: null,
    };
    const inputs: ReadinessInputs = {
      today,
      trend: [],
    };
    const c = buildContributors(inputs);
    expect(c.every((x) => x.direction === 'missing')).toBe(true);
  });
});

describe('topContributors', () => {
  it('sorts by absolute delta vs median desc and caps at n', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', {}, {
        hrv_balance: 90, // big +delta from 70
        recovery_index: 55, // big -delta from 88
        previous_night: 85, // tiny delta
      }),
      trend: [
        row('2026-04-16', {}, {
          hrv_balance: 70, recovery_index: 88, previous_night: 85,
        }),
        row('2026-04-15', {}, {
          hrv_balance: 71, recovery_index: 89, previous_night: 86,
        }),
        row('2026-04-14', {}, {
          hrv_balance: 69, recovery_index: 87, previous_night: 84,
        }),
      ],
    };
    const c = buildContributors(inputs);
    const top2 = topContributors(c, 2);
    expect(top2).toHaveLength(2);
    const ids = top2.map((x) => x.id);
    expect(ids).toContain('hrv_balance');
    expect(ids).toContain('recovery_index');
  });
});

describe('buildReadinessSignal', () => {
  it('uses Oura\'s readiness_score directly, never recomputed', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17', { readiness_score: 65 }),
      trend: [row('2026-04-16'), row('2026-04-15'), row('2026-04-14')],
    };
    const signal = buildReadinessSignal(inputs);
    expect(signal.score).toBe(65);
    expect(signal.source).toBe('oura');
  });

  it('returns score=null and source=none when no readiness', () => {
    const today = row('2026-04-17', { readiness_score: null, raw_json: null });
    const inputs: ReadinessInputs = {
      today,
      trend: [],
    };
    const signal = buildReadinessSignal(inputs);
    expect(signal.score).toBeNull();
    expect(signal.source).toBe('none');
  });

  it('surfaces temperature_deviation from raw_json when available', () => {
    const inputs: ReadinessInputs = {
      today: row('2026-04-17'),
      trend: [row('2026-04-16')],
    };
    const signal = buildReadinessSignal(inputs);
    expect(signal.temperatureDeviation).toBe(0.1);
  });

  it('produces a narrative only when a contributor is up or down', () => {
    const flatInputs: ReadinessInputs = {
      today: row('2026-04-17'),
      trend: [row('2026-04-16'), row('2026-04-15'), row('2026-04-14')],
    };
    const flat = buildReadinessSignal(flatInputs);
    expect(flat.narrative).toBeNull();

    const shiftedInputs: ReadinessInputs = {
      today: row('2026-04-17', {}, { hrv_balance: 50, recovery_index: 100 }),
      trend: [
        row('2026-04-16', {}, { hrv_balance: 72, recovery_index: 85 }),
        row('2026-04-15', {}, { hrv_balance: 70, recovery_index: 86 }),
        row('2026-04-14', {}, { hrv_balance: 73, recovery_index: 87 }),
      ],
    };
    const shifted = buildReadinessSignal(shiftedInputs);
    expect(shifted.narrative).not.toBeNull();
    expect(shifted.narrative!.length).toBeGreaterThan(0);
  });
});
