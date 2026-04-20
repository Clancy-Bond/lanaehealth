/**
 * /cycle/log - single-screen period log. FAB destination.
 *
 * Prefills from an existing cycle_entries row for the target date. When the
 * URL has ?date=YYYY-MM-DD we backfill that day; otherwise defaults to
 * today. The form saves via /api/cycle/log and redirects to /cycle.
 */
import { format } from 'date-fns'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentCycleDay } from '@/lib/cycle/current-day'
import { PeriodLogForm } from '@/components/cycle/PeriodLogForm'

export const dynamic = 'force-dynamic'

export default async function CycleLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const sp = await searchParams
  const todayISO = format(new Date(), 'yyyy-MM-dd')
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO
  const sb = createServiceClient()

  const [{ data: entry, error: entryError }, cycle] = await Promise.all([
    sb.from('cycle_entries').select('*').eq('date', date).maybeSingle(),
    getCurrentCycleDay(date),
  ])

  // Detect whether the endo migration has landed. One probe query decides
  // whether to show the notes/endo section so users on pre-migration DBs
  // do not see fields that will be silently dropped.
  const endoCheck = await sb.from('cycle_entries').select('endo_notes').limit(1)
  const endoMode = !endoCheck.error

  const initialOvulationSigns =
    typeof entry?.ovulation_signs === 'string'
      ? entry.ovulation_signs.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 16,
        maxWidth: 760,
        margin: '0 auto',
        paddingBottom: 140,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Cycle / Log
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.15 }}>
          {format(new Date(date + 'T00:00:00'), 'EEEE, MMM d')}
        </h1>
        {cycle.day !== null && (
          <div className="tabular" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Cycle day {cycle.day}
            {cycle.phase ? ` \u00b7 ${cycle.phase}` : ''}
          </div>
        )}
      </div>

      {entryError && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--phase-menstrual)' }}>
          Could not load existing entry: {entryError.message}
        </div>
      )}

      <PeriodLogForm
        date={date}
        initialFlow={entry?.flow_level ?? null}
        initialMenstruation={entry?.menstruation === true}
        initialOvulationSigns={initialOvulationSigns}
        initialLh={entry?.lh_test_result ?? 'not_taken'}
        initialMucusConsistency={entry?.cervical_mucus_consistency ?? null}
        initialMucusQuantity={entry?.cervical_mucus_quantity ?? null}
        initialNotes={entry?.endo_notes ?? ''}
        endoMode={endoMode}
      />

      <Link
        href="/cycle"
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          textDecoration: 'none',
          alignSelf: 'flex-start',
        }}
      >
        &lsaquo; Back to Cycle
      </Link>
    </div>
  )
}
