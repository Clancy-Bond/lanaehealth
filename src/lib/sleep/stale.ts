/**
 * Stale-data detection for the Sleep tab.
 *
 * Oura users rank firmware-breaking-sync and AI-only support among their
 * top complaints (docs/competitive/oura/user-reviews.md). We counter
 * both by never silently pretending old readings are today's. When the
 * latest oura_daily row is more than 24 hours old, every sleep route
 * surfaces a "Last synced" banner that links to /api/oura/sync.
 *
 * Pure helper module; no I/O so tests don't need Supabase.
 */

export interface StaleInput {
  /** Date (YYYY-MM-DD) of the most recent oura_daily row we have. */
  latestDate: string | null;
  /** Date (YYYY-MM-DD) we're rendering. Usually "today" in the user's tz. */
  today: string;
  /**
   * Optional synced_at ISO timestamp from oura_daily. When provided we
   * combine it with the date gap for a tighter "N hours ago" label.
   */
  syncedAt?: string | null;
  /** Clock override for tests. Defaults to Date.now(). */
  nowMs?: number;
}

export type StaleStatus = 'fresh' | 'stale' | 'never-synced';

export interface StaleResult {
  status: StaleStatus;
  /** Full days between today and the latest reading (0 when same-day). */
  daysStale: number;
  /** Short human label like "just now", "yesterday", "3 days ago". */
  label: string;
  /** ARIA-friendly longer phrasing for screen readers. */
  longLabel: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeStale({ latestDate, today, syncedAt, nowMs }: StaleInput): StaleResult {
  if (!latestDate) {
    return {
      status: 'never-synced',
      daysStale: Infinity,
      label: 'No recent sync',
      longLabel: 'No Oura readings have synced yet.',
    };
  }
  const parsed = Date.parse(latestDate + 'T00:00:00');
  const parsedToday = Date.parse(today + 'T00:00:00');
  if (Number.isNaN(parsed) || Number.isNaN(parsedToday)) {
    return {
      status: 'never-synced',
      daysStale: Infinity,
      label: 'No recent sync',
      longLabel: 'No Oura readings have synced yet.',
    };
  }
  const daysStale = Math.max(0, Math.round((parsedToday - parsed) / DAY_MS));

  // If we have a synced_at timestamp use it for finer-grained "hours ago" text.
  const now = nowMs ?? Date.now();
  let hoursSinceSync: number | null = null;
  if (syncedAt) {
    const syncedMs = Date.parse(syncedAt);
    if (!Number.isNaN(syncedMs)) {
      hoursSinceSync = Math.max(0, (now - syncedMs) / (60 * 60 * 1000));
    }
  }

  // "fresh" means the latest row is today's date AND the sync timestamp
  // is within the last 24 hours (if we have it).
  const isToday = daysStale === 0;
  const syncedRecently = hoursSinceSync === null ? true : hoursSinceSync <= 24;

  if (isToday && syncedRecently) {
    const label = hoursSinceSync !== null && hoursSinceSync < 1
      ? 'Just synced'
      : `Synced ${Math.round(hoursSinceSync ?? 0)}h ago`;
    return {
      status: 'fresh',
      daysStale: 0,
      label,
      longLabel: `Oura synced within the last day.`,
    };
  }

  // Otherwise the data is stale. Compose a human label.
  const label = daysStale === 0
    ? 'Awaiting today\u2019s sync'
    : daysStale === 1
    ? 'Yesterday\u2019s reading'
    : `${daysStale} days behind`;
  const longLabel = daysStale === 0
    ? 'Oura has not synced today\u2019s reading yet.'
    : daysStale === 1
    ? 'Last Oura reading is from yesterday.'
    : `Last Oura reading is ${daysStale} days old.`;

  return { status: 'stale', daysStale, label, longLabel };
}

/**
 * Convenience predicate: returns true when the latest row is older than
 * 24 hours OR missing entirely. Used by page components that only need
 * a boolean ("show banner?") rather than full metadata.
 */
export function isStale(input: StaleInput): boolean {
  return computeStale(input).status !== 'fresh';
}
