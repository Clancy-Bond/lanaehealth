import { describe, it, expect } from 'vitest';
import { computeStale, isStale } from '../stale';

describe('computeStale', () => {
  const today = '2026-04-19';
  const baseNow = Date.parse(today + 'T12:00:00Z');

  it('returns never-synced when no latestDate', () => {
    expect(computeStale({ latestDate: null, today }).status).toBe('never-synced');
  });

  it('returns fresh when latest row is today and sync is recent', () => {
    const result = computeStale({
      latestDate: today,
      today,
      syncedAt: '2026-04-19T10:00:00Z',
      nowMs: baseNow,
    });
    expect(result.status).toBe('fresh');
    expect(result.daysStale).toBe(0);
  });

  it('returns stale when latest row is yesterday', () => {
    const result = computeStale({
      latestDate: '2026-04-18',
      today,
      nowMs: baseNow,
    });
    expect(result.status).toBe('stale');
    expect(result.daysStale).toBe(1);
    expect(result.label).toContain('Yesterday');
  });

  it('returns stale when latest row is 5 days old', () => {
    const result = computeStale({
      latestDate: '2026-04-14',
      today,
      nowMs: baseNow,
    });
    expect(result.status).toBe('stale');
    expect(result.daysStale).toBe(5);
    expect(result.label).toContain('5 days');
  });

  it('isStale convenience returns false only for fresh', () => {
    expect(
      isStale({ latestDate: today, today, syncedAt: '2026-04-19T10:00:00Z', nowMs: baseNow }),
    ).toBe(false);
    expect(isStale({ latestDate: '2026-04-18', today, nowMs: baseNow })).toBe(true);
    expect(isStale({ latestDate: null, today, nowMs: baseNow })).toBe(true);
  });
});
