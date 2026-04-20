/**
 * /sleep/recovery -- Readiness + contributor breakdown.
 *
 * Redesign applied after the mobile review flagged the "9+ no-reading-yet
 * messages" graveyard effect when today's data hasn't synced.
 *
 * Now:
 *   - When today's row is missing we show ONE unified "waiting on
 *     today" state with the last known reading + date.
 *   - When today's row is present we render the contributor waterfall
 *     and the BaselineCard together.
 *   - Ring + description is a single cohesive hero, not ring-on-left-
 *     text-on-right.
 *
 * Server component. One parallel fetch via fetchSleepWindow.
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';
import Link from 'next/link';
import { fetchSleepWindow, splitWindowAtToday, avgOf } from '@/lib/sleep/queries';
import { computeStale } from '@/lib/sleep/stale';
import { StaleBanner } from '@/components/sleep/StaleBanner';
import { BaselineCard } from '@/components/home/BaselineCard';
import { ContributorList } from '@/components/sleep/ContributorList';
import { ScoreRing } from '@/components/sleep/ScoreRing';
import { bandForScore, deltaVsAverage } from '@/lib/sleep/bands';
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

  const last7 = data.rows.slice(-7);
  const avgReadiness = avgOf(last7, (r) => r.readiness_score);
  const latestRow = data.latestRow;
  const readinessScore = latestRow?.readiness_score ?? null;
  const readinessDelta = deltaVsAverage(readinessScore, avgReadiness);
  const readinessBand = bandForScore(readinessScore);
  const hasToday = todayRow !== null;

  // Contributor + BaselineCard share the same row set. When todayRow is
  // null we render a single consolidated "waiting on today" callout and
  // still show the contributor baseline numbers so the user knows what
  // the typical range looks like.
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

  // BaselineCard inputs for the "present today" branch only.
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

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '12px 16px 120px',
        maxWidth: 820,
        margin: '0 auto',
      }}
    >
      <header>
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
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
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.4 }}>
          {'How ready your body is vs. the last 28 days.'}
        </p>
      </header>

      {stale.status !== 'fresh' && (
        <StaleBanner stale={stale} latestDate={data.latestDate} />
      )}

      <section
        style={{
          padding: '18px 18px 16px',
          borderRadius: 'var(--radius-lg)',
          background:
            'linear-gradient(180deg, #FFFFFF 0%, #FBFBF7 55%, #F5F5F0 100%)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          textAlign: 'center',
        }}
      >
        <ScoreRing
          label="Readiness"
          score={readinessScore}
          size={160}
          strokeWidth={12}
          ringOnly
        />
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: readinessBand.color,
          }}
        >
          {'Readiness \u00B7 '}{readinessBand.label}
        </div>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-primary)',
            margin: 0,
            maxWidth: 380,
          }}
        >
          {readinessCopy(readinessScore, hasToday)}
        </p>
        {readinessDelta !== null && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {readinessDelta > 0 ? '+' : ''}
            {readinessDelta} vs 7-day avg
          </div>
        )}
      </section>

      {hasToday ? (
        <>
          <ContributorList windowRows={contributorWindow} todayRow={contributorToday} />
          <BaselineCard
            windowRows={baselineWindowRows}
            todayRow={baselineTodayRow}
            lastSyncedDate={lastSynced}
            today={today}
          />
        </>
      ) : (
        <WaitingOnToday latestDate={data.latestDate} contributorWindow={contributorWindow} />
      )}
    </main>
  );
}

function readinessCopy(score: number | null, hasToday: boolean): string {
  if (!hasToday) {
    return 'Showing your most recent synced reading. Contributors fill in once today syncs.';
  }
  if (score === null) return 'Waiting on today\u2019s reading.';
  if (score >= 85) return 'Your body is in strong shape for today\u2019s plans.';
  if (score >= 70) return 'Solid foundation today. Move at a normal pace.';
  if (score >= 60) return 'A bit less capacity than usual. Consider easing the heaviest tasks.';
  return 'Your body is asking for a lighter day. Rest is not regression.';
}

/**
 * Unified "no today yet" state that replaces the 9+ repeated empty rows
 * from the first-pass design. Shows the four baseline metrics as
 * reference values (what's typical) so the page still delivers value
 * when today's row hasn't synced.
 */
function WaitingOnToday({
  latestDate,
  contributorWindow,
}: {
  latestDate: string | null;
  contributorWindow: ContributorRow[];
}) {
  const hrv = median(contributorWindow.map((r) => r.hrv_avg));
  const rhr = median(contributorWindow.map((r) => r.resting_hr));
  const temp = median(contributorWindow.map((r) => r.body_temp_deviation));
  const resp = median(contributorWindow.map((r) => r.respiratory_rate));

  return (
    <section
      style={{
        padding: '16px 18px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Your 28-day typical</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
          {latestDate
            ? `Today hasn\u2019t synced yet. Last reading ${latestDate}. These numbers are what's typical for you.`
            : 'Today hasn\u2019t synced yet. These numbers are what\u2019s typical for you.'}
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}
      >
        <TypicalTile label="HRV" value={hrv !== null ? `${Math.round(hrv)}` : '\u2014'} unit="ms" />
        <TypicalTile label="Resting HR" value={rhr !== null ? `${Math.round(rhr)}` : '\u2014'} unit="bpm" />
        <TypicalTile
          label="Body temp"
          value={temp !== null ? `${temp > 0 ? '+' : ''}${temp.toFixed(2)}` : '\u2014'}
          unit={'\u00B0C'}
        />
        <TypicalTile
          label="Respiratory"
          value={resp !== null ? resp.toFixed(1) : '\u2014'}
          unit="br/min"
        />
      </div>
    </section>
  );
}

function median(vals: (number | null)[]): number | null {
  const clean = vals.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
}

function TypicalTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 17, fontWeight: 700, marginTop: 3 }}>
        {value}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 3 }}>
          {unit}
        </span>
      </div>
    </div>
  );
}
