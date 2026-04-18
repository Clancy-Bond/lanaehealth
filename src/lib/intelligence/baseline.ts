/**
 * Today vs Baseline computation for the home BaselineCard.
 *
 * For each tracked Oura metric we compute a 28-day rolling baseline
 * (median + IQR bounds) from the days immediately before "today", then
 * compare today's value against that window. Values outside the IQR
 * fence are flagged so the UI can surface a gentle, plain-language
 * callout.
 *
 * Design choices:
 * - We never emit diagnostic framing. Copy is descriptive ("higher than
 *   your usual range"), never interpretive ("your RHR is elevated").
 * - Baseline excludes today so today can stand out against the window.
 * - If fewer than 7 non-null historical values exist we report
 *   "insufficient" so the UI can show a "not enough data yet" state.
 *   7 is low enough that Lanae's 1,187 days always qualify but we keep
 *   the guard for resilience.
 * - IQR fence uses Tukey's 1.5 * IQR on either side of the median. A
 *   value at or below (Q1 minus 1.5 * IQR) is flagged "lower"; at or
 *   above (Q3 plus 1.5 * IQR) is "higher". Inside the fence is "normal".
 *
 * All functions in this module are pure and deterministic. Database
 * access lives in the component/page that feeds data in.
 */

export type BaselineMetricId =
  | 'resting_hr'
  | 'hrv_avg'
  | 'body_temp_deviation'
  | 'respiratory_rate';

/**
 * Direction the today-vs-baseline anomaly is pointing, if any.
 *
 * "normal" => inside the Tukey fence (no accent)
 * "higher" => today >= Q3 + 1.5 * IQR (blush accent)
 * "lower" => today <= Q1 - 1.5 * IQR (blush accent)
 * "insufficient" => not enough historical points to compute a baseline
 * "no_today" => no reading for today at all
 */
export type BaselineFlag = 'normal' | 'higher' | 'lower' | 'insufficient' | 'no_today';

export interface BaselineResult {
  metric: BaselineMetricId;
  today: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  lowerFence: number | null;
  upperFence: number | null;
  sampleSize: number;
  flag: BaselineFlag;
}

export interface DailyRow {
  date: string;
  resting_hr: number | null;
  hrv_avg: number | null;
  body_temp_deviation: number | null;
  respiratory_rate: number | null;
}

/**
 * Minimum number of non-null historical points required before we
 * emit a baseline. Chosen low enough that it only kicks in for very
 * new users; Lanae's 1,187 days always exceed it comfortably.
 */
export const MIN_BASELINE_SAMPLES = 7;

/**
 * Rolling window size in days. Matches Apple Health's "typical" framing.
 */
export const BASELINE_WINDOW_DAYS = 28;

/**
 * Pure percentile helper. Accepts an already-sorted ascending array of
 * finite numbers and returns the value at the given percentile (0 to 1)
 * using linear interpolation. Returns null for empty input.
 *
 * Kept pure so tests don't need Supabase or I/O.
 */
export function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const clamped = Math.min(1, Math.max(0, p));
  const pos = clamped * (sortedAsc.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sortedAsc[lower];
  const weight = pos - lower;
  return sortedAsc[lower] * (1 - weight) + sortedAsc[upper] * weight;
}

/**
 * Compute median + IQR fence for one metric over a window of daily rows.
 *
 * @param values Non-null numeric readings from the historical window.
 *   Must exclude today's row; callers are responsible for that.
 * @returns A BaselineResult with flag set to 'insufficient' or 'no_today'
 *   when appropriate, otherwise 'normal' / 'higher' / 'lower'.
 */
