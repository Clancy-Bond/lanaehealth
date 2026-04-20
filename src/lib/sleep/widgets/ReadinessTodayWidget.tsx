/**
 * Home widget: Readiness + top driver.
 *
 * Redesigned after mobile review — answers two questions in one card:
 *   - "How ready am I today?" (score + band)
 *   - "Why?" (top contributor inline)
 *
 * Flat card, matches SleepLastNightWidget layout so they read as a pair.
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { fetchSleepWindow, splitWindowAtToday } from '@/lib/sleep/queries';
import { bandForScore } from '@/lib/sleep/bands';
import { computeContributors, type ContributorRow } from '@/lib/sleep/contributors';
import type { HomeWidgetContext } from '@/lib/home/widgets';

export async function ReadinessTodayWidget({ date }: HomeWidgetContext) {
  const supabase = createServiceClient();
  const data = await fetchSleepWindow(supabase, { today: date, days: 29 });
  const { priorRows, todayRow } = splitWindowAtToday(data.rows, date);
  const latest = data.latestRow;
  const score = latest?.readiness_score ?? null;
  const band = bandForScore(score);

  const contributorInput: ContributorRow[] = priorRows.map((r) => ({
    date: r.date,
    hrv_avg: r.hrv_avg,
    resting_hr: r.resting_hr,
    sleep_score: r.sleep_score,
    body_temp_deviation: r.body_temp_deviation,
    respiratory_rate: r.respiratory_rate,
  }));
  const contributorToday: ContributorRow | null = todayRow
    ? {
        date: todayRow.date,
        hrv_avg: todayRow.hrv_avg,
        resting_hr: todayRow.resting_hr,
        sleep_score: todayRow.sleep_score,
        body_temp_deviation: todayRow.body_temp_deviation,
        respiratory_rate: todayRow.respiratory_rate,
      }
    : null;
  const topDriver = computeContributors(contributorInput, contributorToday).find(
    (c) => c.influence !== 'no_data' && c.influence !== 'neutral',
  ) ?? null;

  const subtitle = topDriver
    ? `${topDriver.label} ${topDriver.direction === 'up' ? 'up' : 'down'} vs usual`
    : score === null
    ? 'Waiting on today\u2019s reading'
    : 'All drivers near your usual';

  return (
    <Link
      href="/sleep/recovery"
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
          {'Readiness \u00B7 '}{band.label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, lineHeight: 1.3 }}>
          {subtitle}
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
