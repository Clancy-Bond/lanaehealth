/**
 * Home widget: 7-day HRV sparkline.
 *
 * Reuses HrvSparkline so the vertical rhythm matches /sleep exactly
 * (sparkline, avg number, small caption). Tap-through opens the full
 * trend view at /patterns/sleep.
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { fetchSleepWindow, avgOf } from '@/lib/sleep/queries';
import { HrvSparkline } from '@/components/sleep/HrvSparkline';
import type { HomeWidgetContext } from '@/lib/home/widgets';

export async function HrvTrend7dWidget({ date }: HomeWidgetContext) {
  const supabase = createServiceClient();
  const window = await fetchSleepWindow(supabase, { today: date, days: 7 });
  const rows = window.rows;
  const avg = avgOf(rows, (r) => r.hrv_avg);
  const values = rows.map((r) => r.hrv_avg);
  const latest = values.filter((v): v is number => v !== null).pop() ?? null;

  return (
    <Link
      href="/patterns/sleep"
      className="press-feedback"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        textDecoration: 'none',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          HRV over 7 days
        </span>
        <span className="tabular" style={{ fontSize: 14, fontWeight: 700 }}>
          {latest !== null ? Math.round(latest) : '\u2014'}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>ms</span>
        </span>
      </div>
      <HrvSparkline values={values} height={40} />
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {avg !== null ? `7-day avg ${Math.round(avg)} ms` : 'Not enough readings yet'}
      </div>
    </Link>
  );
}
