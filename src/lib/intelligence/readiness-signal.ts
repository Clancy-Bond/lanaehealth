/**
 * Morning Signal / Readiness computation.
 *
 * The "Morning Signal" is LanaeHealth's answer to Oura's Readiness card:
 * one number (0-100) that tells Lanae whether her body is ready for
 * normal-load today, and the 3-4 biggest contributors to that number.
 *
 * This lib is a pure function set (no I/O) so it is easy to test and
 * safe to run on the server. It takes today's Oura row plus a 7-day
 * trend window and returns a structured signal the MorningSignalCard
 * renders directly.
 *
 * Design notes:
 * - Non-diagnostic copy only. We say "you tend to feel lighter when
 *   HRV is here", not "your HRV is low, go rest".
 * - Contributors report their value, 7-day median, and a direction
 *   flag. The card picks the 4 contributors with the largest absolute
 *   z-score so the most abnormal signals float to the top.
 * - Missing metrics return a null contributor rather than a zero, so
 *   the UI can skip them cleanly.
 */
export type MetricId =
  | 'hrv'
  | 'rhr'
  | 'sleep'
  | 'temp'
  | 'respiratory';

export interface ReadinessInputs {
  /** Today's oura_daily row, or null if no sync yet. */
  today: OuraRow | null;
  /** Up to 7 prior oura_daily rows, most recent first. */
  trend: OuraRow[];
}

export interface OuraRow {
  date: string;
  hrv_avg: number | null;
  resting_hr: number | null;
  sleep_score: number | null;
  body_temp_deviation: number | null;
  respiratory_rate: number | null;
  /** Oura's own readiness score, for comparison / fallback display. */
  readiness_score: number | null;
}

export interface Contributor {
  id: MetricId;
  label: string;
  /** Today's reading, formatted for display. */
  valueLabel: string;
  /** Raw today value (null if missing). */
  value: number | null;
  /** 7-day median, null if insufficient history. */
  median: number | null;
  /** Positive z-score means above typical, negative below. */
  zScore: number | null;
  /** 'up' = higher than usual, 'down' = lower, 'flat' = within half a SD. */
  direction: 'up' | 'down' | 'flat' | 'missing';
  /**
   * Higher z direction means "bad" for RHR/temp/respiratory, "good" for
   * HRV/sleep. This sign orients the UI arrow color consistently.
   */
  favorableDirection: 'up' | 'down';
}

export interface ReadinessSignal {
  /** 0-100 readiness score, or null if we have no data. */
  score: number | null;
  /** Whether `score` came from our formula or Oura's fallback. */
  source: 'lanaehealth' | 'oura' | 'none';
  /** Top contributors sorted by |z-score| desc, up to 4. */
  topContributors: Contributor[];
  /** All contributors we could compute, sorted by id. */
  allContributors: Contributor[];
  /** One-line human narrative ("Body temp and HRV both lower than usual."). */
  narrative: string | null;
}

// ────────────────────────────────────────────────────────────────────
// Pure helpers (no I/O)
// ────────────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 1
    ? clean[mid]
    : (clean[mid - 1] + clean[mid]) / 2;
}

function stdDev(values: number[], mean: number): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return null;
  const variance =
    clean.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (clean.length - 1);
  return Math.sqrt(variance);
}

function computeContributor(
  id: MetricId,
  label: string,
  favorableDirection: 'up' | 'down',
  value: number | null,
  history: number[],
  valueFormatter: (v: number) => string,
): Contributor {
  const med = median(history);
  const mean = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : null;
  const sd = mean !== null ? stdDev(history, mean) : null;

  let zScore: number | null = null;
  let direction: Contributor['direction'] = 'missing';
  let valueLabel = 'no reading';

  if (value === null) {
    direction = 'missing';
  } else {
    valueLabel = valueFormatter(value);
    if (med !== null && sd !== null && sd > 0) {
      zScore = (value - med) / sd;
      if (zScore > 0.5) direction = 'up';
      else if (zScore < -0.5) direction = 'down';
      else direction = 'flat';
    } else {
      direction = 'flat';
    }
  }

  return {
    id,
    label,
    valueLabel,
    value,
    median: med,
    zScore,
    direction,
    favorableDirection,
  };
}

function fmtInt(v: number): string {
  return `${Math.round(v)}`;
}

function fmtHrv(v: number): string {
  return `${Math.round(v)} ms`;
}

function fmtBpm(v: number): string {
  return `${Math.round(v)} bpm`;
}

