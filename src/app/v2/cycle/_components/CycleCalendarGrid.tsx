/*
 * CycleCalendarGrid
 *
 * NC-fidelity push (PR following #57): Wave 3 inverted the cell content
 * to show the cycle day as primary; this pass tightens the visual
 * language to match NC frame_0163 more literally.
 *
 *   - Cells that fall on consecutive period days get a horizontal pink
 *     "bead" bar joining them, so a four-day period reads as one
 *     connected shape rather than four isolated circles.
 *   - Past Green Days (logged but not menstruating) render as filled
 *     green circles, mirroring the WeekdayStrip and the today-orb so
 *     the "green = not fertile" semantic carries everywhere.
 *   - Calendar date is restored from a microscopic 8px corner glyph to
 *     a readable 10px micro-label (still subordinate to cycle day).
 *   - Cells with no data fade to a faint outline so the eye lands on
 *     the colored cells first; the calendar reads as a pattern rather
 *     than a wall of dark squares.
 *
 * Rules (from docs/competitive/natural-cycles/user-reviews.md #39):
 *   - Past cells render the data that is actually logged (flow level).
 *   - Predicted-period cells render ONLY on future dates, with a dashed
 *     border. We never retroactively re-color a past cell.
 */
import type { CycleEntry } from '@/lib/types'

type Kind = 'future-predicted' | 'past' | 'today' | 'future' | 'outside'

interface Cell {
  date: string
  /** Calendar day-of-month (1-31), now rendered SMALL above the cycle day. */
  label: number
  /** 1-indexed cycle day, or null when no menstrual history is known. */
  cycleDay: number | null
  kind: Kind
  flow: CycleEntry['flow_level'] | undefined
  menstruating: boolean
  hasGreenSignal: boolean
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
      return 'rgba(232, 69, 112, 0.78)'
    case 'light':
      return 'rgba(232, 69, 112, 0.55)'
    case 'spotting':
      return 'rgba(232, 69, 112, 0.32)'
    default:
      return menstruating ? 'rgba(232, 69, 112, 0.55)' : 'transparent'
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

  // Identify cells that have ANY logged signal (used to color past Green Days).
  const greenSignal = new Set<string>()
  for (const e of entries) {
    if (e.menstruation === true) continue
    const hasSignal =
      e.flow_level != null ||
      e.lh_test_result != null ||
      (Array.isArray(e.symptoms) && e.symptoms.length > 0) ||
      e.mood_emoji != null ||
      e.skin_state != null ||
      e.cervical_mucus_consistency != null ||
      e.cervical_mucus_quantity != null
    if (hasSignal) greenSignal.add(e.date)
  }

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

