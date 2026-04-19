import { describe, it, expect } from 'vitest';
import { computeContributors, type ContributorRow } from '../contributors';

function makeRow(overrides: Partial<ContributorRow> = {}): ContributorRow {
  return {
    date: overrides.date ?? '2026-04-01',
    hrv_avg: overrides.hrv_avg ?? null,
    resting_hr: overrides.resting_hr ?? null,
    sleep_score: overrides.sleep_score ?? null,
    body_temp_deviation: overrides.body_temp_deviation ?? null,
    respiratory_rate: overrides.respiratory_rate ?? null,
  };
}

describe('computeContributors', () => {
  it('flags low HRV as a negative influence', () => {
    const windowRows = Array.from({ length: 28 }, (_, i) =>
      makeRow({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, hrv_avg: 60 + (i % 5) }),
    );
    const todayRow = makeRow({ date: '2026-04-01', hrv_avg: 35 });
    const contributors = computeContributors(windowRows, todayRow);
    const hrv = contributors.find((c) => c.key === 'hrv')!;
    expect(hrv.direction).toBe('down');
    expect(hrv.influence).toBe('negative');
    expect(hrv.z).toBeLessThan(-1);
  });

  it('flags high HRV as a positive influence', () => {
    const windowRows = Array.from({ length: 28 }, (_, i) =>
      makeRow({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, hrv_avg: 60 + (i % 5) }),
    );
    const todayRow = makeRow({ date: '2026-04-01', hrv_avg: 95 });
    const contributors = computeContributors(windowRows, todayRow);
    const hrv = contributors.find((c) => c.key === 'hrv')!;
    expect(hrv.direction).toBe('up');
    expect(hrv.influence).toBe('positive');
  });

  it('flags high resting HR as a negative influence (higher is worse)', () => {
    const windowRows = Array.from({ length: 28 }, (_, i) =>
      makeRow({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, resting_hr: 55 + (i % 4) }),
    );
    const todayRow = makeRow({ date: '2026-04-01', resting_hr: 80 });
    const contributors = computeContributors(windowRows, todayRow);
    const rhr = contributors.find((c) => c.key === 'resting_hr')!;
    expect(rhr.direction).toBe('up');
    expect(rhr.influence).toBe('negative');
  });

  it('returns no_data when today values are missing', () => {
    const windowRows = Array.from({ length: 28 }, (_, i) =>
      makeRow({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, hrv_avg: 60 }),
    );
    const todayRow = null;
    const contributors = computeContributors(windowRows, todayRow);
    for (const c of contributors) {
      expect(c.influence).toBe('no_data');
    }
  });

  it('orders contributors by magnitude of z-score', () => {
    const windowRows = Array.from({ length: 28 }, (_, i) =>
      makeRow({
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        hrv_avg: 60 + (i % 3),
        resting_hr: 55 + (i % 2),
        sleep_score: 70 + (i % 5),
      }),
    );
    const todayRow = makeRow({
      date: '2026-04-01',
      hrv_avg: 30,
      resting_hr: 56,
      sleep_score: 70,
    });
    const [top] = computeContributors(windowRows, todayRow);
    expect(top.key).toBe('hrv');
  });
});
