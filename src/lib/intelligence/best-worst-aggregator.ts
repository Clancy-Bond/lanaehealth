/**
 * Best vs Worst Days aggregator (Daylio Feature 3)
 *
 * Pure, IO-free aggregation. Given mood_entries (with attached log_id) and
 * custom_trackable_entries, partition days by mood_score and rank the
 * activities/factors that appear most frequently on each side.
 *
 * Contract:
 *   - Best bucket: mood_score in {4, 5}
 *   - Worst bucket: mood_score in {1, 2}
 *   - Minimum 10 days per bucket before any results surface (non-shaming:
 *     small samples can mislead and push Lanae toward adherence framing).
 *   - Frequency only. No p-values, no effect sizes, no causal claims.
 *   - Voice: "Common on" rather than "Causes" per docs/plans/2026-04-16-
 *     non-shaming-voice-rule.md. All copy centralized in this module so
 *     tests can pin it down.
 *
 * Consumer: src/components/patterns/BestWorstDaysCard.tsx reads the
 * AggregationResult and renders side-by-side columns. The component does
 * not decide copy or thresholds; that lives here.
 */

import type { MoodScore, TrackableCategory } from "@/lib/types";

// ── Tunables ────────────────────────────────────────────────────────────
/** Minimum days in a bucket before we render top items for that side. */
export const MIN_DAYS_PER_BUCKET = 10;

/** How many top items to surface per bucket. */
export const TOP_N = 5;

// ── Inputs ──────────────────────────────────────────────────────────────
/**
 * A mood row attached to the daily_log identifier. Shape matches
 * `mood_entries` projected with `log_id`.
 */
export interface MoodRow {
  log_id: string;
  mood_score: MoodScore;
  /** Optional, purely for window filtering upstream. Not read here. */
  logged_at?: string;
}

/**
 * Shape of a custom_trackable_entries row joined to its parent trackable
 * definition. The join is expected to happen at the query layer (select
 * with a PostgREST `!inner` relationship); this module only aggregates.
 */
export interface TrackableEntryRow {
  log_id: string;
  trackable_id: string;
  toggled: boolean | null;
  value: number | null;
  trackable: {
    id: string;
    name: string;
    category: TrackableCategory;
    icon: string | null;
  };
}

// ── Outputs ─────────────────────────────────────────────────────────────
export interface TopItem {
  trackable_id: string;
  name: string;
  category: TrackableCategory;
  icon: string | null;
  /** How many bucket days this item appears on. */
  count: number;
  /** count / bucketSize, 0..1. Surface as percentage in UI. */
  frequency: number;
}

export type BucketKey = "best" | "worst";

export interface BucketResult {
  key: BucketKey;
  /** Copy for the column header. */
  label: string;
  /** Count of unique log_ids in this bucket. */
  bucketSize: number;
  /** True when we render items. False returns hold-copy. */
  hasEnoughData: boolean;
  /** Sorted highest frequency first, capped at TOP_N. Empty until hasEnoughData. */
  items: TopItem[];
}

export interface AggregationResult {
  best: BucketResult;
  worst: BucketResult;
  /** Stable footer copy the UI must always show. */
  footnote: string;
  /** Window description for the sub-header (e.g. "Last 90 days"). */
  windowLabel: string;
  /** True iff either bucket met threshold. Used by the UI to decide between
   *  the rendered card and a single empty state. */
  anyBucketReady: boolean;
}

