/**
 * Year-in-Pixels data shaping
 *
 * Flattens multi-source daily signals into one row per calendar date for the
 * trailing 365 days, and provides color-mapping helpers per selectable metric.
 *
 * Design choices:
 *   - Empty cells for no-data days (non-shaming). We distinguish missing from
 *     zero. Pain 0 is a legit value; no log at all is null.
 *   - Cycle phase is rendered as a BORDER by the consumer. This module only
 *     surfaces the phase; fill color is reserved for the selected metric.
 *   - Pain uses the --pain-* scale. Other metrics use --accent-sage (good) to
 *     --accent-blush (not good) interpolation, with --bg-elevated as "no data".
 *   - All date math is UTC-noon anchored so DST transitions don't skew the
 *     per-day bucketing.
 *
 * Contract: pure functions. No Supabase imports. Callers hand in rows.
 */

import type {
  DailyLog,
  OuraDaily,
  NcImported,
  CycleEntry,
  CyclePhase,
} from "@/lib/types";

// ── Metric contract ────────────────────────────────────────────────────
export type PixelMetric = "mood" | "pain" | "fatigue" | "sleep" | "flow" | "hrv";

export const PIXEL_METRICS: ReadonlyArray<{ value: PixelMetric; label: string }> = [
  { value: "mood", label: "Mood" },
  { value: "pain", label: "Pain" },
  { value: "fatigue", label: "Fatigue" },
  { value: "sleep", label: "Sleep" },
  { value: "flow", label: "Flow" },
  { value: "hrv", label: "HRV" },
];

// ── Per-day flattened shape ────────────────────────────────────────────
export interface PixelDay {
  /** YYYY-MM-DD, one-per-day key. */
  date: string;
  /** 1-5 (mood_entries). Null when no mood logged. */
  mood: number | null;
  /** 0-10 (daily_logs.overall_pain). */
  pain: number | null;
  /** 0-10 (daily_logs.fatigue). */
  fatigue: number | null;
  /** 0-100 (oura_daily.sleep_score). */
  sleep: number | null;
  /** 0-4 encoded (none..heavy) or null. */
  flow: number | null;
  /** HRV avg (ms). */
  hrv: number | null;
  /** Cycle phase if known. Rendered as border. */
  cyclePhase: CyclePhase | null;
}

// ── Inputs (what the server component hands in) ────────────────────────
export interface BuildPixelDaysInput {
  dailyLogs: Pick<DailyLog, "date" | "overall_pain" | "fatigue" | "cycle_phase">[];
  ouraDaily: Pick<OuraDaily, "date" | "sleep_score" | "hrv_avg">[];
  cycleEntries: Pick<CycleEntry, "date" | "flow_level" | "menstruation">[];
  ncImported: Pick<NcImported, "date" | "menstruation" | "cycle_day">[];
  /** Optional mood series, keyed by date. MoodEntry is joined via log_id on
   *  the DB; callers can pre-flatten or omit until the Lite Log is live. */
  moodByDate?: Record<string, number>;
  /** Anchor "today" (UTC). Defaults to now(). */
  today?: Date;
  /** Window size in days. Defaults to 365. */
  windowDays?: number;
}

// Flow ordinal: ranks flow levels 0-4 so we can map to a 0-1 scale for color.
const FLOW_RANK: Record<string, number> = {
  none: 0,
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
};

/**
 * Build 365 consecutive PixelDay rows, oldest first. Days with no data are
 * still present with all null metric fields so the grid renders a 365-cell
 * shape regardless of logging gaps.
 */
