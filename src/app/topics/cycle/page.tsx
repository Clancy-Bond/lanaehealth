// ARCHIVED: This legacy route is now redirected to /v2/topics/cycle via next.config.ts.
// Kept in source for fast revert. To revive: remove the redirect in next.config.ts.
// Cutover landed: 2026-04-25 (legacy → v2 unified merge).

/**
 * Menstrual Cycle Topic Page
 *
 * Third anchor in the /topics/* family. Pulls from cycle_entries,
 * nc_imported (Natural Cycles legacy data), and the shared
 * getCurrentCycleDay helper at src/lib/cycle/current-day.ts so the
 * day and phase always match the home page display.
 *
 * Non-diagnostic. This is a reading page for Lanae to understand her
 * own cycle trends. The cycle helper already handles edge cases
 * (long cycles, stale NC data, unknown days).
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';
import { getCurrentCycleDay } from '@/lib/cycle/current-day';

export const dynamic = 'force-dynamic';

interface CycleRow {
  date: string;
  menstruation: boolean | null;
  flow_level: string | null;
}

function phaseColor(phase: string | null): string {
  switch (phase?.toLowerCase()) {
    case 'menstrual':
      return 'var(--phase-menstrual)';
    case 'follicular':
      return 'var(--phase-follicular)';
    case 'ovulatory':
      return 'var(--phase-ovulatory)';
    case 'luteal':
      return 'var(--phase-luteal)';
    default:
      return 'var(--text-muted)';
  }
}

function phaseExplanation(phase: string | null): string {
  switch (phase?.toLowerCase()) {
    case 'menstrual':
      return 'Day 1 starts here. Estrogen and progesterone are at their lowest. Pain, fatigue, and migraines often peak during days 1-3.';
    case 'follicular':
      return 'Estrogen climbs toward ovulation. Energy and mood typically lift during this phase, which for most cycles lasts ~10-14 days.';
    case 'ovulatory':
      return 'A short 2-3 day window around ovulation. BBT rises 0.3-0.7C, cervical mucus changes, and LH peaks.';
    case 'luteal':
      return 'Progesterone dominant. BBT stays elevated. PMS-type symptoms cluster in days 5-2 before the next period.';
    default:
      return 'Phase not established yet for this cycle.';
  }
}

/**
 * Derive cycle lengths from a sequence of menstruation=true dates.
 * Returns an array of lengths in days, newest first. Skips any gaps
 * that look like amenorrhea (>60 days) so they don't distort the
 * recent-cycle average.
 */
