/**
 * Hypnogram parser for the Sleep tab.
 *
 * The Oura `/usercollection/sleep` endpoint returns a 5-minute-resolution
 * string called `sleep_phase_5_min` where each character encodes one
 * interval's stage (1 = deep, 2 = light, 3 = REM, 4 = awake). Our sync
 * pipeline stores the entire entry under `raw_json.oura.sleep_detail`.
 *
 * If the string is present we produce a real hypnogram. If not (older
 * rows, no sync, manual log days) callers can fall back to the
 * aggregate-based reconstruction in the /api/oura/sleep-stages route.
 *
 * Pure helper module with no I/O so the logic is fully unit-testable.
 */

export type HypnogramStage = 'awake' | 'rem' | 'light' | 'deep';

export interface HypnogramBlock {
  /** Minutes from sleep onset (bedtime_start) where this block begins. */
  startMinute: number;
  stage: HypnogramStage;
  /** Integer minutes. Blocks always align on the 5-minute grid. */
  durationMinutes: number;
}

export interface HypnogramResult {
  blocks: HypnogramBlock[];
  totalMinutes: number;
  bedtime: string | null;
  wakeTime: string | null;
  source: 'sleep_phase_5_min' | 'aggregates' | 'empty';
  /** Per-stage minute totals; useful for captions and cross-checks. */
  minutesByStage: Record<HypnogramStage, number>;
  /** Efficiency 0-100, if available. */
  efficiency: number | null;
  /** Sleep latency in minutes, if available. */
  latencyMinutes: number | null;
  /** Number of restless periods from the Oura detail payload. */
  restlessPeriods: number | null;
}

const CHAR_TO_STAGE: Record<string, HypnogramStage> = {
  '1': 'deep',
  '2': 'light',
  '3': 'rem',
  '4': 'awake',
};

const INTERVAL_MIN = 5;

export interface SleepDetailInput {
  sleep_phase_5_min?: string | null;
  light_sleep_duration?: number | null; // seconds
  awake_time?: number | null; // seconds
  bedtime_start?: string | null;
  bedtime_end?: string | null;
  efficiency?: number | null;
  latency?: number | null; // seconds
  restless_periods?: number | null;
  total_sleep_duration?: number | null; // seconds
  deep_sleep_duration?: number | null; // seconds
  rem_sleep_duration?: number | null; // seconds
}

export interface AggregateFallback {
  totalMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
}

/**
 * Parse the Oura `sleep_phase_5_min` string into a list of contiguous
 * stage blocks. Invalid characters (anything outside "1234") are
 * silently dropped so a noisy string still produces a usable hypnogram.
 */
export function parseSleepPhases(phases: string | null | undefined): HypnogramBlock[] {
  if (!phases || typeof phases !== 'string') return [];

  const blocks: HypnogramBlock[] = [];
  let currentStage: HypnogramStage | null = null;
  let currentRun = 0;
  let cursorMinute = 0;

  for (const ch of phases) {
    const stage = CHAR_TO_STAGE[ch];
    if (!stage) continue;
    if (stage === currentStage) {
      currentRun += INTERVAL_MIN;
      continue;
    }
    if (currentStage !== null && currentRun > 0) {
      blocks.push({
        startMinute: cursorMinute,
        stage: currentStage,
        durationMinutes: currentRun,
      });
      cursorMinute += currentRun;
    }
    currentStage = stage;
    currentRun = INTERVAL_MIN;
  }
  if (currentStage !== null && currentRun > 0) {
    blocks.push({
      startMinute: cursorMinute,
      stage: currentStage,
      durationMinutes: currentRun,
    });
  }
  return blocks;
}

/**
 * Sum minutes per stage across a block list. Pure.
 */
export function sumMinutesByStage(
  blocks: HypnogramBlock[],
): Record<HypnogramStage, number> {
  const out: Record<HypnogramStage, number> = { awake: 0, rem: 0, light: 0, deep: 0 };
  for (const b of blocks) {
    out[b.stage] += b.durationMinutes;
  }
  return out;
}

/**
 * Build a plausible hypnogram from aggregate minutes when sleep_phase_5_min
 * isn't available. Mirrors the distribution heuristic in the shell's
 * /api/oura/sleep-stages route so visual output stays consistent.
 *
 * The weighting follows real sleep architecture: deep dominates the first
 * half of the night, REM dominates the second half, light is spread evenly.
 */
