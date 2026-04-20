/**
 * /sleep overview -- last-night hero + quick-jump tiles + tight history.
 *
 * Redesign principles applied after the first-pass review:
 *   - One dominant hero: big sleep ring + stats in a single unified card.
 *     No card-in-card, no double labeling.
 *   - Stats strip runs horizontally across the hero, not a 2x2 grid.
 *   - Deep links become a 2x2 tile grid (dashboard feel), not a list of
 *     settings rows.
 *   - Recent nights collapses to the most recent 7, clean single-line
 *     rows with tight typography.
 *   - Stale-banner is now a compact pill so it doesn't eat a quarter of
 *     the viewport.
 *
 * Server component. Single parallel fetch via fetchSleepWindow.
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  fetchSleepWindow,
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
  const windowData = await fetchSleepWindow(supabase, { today, days: 29 });
  const latest = windowData.latestRow;
  const stale = computeStale({
    latestDate: windowData.latestDate,
    today,
    syncedAt: windowData.latestSyncedAt,
  });

  const lastNight = latest;
  const lastNightDate = lastNight?.date ?? null;
  const last7 = windowData.rows.slice(-7);
  const avgSleep = avgOf(last7, (r) => r.sleep_score);
  const avgReadiness = avgOf(last7, (r) => r.readiness_score);
  const avgHrv = avgOf(last7, (r) => r.hrv_avg);
  const sleepDelta = deltaVsAverage(lastNight?.sleep_score ?? null, avgSleep);
  const readinessDelta = deltaVsAverage(lastNight?.readiness_score ?? null, avgReadiness);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '12px 16px 120px',
        maxWidth: 920,
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
          Sleep
        </p>
        <h1 className="page-title" style={{ marginTop: 2 }}>
          {lastNight ? 'Last night' : 'Sleep overview'}
        </h1>
        {lastNightDate && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: '3px 0 0',
              lineHeight: 1.4,
            }}
          >
            {format(new Date(lastNightDate + 'T00:00:00'), 'EEEE, MMM d')}
          </p>
        )}
      </header>

      {stale.status !== 'fresh' && (
        <StaleBanner stale={stale} latestDate={windowData.latestDate} />
      )}

      {!lastNight ? (
        <EmptyState />
      ) : (
        <>
          <Hero
            sleep={lastNight.sleep_score}
            readiness={lastNight.readiness_score}
            sleepDelta={sleepDelta}
            readinessDelta={readinessDelta}
            sleepDuration={lastNight.sleep_duration}
            deep={lastNight.deep_sleep_min}
            rem={lastNight.rem_sleep_min}
            restingHr={lastNight.resting_hr}
          />

          <HrvCard values={last7.map((r) => r.hrv_avg)} avg={avgHrv} />
          <BodyTempGauge
            todayDeviation={lastNight.body_temp_deviation}
            trendDeviations={last7.map((r) => r.body_temp_deviation)}
          />
          <QuickLinks />
          <RecentNights rows={windowData.rows.slice(-7).reverse()} />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <section
      aria-label="No Oura readings"
      style={{
        padding: '32px 20px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 60,
          height: 60,
          borderRadius: 'var(--radius-full)',
          background: 'var(--accent-sage-muted)',
          margin: '0 auto 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        {'\u{1F319}'}
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>No sleep data yet</h2>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          margin: '6px auto 16px',
          maxWidth: 300,
          lineHeight: 1.5,
        }}
      >
        Connect Oura in Settings to pull in the last 30 days, or log a night manually.
      </p>
      <a
        href="/sleep/log"
        className="press-feedback"
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--accent-sage)',
          color: 'var(--text-inverse)',
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Log a night
      </a>
    </section>
  );
}

function Hero({
  sleep,
  readiness,
  sleepDelta,
  readinessDelta,
  sleepDuration,
  deep,
  rem,
  restingHr,
}: {
  sleep: number | null;
  readiness: number | null;
  sleepDelta: number | null;
  readinessDelta: number | null;
  sleepDuration: number | null;
  deep: number | null;
  rem: number | null;
  restingHr: number | null;
}) {
  const hours = formatDurationFromSeconds(sleepDuration);
  const sleepBand = bandForScore(sleep);
  const readinessBand = bandForScore(readiness);
  return (
    <section
      aria-label="Last night hero"
      style={{
        padding: '18px 16px 14px',
        borderRadius: 'var(--radius-lg)',
        background:
          'linear-gradient(180deg, #FFFFFF 0%, #FBFBF7 55%, #F5F5F0 100%)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <ScoreRing label="Sleep" score={sleep} size={130} strokeWidth={11} ringOnly />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: sleepBand.color,
            }}
          >
            {'Sleep \u00B7 '}{sleepBand.label}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1.15,
              marginTop: 4,
              letterSpacing: '-0.02em',
            }}
          >
            {hours ?? 'No duration'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            {sleepDelta !== null
              ? `${sleepDelta > 0 ? '+' : ''}${sleepDelta} vs 7-day avg`
              : 'No 7-day average yet'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              marginTop: 10,
              fontSize: 11.5,
              color: 'var(--text-muted)',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                color: readinessBand.color,
                fontSize: 12,
              }}
            >
              Readiness {readiness ?? '\u2014'}
            </span>
            <span>{readinessBand.label.toLowerCase()}</span>
            {readinessDelta !== null && (
              <span style={{ marginLeft: 'auto' }}>
                {readinessDelta > 0 ? '+' : ''}
                {readinessDelta} vs 7d
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          padding: '10px 0 2px',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        <StatCell label="Deep" value={deep !== null ? `${deep}m` : '\u2014'} />
        <StatCell label="REM" value={rem !== null ? `${rem}m` : '\u2014'} />
        <StatCell label="RHR" value={restingHr !== null ? `${restingHr}` : '\u2014'} unit="bpm" />
        <StatCell label="Total" value={hours ?? '\u2014'} tight />
      </div>
    </section>
  );
}

function StatCell({
  label,
  value,
  unit,
  tight,
}: {
  label: string;
  value: string;
  unit?: string;
  tight?: boolean;
}) {
  return (
    <div style={{ textAlign: 'center', minWidth: 0 }}>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </div>
      <div
        className="tabular"
        style={{
          fontSize: tight ? 14 : 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginTop: 2,
          lineHeight: 1.15,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 2 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function HrvCard({ values, avg }: { values: (number | null | undefined)[]; avg: number | null }) {
  const latest = values.filter((v): v is number => v !== null && v !== undefined).pop() ?? null;
  return (
    <section
      aria-labelledby="hrv-title"
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <h3 id="hrv-title" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
            HRV
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Last 7 nights</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="tabular" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {latest !== null ? Math.round(latest) : '\u2014'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3, fontWeight: 600 }}>
            ms
          </span>
          {avg !== null && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
              avg {Math.round(avg)} ms
            </div>
          )}
        </div>
      </div>
      <HrvSparkline values={values} height={56} />
    </section>
  );
}

function QuickLinks() {
  const LINKS = [
    {
      href: '/sleep/stages',
      emoji: '\u{1F4CA}',
      label: 'Stages',
      hint: 'REM / Deep',
    },
    {
      href: '/sleep/recovery',
      emoji: '\u{2764}\u{FE0F}',
      label: 'Recovery',
      hint: 'HRV + RHR',
    },
    {
      href: '/sleep/log',
      emoji: '\u{270D}\u{FE0F}',
      label: 'Log night',
      hint: 'Manual entry',
    },
    {
      href: '/patterns/sleep',
      emoji: '\u{1F4C8}',
      label: 'Trends',
      hint: '30-day',
    },
  ];
  return (
    <nav
      aria-label="Sleep sections"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
      }}
    >
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="press-feedback"
          style={{
            padding: '14px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            boxShadow: 'var(--shadow-sm)',
            textDecoration: 'none',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span aria-hidden style={{ fontSize: 22, flexShrink: 0 }}>
            {link.emoji}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{link.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {link.hint}
            </div>
          </div>
        </Link>
      ))}
    </nav>
  );
}

function RecentNights({ rows }: { rows: SleepRingRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section
      aria-labelledby="nights-title"
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}
      >
        <h3 id="nights-title" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
          Last 7 nights
        </h3>
        <Link
          href="/patterns/sleep"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent-sage)',
            textDecoration: 'none',
          }}
        >
          {'All trends \u2192'}
        </Link>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' }}>
        {rows.map((r, idx) => {
          const band = bandForScore(r.sleep_score);
          const hours = formatDurationFromSeconds(r.sleep_duration);
          const isLast = idx === rows.length - 1;
          return (
            <li
              key={r.date}
              style={{
                display: 'grid',
                gridTemplateColumns: '8px 66px 1fr auto',
                gap: 10,
                padding: '10px 0',
                alignItems: 'center',
                fontSize: 12,
                borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: band.color,
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {format(new Date(r.date + 'T00:00:00'), 'EEE MMM d')}
              </span>
              <span className="tabular" style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                {hours ?? '\u2014'}
              </span>
              <span
                className="tabular"
                style={{ fontWeight: 800, color: band.color, fontSize: 15 }}
              >
                {r.sleep_score ?? '\u2014'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
