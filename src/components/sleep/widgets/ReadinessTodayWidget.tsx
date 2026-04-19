/**
 * Home widget: Readiness number + top contributor.
 *
 * Answers the #2 Oura wish-list item: "I want readiness to tell me WHY
 * it's 62 today" (docs/competitive/oura/user-reviews.md). We compute the
 * contributor waterfall inline and surface the single biggest driver
 * with plain-language framing.
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { fetchSleepWindow, splitWindowAtToday } from '@/lib/sleep/queries';
import { bandForScore } from '@/lib/sleep/bands';
import { computeContributors, type ContributorRow } from '@/lib/sleep/contributors';
import type { HomeWidgetContext } from '@/lib/home/widgets';

export async function ReadinessTodayWidget({ date }: HomeWidgetContext) {
  const supabase = createServiceClient();
  const window = await fetchSleepWindow(supabase, { today: date, days: 29 });
  const { priorRows, todayRow } = splitWindowAtToday(window.rows, date);
  const latest = window.latestRow;
  const score = latest?.readiness_score ?? null;
  const band = bandForScore(score);

  // Compute contributors over the 28-day prior window so we can tell her
  // which signal actually moved today's number.
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
  const contributors = computeContributors(contributorInput, contributorToday);
  const topDriver = contributors.find((c) => c.influence !== 'no_data' && c.influence !== 'neutral') ?? null;

  return (
    <Link
      href="/sleep/recovery"
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
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span className="tabular" style={{ fontSize: 18, fontWeight: 800 }}>
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
          Readiness {band.label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
          {topDriver
            ? `${topDriver.label} ${topDriver.direction === 'up' ? 'up' : 'down'} vs usual`
            : score === null
            ? 'Waiting on today\u2019s reading'
            : 'All contributors near your usual'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Tap to see the full driver breakdown.
        </div>
      </div>
    </Link>
  );
}
