import Link from 'next/link'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase'
import { getCurrentCycleDay } from '@/lib/cycle/current-day'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import PeriodLogFormV2 from '../_components/PeriodLogFormV2'
import RouteSlide from '../../_components/RouteSlide'

export const dynamic = 'force-dynamic'

/*
 * LEARNING-MODE HOOK G2: Log-flow shape.
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

/*
 * Endo-mode gating
 *
 * The expanded log includes a collapsible "Endo mode" section covering
 * bowel/bladder symptoms, dyspareunia, clots, and notes. We show that
 * section when any of these are true:
 *
 *   1. active_problems has an unresolved row whose `problem` contains
 *      "endo" (case-insensitive). This is the ground-truth clinical
 *      problem list.
 *   2. health_profile has "endometriosis" inside confirmed_diagnoses or
 *      suspected_conditions. Lanae has endo as suspected, not confirmed,
 *      so we need both.
 *   3. The entry for this date already has any endo-mode column
 *      populated. Protects against data loss if Lanae previously logged
 *      endo fields and the flag flips off later.
 *
 * Kept server-side so the client form does not need to re-query the DB.
 */
async function hasEndoMode(
  sb: ReturnType<typeof createServiceClient>,
  entry: Record<string, unknown> | null,
): Promise<boolean> {
  if (entry) {
    const endoFields: (keyof typeof entry)[] = [
      'bowel_symptoms',
      'bladder_symptoms',
      'dyspareunia',
      'dyspareunia_intensity',
      'clots_present',
      'clot_size',
      'clot_count',
      'endo_notes',
    ]
    for (const f of endoFields) {
      const v = entry[f]
      if (Array.isArray(v) && v.length > 0) return true
      if (typeof v === 'boolean' && v) return true
      if (typeof v === 'number' && v > 0) return true
      if (typeof v === 'string' && v.trim().length > 0) return true
    }
  }

  const [{ data: problems }, { data: profile }] = await Promise.all([
    sb
      .from('active_problems')
      .select('problem')
      .neq('status', 'resolved'),
    sb
      .from('health_profile')
      .select('section, content')
      .in('section', ['confirmed_diagnoses', 'suspected_conditions']),
  ])

  const problemHit = (problems ?? []).some((row) =>
    typeof row?.problem === 'string' && /endo/i.test(row.problem),
  )
  if (problemHit) return true

  for (const row of profile ?? []) {
    const list = Array.isArray(row?.content) ? row.content : []
    for (const item of list) {
      if (typeof item === 'string' && /endometri/i.test(item)) return true
    }
  }

  return false
}

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

  const endoMode = await hasEndoMode(sb, entry)

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
      <RouteSlide>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
            padding: 'var(--v2-space-4)',
            paddingBottom: 'var(--v2-space-10)',
            maxWidth: 640,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <Link
            href="/v2/learn/tracking-your-period-accurately"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            alignSelf: 'flex-start',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-accent-primary)',
            textDecoration: 'none',
            padding: 'var(--v2-space-1) 0',
          }}
        >
          Learn how to track accurately
        </Link>
        <PeriodLogFormV2
          date={date}
          endoMode={endoMode}
          initialFlow={entry?.flow_level ?? null}
          initialMenstruation={entry?.menstruation === true}
          initialOvulationSigns={initialOvulationSigns}
          initialLh={entry?.lh_test_result ?? 'not_taken'}
          initialCervicalMucusConsistency={entry?.cervical_mucus_consistency ?? null}
          initialCervicalMucusQuantity={entry?.cervical_mucus_quantity ?? null}
          initialSymptoms={Array.isArray(entry?.symptoms) ? entry.symptoms : []}
          initialMoodEmoji={entry?.mood_emoji ?? null}
          initialSkinState={entry?.skin_state ?? null}
          initialSexActivityType={entry?.sex_activity_type ?? null}
          initialBowelSymptoms={Array.isArray(entry?.bowel_symptoms) ? entry.bowel_symptoms : []}
          initialBladderSymptoms={Array.isArray(entry?.bladder_symptoms) ? entry.bladder_symptoms : []}
          initialDyspareunia={entry?.dyspareunia === true}
          initialDyspareuniaIntensity={
            typeof entry?.dyspareunia_intensity === 'number' ? entry.dyspareunia_intensity : 0
          }
          initialClotsPresent={entry?.clots_present === true}
          initialClotSize={entry?.clot_size ?? null}
          initialClotCount={typeof entry?.clot_count === 'number' ? entry.clot_count : 0}
          initialEndoNotes={entry?.endo_notes ?? ''}
        />
        </div>
      </RouteSlide>
    </MobileShell>
  )
}
