/**
 * Readiness Detail Page
 *
 * Tapping the Morning Signal card on Home lands here. Shows Oura's
 * full readiness score and all 8 contributors, with LanaeHealth's
 * condition-aware reasoning overlay per contributor.
 *
 * We DO NOT recompute Oura's numbers. We render their contributor
 * sub-scores directly and layer trend arrows + POTS-aware context
 * on top. See docs/intelligence/readiness-formula.md for the
 * architecture rationale.
 *
 * Server component, direct Supabase fetch. Wave 2 MVP-0 Feature 3.
 */

import { createServiceClient } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  buildReadinessSignal,
  type OuraRow,
} from '@/lib/intelligence/readiness-signal';
import { contextFor, citationUrl } from '@/lib/intelligence/readiness-context';

export const dynamic = 'force-dynamic';

export default async function ReadinessDetail() {
  const supabase = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Pull last 30 days of oura_daily so we can render a sparkline and
  // derive a fresh 7-day median for the trend arrows.
  const { data: rows } = await supabase
    .from('oura_daily')
    .select(
      'date, readiness_score, hrv_avg, resting_hr, sleep_score, body_temp_deviation, respiratory_rate, raw_json',
    )
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(30);

  const ouraRows = (rows ?? []) as OuraRow[];
  const todayRow = ouraRows[0] ?? null;
  const trendRows = ouraRows.slice(1, 8);

  const signal = buildReadinessSignal({ today: todayRow, trend: trendRows });

  // 30-day score series for the sparkline. Reverse to ascending order
  // for chart-native reading order.
  const scoreSeries = ouraRows
    .map((r) => ({ date: r.date, score: r.readiness_score }))
    .reverse();

  const readingDate = todayRow?.date ?? null;
  const readingLabel =
    readingDate === today
      ? 'This morning'
      : readingDate
        ? `From ${format(new Date(readingDate + 'T00:00:00'), 'EEE MMM d')}`
        : 'No reading yet';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '16px',
        maxWidth: 720,
        margin: '0 auto',
        paddingBottom: 96,
      }}
    >
      {/* Back link */}
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

      {/* Hero: score + band + reading label */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '20px 24px',
          borderRadius: 20,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)',
          boxShadow: 'var(--shadow-md)',
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
          Morning signal
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span
            className="tabular"
            style={{ fontSize: 64, fontWeight: 700, lineHeight: 1 }}
          >
            {signal.score ?? '\u2014'}
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {readingLabel}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          From Oura&rsquo;s calibrated readiness score. LanaeHealth adds the trend
          context below.
        </div>
      </div>

      {/* 30-day sparkline */}
      {scoreSeries.length >= 3 && (
        <ReadinessSparkline series={scoreSeries} />
      )}

      {/* All 8 contributors with POTS-aware context */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            margin: 0,
            padding: '0 4px',
          }}
        >
          Contributors
        </h2>
        {signal.allContributors.map((c) => {
          const ctx = contextFor(c.id, c.direction);
          const cite = citationUrl(ctx.citation);
          const deltaAccent =
            c.direction === 'up'
              ? 'var(--accent-sage)'
              : c.direction === 'down'
                ? 'var(--accent-blush)'
                : 'var(--border-light)';
          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderLeftWidth: 3,
                borderLeftStyle: 'solid',
                borderLeftColor: deltaAccent,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Label row + score */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>{c.label}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    className="tabular"
                    style={{ fontSize: 22, fontWeight: 700 }}
                  >
                    {c.score ?? '\u2014'}
                  </span>
                  {c.direction !== 'missing' && c.median !== null && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      7-day <span className="tabular">{Math.round(c.median)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Trend copy line */}
              {c.trendCopy && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {c.trendCopy}
                </div>
              )}

              {/* Why it matters */}
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                {ctx.whyItMatters}
              </div>

              {/* Direction-specific interpretation */}
              {ctx.whatDirectionMeans && (
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background:
                      c.direction === 'up'
                        ? 'var(--accent-sage-muted)'
                        : 'var(--accent-blush-muted)',
                  }}
                >
                  {ctx.whatDirectionMeans}
                </div>
              )}

              {/* Citation */}
              {cite && (
                <a
                  href={cite}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                  }}
                >
                  Source: {ctx.citation} &#x2197;
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: attribution */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '16px 0',
          lineHeight: 1.5,
        }}
      >
        Readiness score and contributor values from Oura. Trend arrows and
        condition context by LanaeHealth.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Inline sparkline (keeps the page a single server component).
// ────────────────────────────────────────────────────────────────────

function ReadinessSparkline({
  series,
}: {
  series: Array<{ date: string; score: number | null }>;
}) {
  const width = 640;
  const height = 100;
  const padding = 16;
  const plottable = series.filter(
    (d): d is { date: string; score: number } => d.score !== null,
  );

  if (plottable.length < 2) return null;

  const min = 40;
  const max = 100;
  const xStep = (width - 2 * padding) / (plottable.length - 1);

  const points = plottable.map((d, i) => {
    const x = padding + i * xStep;
    const y =
      height - padding - ((d.score - min) / (max - min)) * (height - 2 * padding);
    return { x, y, ...d };
  });

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const avg =
    plottable.reduce((acc, d) => acc + d.score, 0) / plottable.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
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
          30-day trend
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          avg <span className="tabular">{Math.round(avg)}</span>
        </span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="30-day readiness sparkline"
      >
        {/* Reference line at 70 (Oura's optimal threshold) */}
        <line
          x1={padding}
          x2={width - padding}
          y1={height - padding - ((70 - min) / (max - min)) * (height - 2 * padding)}
          y2={height - padding - ((70 - min) / (max - min)) * (height - 2 * padding)}
          stroke="var(--border-light)"
          strokeDasharray="3 3"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--accent-sage)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
