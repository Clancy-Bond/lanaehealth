/**
 * Readiness contributor waterfall.
 *
 * Oura's review-winning insight is showing WHY today's readiness score
 * landed where it did. Users hate the opaque black-box ("readiness 87
 * but HRV is my lowest in weeks -- feels inconsistent"). We build our
 * own contributor breakdown by z-scoring today's metrics against a
 * 28-day rolling window.
 *
 * Pure functions only; input rows are plain POJOs so tests don't need
 * Supabase.
 */

export interface ContributorRow {
  date: string;
  hrv_avg: number | null;
  resting_hr: number | null;
  sleep_score: number | null;
  body_temp_deviation: number | null;
  respiratory_rate: number | null;
}

export type ContributorKey =
  | 'hrv'
  | 'resting_hr'
  | 'sleep'
  | 'body_temp'
  | 'respiratory_rate';

export type ContributorDirection = 'up' | 'down' | 'stable' | 'no_data';

export interface Contributor {
  key: ContributorKey;
  label: string;
  /** Today's raw value, may be null. */
  today: number | null;
  /** 28-day baseline median (excluding today). */
  baseline: number | null;
  /** Delta vs baseline (raw units). Null when either input is null. */
  delta: number | null;
  /** Z-score relative to the window's stddev. Null when stddev = 0 or data missing. */
  z: number | null;
  /**
   * Whether the delta is *favourable* or *unfavourable* for readiness.
   * For HRV higher = better. For resting HR, body_temp, resp rate
   * higher = worse. For sleep_score higher = better.
   */
  direction: ContributorDirection;
  /**
   * Whether this metric is pulling readiness up, down, or roughly neutral.
   * Threshold: |z| >= 1 counts as meaningful.
   */
  influence: 'positive' | 'negative' | 'neutral' | 'no_data';
}

/**
 * Direction orientation per metric. true means "higher value is better for readiness".
 */
const HIGHER_IS_BETTER: Record<ContributorKey, boolean> = {
  hrv: true,
  resting_hr: false,
  sleep: true,
  body_temp: false,
  respiratory_rate: false,
};

const LABELS: Record<ContributorKey, string> = {
  hrv: 'HRV',
  resting_hr: 'Resting heart rate',
  sleep: 'Sleep score',
  body_temp: 'Body temperature',
  respiratory_rate: 'Respiratory rate',
};

function extract(rows: ContributorRow[], key: ContributorKey): number[] {
  const vals = rows
    .map((r) => {
      switch (key) {
        case 'hrv':
          return r.hrv_avg;
        case 'resting_hr':
          return r.resting_hr;
        case 'sleep':
          return r.sleep_score;
        case 'body_temp':
          return r.body_temp_deviation;
        case 'respiratory_rate':
          return r.respiratory_rate;
      }
    })
    .filter((v): v is number => v !== null && Number.isFinite(v));
  return vals;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stddev(vals: number[]): number | null {
  if (vals.length < 2) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance =
    vals.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute the contributor waterfall given a window of prior-day rows
 * and today's row. Returns contributors ordered by magnitude of
 * influence (biggest drivers first).
 */
export function computeContributors(
  windowRows: ContributorRow[],
  todayRow: ContributorRow | null,
): Contributor[] {
  const keys: ContributorKey[] = [
    'hrv',
    'resting_hr',
    'sleep',
    'body_temp',
    'respiratory_rate',
  ];
  const result: Contributor[] = keys.map((key) => {
    const windowVals = extract(windowRows, key);
    const sorted = [...windowVals].sort((a, b) => a - b);
    const med = median(sorted);
    const sd = stddev(windowVals);
    const todayRaw = todayRow
      ? key === 'hrv'
        ? todayRow.hrv_avg
        : key === 'resting_hr'
        ? todayRow.resting_hr
        : key === 'sleep'
        ? todayRow.sleep_score
        : key === 'body_temp'
        ? todayRow.body_temp_deviation
        : todayRow.respiratory_rate
      : null;
    const today = todayRaw !== null && Number.isFinite(todayRaw) ? todayRaw : null;
    const delta = today !== null && med !== null ? today - med : null;
    const z = today !== null && med !== null && sd !== null && sd > 0 ? (today - med) / sd : null;

    let direction: ContributorDirection = 'no_data';
    if (delta !== null) {
      if (Math.abs(delta) < 0.0001) direction = 'stable';
      else direction = delta > 0 ? 'up' : 'down';
    }

    let influence: Contributor['influence'] = 'no_data';
    if (z === null) {
      influence = 'no_data';
    } else if (Math.abs(z) < 1) {
      influence = 'neutral';
    } else {
      const aboveMedian = z > 0;
      const favourable =
        (aboveMedian && HIGHER_IS_BETTER[key]) ||
        (!aboveMedian && !HIGHER_IS_BETTER[key]);
      influence = favourable ? 'positive' : 'negative';
    }

    return {
      key,
      label: LABELS[key],
      today,
      baseline: med,
      delta,
      z,
      direction,
      influence,
    };
  });

  return result.sort((a, b) => {
    const za = a.z === null ? -Infinity : Math.abs(a.z);
    const zb = b.z === null ? -Infinity : Math.abs(b.z);
    return zb - za;
  });
}
