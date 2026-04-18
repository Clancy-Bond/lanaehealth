import { describe, it, expect } from 'vitest';
import {
  contextFor,
  citationUrl,
} from '../readiness-context';
import type { OuraContributorId } from '../readiness-signal';

describe('contextFor', () => {
  it('returns direction-specific copy when direction is up', () => {
    const ctx = contextFor('hrv_balance', 'up');
    expect(ctx.whyItMatters).toContain('autonomic');
    expect(ctx.whatDirectionMeans).toContain('recovered');
  });

  it('returns direction-specific copy when direction is down', () => {
    const ctx = contextFor('hrv_balance', 'down');
    expect(ctx.whatDirectionMeans).toContain('autonomic load');
  });

  it('returns null whatDirectionMeans for flat or missing', () => {
    const flat = contextFor('hrv_balance', 'flat');
    const missing = contextFor('hrv_balance', 'missing');
    expect(flat.whatDirectionMeans).toBeNull();
    expect(missing.whatDirectionMeans).toBeNull();
    expect(flat.whyItMatters.length).toBeGreaterThan(0);
  });

  it('covers all 8 Oura contributors', () => {
    const ids: OuraContributorId[] = [
      'hrv_balance',
      'resting_heart_rate',
      'previous_night',
      'sleep_balance',
      'recovery_index',
      'body_temperature',
      'activity_balance',
      'previous_day_activity',
    ];
    for (const id of ids) {
      const ctx = contextFor(id, 'down');
      expect(ctx.whyItMatters.length).toBeGreaterThan(10);
      expect(ctx.whatDirectionMeans).not.toBeNull();
    }
  });

  it('body_temperature copy references the luteal phase for cycle tracking users', () => {
    const ctx = contextFor('body_temperature', 'down');
    expect(ctx.whyItMatters.toLowerCase()).toContain('cycle');
  });

  it('resting_heart_rate copy references the orthostatic baseline specific to Lanae', () => {
    const ctx = contextFor('resting_heart_rate', 'down');
    expect(ctx.whyItMatters).toContain('orthostatic');
  });
});

describe('citationUrl', () => {
  it('maps known citation tags to PMC URLs', () => {
    expect(citationUrl('PMC6936126')).toContain('pmc.ncbi.nlm.nih.gov');
    expect(citationUrl('PMC2892834')).toContain('pmc.ncbi.nlm.nih.gov');
    expect(citationUrl('PMC7575238')).toContain('pmc.ncbi.nlm.nih.gov');
  });

  it('returns null for unknown or undefined tags', () => {
    expect(citationUrl(undefined)).toBeNull();
    expect(citationUrl('NOT_A_TAG')).toBeNull();
  });
});
