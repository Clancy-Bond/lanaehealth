'use client'

/**
 * LogPageClient
 *
 * The whole log page is wrapped in one client component so sheet
 * state lives in a single place. The server-rendered page hydrates
 * this with the initial daily log; further edits update the local
 * copy optimistically after writes succeed.
 *
 * Shape (MyNetDiary-style): rows list vitals / mode / notes, each
 * row opens a focused sheet, save closes the sheet and refreshes
 * just that row's text. Nothing is "page-dirty" so the reader can
 * leave at any time.
 */
import { useState } from 'react'
import Link from 'next/link'
import type { DailyLog, Symptom, Appointment } from '@/lib/types'
import { Card, ListRow, Banner } from '@/v2/components/primitives'
import SliderSheet, {
  painSeverityLabel,
  painSeverityColor,
  fatigueSeverityLabel,
  fatigueSeverityColor,
  stressSeverityLabel,
  sleepQualityLabel,
} from './SliderSheet'
import NotesSheet from './NotesSheet'
import EnergyModeSheet from './EnergyModeSheet'

type SheetKey = 'pain' | 'fatigue' | 'stress' | 'sleep' | 'notes' | 'mode' | null

export interface LogPageClientProps {
  initialLog: DailyLog
  symptomsToday: Symptom[]
  nextAppointment: Appointment | null
}

