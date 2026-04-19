/**
 * /sleep/recovery -- HRV / RHR / readiness vs. 28-day baseline.
 *
 * Oura reviewers love the separation of Sleep Score / Recovery /
 * Readiness into three distinct numbers. This page brings that apart
 * view into LanaeHealth by reusing the shared BaselineCard (which is
 * the exact Tukey-IQR computation on oura_daily) and layering the
 * readiness contributor breakdown on top.
 *
 * We don't duplicate BaselineCard; we import it and feed it the same
 * windowRows/todayRow it expects on Home.
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';
import Link from 'next/link';
import { fetchSleepWindow, splitWindowAtToday } from '@/lib/sleep/queries';
import { computeStale } from '@/lib/sleep/stale';
import { StaleBanner } from '@/components/sleep/StaleBanner';
import { BaselineCard } from '@/components/home/BaselineCard';
import { ContributorList } from '@/components/sleep/ContributorList';
import { ScoreRing } from '@/components/sleep/ScoreRing';
import { bandForScore, deltaVsAverage } from '@/lib/sleep/bands';
import { avgOf } from '@/lib/sleep/queries';
import type { DailyRow } from '@/lib/intelligence/baseline';
import type { ContributorRow } from '@/lib/sleep/contributors';

export const dynamic = 'force-dynamic';

export default async function SleepRecoveryPage() {
  const supabase = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const data = await fetchSleepWindow(supabase, { today, days: 29 });
  const { priorRows, todayRow } = splitWindowAtToday(data.rows, today);

  const stale = computeStale({
    latestDate: data.latestDate,
    today,
    syncedAt: data.latestSyncedAt,
  });

  // BaselineCard expects a specific DailyRow shape; map from our SleepRingRow.
  const baselineWindowRows: DailyRow[] = priorRows.map((r) => ({
    date: r.date,
    resting_hr: r.resting_hr,
    hrv_avg: r.hrv_avg,
    body_temp_deviation: r.body_temp_deviation,
    respiratory_rate: r.respiratory_rate,
  }));
  const baselineTodayRow: DailyRow | null = todayRow
    ? {
        date: todayRow.date,
        resting_hr: todayRow.resting_hr,
        hrv_avg: todayRow.hrv_avg,
        body_temp_deviation: todayRow.body_temp_deviation,
        respiratory_rate: todayRow.respiratory_rate,
      }
    : null;
  const lastSynced = priorRows.length > 0 ? priorRows[priorRows.length - 1].date : null;

  // Contributor list: wants the sleep_score + same numeric signals.
  const contributorWindow: ContributorRow[] = priorRows.map((r) => ({
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

  const latestRow = data.latestRow;
  const last7 = data.rows.slice(-7);
  const avgReadiness = avgOf(last7, (r) => r.readiness_score);
  const readinessDelta = deltaVsAverage(latestRow?.readiness_score ?? null, avgReadiness);
  const readinessBand = bandForScore(latestRow?.readiness_score ?? null);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '12px 16px 96px',
        maxWidth: 820,
        margin: '0 auto',
      }}
    >
      <header>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          <Link href="/sleep" style={{ color: 'inherit', textDecoration: 'none' }}>
            &larr; Sleep
          </Link>
        </p>
        <h1 className="page-title" style={{ marginTop: 2 }}>
          Recovery today
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
          How ready your body is vs. the last 28 days. Observation only, never a verdict.
        </p>
      </header>

      {stale.status !== 'fresh' && (
        <StaleBanner stale={stale} latestDate={data.latestDate} />
      )}

      {/* Readiness hero */}
      <section
        style={{
          padding: '18px 16px',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <ScoreRing
          label="Readiness"
          score={latestRow?.readiness_score ?? null}
          caption={
            readinessDelta !== null
              ? `${readinessDelta > 0 ? '+' : ''}${readinessDelta} vs 7-day avg`
              : 'No 7-day average yet'
          }
          size={132}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: readinessBand.color, textTransform: 'uppercase' }}>
            {readinessBand.label}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.4, marginTop: 4 }}>
            {latestRow
              ? readinessCopy(latestRow.readiness_score)
              : 'Waiting on today\u2019s reading.'}
          </div>
        </div>
      </section>

      <ContributorList windowRows={contributorWindow} todayRow={contributorToday} />

      <BaselineCard
        windowRows={baselineWindowRows}
        todayRow={baselineTodayRow}
        lastSyncedDate={lastSynced}
        today={today}
      />
    </main>
  );
}

function readinessCopy(score: number | null): string {
  if (score === null) return 'Waiting on today\u2019s reading.';
  if (score >= 85) return 'Your body is in strong shape for today\u2019s plans.';
  if (score >= 70) return 'Solid foundation today; move through your day at a normal pace.';
  if (score >= 60) return 'A bit less capacity than usual. Consider easing the heaviest tasks.';
  return 'Your body is asking for a lighter day. Rest is not regression.';
}