function fmtTemp(v: number): string {
  // body_temp_deviation is in degrees C. Render as +/- 0.1C.
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}\u00B0C`;
}

function fmtRate(v: number): string {
  return `${v.toFixed(1)} /min`;
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

/**
 * Build the full set of contributors from today's row plus a 7-day trend.
 * Missing values are kept so the caller can decide what to surface.
 */
export function buildContributors(inputs: ReadinessInputs): Contributor[] {
  const t = inputs.today;

  const hrvHist = inputs.trend
    .map((r) => r.hrv_avg)
    .filter((v): v is number => v !== null);
  const rhrHist = inputs.trend
    .map((r) => r.resting_hr)
    .filter((v): v is number => v !== null);
  const sleepHist = inputs.trend
    .map((r) => r.sleep_score)
    .filter((v): v is number => v !== null);
  const tempHist = inputs.trend
    .map((r) => r.body_temp_deviation)
    .filter((v): v is number => v !== null);
  const respHist = inputs.trend
    .map((r) => r.respiratory_rate)
    .filter((v): v is number => v !== null);

  return [
    computeContributor('hrv', 'HRV', 'up', t?.hrv_avg ?? null, hrvHist, fmtHrv),
    computeContributor('rhr', 'Resting HR', 'down', t?.resting_hr ?? null, rhrHist, fmtBpm),
    computeContributor('sleep', 'Sleep', 'up', t?.sleep_score ?? null, sleepHist, fmtInt),
    computeContributor('temp', 'Body temp', 'down', t?.body_temp_deviation ?? null, tempHist, fmtTemp),
    computeContributor('respiratory', 'Breath rate', 'down', t?.respiratory_rate ?? null, respHist, fmtRate),
  ];
}

/**
 * Pick the top N contributors by absolute z-score. Missing contributors
 * fall to the bottom so the UI shows real signal first.
 */
export function topContributors(
  contributors: Contributor[],
  n: number,
): Contributor[] {
  return [...contributors]
    .sort((a, b) => {
      const za = a.zScore === null ? -1 : Math.abs(a.zScore);
      const zb = b.zScore === null ? -1 : Math.abs(b.zScore);
      return zb - za;
    })
    .slice(0, n);
}

/**
 * TODO (Clancy, Learning-Mode decision point):
 *
 * Implement LanaeHealth's own Readiness formula for Lanae specifically.
 *
 * Oura's stock Readiness weights are roughly:
 *   HRV balance 35%, Recovery index (RHR) 25%, Sleep 20%,
 *   Body temperature 10%, Activity balance 10%.
 *
 * Those weights are tuned for athletic recovery, not for chronic POTS
 * and migraine. For Lanae, I'd argue:
 *   - HRV matters MORE (autonomic load is her primary signal)
 *   - RHR matters MORE (orthostatic stress shows up here first)
 *   - Body temp deviation matters LESS (less clinically specific)
 *   - Sleep still matters a lot, but low sleep should drag harder
 *
 * Write 5-10 lines that:
 *   1. Take `contributors` (already z-scored against 7-day history)
 *   2. Apply your chosen weights
 *   3. Return a number 0-100 (clamp at the edges)
 *   4. Return `null` if fewer than 3 contributors have real values
 *
 * Below is a placeholder so the app renders. REPLACE it before ship.
 */
export function computeReadiness(contributors: Contributor[]): number | null {
  // ── Placeholder formula. Replace with your weighted version. ──
  const usable = contributors.filter((c) => c.zScore !== null);
  if (usable.length < 3) return null;
  // Naive average of z-scores, each mapped from [-2, +2] to [0, 100],
  // where "favorable" direction adds to the score.
  const scoreParts = usable.map((c) => {
    const z = c.zScore ?? 0;
    // If the metric's favorable direction is 'down' (e.g. RHR),
    // lower values give a higher score. Flip the sign accordingly.
    const zAdj = c.favorableDirection === 'down' ? -z : z;
    // Map [-2, +2] -> [0, 100], clamp.
    const raw = 50 + zAdj * 25;
    return Math.max(0, Math.min(100, raw));
  });
  const avg = scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length;
  return Math.round(avg);
}

/**
 * Compose the full Readiness signal from the raw Oura inputs.
 * This is the one-call entrypoint the card will use.
 */
export function buildReadinessSignal(inputs: ReadinessInputs): ReadinessSignal {
  const all = buildContributors(inputs);
  const top = topContributors(all, 4);
  const ownScore = computeReadiness(all);

  const score: number | null =
    ownScore !== null ? ownScore : inputs.today?.readiness_score ?? null;
  const source: ReadinessSignal['source'] =
    ownScore !== null ? 'lanaehealth' : score !== null ? 'oura' : 'none';

  return {
    score,
    source,
    topContributors: top,
    allContributors: all,
    narrative: buildNarrative(top),
  };
}

/**
 * Turn the top contributors into a one-line observation. We never prescribe.
 */
function buildNarrative(top: Contributor[]): string | null {
  const flagged = top.filter((c) => c.direction === 'up' || c.direction === 'down');
  if (flagged.length === 0) return null;

  const phrases = flagged.slice(0, 2).map((c) => {
    const dir = c.direction === 'up' ? 'higher than usual' : 'lower than usual';
    return `${c.label} ${dir}`;
  });

  if (phrases.length === 1) return `${phrases[0]} today.`;
  return `${phrases[0]}, ${phrases[1]} today.`;
}
