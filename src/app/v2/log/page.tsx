/**
 * /v2/log: Daily log rebuild
 *
 * The page is a server component that does the get-or-create dance
 * for today's daily_logs row, then hands the seed state to a client
 * wrapper. The wrapper owns sheet open/close state and optimistic
 * row updates so the reader never sees a full-page spinner after a
 * save.
 *
 * Input fields (pain, energy, stress, sleep_quality, mode, notes)
 * all persist to the same daily_logs row used by the legacy /log
 * page through updateDailyLog in @/lib/api/logs. Symptoms, food,
 * and cycle deep-link out to their respective views because those
 * workflows are owned by other sessions.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase'
import type { DailyLog, Symptom, Appointment } from '@/lib/types'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import LogProgressHeader from './_components/LogProgressHeader'
import LogPageClient from './_components/LogPageClient'
import SectionHeader from '../_components/SectionHeader'
import CorrectionsPanel from '@/v2/components/CorrectionsPanel'

export const dynamic = 'force-dynamic'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function getOrCreateTodayLog(today: string): Promise<DailyLog> {
  const sb = createServiceClient()
  const { data: existing } = await sb.from('daily_logs').select('*').eq('date', today).maybeSingle()
  if (existing) return existing as DailyLog
  const { data: created, error } = await sb
    .from('daily_logs')
    .insert({ date: today })
    .select()
    .single()
  if (error) throw new Error(`Failed to create today's log: ${error.message}`)
  return created as DailyLog
}

async function loadSupportingData(today: string, logId: string) {
  const sb = createServiceClient()
  const [symptomsRes, apptRes] = await Promise.all([
    sb
      .from('symptoms')
      .select('*')
      .eq('log_id', logId)
      .order('logged_at', { ascending: true }),
    sb
      .from('appointments')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])
  return {
    symptoms: ((symptomsRes.data ?? []) as Symptom[]),
    nextAppointment: (apptRes.data ?? null) as Appointment | null,
  }
}

function countLogged(log: DailyLog): number {
  let n = 0
  if (log.overall_pain != null) n += 1
  if (log.fatigue != null) n += 1
  if (log.stress != null) n += 1
  if (log.sleep_quality != null) n += 1
  if (log.energy_mode != null) n += 1
  if (log.notes && log.notes.trim().length > 0) n += 1
  return n
}

export default async function V2LogPage() {
  const today = todayISO()
  const log = await getOrCreateTodayLog(today)
  const { symptoms, nextAppointment } = await loadSupportingData(today, log.id)

  const total = 6
  const logged = countLogged(log)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Log"
          leading={
            <Link
              href="/v2"
              aria-label="Back to home"
              style={{
                color: 'var(--v2-text-secondary)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                minWidth: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-10)',
        }}
      >
        <LogProgressHeader iso={today} loggedCount={logged} totalCount={total} />

        <section>
          <SectionHeader eyebrow="Check-ins" />
          <div style={{ marginTop: 'var(--v2-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <LogPageClient
              initialLog={log}
              symptomsToday={symptoms}
              nextAppointment={nextAppointment}
            />
          </div>
        </section>

        {/* Data correction affordance for the daily log row. The
            check-ins above set these via dedicated sheets, but the
            panel below lets the user fix a mis-tap (e.g. logged 8
            for stress when she meant 3) without re-opening the slider
            and surfaces a "tell the assistant why" textarea. */}
        <CorrectionsPanel
          tableName="daily_logs"
          rowId={log.id}
          source="v2_log"
          heading="Need to fix a check-in?"
          subtext="Tap any value to correct it. Tell me why so the assistant remembers next time."
          fields={[
            {
              label: 'Overall pain (0-10)',
              value: log.overall_pain,
              fieldName: 'overall_pain',
              inputType: 'number',
              displayValue: log.overall_pain == null ? 'Not logged' : String(log.overall_pain),
            },
            {
              label: 'Fatigue (0-10)',
              value: log.fatigue,
              fieldName: 'fatigue',
              inputType: 'number',
              displayValue: log.fatigue == null ? 'Not logged' : String(log.fatigue),
            },
            {
              label: 'Stress (0-10)',
              value: log.stress,
              fieldName: 'stress',
              inputType: 'number',
              displayValue: log.stress == null ? 'Not logged' : String(log.stress),
            },
            {
              label: 'Sleep quality (0-10)',
              value: log.sleep_quality,
              fieldName: 'sleep_quality',
              inputType: 'number',
              displayValue: log.sleep_quality == null ? 'Not logged' : String(log.sleep_quality),
            },
          ]}
        />
      </div>
    </MobileShell>
  )
}
