/**
 * /sleep/stages -- last night's REM / deep / light breakdown.
 *
 * Oura's sleep-staging accuracy is review-praised ("79% agreement with
 * polysomnography"). We reuse the existing /api/oura/sleep-stages
 * route that already reconstructs a plausible hypnogram from the
 * aggregates stored in oura_daily. This page renders the hypnogram as
 * a horizontal timeline + the 7-day average minutes-per-stage so Lanae
 * can see whether last night was typical.
 */

import { createServiceClient } from '@/lib/supabase';
import { format, subDays } from 'date-fns';
import Link from 'next/link';
import { fetchSleepWindow, avgOf } from '@/lib/sleep/queries';
import { computeStale } from '@/lib/sleep/stale';
import { StaleBanner } from '@/components/sleep/StaleBanner';

export const dynamic = 'force-dynamic';

type Stage = 'awake' | 'rem' | 'light' | 'deep';

interface StageBlock {
  startMinute: number;
  stage: Stage;
  durationMinutes: number;
}

const STAGE_COLOR: Record<Stage, string> = {
  awake: 'var(--accent-blush)',
  rem: 'var(--phase-ovulatory)',
  light: 'var(--phase-follicular)',
  deep: 'var(--accent-sage)',
};

const STAGE_LABEL: Record<Stage, string> = {
  awake: 'Awake',
  rem: 'REM',
  light: 'Light',
  deep: 'Deep',
};

interface StagesPayload {
  stages: StageBlock[];
  totalMinutes: number;
  bedtime: string | null;
  wakeTime: string | null;
  message?: string;
}

async function fetchStages(date: string, origin: string): Promise<StagesPayload | null> {
  try {
    const res = await fetch(`${origin}/api/oura/sleep-stages?date=${date}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as StagesPayload;
  } catch {
    return null;
  }
}

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

  // Pull the last 8 rows so we have today + 7 priors for the average.
  const windowData = await fetchSleepWindow(supabase, { today, days: 8 });
  const stale = computeStale({
    latestDate: windowData.latestDate,
    today,
    syncedAt: windowData.latestSyncedAt,
  });
  const latest = windowData.latestRow;
  const targetDate = latest?.date ?? yesterday;

  // Resolve a base URL for the internal fetch. VERCEL_URL is set on prod;
  // otherwise fall back to the local dev port configured for lanaehealth.
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3005';
  const stages = await fetchStages(targetDate, origin);

  // 7-day averages per stage (excluding the target row itself).
  const priorRows = windowData.rows.filter((r) => r.date !== targetDate);
  const avgDeep = avgOf(priorRows, (r) => r.deep_sleep_min);
  const avgRem = avgOf(priorRows, (r) => r.rem_sleep_min);
  // Light/awake come from raw_json inside the stages payload of each
  // night; computing per-day averages would need N extra fetches and
  // isn't worth the round-trip. We surface deep + REM averages only.

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
            ? `Reconstructed from your Oura data for ${format(new Date(targetDate + 'T00:00:00'), 'EEE MMM d')}.`
            : 'Waiting for Oura to sync your first night.'}
        </p>
      </header>

      {stale.status !== 'fresh' && (
        <StaleBanner stale={stale} latestDate={windowData.latestDate} />
      )}

      {stages && stages.stages.length > 0 ? (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Last night, stage by stage</h3>
              <span className="tabular" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {stages.bedtime && stages.wakeTime
                  ? `${stages.bedtime} \u2192 ${stages.wakeTime}`
                  : `${formatMins(stages.totalMinutes)} total`}
              </span>
            </div>
            <HypnogramBar stages={stages.stages} totalMinutes={stages.totalMinutes} />
            <Legend />
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
              tonight={latest?.deep_sleep_min ?? null}
              avg={avgDeep}
            />
            <StageCard
              stage="rem"
              label="REM"
              tonight={latest?.rem_sleep_min ?? null}
              avg={avgRem}
            />
          </section>
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
            Oura hasn\u2019t sent a hypnogram for this night. Check /sleep/log to add one manually.
          </p>
        </div>
      )}
    </main>
  );
}

function HypnogramBar({ stages, totalMinutes }: { stages: StageBlock[]; totalMinutes: number }) {
  const total = Math.max(1, totalMinutes);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 22,
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px var(--border-light)',
          background: 'var(--bg-elevated)',
        }}
        aria-label="Stage timeline"
      >
        {stages.map((b, i) => {
          const pct = (b.durationMinutes / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={`${i}-${b.stage}`}
              title={`${STAGE_LABEL[b.stage]} ${b.durationMinutes}m`}
              style={{
                width: `${pct}%`,
                background: STAGE_COLOR[b.stage],
                opacity: b.stage === 'awake' ? 0.6 : 1,
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
  stage: Stage;
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
        {avg !== null ? `7-day avg ${Math.round(avg)}m` : 'No 7-day avg yet'}
        {delta !== null ? `  ${delta > 0 ? '+' : ''}${delta}` : ''}
      </div>
    </div>
  );
}
