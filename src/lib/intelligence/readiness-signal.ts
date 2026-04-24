/**
 * Morning Signal / Readiness.
 *
 * Architecture decision (2026-04-17, after Clancy's correction):
 * DO NOT reinvent Oura's Readiness formula. Oura's public API at
 * /v2/usercollection/daily_readiness already returns a fully-weighted
 * score (0-100) AND a `contributors` object with 7 sub-scores, each
 * also 0-100. We display those directly.
 *
 * The sync job at src/app/api/oura/sync/route.ts already stores the
 * full readiness payload in oura_daily.raw_json.oura.readiness, so
 * this lib reads from there with zero new network calls.
 *
 * LanaeHealth's value-add is the TREND OVERLAY, not a competing
 * calculation:
 *   - Oura tells us the score today
 *   - Oura tells us each contributor's score today
 *   - We compute whether each contributor is above/below its 7-day
 *     median so the UI can render a direction arrow
 *
 * That's it. No weighted formula, no proprietary logic being guessed at.
 *
 * Full research + architecture rationale: docs/intelligence/readiness-formula.md.
 */

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

/**
 * The shape Oura returns under raw_json.oura.readiness. Every
 * contributor is a 0-100 score with Oura's own weighting.
 */
export interface OuraReadinessPayload {
  score: number | null;
  temperature_deviation?: number | null;
  temperature_trend_deviation?: number | null;
  contributors?: OuraContributors | null;
}

export interface OuraContributors {
  activity_balance?: number | null;
  body_temperature?: number | null;
  hrv_balance?: number | null;
  previous_day_activity?: number | null;
  previous_night?: number | null;
  recovery_index?: number | null;
  resting_heart_rate?: number | null;
  sleep_balance?: number | null;
  /**
   * Wave 1 (audit): present in raw_json.oura.readiness.contributors but
   * was missing from this interface. NC research lists sleep regularity
   * as migraine's #1 behavioral trigger, so the sleep page already had
   * a SleepRegularityExplainer wired and a regularityScore prop slot;
   * the value just needed wiring through.
   */
  sleep_regularity?: number | null;
}

export type OuraContributorId = keyof OuraContributors;

/**
 * A single row from oura_daily. `raw_json` is optional because some
 * fetch paths don't include it; when it's missing we fall back to the
 * flat columns.
 */
export interface OuraRow {
  date: string;
  hrv_avg: number | null;
  resting_hr: number | null;
  sleep_score: number | null;
  body_temp_deviation: number | null;
  respiratory_rate: number | null;
  readiness_score: number | null;
  /** Full Oura payloads (sleep, readiness, stress, sleep_detail, ...). */
  raw_json?: {
    oura?: {
      readiness?: OuraReadinessPayload;
    };
  } | null;
}

export interface ReadinessInputs {
  /** Today's oura_daily row, or null if no sync yet. */
  today: OuraRow | null;
  /** Up to 7 prior oura_daily rows, most recent first. */
  trend: OuraRow[];
}

/**
 * One contributor in the UI. Value comes from Oura, trend direction
 * from our own 7-day comparison.
 */
export interface Contributor {
  id: OuraContributorId;
  label: string;
  /** Oura's 0-100 sub-score for today. */
  score: number | null;
  /** 7-day median score for this contributor, for trend arrow. */
  median: number | null;
  /** 'up' / 'down' / 'flat' / 'missing' vs this user's own 7-day. */
  direction: 'up' | 'down' | 'flat' | 'missing';
  /** Short human sentence: "Sleep balance is above your 7-day median." */
  trendCopy: string | null;
}

export interface ReadinessSignal {
  /** Oura's own readiness score (0-100), or null if missing. */
  score: number | null;
  /** Where we got the score from. */
  source: 'oura' | 'none';
  /** Top contributors sorted by largest delta vs 7-day median. */
  topContributors: Contributor[];
  /** All 9 Oura contributors, for the expand view. */
  allContributors: Contributor[];
  /** Raw Oura temperature deviation in degrees C, for detail view. */
  temperatureDeviation: number | null;
  /** One-line observation across the top contributors. */
  narrative: string | null;
}

// ────────────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────────────

const CONTRIBUTOR_LABELS: Record<OuraContributorId, string> = {
  activity_balance: 'Activity balance',
  body_temperature: 'Body temperature',
  hrv_balance: 'HRV balance',
  previous_day_activity: 'Yesterday\u2019s activity',
  previous_night: 'Last night\u2019s sleep',
  recovery_index: 'Recovery index',
  resting_heart_rate: 'Resting heart rate',
  sleep_balance: 'Sleep balance',
  sleep_regularity: 'Sleep regularity',
};

