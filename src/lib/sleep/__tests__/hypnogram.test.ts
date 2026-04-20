import { describe, it, expect } from 'vitest';
import {
  parseSleepPhases,
  sumMinutesByStage,
  buildHypnogramFromAggregates,
  buildHypnogram,
  type SleepDetailInput,
} from '../hypnogram';

describe('parseSleepPhases', () => {
  it('returns an empty list for null/empty inputs', () => {
    expect(parseSleepPhases(null)).toEqual([]);
    expect(parseSleepPhases('')).toEqual([]);
    expect(parseSleepPhases(undefined)).toEqual([]);
  });

  it('collapses consecutive identical phases into one block', () => {
    const blocks = parseSleepPhases('1111');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ stage: 'deep', durationMinutes: 20, startMinute: 0 });
  });

  it('transitions between phases preserve chronological order', () => {
    const blocks = parseSleepPhases('1122334');
    // deep(10) -> light(10) -> rem(10) -> awake(5)
    expect(blocks.map((b) => b.stage)).toEqual(['deep', 'light', 'rem', 'awake']);
    expect(blocks.map((b) => b.durationMinutes)).toEqual([10, 10, 10, 5]);
    expect(blocks[1].startMinute).toBe(10);
    expect(blocks[2].startMinute).toBe(20);
    expect(blocks[3].startMinute).toBe(30);
  });

  it('ignores unknown characters without breaking the sequence', () => {
    const blocks = parseSleepPhases('1X1X');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ stage: 'deep', durationMinutes: 10 });
  });
});

describe('sumMinutesByStage', () => {
  it('zeroes all stages for an empty block list', () => {
    expect(sumMinutesByStage([])).toEqual({ awake: 0, rem: 0, light: 0, deep: 0 });
  });

  it('sums per-stage durations independent of ordering', () => {
    const blocks = parseSleepPhases('1122334421');
    const sums = sumMinutesByStage(blocks);
    // deep(10) + light(10) + rem(10) + awake(10) + light(5) + deep(5)
    expect(sums).toEqual({ deep: 15, light: 15, rem: 10, awake: 10 });
  });
});

describe('buildHypnogramFromAggregates', () => {
  it('returns an empty list when totalMinutes is zero', () => {
    expect(
      buildHypnogramFromAggregates({
        totalMinutes: 0,
        deepMinutes: 0,
        remMinutes: 0,
        lightMinutes: 0,
        awakeMinutes: 0,
      }),
    ).toEqual([]);
  });

  it('generates contiguous blocks that cover the reconstructed night', () => {
    const blocks = buildHypnogramFromAggregates({
      totalMinutes: 420,
      deepMinutes: 90,
      remMinutes: 90,
      lightMinutes: 210,
      awakeMinutes: 30,
    });
    expect(blocks.length).toBeGreaterThan(0);
    // blocks should be in ascending startMinute order
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].startMinute).toBeGreaterThanOrEqual(blocks[i - 1].startMinute);
    }
  });
});

describe('buildHypnogram', () => {
  it('returns empty source when input is null', () => {
    const result = buildHypnogram(null);
    expect(result.source).toBe('empty');
    expect(result.blocks).toEqual([]);
    expect(result.totalMinutes).toBe(0);
  });

  it('prefers sleep_phase_5_min when present', () => {
    const detail: SleepDetailInput = {
      sleep_phase_5_min: '11223344',
      bedtime_start: '2026-04-18T22:30:00-05:00',
      bedtime_end: '2026-04-19T06:00:00-05:00',
      efficiency: 88,
      latency: 600,
      restless_periods: 5,
    };
    const result = buildHypnogram(detail);
    expect(result.source).toBe('sleep_phase_5_min');
    expect(result.blocks).toHaveLength(4);
    expect(result.minutesByStage).toEqual({ deep: 10, light: 10, rem: 10, awake: 10 });
    expect(result.bedtime).toBe('22:30');
    expect(result.wakeTime).toBe('06:00');
    expect(result.efficiency).toBe(88);
    expect(result.latencyMinutes).toBe(10);
    expect(result.restlessPeriods).toBe(5);
  });

  it('falls back to aggregates when sleep_phase_5_min is missing', () => {
    const detail: SleepDetailInput = {
      total_sleep_duration: 420 * 60,
      deep_sleep_duration: 90 * 60,
      rem_sleep_duration: 90 * 60,
      light_sleep_duration: 210 * 60,
      awake_time: 30 * 60,
      bedtime_start: null,
      bedtime_end: null,
    };
    const result = buildHypnogram(detail);
    expect(result.source).toBe('aggregates');
    expect(result.totalMinutes).toBe(420);
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.efficiency).toBeNull();
  });

  it('returns empty source when both real and aggregate data are missing', () => {
    const result = buildHypnogram({ bedtime_start: '2026-04-18T22:00:00Z' });
    expect(result.source).toBe('empty');
    expect(result.blocks).toEqual([]);
    expect(result.bedtime).toBe('22:00');
  });
});