function deriveCycleLengths(cycleRows: CycleRow[]): number[] {
  const periodDays = cycleRows
    .filter((r) => r.menstruation === true)
    .map((r) => r.date)
    .sort();
  if (periodDays.length < 2) return [];

  // Collapse consecutive menstruation days into just the first (start of period).
  const starts: string[] = [periodDays[0]];
  for (let i = 1; i < periodDays.length; i++) {
    const prev = new Date(periodDays[i - 1] + 'T00:00:00').getTime();
    const curr = new Date(periodDays[i] + 'T00:00:00').getTime();
    const gap = Math.round((curr - prev) / 86400000);
    if (gap >= 10) starts.push(periodDays[i]);
  }

  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const a = new Date(starts[i - 1] + 'T00:00:00').getTime();
    const b = new Date(starts[i] + 'T00:00:00').getTime();
    const len = Math.round((b - a) / 86400000);
    if (len <= 60) lengths.push(len);
  }
  return lengths.reverse();
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default async function CycleTopic() {
  const supabase = createServiceClient();
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const sixMonthsAgo = format(
    new Date(now.getTime() - 180 * 86400000),
    'yyyy-MM-dd',
  );

  const [cycleCurrent, cycleEntriesResult] = await Promise.all([
    getCurrentCycleDay(today),
    supabase
      .from('cycle_entries')
      .select('date, menstruation, flow_level')
      .gte('date', sixMonthsAgo)
      .lte('date', today)
      .order('date', { ascending: true }),
  ]);

  const rows = ((cycleEntriesResult.data ?? []) as unknown) as CycleRow[];
  const lengths = deriveCycleLengths(rows);
  const meanLength = avg(lengths.slice(0, 6));
  const lengthsForChart = lengths.slice(0, 6);

  const dayLabel = cycleCurrent.day !== null ? `CD ${cycleCurrent.day}` : '\u2014';
  const phase = cycleCurrent.phase;
  const phaseLabel = phase ? phase.charAt(0).toUpperCase() + phase.slice(1) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '16px',
        maxWidth: 720,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
      <a
        href="/"
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path
            d="M12.5 5L7.5 10L12.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Home
      </a>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Topic
        </span>
        <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
          Menstrual cycle
        </h1>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          ACOG considers cycle lengths from 21 to 35 days typical. Phase
          matters more than day-count for how you&rsquo;re likely to feel. This
          page shows where you are right now and how your cycles have been
          lengthening or shortening over the last 6 months.
        </p>
      </div>

      {/* Today's phase card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '16px 18px',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
          border: '1px solid var(--border-light)',
          borderLeftWidth: 3,
          borderLeftStyle: 'solid',
          borderLeftColor: phaseColor(phase),
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Today
          </span>
          <span className="tabular" style={{ fontSize: 22, fontWeight: 700 }}>
            {dayLabel}
          </span>
        </div>
        {phaseLabel && (
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: phaseColor(phase),
            }}
          >
            {phaseLabel} phase
          </div>
        )}
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          {phaseExplanation(phase)}
        </p>
        {cycleCurrent.isUnusuallyLong && cycleCurrent.lastPeriodStart && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent-blush)',
              padding: '6px 10px',
              background: 'var(--accent-blush-muted)',
              borderRadius: 8,
            }}
          >
            Long cycle notice: last period started {cycleCurrent.lastPeriodStart}.
            That&rsquo;s {cycleCurrent.daysSinceLastPeriod} days ago.
          </div>
        )}
      </div>

      {/* Recent cycle lengths */}
      {lengthsForChart.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 14,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Last 6 cycles
            </span>
            {meanLength !== null && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                avg{' '}
                <span className="tabular">{Math.round(meanLength)}</span> days
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {[...lengthsForChart].reverse().map((len, i) => {
              const inRange = len >= 21 && len <= 35;
              const heightPct = Math.min(100, (len / 40) * 100);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      height: `${heightPct}%`,
                      width: '100%',
                      borderRadius: '6px 6px 0 0',
                      background: inRange
                        ? 'var(--accent-sage)'
                        : 'var(--accent-blush-light)',
                    }}
                  />
                  <span
                    className="tabular"
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    {len}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Sage = within ACOG typical range (21-35 days). Blush = outside.
          </div>
        </div>
      )}

      {/* Explainer */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '14px 16px',
          borderRadius: 14,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          What the phases mean
        </span>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Menstrual (days 1-5)</strong> &middot; Day 1 is the first
            day of bleeding. Estrogen and progesterone are at their lowest.
            Pain, fatigue, and migraines often peak here.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Follicular (days 6-13)</strong> &middot; Estrogen climbs.
            Energy and mood typically lift. Length varies most in this phase.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Ovulatory (days 14-16)</strong> &middot; A short window
            around ovulation. BBT rises 0.3-0.7C for the rest of the cycle.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Luteal (days 17-28)</strong> &middot; Progesterone
            dominant. PMS symptoms cluster in days 5-2 before the next period.
            Menstrual-migraine attacks concentrate here and in early menstrual.
          </p>
        </div>
      </div>

      {/* CTA */}
      <a
        href="/log"
        className="press-feedback"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, #7CA391 0%, #6B9080 50%, #5D7E6F 100%)',
          color: 'var(--text-inverse)',
          textDecoration: 'none',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Log a cycle entry</span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path
            d="M7.5 5L12.5 10L7.5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </div>
  );
}