// ── Copy (centralized for tests + voice audit) ─────────────────────────
export const COPY = {
  /** Column header on the "best" side. Daylio uses "Rad"; we stay warmer. */
  bestLabel: "Best days",
  /** Column header on the "worst" side. Avoid "bad"; "rough" is gentler. */
  worstLabel: "Rough days",
  /**
   * Always-on disclaimer. Non-shaming rule: we never imply these items
   * CAUSE the outcome, only that they co-occur. No em dashes.
   */
  footnote:
    "These are patterns, not causes. Bodies are complex; one factor rarely explains a day.",
  /** Pre-threshold hold copy (shared card empty state). */
  holdTitle: "Keep logging to unlock this card",
  holdBody:
    "Once you have ten or more days in either the best or the rough group, the top factors show up here.",
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Classify a mood_score into a bucket. Neutral (3) is intentionally null
 * so it does not inflate either side.
 */
export function bucketForScore(score: MoodScore): BucketKey | null {
  if (score >= 4) return "best";
  if (score <= 2) return "worst";
  return null;
}

/**
 * Build a Set of log_ids for each bucket from the mood rows.
 * Ties (the same log_id appearing twice with different scores, which would
 * be a data integrity issue) keep the LAST row's bucket, matching what a
 * natural "latest write wins" mood entry UI would produce.
 */
export function bucketLogIds(
  moods: ReadonlyArray<MoodRow>,
): { best: Set<string>; worst: Set<string> } {
  const best = new Set<string>();
  const worst = new Set<string>();
  for (const m of moods) {
    const bucket = bucketForScore(m.mood_score);
    if (!bucket) continue;
    // latest-write-wins semantics: if we see the same log_id again with a
    // different bucket classification, remove from the old set first.
    if (bucket === "best") {
      worst.delete(m.log_id);
      best.add(m.log_id);
    } else {
      best.delete(m.log_id);
      worst.add(m.log_id);
    }
  }
  return { best, worst };
}

/**
 * Check whether a trackable entry counts as "present" for a given day.
 *
 * Rules:
 *   - If `toggled` is explicitly false, it does NOT count (user tapped it off).
 *   - If `toggled` is true OR null (with a numeric value > 0), it counts.
 *   - If value is null AND toggled is null, we skip (empty row).
 *
 * This keeps the aggregation honest: scale entries with value=0 are
 * "logged as none", not "present."
 */
export function entryCounts(entry: TrackableEntryRow): boolean {
  if (entry.toggled === true) return true;
  if (entry.toggled === false) return false;
  if (entry.value !== null && entry.value > 0) return true;
  return false;
}

/**
 * Given a set of log_ids and the entry rows for those logs, count per
 * trackable the number of distinct log_ids it appears on. De-duplicates
 * within a single day so a double-toggle doesn't double-count.
 */
export function countByTrackable(
  bucket: ReadonlySet<string>,
  entries: ReadonlyArray<TrackableEntryRow>,
): Map<string, { count: number; sample: TrackableEntryRow }> {
  const seen = new Map<string, Set<string>>(); // trackable_id -> set of log_ids
  const samples = new Map<string, TrackableEntryRow>();
  for (const entry of entries) {
    if (!bucket.has(entry.log_id)) continue;
    if (!entryCounts(entry)) continue;
    if (!seen.has(entry.trackable_id)) {
      seen.set(entry.trackable_id, new Set());
      samples.set(entry.trackable_id, entry);
    }
    seen.get(entry.trackable_id)!.add(entry.log_id);
  }
  const result = new Map<string, { count: number; sample: TrackableEntryRow }>();
  for (const [tid, logIds] of seen.entries()) {
    result.set(tid, { count: logIds.size, sample: samples.get(tid)! });
  }
  return result;
}

/**
 * Ranks counts into a TOP_N list, descending by count then alphabetical by
 * name for deterministic ties.
 */
export function rankTop(
  counts: ReadonlyMap<string, { count: number; sample: TrackableEntryRow }>,
  bucketSize: number,
  topN: number = TOP_N,
): TopItem[] {
  if (bucketSize <= 0) return [];
  const items: TopItem[] = [];
  for (const [tid, { count, sample }] of counts.entries()) {
    if (count <= 0) continue;
    items.push({
      trackable_id: tid,
      name: sample.trackable.name,
      category: sample.trackable.category,
      icon: sample.trackable.icon,
      count,
      frequency: count / bucketSize,
    });
  }
  items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
  return items.slice(0, topN);
}

/**
 * Format a frequency (0..1) as an integer percentage. Rounds half-up.
 * Kept here so unit tests can pin exact output and copy audits can reason
 * about a single source of truth.
 */
export function formatFrequency(freq: number): string {
  const clamped = Math.max(0, Math.min(1, freq));
  return `${Math.round(clamped * 100)}%`;
}

// ── Public API ──────────────────────────────────────────────────────────

export interface AggregateInput {
  moods: ReadonlyArray<MoodRow>;
  entries: ReadonlyArray<TrackableEntryRow>;
  /** Optional description for the sub-header. Default: "Last 90 days". */
  windowLabel?: string;
  /** Override the min-days threshold. Tests only. */
  minDaysPerBucket?: number;
  /** Override top-N. Tests only. */
  topN?: number;
}

/**
 * Entry point. Pure function, no IO.
 */
export function aggregateBestWorst(input: AggregateInput): AggregationResult {
  const minDays = input.minDaysPerBucket ?? MIN_DAYS_PER_BUCKET;
  const topN = input.topN ?? TOP_N;
  const windowLabel = input.windowLabel ?? "Last 90 days";

  const { best, worst } = bucketLogIds(input.moods);

  const bestCounts = countByTrackable(best, input.entries);
  const worstCounts = countByTrackable(worst, input.entries);

  const bestReady = best.size >= minDays;
  const worstReady = worst.size >= minDays;

  const bestBucket: BucketResult = {
    key: "best",
    label: COPY.bestLabel,
    bucketSize: best.size,
    hasEnoughData: bestReady,
    items: bestReady ? rankTop(bestCounts, best.size, topN) : [],
  };

  const worstBucket: BucketResult = {
    key: "worst",
    label: COPY.worstLabel,
    bucketSize: worst.size,
    hasEnoughData: worstReady,
    items: worstReady ? rankTop(worstCounts, worst.size, topN) : [],
  };

  return {
    best: bestBucket,
    worst: worstBucket,
    footnote: COPY.footnote,
    windowLabel,
    anyBucketReady: bestReady || worstReady,
  };
}
