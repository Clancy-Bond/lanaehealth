/**
 * /sleep/stages -- last night's REM / deep / light breakdown.
 *
 * Oura users call sleep-staging the app's best-reviewed feature, with
 * 79% agreement vs. polysomnography (docs/competitive/oura/user-reviews.md).
 * We read the raw `sleep_phase_5_min` string when Oura stores it under
 * `raw_json.oura.sleep_detail`, giving a real 5-minute-resolution
 * hypnogram. When that column is missing (older rows, or nights the
 * ring didn't capture) we fall back to the aggregate-reconstruction
 * heuristic via buildHypnogramFromAggregates so the page still renders.
 *
 * Server component. No API round-trip: all data comes from oura_daily
 * in one query. Efficiency + latency + restless-periods fields are
 * surfaced when present.
 */

import { createServiceClient } from '@/lib/supabase';
import { format, subDays } from 'date-fns';
import Link from 'next/link';
import { fetchSleepWindow, avgOf } from '@/lib/sleep/queries';
import { computeStale } from '@/lib/sleep/stale';
import { StaleBanner } from '@/components/sleep/StaleBanner';
import {
  buildHypnogram,
  type HypnogramBlock,
  type HypnogramStage,
  type SleepDetailInput,
} from '@/lib/sleep/hypnogram';

export const dynamic = 'force-dynamic';

const STAGE_COLOR: Record<HypnogramStage, string> = {
  awake: 'var(--accent-blush)',
  rem: 'var(--phase-ovulatory)',
  light: 'var(--phase-follicular)',
  deep: 'var(--accent-sage)',
};

const STAGE_LABEL: Record<HypnogramStage, string> = {
  awake: 'Awake',
  rem: 'REM',
  light: 'Light',
  deep: 'Deep',
};

function formatMins(m: number): string {
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

export default async function SleepStagesPage() {
  const supabase = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(today + 'T00:00:00'), 1), 'yyyy-MM-dd');

  const windowData = await fetchSleepWindow(supabase, { today, days: 8 });
  const stale = computeStale({
    latestDate: windowData.latestDate,
    today,
    syncedAt: windowData.latestSyncedAt,
  });
  const latest = windowData.latestRow;
  const targetDate = latest?.date ?? yesterday;

  // Pull the raw Oura sleep_detail payload so we can access
  // sleep_phase_5_min. Keep this query tiny to avoid hydrating the
  // (potentially large) full raw_json when we only need the one slot.
  const { data: rawRow } = await supabase
    .from('oura_daily')
    .select('raw_json')
    .eq('date', targetDate)
    .maybeSingle();
  const rawJson = (rawRow?.raw_json as Record<string, unknown> | null) ?? {};
  const ouraSection = (rawJson.oura as Record<string, unknown> | undefined) ?? {};
  const sleepDetail =
    (ouraSection.sleep_detail as SleepDetailInput | undefined) ??
    (rawJson.sleep_detail as SleepDetailInput | undefined) ??
    null;
  const hyp = buildHypnogram(sleepDetail);

  // 7-day averages for the per-stage stat cards (excluding target day).
  const priorRows = windowData.rows.filter((r) => r.date !== targetDate);
  const avgDeep = avgOf(priorRows, (r) => r.deep_sleep_min);
  const avgRem = avgOf(priorRows, (r) => r.rem_sleep_min);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '12px 16px 120px',
        maxWidth: 720,
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
          Sleep stages
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0 0', lineHeight: 1.4 }}>
          {latest
            ? format(new Date(targetDate + 'T00:00:00'), 'EEEE, MMM d')
            : 'Waiting for Oura to sync your first night.'}
        </p>
      </header>

      {stale.status !== 'fresh' && (
        <StaleBanner stale={stale} latestDate={windowData.latestDate} />
      )}

      {hyp.blocks.length > 0 ? (
        <>
          <section
            aria-label="Hypnogram hero"
            style={{
              padding: '18px 16px 16px',
              borderRadius: 'var(--radius-lg)',
              background:
                'linear-gradient(180deg, #FFFFFF 0%, #FBFBF7 55%, #F5F5F0 100%)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Stage by stage</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
                  {hyp.source === 'sleep_phase_5_min'
                    ? 'Real 5-minute intervals from your ring.'
                    : 'Reconstructed from totals (ring did not sync minute data).'}
                </p>
              </div>
              <span
                className="tabular"
                style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}
              >
                {hyp.bedtime && hyp.wakeTime
                  ? `${hyp.bedtime} \u2192 ${hyp.wakeTime}`
                  : formatMins(hyp.totalMinutes)}
              </span>
            </div>
            <HypnogramBar blocks={hyp.blocks} totalMinutes={hyp.totalMinutes} />
            <Legend />
          </section>

          <section
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-sm)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}
          >
            <StageCard
              stage="deep"
              label="Deep"
              tonight={hyp.minutesByStage.deep}
              avg={avgDeep}
            />
            <StageCard
              stage="rem"
              label="REM"
              tonight={hyp.minutesByStage.rem}
              avg={avgRem}
            />
            <StageCard
              stage="light"
              label="Light"
              tonight={hyp.minutesByStage.light}
              avg={null}
            />
            <StageCard
              stage="awake"
              label="Awake"
              tonight={hyp.minutesByStage.awake}
              avg={null}
            />
          </section>

          {(hyp.efficiency !== null || hyp.latencyMinutes !== null || hyp.restlessPeriods !== null) && (
            <section
              aria-label="Sleep quality details"
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-sm)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {hyp.efficiency !== null && (
                <MetaTile label="Efficiency" value={`${hyp.efficiency}%`} />
              )}
              {hyp.latencyMinutes !== null && (
                <MetaTile
                  label="Fell asleep in"
                  value={formatMins(hyp.latencyMinutes)}
                />
              )}
              {hyp.restlessPeriods !== null && (
                <MetaTile
                  label="Restless"
                  value={hyp.restlessPeriods.toString()}
                />
              )}
            </section>
          )}
        </>
      ) : (
        <div
          style={{
            padding: 24,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            textAlign: 'center',
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>No stage data</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {'Oura hasn\u2019t sent a hypnogram for this night. Check /sleep/log to add one manually.'}
          </p>
        </div>
      )}
    </main>
  );
}

