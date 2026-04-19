/**
 * /sleep/log -- manual sleep entry.
 *
 * The FAB on the sleep tab lands here. Scenario: Oura didn't sync (ring
 * died, firmware bug, user stayed at a hotel), and the user wants the
 * night captured anyway. We ask for bedtime, wake, a perceived 1-5
 * quality, optional naps, and a free-text note. No step-count, no
 * stage breakdown; those are the ring's job. When Oura DOES sync later
 * we keep both readings.
 *
 * Server component shell hosts the client form so data loading for
 * "did Oura already record tonight?" happens on the server; the form
 * itself is client-side.
 */

import { format } from 'date-fns';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { SleepLogForm } from './SleepLogForm';

export const dynamic = 'force-dynamic';

export default async function SleepLogPage() {
  const supabase = createServiceClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [{ data: todayLog }, { data: ouraToday }, { data: sleepDetail }] = await Promise.all([
    supabase.from('daily_logs').select('id, sleep_quality, notes').eq('date', today).maybeSingle(),
    supabase
      .from('oura_daily')
      .select('sleep_score, sleep_duration')
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('sleep_details')
      .select('bedtime, wake_time, naps, log_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const matchingDetail =
    sleepDetail && todayLog && sleepDetail.log_id === todayLog.id ? sleepDetail : null;

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
          Log last night
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
          For nights your ring missed. Anything you skip is fine -- log only what you remember.
        </p>
      </header>

      {ouraToday?.sleep_score !== null && ouraToday?.sleep_score !== undefined && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
          }}
        >
          Oura already has a reading for today (sleep score {ouraToday.sleep_score}). Your manual
          entry will be kept alongside it for comparison.
        </div>
      )}

      <SleepLogForm
        date={today}
        initialQuality={
          todayLog?.sleep_quality !== null && todayLog?.sleep_quality !== undefined
            ? Math.round((todayLog.sleep_quality as number) / 2)
            : null
        }
        initialBedtime={matchingDetail?.bedtime ?? null}
        initialWake={matchingDetail?.wake_time ?? null}
        initialNotes={todayLog?.notes ?? null}
        initialNaps={(matchingDetail?.naps as unknown as { start: string; duration_min: number }[]) ?? []}
      />
    </main>
  );
}
