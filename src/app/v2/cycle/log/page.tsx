import Link from 'next/link'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentCycleDay } from '@/lib/cycle/current-day'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import PeriodLogFormV2 from '../_components/PeriodLogFormV2'

export const dynamic = 'force-dynamic'

/*
 * LEARNING-MODE HOOK G2 — Log-flow shape.
 *
 * Three valid approaches for this route:
 *
 *   1. Single-screen (current):  all fields visible, submit at bottom.
 *        Fastest for power users. Can feel clinical when empty.
 *   2. Sheet overlay from Today:  Log button opens a bottom sheet over
 *        /v2/cycle; keeps context, but vertical space is tighter.
 *   3. Stepper:  one question at a time. Progressive disclosure, less
 *        overwhelm, more taps.
 *
 * Shipping option 1 for M3 (single-screen, parity with legacy /cycle/log).
 * To switch to option 2, move <PeriodLogFormV2 /> inside a <Sheet> rendered
 * from /v2/cycle/page.tsx and keep this route as a no-op redirect. To
 * switch to option 3, replace the body below with a <Stepper>-driven flow.
 */

export default async function V2CycleLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const sp = await searchParams
  const todayISO = format(new Date(), 'yyyy-MM-dd')
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO

  const sb = createServiceClient()
  const [{ data: entry }, cycle] = await Promise.all([
    sb.from('cycle_entries').select('*').eq('date', date).maybeSingle(),
    getCurrentCycleDay(date),
  ])

  const initialOvulationSigns =
    typeof entry?.ovulation_signs === 'string'
      ? entry.ovulation_signs.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []

  const headerDate = format(new Date(date + 'T00:00:00'), 'EEE, MMM d')
  const cycleDayText = cycle.day != null ? `Cycle day ${cycle.day}` : null

  return (
    <MobileShell
      top={
        <TopAppBar
          leading={
            <Link
              href="/v2/cycle"
              aria-label="Back to cycle"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ‹ Cycle
            </Link>
          }
          title={
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              <span>{headerDate}</span>
              {cycleDayText && (
                <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontWeight: 'var(--v2-weight-regular)' }}>
                  {cycleDayText}
                </span>
              )}
            </span>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
          maxWidth: 640,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <PeriodLogFormV2
          date={date}
          initialFlow={entry?.flow_level ?? null}
          initialMenstruation={entry?.menstruation === true}
          initialOvulationSigns={initialOvulationSigns}
          initialLh={entry?.lh_test_result ?? 'not_taken'}
          initialNotes={entry?.endo_notes ?? ''}
        />
      </div>
    </MobileShell>
  )
}