export function buildPixelDays(input: BuildPixelDaysInput): PixelDay[] {
  const windowDays = input.windowDays ?? 365;
  const today = input.today ?? new Date();
  const todayIso = isoDate(today);

  // Build an index from date to partial source rows for O(1) lookup.
  const logByDate = new Map<string, BuildPixelDaysInput["dailyLogs"][number]>();
  for (const r of input.dailyLogs) logByDate.set(r.date, r);

  const ouraByDate = new Map<string, BuildPixelDaysInput["ouraDaily"][number]>();
  for (const r of input.ouraDaily) ouraByDate.set(r.date, r);

  const cycleByDate = new Map<string, BuildPixelDaysInput["cycleEntries"][number]>();
  for (const r of input.cycleEntries) cycleByDate.set(r.date, r);

  const ncByDate = new Map<string, BuildPixelDaysInput["ncImported"][number]>();
  for (const r of input.ncImported) ncByDate.set(r.date, r);

  const days: PixelDay[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = addDaysIso(todayIso, -i);
    const log = logByDate.get(d) ?? null;
    const oura = ouraByDate.get(d) ?? null;
    const cyc = cycleByDate.get(d) ?? null;
    const nc = ncByDate.get(d) ?? null;

    const flowFromCycle = cyc?.flow_level ?? null;
    const flowRank = flowFromCycle
      ? FLOW_RANK[flowFromCycle] ?? null
      : nc?.menstruation
        ? 2 // NC tells us there was a period day; treat as "light" default
        : null;

    days.push({
      date: d,
      mood: input.moodByDate?.[d] ?? null,
      pain: log?.overall_pain ?? null,
      fatigue: log?.fatigue ?? null,
      sleep: oura?.sleep_score ?? null,
      hrv: oura?.hrv_avg ?? null,
      flow: flowRank,
      cyclePhase: log?.cycle_phase ?? null,
    });
  }
  return days;
}

// ── Color mapping ──────────────────────────────────────────────────────
// Empty / no-data token. Consumers may override via CSS but this is the
// canonical no-data swatch (distinct from zero). Non-shaming rule: empty
// cells must look intentional, not scolding.
export const EMPTY_FILL = "var(--bg-elevated)";

/**
 * Return the CSS color string for a given day + metric. Returns EMPTY_FILL
 * when the metric is null (missing data). Pain uses the --pain-* severity
 * ramp. All other metrics map to an --accent-sage to --accent-blush gradient
 * interpolated by value.
 */
export function colorForDay(day: PixelDay, metric: PixelMetric): string {
  const raw = day[metric];
  if (raw === null || raw === undefined) return EMPTY_FILL;

  if (metric === "pain") {
    return painColor(raw);
  }

  // Mood: 1 (low) to 5 (high). Higher is better.
  if (metric === "mood") {
    return accentRamp(clamp01((raw - 1) / 4), { higherIsBetter: true });
  }

  // Fatigue: 0-10. Higher = worse.
  if (metric === "fatigue") {
    return accentRamp(clamp01(raw / 10), { higherIsBetter: false });
  }

  // Sleep: 0-100 score. Higher = better.
  if (metric === "sleep") {
    return accentRamp(clamp01(raw / 100), { higherIsBetter: true });
  }

  // Flow: 0-4 ordinal. Higher = heavier (not "worse", just "more"), but we
  // keep the ramp going from sage (none) to blush (heavy) so the grid reads
  // as intensity, not valence.
  if (metric === "flow") {
    return accentRamp(clamp01(raw / 4), { higherIsBetter: false });
  }

  // HRV (ms): bucket relative to a physiologically plausible window so we do
  // not need a full per-user baseline pass here. Lanae's range is typically
  // 25-90 ms. Higher = better.
  if (metric === "hrv") {
    const t = clamp01((raw - 25) / (90 - 25));
    return accentRamp(t, { higherIsBetter: true });
  }

  return EMPTY_FILL;
}

/**
 * Pain color from the --pain-* scale (0-10). We bucket into the existing
 * token ramp to keep the grid consistent with the pain slider colors.
 */
export function painColor(pain: number): string {
  if (pain <= 0) return "var(--pain-none)";
  if (pain <= 2) return "var(--pain-low)";
  if (pain <= 4) return "var(--pain-mild)";
  if (pain <= 6) return "var(--pain-moderate)";
  if (pain <= 8) return "var(--pain-severe)";
  return "var(--pain-extreme)";
}

/**
 * Linear interpolation on the accent axis. t is 0..1 where:
 *   higherIsBetter=true  => t=1 is sage (good), t=0 is blush (rough)
 *   higherIsBetter=false => t=1 is blush (rough), t=0 is sage (good)
 */
export function accentRamp(
  t: number,
  opts: { higherIsBetter: boolean },
): string {
  const clamped = clamp01(t);
  const pct = Math.round((opts.higherIsBetter ? clamped : 1 - clamped) * 100);
  // pct=100 means fully sage (good), pct=0 means fully blush (rough).
  return `color-mix(in srgb, var(--accent-sage) ${pct}%, var(--accent-blush))`;
}