export function computeBaseline(
  metric: BaselineMetricId,
  values: number[],
  todayValue: number | null,
): BaselineResult {
  const cleaned = values.filter((v) => Number.isFinite(v));
  const sorted = [...cleaned].sort((a, b) => a - b);
  const sampleSize = sorted.length;

  if (sampleSize < MIN_BASELINE_SAMPLES) {
    return {
      metric,
      today: todayValue,
      median: null,
      q1: null,
      q3: null,
      lowerFence: null,
      upperFence: null,
      sampleSize,
      flag: 'insufficient',
    };
  }

  const median = percentile(sorted, 0.5);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);

  if (median === null || q1 === null || q3 === null) {
    return {
      metric,
      today: todayValue,
      median: null,
      q1: null,
      q3: null,
      lowerFence: null,
      upperFence: null,
      sampleSize,
      flag: 'insufficient',
    };
  }

  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  if (todayValue === null || !Number.isFinite(todayValue)) {
    return {
      metric,
      today: null,
      median,
      q1,
      q3,
      lowerFence,
      upperFence,
      sampleSize,
      flag: 'no_today',
    };
  }

  let flag: BaselineFlag = 'normal';
  if (todayValue >= upperFence) flag = 'higher';
  else if (todayValue <= lowerFence) flag = 'lower';

  return {
    metric,
    today: todayValue,
    median,
    q1,
    q3,
    lowerFence,
    upperFence,
    sampleSize,
    flag,
  };
}

/**
 * Build the four baseline results from a set of daily rows plus a target
 * "today" row. Rows should be the most recent `BASELINE_WINDOW_DAYS`
 * days BEFORE today; `todayRow` is the target day (may be null).
 */
export function computeAllBaselines(
  rows: DailyRow[],
  todayRow: DailyRow | null,
): BaselineResult[] {
  const metrics: BaselineMetricId[] = [
    'resting_hr',
    'hrv_avg',
    'body_temp_deviation',
    'respiratory_rate',
  ];
  return metrics.map((m) => {
    const values = rows
      .map((r) => r[m])
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const today = todayRow ? todayRow[m] : null;
    return computeBaseline(m, values, today);
  });
}

/**
 * Copy helpers. Kept in this module so tests can assert on the
 * non-diagnostic phrasing without pulling in React.
 *
 * Rules:
 * - Never medicalize. "higher than your usual range" not "elevated".
 * - Always let the user interpret. "Heads up" framing is fine, but we
 *   don't hint at a cause or severity.
 */
export const METRIC_COPY: Record<
  BaselineMetricId,
  { label: string; unit: string; higher: string; lower: string; normal: string }
> = {
  resting_hr: {
    label: 'Resting heart rate',
    unit: 'bpm',
    higher: 'Higher than your usual range today',
    lower: 'Lower than your usual range today',
    normal: 'Sitting inside your usual range',
  },
  hrv_avg: {
    label: 'Heart rate variability',
    unit: 'ms',
    higher: 'Higher than your usual range today',
    lower: 'Lower than your usual range today',
    normal: 'Sitting inside your usual range',
  },
  body_temp_deviation: {
    label: 'Wrist temp deviation',
    unit: '\u00B0C',
    higher: 'Warmer than your usual range today',
    lower: 'Cooler than your usual range today',
    normal: 'Sitting inside your usual range',
  },
  respiratory_rate: {
    label: 'Respiratory rate',
    unit: 'br/min',
    higher: 'Higher than your usual range today',
    lower: 'Lower than your usual range today',
    normal: 'Sitting inside your usual range',
  },
};

/**
 * Format a range like "48 to 56" for display. Null inputs become "--".
 * Decimals are rounded so RHR shows as integers but temp deviation
 * keeps one decimal place so small changes stay visible.
 */
export function formatRange(
  metric: BaselineMetricId,
  low: number | null,
  high: number | null,
): string {
  if (low === null || high === null) return '--';
  const rounded = (v: number) =>
    metric === 'body_temp_deviation' ? v.toFixed(1) : Math.round(v).toString();
  return `${rounded(low)} to ${rounded(high)}`;
}

/**
 * Format a single value for display, respecting the metric's precision.
 */
export function formatValue(metric: BaselineMetricId, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--';
  if (metric === 'body_temp_deviation') return value.toFixed(1);
  if (metric === 'hrv_avg') return Math.round(value).toString();
  if (metric === 'respiratory_rate') return value.toFixed(1);
  return Math.round(value).toString();
}

/**
 * Return the plain-language copy string for a baseline flag, never
 * diagnostic. Returns an empty string for non-actionable flags so the
 * caller can fall back to a neutral default.
 */
export function copyForResult(result: BaselineResult): string {
  const copy = METRIC_COPY[result.metric];
  if (result.flag === 'higher') return copy.higher;
  if (result.flag === 'lower') return copy.lower;
  if (result.flag === 'normal') return copy.normal;
  return '';
}