const CONTRIBUTOR_ORDER: OuraContributorId[] = [
  'hrv_balance',
  'resting_heart_rate',
  'previous_night',
  'sleep_balance',
  'sleep_regularity',
  'recovery_index',
  'body_temperature',
  'activity_balance',
  'previous_day_activity',
];

function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 1
    ? clean[mid]
    : (clean[mid - 1] + clean[mid]) / 2;
}

function extractContributors(row: OuraRow | null): OuraContributors | null {
  return row?.raw_json?.oura?.readiness?.contributors ?? null;
}

function getContributorValue(
  c: OuraContributors | null,
  id: OuraContributorId,
): number | null {
  if (!c) return null;
  const v = c[id];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function buildContributor(
  id: OuraContributorId,
  todayContribs: OuraContributors | null,
  trend: OuraRow[],
): Contributor {
  const today = getContributorValue(todayContribs, id);
  const history = trend
    .map((r) => getContributorValue(extractContributors(r), id))
    .filter((v): v is number => v !== null);

  const med = median(history);

  let direction: Contributor['direction'] = 'missing';
  let trendCopy: string | null = null;

  if (today === null) {
    direction = 'missing';
  } else if (med === null) {
    direction = 'flat';
    trendCopy = 'Not enough history yet for a trend.';
  } else {
    // A 5-point shift on a 0-100 scale is meaningful, below that treat as flat.
    const delta = today - med;
    if (delta > 5) {
      direction = 'up';
      trendCopy = `Above your 7-day median (${Math.round(med)}).`;
    } else if (delta < -5) {
      direction = 'down';
      trendCopy = `Below your 7-day median (${Math.round(med)}).`;
    } else {
      direction = 'flat';
      trendCopy = `Near your 7-day median (${Math.round(med)}).`;
    }
  }

  return {
    id,
    label: CONTRIBUTOR_LABELS[id],
    score: today,
    median: med,
    direction,
    trendCopy,
  };
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

/**
 * Build all 9 contributors. Each uses Oura's own 0-100 score and
 * our 7-day median for the direction arrow.
 */
export function buildContributors(inputs: ReadinessInputs): Contributor[] {
  const todayContribs = extractContributors(inputs.today);
  return CONTRIBUTOR_ORDER.map((id) =>
    buildContributor(id, todayContribs, inputs.trend),
  );
}

/**
 * Sort contributors by magnitude of their deviation from 7-day median
 * so the UI can surface the biggest movers first. Missing scores
 * fall to the bottom.
 */
export function topContributors(
  contributors: Contributor[],
  n: number,
): Contributor[] {
  return [...contributors]
    .sort((a, b) => {
      const deltaA =
        a.score !== null && a.median !== null ? Math.abs(a.score - a.median) : -1;
      const deltaB =
        b.score !== null && b.median !== null ? Math.abs(b.score - b.median) : -1;
      return deltaB - deltaA;
    })
    .slice(0, n);
}

/**
 * Compose the full Readiness signal from the raw Oura inputs. One call,
 * everything the card needs.
 */
export function buildReadinessSignal(inputs: ReadinessInputs): ReadinessSignal {
  const all = buildContributors(inputs);
  const top = topContributors(all, 4);
  const score = inputs.today?.readiness_score ?? null;
  const source: ReadinessSignal['source'] = score !== null ? 'oura' : 'none';
  const temperatureDeviation =
    inputs.today?.raw_json?.oura?.readiness?.temperature_deviation ??
    inputs.today?.body_temp_deviation ??
    null;

  return {
    score,
    source,
    topContributors: top,
    allContributors: all,
    temperatureDeviation,
    narrative: buildNarrative(top),
  };
}

/**
 * One-line observation across the biggest movers. Non-diagnostic copy.
 */
function buildNarrative(top: Contributor[]): string | null {
  const flagged = top.filter((c) => c.direction === 'up' || c.direction === 'down');
  if (flagged.length === 0) return null;

  const phrases = flagged.slice(0, 2).map((c) => {
    const dir = c.direction === 'up' ? 'up' : 'down';
    return `${c.label.toLowerCase()} ${dir}`;
  });

  if (phrases.length === 1) return `${phrases[0]} vs your 7-day.`;
  return `${phrases[0]}, ${phrases[1]} vs your 7-day.`;
}
