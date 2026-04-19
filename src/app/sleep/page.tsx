/**
 * /sleep -- Sleep tab overview.
 *
 * Oura's standout moment is opening the app to three concentric rings
 * (sleep / readiness / HRV) that answer "how did I sleep?" and "how
 * recovered am I?" in one glance. We mirror that mental model with the
 * warm-modern palette and, crucially, never hide stale data.
 *
 * Deliverable list (docs/plans/2026-04-19-clone-prompts.md PROMPT 4):
 *   - readiness-score ring
 *   - sleep-score ring
 *   - HRV 7-day sparkline
 *   - body-temp deviation gauge
 *   - deep links to /sleep/stages, /sleep/recovery, /sleep/log
 *
 * Server component. One parallel fetch batch (fetchSleepWindow) powers
 * the whole page; child components receive pre-sliced data.
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  fetchSleepWindow,
  splitWindowAtToday,
  avgOf,
  type SleepRingRow,
} from '@/lib/sleep/queries';
import { computeStale } from '@/lib/sleep/stale';
import { bandForScore, formatDurationFromSeconds, deltaVsAverage } from '@/lib/sleep/bands';
import { ScoreRing } from '@/components/sleep/ScoreRing';
import { StaleBanner } from '@/components/sleep/StaleBanner';
import { HrvSparkline } from '@/components/sleep/HrvSparkline';
import { BodyTempGauge } from '@/components/sleep/BodyTempGauge';

export const dynamic = 'force-dynamic';

export default async function SleepOverview() {
  const supabase = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const window = await fetchSleepWindow(supabase, { today, days: 29 });
  const { priorRows } = splitWindowAtToday(window.rows, today);

  const latest = window.latestRow;
  const stale = computeStale({
    latestDate: window.latestDate,
    today,
    syncedAt: window.latestSyncedAt,
  });

  // "Last night" readings: always the most recent row, even if sync is lagging.
  const lastNight = latest;
  const lastNightDate = lastNight?.date ?? null;

  // 7-day averages for the subtitle deltas + the HRV sparkline.
  const last7 = window.rows.slice(-7);
  const avgSleep = avgOf(last7, (r) => r.sleep_score);
  const avgReadiness = avgOf(last7, (r) => r.readiness_score);
  const avgHrv = avgOf(last7, (r) => r.hrv_avg);

  const sleepDelta = deltaVsAverage(lastNight?.sleep_score ?? null, avgSleep);
  const readinessDelta = deltaVsAverage(lastNight?.readiness_score ?? null, avgReadiness);

  const hrvTrend = last7.map((r) => r.hrv_avg);
  const bodyTempTrend = last7.map((r) => r.body_temp_deviation);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '12px 16px 96px',
        maxWidth: 920,
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
          Sleep
        </p>
        <h1 className="page-title" style={{ marginTop: 2 }}>
          {lastNight
            ? `Last night`
            : 'Sleep overview'}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: '4px 0 0',
            lineHeight: 1.4,
          }}
        >
          {lastNightDate
            ? `Oura reading from ${format(new Date(lastNightDate + 'T00:00:00'), 'EEE MMM d')}.`
            : 'Pull in Oura data from Settings to populate this view.'}
        </p>
      </header>

      {stale.status !== 'fresh' && (
        <StaleBanner stale={stale} latestDate={window.latestDate} />
      )}

      {/* Primary rings */}
      <section
        aria-label="Tonight\u2019s scores"
        style={{
          padding: '18px 16px',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'grid',
          gap: 16,
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        <ScoreRing
          label="Sleep"
          score={lastNight?.sleep_score ?? null}
          caption={
            sleepDelta !== null
              ? `${sleepDelta > 0 ? '+' : ''}${sleepDelta} vs 7-day avg`
              : 'No 7-day average yet'
          }
        />
        <ScoreRing
          label="Readiness"
          score={lastNight?.readiness_score ?? null}
          caption={
            readinessDelta !== null
              ? `${readinessDelta > 0 ? '+' : ''}${readinessDelta} vs 7-day avg`
              : 'No 7-day average yet'
          }
        />
      </section>

      {/* Secondary stats: total sleep + deep + REM, short and scannable */}
      {lastNight && (
        <section
          aria-label="Last-night breakdown"
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: 12,
          }}
        >
          <StatTile
            label="Total asleep"
            value={formatDurationFromSeconds(lastNight.sleep_duration) ?? '\u2014'}
          />
          <StatTile
            label="Deep"
            value={lastNight.deep_sleep_min !== null ? `${lastNight.deep_sleep_min}m` : '\u2014'}
          />
          <StatTile
            label="REM"
            value={lastNight.rem_sleep_min !== null ? `${lastNight.rem_sleep_min}m` : '\u2014'}
          />
          <StatTile
            label="Resting HR"
            value={lastNight.resting_hr !== null ? `${lastNight.resting_hr} bpm` : '\u2014'}
          />
        </section>
      )}

      {/* HRV 7-day trend */}
      <section
        aria-labelledby="hrv-title"
        style={{
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3 id="hrv-title" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
            HRV over 7 days
          </h3>
          <span className="tabular" style={{ fontSize: 14, fontWeight: 700 }}>
            {avgHrv !== null ? `${Math.round(avgHrv)} ms` : '\u2014'}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>avg</span>
          </span>
        </div>
        <HrvSparkline values={hrvTrend} />
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
          HRV trending alongside sleep tells us more than either reading alone.
        </p>
      </section>

      <BodyTempGauge
        todayDeviation={lastNight?.body_temp_deviation ?? null}
        trendDeviations={bodyTempTrend}
      />

      <DeepLinks />

      {/* Best/worst night quick list (Oura "nights" pattern) */}
      <NightsList rows={priorRows.slice(-14).reverse()} />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </div>
      <div className="tabular" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function DeepLinks() {
  const LINKS = [
    { href: '/sleep/stages', label: 'Sleep stages', hint: 'REM / Deep / Light breakdown' },
    { href: '/sleep/recovery', label: 'Recovery today', hint: 'HRV + RHR vs 28-day baseline' },
    { href: '/sleep/log', label: 'Log a manual night', hint: 'Fill in the days Oura missed' },
    { href: '/patterns/sleep', label: 'Open trends', hint: '30-day time series' },
  ];
  return (
    <nav aria-label="Sleep details"
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="press-feedback"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 6px',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            color: 'var(--text-primary)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{link.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{link.hint}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M7 5L12 10L7 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ))}
    </nav>
  );
}

function NightsList({ rows }: { rows: SleepRingRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="nights-title"
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h3 id="nights-title" style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>
        Recent nights
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r) => {
          const band = bandForScore(r.sleep_score);
          const hours = formatDurationFromSeconds(r.sleep_duration);
          return (
            <li
              key={r.date}
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 60px 1fr auto',
                gap: 10,
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <span>{format(new Date(r.date + 'T00:00:00'), 'EEE MMM d')}</span>
              <span className="tabular" style={{ fontWeight: 700, color: band.color }}>
                {r.sleep_score ?? '\u2014'}
              </span>
              <span className="tabular" style={{ color: 'var(--text-muted)' }}>
                {hours ?? '\u2014'}
                {r.deep_sleep_min !== null && ` \u00B7 deep ${r.deep_sleep_min}m`}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: band.color,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {band.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
