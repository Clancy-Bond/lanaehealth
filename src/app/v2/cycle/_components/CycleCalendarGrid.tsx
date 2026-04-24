/*
 * CycleCalendarGrid
 *
 * FOUNDATION-REQUEST: consider promoting this to a primitive if another
 * section needs a month-grid. For now it's section-local.
 *
 * Rules (from docs/competitive/natural-cycles/user-reviews.md #39):
 *   - Past cells render the data that is actually logged (flow level).
 *   - Predicted-period cells render ONLY on future dates, with a dashed
 *     border. We never retroactively re-color a past cell.
 *
 * Wave 3 inversion (frame_0150, frame_0158, frame_0163 in
 * docs/reference/natural-cycles/frames/full-tour): the primary cell
 * content is the CYCLE DAY NUMBER, not the calendar date. NC's
 * cycle-aware calendar reads "Day 12" first, "April 12" second,
 * because the cycle day is the unit of meaning when the user is
 * orienting themselves to where they are this month. The calendar
 * date appears small in the corner of each cell.
 */
import type { CycleEntry } from '@/lib/types'

type Kind = 'future-predicted' | 'past' | 'today' | 'future' | 'outside'

interface Cell {
  date: string
  /** Calendar day-of-month (1-31), now rendered SMALL in the corner. */
  label: number
  /** 1-indexed cycle day, or null when no menstrual history is known. */
  cycleDay: number | null
  kind: Kind
  flow: CycleEntry['flow_level'] | undefined
  menstruating: boolean
}

/**
 * Compute cycle day for a target date from a sorted list of menstrual
 * dates. Mirrors the helper in src/app/v2/cycle/history/page.tsx so we
 * keep the inversion math consistent with the day-detail sheet without
 * adding a dependency on src/lib/cycle/* (Wave 1 ownership).
 */
function cycleDayFor(targetIso: string, menstruationDates: string[]): number | null {
  if (menstruationDates.length === 0) return null
  const targetMs = Date.parse(targetIso + 'T00:00:00Z')
  const eligible = menstruationDates
    .filter((d) => Date.parse(d + 'T00:00:00Z') <= targetMs)
    .sort()
    .reverse()
  if (eligible.length === 0) return null

  let start = eligible[0]
  for (let i = 1; i < eligible.length; i++) {
    const gap =
      (Date.parse(eligible[i - 1] + 'T00:00:00Z') -
        Date.parse(eligible[i] + 'T00:00:00Z')) /
      (24 * 60 * 60 * 1000)
    if (gap <= 2) start = eligible[i]
    else break
  }

  return (
    Math.floor(
      (targetMs - Date.parse(start + 'T00:00:00Z')) / (24 * 60 * 60 * 1000),
    ) + 1
  )
}

function flowFill(flow: CycleEntry['flow_level'] | undefined, menstruating: boolean): string {
  if (!menstruating && !flow) return 'transparent'
  switch (flow) {
    case 'heavy':
      return 'var(--v2-surface-explanatory-accent)'
    case 'medium':
      return 'rgba(232, 69, 112, 0.70)'
    case 'light':
      return 'rgba(232, 69, 112, 0.45)'
    case 'spotting':
      return 'rgba(232, 69, 112, 0.25)'
    default:
      return menstruating ? 'rgba(232, 69, 112, 0.45)' : 'transparent'
  }
}

export interface CycleCalendarGridProps {
  entries: CycleEntry[]
  today: string
  weeks?: number
  predictedRangeStart?: string | null
  predictedRangeEnd?: string | null
  /**
   * Optional tap handler. When provided, each in-range cell renders as a
   * button and the wrapper meets the 44pt tap-target rule. History uses
   * this to open the day detail sheet in place of navigating away.
   */
  onDayClick?: (date: string) => void
}