function HypnogramBar({ blocks, totalMinutes }: { blocks: HypnogramBlock[]; totalMinutes: number }) {
  const total = Math.max(1, totalMinutes);
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: 56,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px var(--border-light)',
        background: 'var(--bg-elevated)',
      }}
      aria-label="Stage timeline"
    >
      {blocks.map((b, i) => {
        const pct = (b.durationMinutes / total) * 100;
        if (pct <= 0) return null;
        return (
          <div
            key={`${i}-${b.stage}`}
            title={`${STAGE_LABEL[b.stage]} ${b.durationMinutes}m`}
            style={{
              width: `${pct}%`,
              background: STAGE_COLOR[b.stage],
              opacity: b.stage === 'awake' ? 0.75 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
      {(['deep', 'rem', 'light', 'awake'] as const).map((s) => (
        <span
          key={s}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 'var(--radius-full)',
              background: STAGE_COLOR[s],
            }}
          />
          {STAGE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

function StageCard({
  label,
  tonight,
  avg,
  stage,
}: {
  label: string;
  tonight: number | null;
  avg: number | null;
  stage: HypnogramStage;
}) {
  const delta = tonight !== null && avg !== null ? Math.round(tonight - avg) : null;
  return (
    <div style={{ textAlign: 'center', padding: '2px 0' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: STAGE_COLOR[stage] }} aria-hidden />
        {label}
      </div>
      <div
        className="tabular"
        style={{
          fontSize: 20,
          fontWeight: 800,
          marginTop: 3,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {tonight !== null ? `${tonight}` : '\u2014'}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 2 }}>m</span>
      </div>
      {avg !== null && (
        <div
          className="tabular"
          style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.2 }}
        >
          avg {Math.round(avg)}
          {delta !== null && (
            <span
              style={{
                marginLeft: 4,
                color: delta > 0 ? 'var(--accent-sage)' : 'var(--accent-blush)',
                fontWeight: 700,
              }}
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
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
      <div
        className="tabular"
        style={{
          fontSize: 18,
          fontWeight: 800,
          marginTop: 3,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
    </div>
  );
}
