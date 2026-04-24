/*
 * WeekdayStrip
 *
 * NC parity (frame_0008): seven days laid out as 3-letter day + number.
 * Past green days render as filled green circles with a small inline
 * checkmark. Today gets a dotted ring (NC's "you are here" treatment).
 * Future Green Days render as open green outline circles. Period days
 * render as filled pink circles. The result is a row of glanceable
 * status pills you can read in a quarter-second.
 *
 * Section-local for now: lives only on /v2/cycle. Promote to a
 * primitive if another section grows the same affordance.
 *
 * Voice: mostly visual; an inline label "this week" anchors it for
 * screen readers without crowding the layout.
 */
import type { CycleEntry } from '@/lib/types'

const DAY_LETTERS_3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface WeekdayStripProps {
  /** ISO yyyy-mm-dd for today. */
  today: string
  /** Cycle entries from a window that overlaps the visible 7 days. */
  entries: CycleEntry[]
}

interface Cell {
  iso: string
  dayNum: number
  weekdayShort: string
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
      weekdayShort: DAY_LETTERS_3[d.getDay()],
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
  const pillSize = 38

  // NC color logic (frame_0008):
  //   menstruation -> filled pink
  //   past + logged -> filled green with inline check
  //   today -> dotted green ring (filled if logged)
  //   future -> open green outline circle (predicted Green Day)
  const isFilledGreen = !cell.isFuture && cell.hasLog && !cell.isMenstruation
  const isFilledPink = cell.isMenstruation
  const isOpenGreen = cell.isFuture

  let pillBg = 'transparent'
  let pillBorder = '1px solid var(--v2-border-subtle)'
  let pillTextColor = 'var(--v2-text-primary)'

  if (isFilledPink) {
    pillBg = 'var(--v2-surface-explanatory-accent)'
    pillBorder = '1px solid var(--v2-surface-explanatory-accent)'
    pillTextColor = '#FFFFFF'
  } else if (isFilledGreen) {
    pillBg = 'var(--v2-accent-success)'
    pillBorder = '1px solid var(--v2-accent-success)'
    pillTextColor = '#0A0A0B'
  } else if (isOpenGreen) {
    pillBg = 'transparent'
    pillBorder = '1.5px solid rgba(106, 207, 137, 0.55)'
    pillTextColor = 'var(--v2-text-secondary)'
  }

  // Today wins: overlay a dashed ring on whatever fill is active.
  const todayDashed = cell.isToday
    ? '1.5px dashed var(--v2-accent-success)'
    : null

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
          color: cell.isToday ? 'var(--v2-text-primary)' : 'var(--v2-text-muted)',
          fontWeight: cell.isToday ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-regular)',
          letterSpacing: 'var(--v2-tracking-normal)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {cell.weekdayShort}
      </span>
      <span
        aria-label={`${cell.iso}${cell.hasLog ? ', logged' : ''}${cell.isToday ? ', today' : ''}`}
        style={{
          position: 'relative',
          width: pillSize,
          height: pillSize,
          borderRadius: '50%',
          background: pillBg,
          border: todayDashed ?? pillBorder,
          color: pillTextColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--v2-text-sm)',
          fontWeight: cell.isToday ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-medium)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {cell.dayNum}
        {(isFilledGreen || isFilledPink) && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: 'var(--v2-bg-primary)',
              color: isFilledGreen ? 'var(--v2-accent-success)' : 'var(--v2-surface-explanatory-accent)',
              fontSize: 9,
              fontWeight: 'var(--v2-weight-bold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: `1px solid ${isFilledGreen ? 'var(--v2-accent-success)' : 'var(--v2-surface-explanatory-accent)'}`,
            }}
          >
            ✓
          </span>
        )}
      </span>
    </div>
  )
}
