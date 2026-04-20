/**
 * Home widget: last night sleep score + hours.
 *
 * Redesigned after mobile review — flat single-card with a clear
 * hierarchy (band colour ring, bold score, hours subtitle). No more
 * border + shadow + internal border stacking.
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { fetchSleepWindow } from '@/lib/sleep/queries';
import { bandForScore, formatDurationFromSeconds } from '@/lib/sleep/bands';
import { computeStale } from '@/lib/sleep/stale';
import type { HomeWidgetContext } from '@/lib/home/widgets';

export async function SleepLastNightWidget({ date }: HomeWidgetContext) {
  const supabase = createServiceClient();
  const data = await fetchSleepWindow(supabase, { today: date, days: 3 });
  const latest = data.latestRow;
  const stale = computeStale({
    latestDate: data.latestDate,
    today: date,
    syncedAt: data.latestSyncedAt,
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
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        textDecoration: 'none',
        color: 'var(--text-primary)',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: `3.5px solid ${band.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span className="tabular" style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {score ?? '\u2014'}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: band.color,
          }}
        >
          {'Sleep \u00B7 '}{band.label}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, letterSpacing: '-0.01em' }}>
          {hours ?? 'No duration'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {stale.status === 'fresh'
            ? 'Synced today'
            : stale.status === 'never-synced'
            ? 'Connect Oura to start'
            : stale.label}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden style={{ color: 'var(--text-muted)' }}>
        <path
          d="M7.5 5L12.5 10L7.5 15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
