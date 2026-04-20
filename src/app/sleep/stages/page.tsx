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
        gap: 16,
        padding: '12px 16px 96px',
        maxWidth: 720,
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
          Sleep stages
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
          {latest
            ? `${hyp.source === 'sleep_phase_5_min' ? 'From your Oura 5-minute hypnogram' : 'Reconstructed from your Oura aggregates'} for ${format(new Date(targetDate + 'T00:00:00'), 'EEE MMM d')}.`
            : 'Waiting for Oura to sync your first night.'}
        </p>
      </header>

      {stale.status !== 'fresh' && (
        <StaleBanner stale={stale} latestDate={windowData.latestDate} />
      )}

      {hyp.blocks.length > 0 ? (
        <>
          <section
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Last night, stage by stage</h3>
              <span className="tabular" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {hyp.bedtime && hyp.wakeTime
                  ? `${hyp.bedtime} \u2192 ${hyp.wakeTime}`
                  : `${formatMins(hyp.totalMinutes)} total`}
              </span>
            </div>
            <HypnogramBar blocks={hyp.blocks} totalMinutes={hyp.totalMinutes} />
            <Legend />
            {hyp.source === 'sleep_phase_5_min' ? (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.4 }}>
                Each bar segment is one 5-minute interval from your ring.
              </p>
            ) : (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.4 }}>
                Minute-resolution hypnogram not synced. This view reconstructs stages from totals.
              </p>
            )}
          </section>

          <section
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-sm)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
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
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              {hyp.efficiency !== null && (
                <MetaTile label="Efficiency" value={`${hyp.efficiency}%`} hint="Minutes asleep / minutes in bed." />
              )}
              {hyp.latencyMinutes !== null && (
                <MetaTile
                  label="Time to fall asleep"
                  value={formatMins(hyp.latencyMinutes)}
                  hint="From first horizontal to first sleep stage."
                />
              )}
              {hyp.restlessPeriods !== null && (
                <MetaTile
                  label="Restless periods"
                  value={hyp.restlessPeriods.toString()}
                  hint="Movement bouts during the night."
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 26,
          borderRadius: 'var(--radius-full)',
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
                opacity: b.stage === 'awake' ? 0.7 : 1,
              }}
            />
          );
        })}
      </div>
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
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[stage] }}
          aria-hidden
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
      </div>
      <div className="tabular" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
        {tonight !== null ? `${tonight}m` : '\u2014'}
      </div>
      <div className="tabular" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
        {avg !== null ? `7-day avg ${Math.round(avg)}m` : '\u00A0'}
        {delta !== null ? `  ${delta > 0 ? '+' : ''}${delta}` : ''}
      </div>
    </div>
  );
}

function MetaTile({ label, value, hint }: { label: string; value: string; hint: string }) {
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
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
        {hint}
      </div>
    </div>
  );
}