export default function LogPageClient({ initialLog, symptomsToday, nextAppointment }: LogPageClientProps) {
  const [log, setLog] = useState<DailyLog>(initialLog)
  const [openSheet, setOpenSheet] = useState<SheetKey>(null)

  const onSaved = (updated: DailyLog) => setLog(updated)

  const rows = buildRows(log, symptomsToday.length, (key) => setOpenSheet(key))

  return (
    <>
      {nextAppointment && (
        <Banner
          intent="info"
          title="Pre-visit log"
          body="A quick log ahead of your appointment makes the visit more useful. Anything you miss now, the provider can ask about live."
        />
      )}

      <Card padding="none">
        <div style={{ padding: 'var(--v2-space-4) var(--v2-space-4) 0' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            Today
          </span>
        </div>
        <div style={{ padding: '0 var(--v2-space-4) var(--v2-space-3)' }}>
          {rows.map((row, i) =>
            row.href ? (
              <Link key={row.key} href={row.href} className="v2-log-row" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <ListRow
                  label={row.label}
                  subtext={row.subtext}
                  trailing={row.trailing}
                  chevron
                  divider={i < rows.length - 1}
                  intent={row.intent}
                />
              </Link>
            ) : (
              <div key={row.key} className="v2-log-row">
                <ListRow
                  label={row.label}
                  subtext={row.subtext}
                  trailing={row.trailing}
                  chevron
                  divider={i < rows.length - 1}
                  intent={row.intent}
                  onClick={row.onClick}
                />
              </div>
            ),
          )}
        </div>
      </Card>
      <style>{`
        /*
         * Tap-driven daily logging needs visible feedback. ListRow is a
         * foundation primitive so we layer a subtle :active state on the
         * wrapper instead of editing the primitive.
         */
        .v2-log-row:active { background: var(--v2-accent-primary-soft); border-radius: var(--v2-radius-md); }
      `}</style>

      <SliderSheet
        open={openSheet === 'pain'}
        onClose={() => setOpenSheet(null)}
        logId={log.id}
        field="overall_pain"
        initial={log.overall_pain}
        title="Pain today"
        lowLabel="None"
        highLabel="Extreme"
        severityLabel={painSeverityLabel}
        severityColor={painSeverityColor}
        onSaved={onSaved}
      />
      <SliderSheet
        open={openSheet === 'fatigue'}
        onClose={() => setOpenSheet(null)}
        logId={log.id}
        field="fatigue"
        initial={log.fatigue}
        title="Energy today"
        lowLabel="Exhausted"
        highLabel="Great"
        severityLabel={fatigueSeverityLabel}
        severityColor={fatigueSeverityColor}
        onSaved={onSaved}
      />
      <SliderSheet
        open={openSheet === 'stress'}
        onClose={() => setOpenSheet(null)}
        logId={log.id}
        field="stress"
        initial={log.stress}
        title="Stress today"
        lowLabel="Calm"
        highLabel="Overwhelming"
        severityLabel={stressSeverityLabel}
        severityColor={painSeverityColor}
        onSaved={onSaved}
      />
      <SliderSheet
        open={openSheet === 'sleep'}
        onClose={() => setOpenSheet(null)}
        logId={log.id}
        field="sleep_quality"
        initial={log.sleep_quality}
        title="Sleep quality"
        lowLabel="Awful"
        highLabel="Restorative"
        severityLabel={sleepQualityLabel}
        severityColor={fatigueSeverityColor}
        onSaved={onSaved}
      />
      <NotesSheet
        open={openSheet === 'notes'}
        onClose={() => setOpenSheet(null)}
        logId={log.id}
        initial={log.notes}
        onSaved={onSaved}
      />
      <EnergyModeSheet
        open={openSheet === 'mode'}
        onClose={() => setOpenSheet(null)}
        logId={log.id}
        initial={log.energy_mode ?? null}
        onSaved={onSaved}
      />
    </>
  )
}

interface Row {
  key: string
  label: string
  subtext: string
  trailing: string
  intent?: 'default' | 'warning' | 'success'
  onClick?: () => void
  href?: string
}

function buildRows(log: DailyLog, symptomCount: number, open: (k: SheetKey) => void): Row[] {
  return [
    {
      // Pain deep-links to the dedicated /v2/log/pain page so the
      // user can drop straight into FACES, the drill-down, and the
      // condition-aware prompts. The legacy SliderSheet for 'pain'
      // is no longer mounted in this file.
      key: 'pain',
      label: 'Pain',
      subtext: 'How today feels, with optional detail',
      trailing: log.overall_pain != null ? `${log.overall_pain}/10` : 'Tap to log',
      href: '/v2/log/pain',
    },
    {
      key: 'fatigue',
      label: 'Energy',
      subtext: 'How much fuel is in the tank',
      trailing: log.fatigue != null ? `${log.fatigue}/10` : 'Tap to log',
      onClick: () => open('fatigue'),
    },
    {
      key: 'stress',
      label: 'Stress',
      subtext: 'A pulse check on how today feels',
      trailing: log.stress != null ? `${log.stress}/10` : 'Tap to log',
      onClick: () => open('stress'),
    },
    {
      key: 'sleep',
      label: 'Sleep quality',
      subtext: 'How last night felt, beyond the Oura score',
      trailing: log.sleep_quality != null ? `${log.sleep_quality}/10` : 'Tap to log',
      onClick: () => open('sleep'),
    },
    {
      key: 'mode',
      label: 'Today\u2019s mode',
      subtext: 'Minimal, gentle, or full',
      trailing: log.energy_mode
        ? log.energy_mode[0].toUpperCase() + log.energy_mode.slice(1)
        : 'Tap to set',
      onClick: () => open('mode'),
    },
    {
      key: 'symptoms',
      label: 'Symptoms',
      subtext:
        symptomCount === 0
          ? 'Log anything new or unusual'
          : `${symptomCount} logged today`,
      trailing: symptomCount === 0 ? 'Open' : 'Review',
      intent: symptomCount === 0 ? 'default' : 'warning',
      href: '/symptoms',
    },
    {
      key: 'food',
      label: 'Meals',
      subtext: 'Handled in the Food view',
      trailing: 'Open',
      href: '/calories',
    },
    {
      key: 'cycle',
      label: 'Cycle',
      subtext: 'Period, BBT, fertility signs',
      trailing: 'Open',
      href: '/v2/cycle',
    },
    {
      key: 'notes',
      label: 'Notes',
      subtext: 'Anything worth remembering',
      trailing:
        log.notes && log.notes.trim().length > 0
          ? log.notes.length > 24
            ? log.notes.slice(0, 24) + '...'
            : log.notes
          : 'Tap to write',
      onClick: () => open('notes'),
    },
  ]
}