export default function CycleCalendarGrid({
  entries,
  today,
  weeks = 10,
  predictedRangeStart,
  predictedRangeEnd,
  onDayClick,
}: CycleCalendarGridProps) {
  const byDate = new Map<string, CycleEntry>()
  for (const e of entries) byDate.set(e.date, e)
  const menstruationDates = entries.filter((e) => e.menstruation === true).map((e) => e.date)

  const todayDate = new Date(today + 'T00:00:00')
  const end = new Date(todayDate)
  end.setDate(end.getDate() + 14)
  const endDow = end.getDay()
  const daysToSunday = 6 - endDow
  end.setDate(end.getDate() + daysToSunday)

  const gridDays: Cell[] = []
  const totalDays = weeks * 7
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const entry = byDate.get(iso)
    const isToday = iso === today
    const isFuture = iso > today
    const inPredicted =
      !!predictedRangeStart &&
      !!predictedRangeEnd &&
      iso >= predictedRangeStart &&
      iso <= predictedRangeEnd

    let kind: Kind = isToday ? 'today' : isFuture ? (inPredicted ? 'future-predicted' : 'future') : 'past'
    gridDays.push({
      date: iso,
      label: d.getDate(),
      cycleDay: cycleDayFor(iso, menstruationDates),
      kind,
      flow: entry?.flow_level ?? undefined,
      menstruating: entry?.menstruation === true,
    })
  }

  const monthStartIdx = gridDays.findIndex((c) => c.label === 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 'var(--v2-space-1)',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          textAlign: 'center',
        }}
      >
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--v2-space-2)' }}>
        {gridDays.map((cell, i) => {
          const fill = cell.kind === 'past' || cell.kind === 'today' ? flowFill(cell.flow, cell.menstruating) : 'transparent'
          const border =
            cell.kind === 'today'
              ? '1.5px solid var(--v2-accent-primary)'
              : cell.kind === 'future-predicted'
                ? '1px dashed var(--v2-surface-explanatory-accent)'
                : '1px solid var(--v2-border-subtle)'
          const isNewMonth = i === monthStartIdx || (i > 0 && gridDays[i].label === 1)
          // Wave 3 inversion: cycle day is the primary readout, calendar
          // date sits small in the upper-left corner. When no cycle day
          // is known (e.g. dates predating any logged period), we fall
          // back to the calendar date so the cell isn't blank.
          const primary: string | number =
            cell.cycleDay != null ? cell.cycleDay : cell.label
          const showCalendarSubscript = cell.cycleDay != null
          const cellContent = (
            <>
              {showCalendarSubscript && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 4,
                    fontSize: 8,
                    color: 'var(--v2-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {cell.label}
                </span>
              )}
              <span
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {primary}
              </span>
              {isNewMonth && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 4,
                    fontSize: 8,
                    color: 'var(--v2-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--v2-tracking-wide)',
                    lineHeight: 1,
                  }}
                >
                  {new Date(cell.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                </span>
              )}
            </>
          )
          // NC parity (frame_0160): true circle day cells. width === height
          // is enforced by aspectRatio on the grid track and 50% border-radius
          // makes the pill a circle regardless of available width.
          const cellStyle: React.CSSProperties = {
            position: 'relative',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            background: fill === 'transparent' ? 'var(--v2-bg-card)' : fill,
            border,
            color: cell.kind === 'future' ? 'var(--v2-text-muted)' : 'var(--v2-text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--v2-text-xs)',
            fontVariantNumeric: 'tabular-nums',
          }
          const cellLabel = cell.cycleDay != null ? `Cycle day ${cell.cycleDay}, ${cell.date}` : cell.date
          if (onDayClick) {
            return (
              <button
                key={cell.date}
                type="button"
                title={cellLabel}
                aria-label={`View details for ${cellLabel}`}
                onClick={() => onDayClick(cell.date)}
                style={{
                  ...cellStyle,
                  padding: 0,
                  margin: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 'inherit',
                }}
              >
                {cellContent}
              </button>
            )
          }
          return (
            <div key={cell.date} title={cellLabel} style={cellStyle}>
              {cellContent}
            </div>
          )
        })}
      </div>
      <Legend />
    </div>
  )
}

function Legend() {
  const items = [
    { label: 'Heavy', fill: 'var(--v2-surface-explanatory-accent)' },
    { label: 'Medium', fill: 'rgba(232, 69, 112, 0.70)' },
    { label: 'Light', fill: 'rgba(232, 69, 112, 0.45)' },
    { label: 'Spot', fill: 'rgba(232, 69, 112, 0.25)' },
  ]
  return (
    <div style={{ display: 'flex', gap: 'var(--v2-space-3)', flexWrap: 'wrap', paddingTop: 'var(--v2-space-2)' }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: it.fill }} aria-hidden />
          <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>{it.label}</span>
        </div>
      ))}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: '1px dashed var(--v2-surface-explanatory-accent)',
          }}
          aria-hidden
        />
        <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>Predicted</span>
      </div>
    </div>
  )
}
