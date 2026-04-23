/*
 * WeekdayStrip
 *
 * Horizontal 7-day strip showing today centered with three days
 * back and three days ahead. Days that have any cycle log render a
 * checkmark over the date pill (NC parity, frame_0008).
 *
 * Section-local for now: lives only on /v2/cycle. Promote to a
 * primitive if another section grows the same affordance.
 *
 * Voice: mostly visual; a single inline label "this week" anchors
 * it for screen readers without crowding the layout.
 */
import type { CycleEntry } from '@/lib/types'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export interface WeekdayStripProps {
  /** ISO yyyy-mm-dd for today. */
  today: string
  /** Cycle entries from a window that overlaps the visible 7 days. */
  entries: CycleEntry[]
}

interface Cell {
  iso: string
  dayNum: number
  weekdayLetter: string
  isToday: boolean
  isFuture: boolean
  hasLog: boolean
  isMenstruation: boolean
}

function isoFor(base: Date, offset: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export default function WeekdayStrip({ today, entries }: WeekdayStripProps) {
  const todayDate = new Date(today + 'T00:00:00')

  const loggedSet = new Set<string>()
  const menstruationSet = new Set<string>()
  for (const e of entries) {
    // Treat any non-empty cycle entry as "logged" so the checkmark
    // appears whenever the user touched the day, not only periods.
    const hasSignal =
      e.menstruation === true ||
      e.flow_level != null ||
      e.lh_test_result != null ||
      (Array.isArray(e.symptoms) && e.symptoms.length > 0) ||
      e.mood_emoji != null ||
      e.skin_state != null ||
      e.cervical_mucus_consistency != null ||
      e.cervical_mucus_quantity != null
    if (hasSignal) loggedSet.add(e.date)
    if (e.menstruation === true) menstruationSet.add(e.date)
  }

  // Three back, today centered, three ahead.
  const cells: Cell[] = []
  for (let offset = -3; offset <= 3; offset++) {
    const iso = isoFor(todayDate, offset)
    const d = new Date(iso + 'T00:00:00')
    cells.push({
      iso,
      dayNum: d.getDate(),
      weekdayLetter: DAY_LETTERS[d.getDay()],
      isToday: offset === 0,
      isFuture: offset > 0,
      hasLog: loggedSet.has(iso),
      isMenstruation: menstruationSet.has(iso),
    })
  }

  return (
    <section
      aria-label="This week"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 'var(--v2-space-2)',
        paddingTop: 'var(--v2-space-2)',
        paddingBottom: 'var(--v2-space-2)',
      }}
    >
      {cells.map((cell) => (
        <DayCell key={cell.iso} cell={cell} />
      ))}
    </section>
  )
}

function DayCell({ cell }: { cell: Cell }) {
  const pillSize = 36
  const pillBg = cell.isMenstruation
    ? 'var(--v2-surface-explanatory-accent)'
    : cell.hasLog
      ? 'rgba(77, 184, 168, 0.18)'
      : 'transparent'
  const pillBorder = cell.isToday
    ? '1.5px solid var(--v2-accent-primary)'
    : cell.isFuture
      ? '1px dashed var(--v2-border-subtle)'
      : '1px solid var(--v2-border-subtle)'
  const pillTextColor = cell.isMenstruation
    ? 'var(--v2-text-primary)'
    : cell.isFuture
      ? 'var(--v2-text-muted)'
      : 'var(--v2-text-primary)'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: cell.isToday ? 'var(--v2-text-secondary)' : 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {cell.weekdayLetter}
      </span>
      <span
        aria-label={`${cell.iso}${cell.hasLog ? ', logged' : ''}${cell.isToday ? ', today' : ''}`}
        style={{
          position: 'relative',
          width: pillSize,
          height: pillSize,
          borderRadius: '50%',
          background: pillBg,
          border: pillBorder,
          color: pillTextColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--v2-text-sm)',
          fontWeight: cell.isToday ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-regular)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {cell.dayNum}
        {cell.hasLog && !cell.isFuture && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 14,
              height: 14,
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-accent-primary)',
              color: 'var(--v2-bg-primary)',
              fontSize: 9,
              fontWeight: 'var(--v2-weight-semibold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ✓
          </span>
        )}
      </span>
    </div>
  )
}
