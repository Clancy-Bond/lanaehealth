/**
 * /patterns/sleep -- 30-day sleep score + HRV + RHR time series.
 *
 * Sits inside the /patterns tree so it appears in the Patterns nav
 * hierarchy, not the Sleep tab. Long-term trends are what reviewers
 * called out as Oura's "longitudinal review is WILD" moment; Lanae has
 * 1,187 days of data and deserves to see it as one continuous picture.
 *
 * Server component with inline SVG. No client interactivity beyond CSS
 * hover because the trend is for glancing, not drilling.
 */

import { createServiceClient } from '@/lib/supabase';
import { format, subDays } from 'date-fns';
import Link from 'next/link';
import { bandForScore } from '@/lib/sleep/bands';

export const dynamic = 'force-dynamic';

interface TrendRow {
  date: string;
  sleep_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
}

export default async function SleepTrendsPage() {
  const supabase = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const start = format(subDays(new Date(today + 'T00:00:00'), 29), 'yyyy-MM-dd');

  const { data } = await supabase
    .from('oura_daily')
    .select('date, sleep_score, hrv_avg, resting_hr')
    .gte('date', start)
    .lte('date', today)
    .order('date', { ascending: true });
  const rows = (data ?? []) as TrendRow[];

  const sleepVals = rows.map((r) => r.sleep_score).filter((v): v is number => v !== null);
  const hrvVals = rows.map((r) => r.hrv_avg).filter((v): v is number => v !== null);
  const rhrVals = rows.map((r) => r.resting_hr).filter((v): v is number => v !== null);

  return (
    <main
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
          <Link href="/patterns" style={{ color: 'inherit', textDecoration: 'none' }}>
            &larr; Patterns
          </Link>
        </p>
        <h1 className="page-title" style={{ marginTop: 2 }}>
          Sleep trends
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
          Last 30 days of Oura readings. Mouse over a line for a snapshot of that night.
        </p>
      </header>

      {rows.length === 0 ? (
        <div
          style={{
            padding: 24,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            textAlign: 'center',
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>No Oura data yet</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Connect Oura from Settings to backfill your last 30 days.
          </p>
        </div>
      ) : (
        <>
          <TrendCard
            title="Sleep score"
            units="/ 100"
            rows={rows}
            pick={(r) => r.sleep_score}
            values={sleepVals}
            refLine={{ y: 70, label: 'Good', color: 'var(--accent-sage)' }}
            suggestedRange={[40, 100]}
            color="var(--accent-sage)"
          />
          <TrendCard
            title="HRV"
            units="ms"
            rows={rows}
            pick={(r) => r.hrv_avg}
            values={hrvVals}
            refLine={null}
            suggestedRange={null}
            color="var(--phase-ovulatory)"
          />
          <TrendCard
            title="Resting heart rate"
            units="bpm"
            rows={rows}
            pick={(r) => r.resting_hr}
            values={rhrVals}
            refLine={null}
            suggestedRange={null}
            color="var(--phase-follicular)"
          />
          <BandLegend />
        </>
      )}
    </main>
  );
}

interface TrendCardProps {
  title: string;
  units: string;
  rows: TrendRow[];
  pick: (r: TrendRow) => number | null;
  values: number[];
  refLine: { y: number; label: string; color: string } | null;
  suggestedRange: [number, number] | null;
  color: string;
}

function TrendCard({ title, units, rows, pick, values, refLine, suggestedRange, color }: TrendCardProps) {
  const latest = rows[rows.length - 1];
  const latestValue = latest ? pick(latest) : null;
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const min = suggestedRange ? suggestedRange[0] : values.length ? Math.min(...values) - 5 : 0;
  const max = suggestedRange ? suggestedRange[1] : values.length ? Math.max(...values) + 5 : 100;

  const width = 720;
  const height = 140;
  const padX = 16;
  const padY = 16;
  const xStep = rows.length > 1 ? (width - 2 * padX) / (rows.length - 1) : 0;
  const points = rows
    .map((r, i) => {
      const v = pick(r);
      if (v === null || !Number.isFinite(v)) return null;
      const x = padX + i * xStep;
      const y = height - padY - ((v - min) / (max - min)) * (height - 2 * padY);
      return { x, y, v, date: r.date };
    })
    .filter((p): p is { x: number; y: number; v: number; date: string } => p !== null);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const refY = refLine ? height - padY - ((refLine.y - min) / (max - min)) * (height - 2 * padY) : null;

  return (
    <section
      aria-labelledby={`trend-${title}`}
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
        <h3 id={`trend-${title}`} style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
          {title}
        </h3>
        <span className="tabular" style={{ fontSize: 14, fontWeight: 700 }}>
          {latestValue !== null ? formatNumber(latestValue, title) : '\u2014'}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{units}</span>
        </span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {refY !== null && refLine && (
          <>
            <line
              x1={padX}
              x2={width - padX}
              y1={refY}
              y2={refY}
              stroke={refLine.color}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          </>
        )}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r="2.25" fill={color} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>{avg !== null ? `30-day avg ${formatNumber(avg, title)} ${units}` : 'No 30-day average yet'}</span>
        {refLine && <span>Dashed line: {refLine.label}</span>}
      </div>
    </section>
  );
}

function formatNumber(v: number, title: string): string {
  if (title === 'HRV') return `${Math.round(v)}`;
  if (title === 'Resting heart rate') return `${Math.round(v)}`;
  return `${Math.round(v)}`;
}

function BandLegend() {
  const bands: { score: number; label: string }[] = [
    { score: 90, label: 'Optimal' },
    { score: 75, label: 'Good' },
    { score: 65, label: 'Fair' },
    { score: 50, label: 'Pay attention' },
  ];
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: 11,
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Score bands
      </span>
      {bands.map((b) => (
        <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: bandForScore(b.score).color,
            }}
          />
          {b.label}
        </span>
      ))}
    </div>
  );
}