// ── Cycle phase border token ───────────────────────────────────────────
/**
 * Return the CSS color for a cycle phase border, or null if unknown. Border
 * is 1-2px, rendered by the consumer. Fill is reserved for the metric.
 */
export function borderForPhase(phase: CyclePhase | null): string | null {
  if (!phase) return null;
  switch (phase) {
    case "menstrual":
      return "var(--phase-menstrual)";
    case "follicular":
      return "var(--phase-follicular)";
    case "ovulatory":
      return "var(--phase-ovulatory)";
    case "luteal":
      return "var(--phase-luteal)";
    default:
      return null;
  }
}

// ── Accessibility copy ─────────────────────────────────────────────────
/**
 * Build an aria-label for a pixel square. Screen readers get a full sentence:
 * date + metric value + cycle phase if known. "Not logged" for empty cells
 * so the audio stream doesn't skip silently.
 */
export function ariaLabelForDay(day: PixelDay, metric: PixelMetric): string {
  const date = formatDateLong(day.date);
  const raw = day[metric];
  if (raw === null || raw === undefined) {
    return `${date}, ${metric} not logged`;
  }
  const phase = day.cyclePhase ? `, ${day.cyclePhase} phase` : "";
  return `${date}, ${metric} ${valueLabel(metric, raw)}${phase}`;
}

function valueLabel(metric: PixelMetric, v: number): string {
  if (metric === "mood") return `${Math.round(v)} of 5`;
  if (metric === "pain") return `${Math.round(v)} of 10`;
  if (metric === "fatigue") return `${Math.round(v)} of 10`;
  if (metric === "sleep") return `${Math.round(v)} of 100`;
  if (metric === "hrv") return `${Math.round(v)} milliseconds`;
  if (metric === "flow") {
    const label = ["none", "spotting", "light", "medium", "heavy"][Math.round(v)] ?? "";
    return label;
  }
  return String(v);
}

// ── Grouping: month-by-week layout ─────────────────────────────────────
export interface MonthColumn {
  /** 0-indexed year-month key, e.g. "2026-04". */
  key: string;
  /** Short month label, e.g. "Apr". */
  label: string;
  /** Start-of-week bucket: each week's 7 cells. Gaps before day 1 and after
   *  the last day are null placeholders to keep the grid aligned. */
  weeks: Array<Array<PixelDay | null>>;
}

/**
 * Group pixel days into month columns with week rows. Rows are Monday-start
 * (matching the rest of the app's cycle-day grouping). Empty leading/trailing
 * cells are null so the column heights align.
 */
export function groupByMonthWeek(days: PixelDay[]): MonthColumn[] {
  const byMonth = new Map<string, PixelDay[]>();
  for (const d of days) {
    const key = d.date.slice(0, 7); // YYYY-MM
    const bucket = byMonth.get(key) ?? [];
    bucket.push(d);
    byMonth.set(key, bucket);
  }

  const out: MonthColumn[] = [];
  // Preserve chronological order by iterating days (already sorted).
  const seen = new Set<string>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    if (seen.has(key)) continue;
    seen.add(key);

    const monthDays = byMonth.get(key) ?? [];
    const first = monthDays[0];
    const firstDow = mondayStartDow(first.date);

    const weeks: Array<Array<PixelDay | null>> = [];
    let currentWeek: Array<PixelDay | null> = Array(firstDow).fill(null);

    for (const md of monthDays) {
      currentWeek.push(md);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    out.push({ key, label: monthLabel(first.date), weeks });
  }
  return out;
}

// ── Date helpers (pure, no locale dependency for the ISO work) ─────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a Date to YYYY-MM-DD in UTC. */
export function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Add delta days to an ISO date string, returning a new ISO date. */
export function addDaysIso(iso: string, delta: number): string {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDate(d);
}

/** Monday-start day-of-week: 0=Mon, 6=Sun. */
export function mondayStartDow(iso: string): number {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  const jsDow = d.getUTCDay(); // 0=Sun..6=Sat
  return (jsDow + 6) % 7;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return MONTH_SHORT[month - 1] ?? "";
}

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export function formatDateLong(iso: string): string {
  const [y, m, dd] = iso.split("-").map(Number);
  return `${MONTH_LONG[m - 1]} ${dd}, ${y}`;
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