export function buildHypnogramFromAggregates(agg: AggregateFallback): HypnogramBlock[] {
  const { totalMinutes, deepMinutes, remMinutes, lightMinutes, awakeMinutes } = agg;
  if (totalMinutes <= 0) return [];
  const numCycles = Math.max(1, Math.round(totalMinutes / 90));
  const deepPerCycle = deepMinutes / numCycles;
  const remPerCycle = remMinutes / numCycles;
  const lightPerCycle = lightMinutes / numCycles;
  const awakePerCycle = awakeMinutes / numCycles;

  const blocks: HypnogramBlock[] = [];
  let cursor = 0;
  for (let c = 0; c < numCycles; c++) {
    const deepWeight = numCycles > 1 ? 2 - c / (numCycles - 1) : 1;
    const remWeight = numCycles > 1 ? 0.5 + (c / (numCycles - 1)) * 1.5 : 1;

    const thisDeep = Math.max(0, Math.round((deepPerCycle * deepWeight) / 1.5));
    const thisRem = Math.max(0, Math.round((remPerCycle * remWeight) / 1.25));
    const thisLight = Math.max(0, Math.round(lightPerCycle));
    const thisAwake = Math.max(0, Math.round(awakePerCycle));

    if (thisLight > 0) {
      const half = Math.round(thisLight / 2);
      blocks.push({ startMinute: cursor, stage: 'light', durationMinutes: half });
      cursor += half;
    }
    if (thisDeep > 0) {
      blocks.push({ startMinute: cursor, stage: 'deep', durationMinutes: thisDeep });
      cursor += thisDeep;
    }
    if (thisLight > 0) {
      const half = Math.round(thisLight / 2);
      blocks.push({ startMinute: cursor, stage: 'light', durationMinutes: half });
      cursor += half;
    }
    if (thisRem > 0) {
      blocks.push({ startMinute: cursor, stage: 'rem', durationMinutes: thisRem });
      cursor += thisRem;
    }
    if (thisAwake > 0 && c < numCycles - 1) {
      blocks.push({ startMinute: cursor, stage: 'awake', durationMinutes: thisAwake });
      cursor += thisAwake;
    }
  }
  return blocks;
}

/**
 * Return HH:MM from an ISO timestamp as stored. We read the characters
 * directly so the server's timezone does not distort the bedtime that
 * Lanae actually experienced. Oura records the ring's captured offset,
 * so the raw HH:MM is already the right local number.
 */
function formatClockTime(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const m = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(ts);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

/**
 * Build a HypnogramResult from an Oura sleep_detail payload. Prefers the
 * 5-minute-resolution string when present; falls back to the aggregate
 * distribution when not.
 */
export function buildHypnogram(detail: SleepDetailInput | null | undefined): HypnogramResult {
  const empty: HypnogramResult = {
    blocks: [],
    totalMinutes: 0,
    bedtime: null,
    wakeTime: null,
    source: 'empty',
    minutesByStage: { awake: 0, rem: 0, light: 0, deep: 0 },
    efficiency: null,
    latencyMinutes: null,
    restlessPeriods: null,
  };
  if (!detail) return empty;

  const bedtime = formatClockTime(detail.bedtime_start);
  const wakeTime = formatClockTime(detail.bedtime_end);
  const efficiency =
    typeof detail.efficiency === 'number' && Number.isFinite(detail.efficiency)
      ? Math.round(detail.efficiency)
      : null;
  const latencyMinutes =
    typeof detail.latency === 'number' && Number.isFinite(detail.latency)
      ? Math.max(0, Math.round(detail.latency / 60))
      : null;
  const restlessPeriods =
    typeof detail.restless_periods === 'number' && Number.isFinite(detail.restless_periods)
      ? detail.restless_periods
      : null;

  // Prefer the real 5-minute-resolution string when present.
  const blocksFromReal = parseSleepPhases(detail.sleep_phase_5_min);
  if (blocksFromReal.length > 0) {
    const minutesByStage = sumMinutesByStage(blocksFromReal);
    const totalMinutes =
      minutesByStage.awake + minutesByStage.rem + minutesByStage.light + minutesByStage.deep;
    return {
      blocks: blocksFromReal,
      totalMinutes,
      bedtime,
      wakeTime,
      source: 'sleep_phase_5_min',
      minutesByStage,
      efficiency,
      latencyMinutes,
      restlessPeriods,
    };
  }

  // Fall back to the aggregate reconstruction.
  const totalSec = typeof detail.total_sleep_duration === 'number' ? detail.total_sleep_duration : 0;
  const deepSec = typeof detail.deep_sleep_duration === 'number' ? detail.deep_sleep_duration : 0;
  const remSec = typeof detail.rem_sleep_duration === 'number' ? detail.rem_sleep_duration : 0;
  const lightSec = typeof detail.light_sleep_duration === 'number' ? detail.light_sleep_duration : 0;
  const awakeSec = typeof detail.awake_time === 'number' ? detail.awake_time : 0;

  const totalMinutes = Math.round(totalSec / 60);
  const agg: AggregateFallback = {
    totalMinutes:
      totalMinutes > 0 ? totalMinutes : Math.round((deepSec + remSec + lightSec + awakeSec) / 60),
    deepMinutes: Math.round(deepSec / 60),
    remMinutes: Math.round(remSec / 60),
    lightMinutes: Math.round(lightSec / 60),
    awakeMinutes: Math.round(awakeSec / 60),
  };
  const blocks = buildHypnogramFromAggregates(agg);
  if (blocks.length === 0) {
    return { ...empty, bedtime, wakeTime, efficiency, latencyMinutes, restlessPeriods };
  }
  return {
    blocks,
    totalMinutes: agg.totalMinutes,
    bedtime,
    wakeTime,
    source: 'aggregates',
    minutesByStage: sumMinutesByStage(blocks),
    efficiency,
    latencyMinutes,
    restlessPeriods,
  };
}
