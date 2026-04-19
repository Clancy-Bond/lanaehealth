/**
 * Home widget: Sleep score + hours from the most recent Oura night.
 *
 * Registered via src/lib/sleep/home-widgets.ts. Renders as a single
 * row inside the Home widget grid with a tap-through to /sleep. When
 * the latest row is stale, we label it accordingly instead of pretending
 * tonight's data exists.
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { fetchSleepWindow } from '@/lib/sleep/queries';
import { bandForScore, formatDurationFromSeconds } from '@/lib/sleep/bands';
import { computeStale } from '@/lib/sleep/stale';
import type { HomeWidgetContext } from '@/lib/home/widgets';

export async function SleepLastNightWidget({ date }: HomeWidgetContext) {
  const supabase = createServiceClient();
  const window = await fetchSleepWindow(supabase, { today: date, days: 3 });
  const latest = window.latestRow;
  const stale = computeStale({
    latestDate: window.latestDate,
    today: date,
    syncedAt: window.latestSyncedAt,
  });
  const score = latest?.sleep_score ?? null;
  const band = bandForScore(score);
  const hours = formatDurationFromSeconds(latest?.sleep_duration ?? null);

  return (
    <Link
      href="/sleep"
      className="press-feedback"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        textDecoration: 'none',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          border: `3px solid ${band.color}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-card)',
          flexShrink: 0,
        }}
      >
        <span className="tabular" style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>
          {score ?? '\u2014'}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: band.color,
          }}
        >
          Sleep {band.label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
          {hours ? `${hours} asleep` : 'Duration not recorded'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {stale.status === 'fresh'
            ? 'Synced in the last day'
            : stale.status === 'never-synced'
            ? 'No sync yet. Connect Oura in Settings.'
            : stale.label}
        </div>
      </div>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