    const kind: Kind = isToday ? 'today' : isFuture ? (inPredicted ? 'future-predicted' : 'future') : 'past'
    gridDays.push({
      date: iso,
      label: d.getDate(),
      cycleDay: cycleDayFor(iso, menstruationDates),
      kind,
      flow: entry?.flow_level ?? undefined,
      menstruating: entry?.menstruation === true,
      hasGreenSignal: greenSignal.has(iso),
    })
  }

  // Pre-compute period-bead neighbors so consecutive period cells render
  // a continuous pink bar on the inner edges. This is what gives NC's
  // calendar its "string of beads" feel.
  function isPeriodCell(c: Cell | undefined): boolean {
    if (!c) return false
    return c.menstruating || (c.kind === 'future-predicted' && c.label > 0)
  }

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
          const isPeriod = cell.menstruating
          const isPast = cell.kind === 'past'
          const isToday = cell.kind === 'today'
          const isPredictedPeriod = cell.kind === 'future-predicted'
          const isGreenDay = isPast && !isPeriod && cell.hasGreenSignal
          const isFutureNoData = cell.kind === 'future' && !isPredictedPeriod

          // Cell fill: solid for period (current or past), filled green for
          // past green days, faint chrome for future / no-data.
          const fill = isPeriod
            ? flowFill(cell.flow, cell.menstruating)
            : isGreenDay
              ? 'rgba(106, 207, 137, 0.85)'
              : isToday
                ? 'transparent'
                : 'transparent'

          // Border: today wins (dashed accent), then predicted-period (dashed
          // pink), then green outline for predicted future, then quiet outline.
          let border = '1px solid var(--v2-border-subtle)'
          if (isToday) border = '1.5px dashed var(--v2-accent-success)'
          else if (isPredictedPeriod) border = '1.5px dashed var(--v2-surface-explanatory-accent)'
          else if (isFutureNoData) border = '1.5px solid rgba(106, 207, 137, 0.35)'

          // Period bead bar: render a horizontal connector behind cells in
          // the same row when this cell + its neighbor are both period.
          const left = (i % 7 === 0) ? null : gridDays[i - 1]
          const right = (i % 7 === 6) ? null : gridDays[i + 1]
          const beadLeft = isPeriod && isPeriodCell(left ?? undefined)
          const beadRight = isPeriod && isPeriodCell(right ?? undefined)

          // Text color: dark on light fills, primary on chrome, muted on faint.
          const isFilled = isPeriod || isGreenDay
          const textColor = isFilled
            ? '#0A0A0B'
            : isFutureNoData
              ? 'var(--v2-text-muted)'
              : 'var(--v2-text-primary)'

          // Wave 3 inversion preserved: cycle day is the primary readout.
          // Calendar date sits ABOVE cycle day at 10px (up from 8px), so it
          // is readable but still subordinate.
          const primary: string | number =
            cell.cycleDay != null ? cell.cycleDay : cell.label
          const showCalendarSubscript = cell.cycleDay != null
          const cellContent = (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, gap: 1 }}>
              {showCalendarSubscript && (
                <span
                  aria-hidden
                  style={{
                    fontSize: 9,
                    color: isFilled ? 'rgba(0,0,0,0.55)' : 'var(--v2-text-muted)',
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
            </span>
          )

          // NC parity (frame_0160): true circle day cells. width === height
          // is enforced by aspectRatio on the grid track and 50% border-radius
          // makes the pill a circle regardless of available width.
          const cellStyle: React.CSSProperties = {
            position: 'relative',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            background: fill,
            border,
            color: textColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--v2-text-xs)',
            fontVariantNumeric: 'tabular-nums',
          }
          // The bead connector sits behind the cell so the cell's border
          // covers its end. We position it at the cell's vertical center.
          const bead = (beadLeft || beadRight) ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                left: beadLeft ? '-12%' : '50%',
                right: beadRight ? '-12%' : '50%',
                height: 6,
                background: 'var(--v2-surface-explanatory-accent)',
                zIndex: 0,
              }}
            />
          ) : null
          const cellLabel = cell.cycleDay != null ? `Cycle day ${cell.cycleDay}, ${cell.date}` : cell.date

          // Wrapper so the bead can sit behind the circle without being
          // clipped by border-radius.
          const wrapperStyle: React.CSSProperties = {
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }

          // NC frame_0150 visual: a tiny water-drop glyph appears
          // centered below period-day circles. We render it below the
          // cell so it sits in the row gutter and the circle stays
          // perfectly round.
          const drop = isPeriod ? <PeriodDrop /> : null
          if (onDayClick) {
            return (
              <span key={cell.date} style={wrapperStyle}>
                {bead}
                <button
                  type="button"
                  title={cellLabel}
                  aria-label={`View details for ${cellLabel}`}
                  onClick={() => onDayClick(cell.date)}
                  style={{
                    ...cellStyle,
                    width: '100%',
                    padding: 0,
                    margin: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 'inherit',
                    zIndex: 1,
                  }}
                >
                  {cellContent}
                </button>
                {drop}
              </span>
            )
          }
          return (
            <span key={cell.date} style={wrapperStyle}>
              {bead}
              <div title={cellLabel} style={{ ...cellStyle, width: '100%', zIndex: 1 }}>
                {cellContent}
              </div>
              {drop}
            </span>
          )
        })}
      </div>
      <Legend />
    </div>
  )
}

/**
 * Tiny droplet glyph rendered below period-day circles to mirror the
 * NC frame_0150 visual ("blood drop" indicator under days 26, 27, 28
 * and the early-May period rows). Pure SVG, no dependency on any
 * icon set, sized to fit in the row gutter.
 */
function PeriodDrop() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 14"
      width={8}
      height={10}
      style={{
        position: 'absolute',
        bottom: -10,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
      }}
    >
      <path
        d="M6 1 C6 1, 1.5 7, 1.5 10 a4.5 4.5 0 0 0 9 0 C10.5 7, 6 1, 6 1 Z"
        fill="var(--v2-surface-explanatory-accent, #E84570)"
      />
    </svg>
  )
}

function Legend() {
  const items = [
    { label: 'Period', fill: 'var(--v2-surface-explanatory-accent)' },
    { label: 'Green day', fill: 'rgba(106, 207, 137, 0.85)' },
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
            border: '1.5px solid rgba(106, 207, 137, 0.35)',
          }}
          aria-hidden
        />
        <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>Predicted green</span>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: '1.5px dashed var(--v2-surface-explanatory-accent)',
          }}
          aria-hidden
        />
        <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>Predicted period</span>
      </div>
    </div>
  )
}
