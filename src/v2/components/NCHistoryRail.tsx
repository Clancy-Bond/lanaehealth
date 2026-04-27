/*
 * NCHistoryRail
 *
 * Vertical timeline rail clone of the Natural Cycles History view.
 * Source frames: docs/reference/natural-cycles/frames/full-tour/
 * frame_0080.png and frame_0090.png.
 *
 * Anatomy (top to bottom):
 *
 *   ┌─────────────────────────────────────┐
 *   │              April 2026             │   month divider
 *   │                                     │
 *   │   ●   Cycle Day 7                   │   pink solid circle = menstrual
 *   │   |        ...                      │   pink rail connector
 *   │   ●   Cycle Day 8        97.23°F →  │
 *   │   |                                 │
 *   │   ●   Cycle Day 9                   │
 *   │   |                                 │
 *   │   ●   Cycle Day 10       ●          │   small black dot = today marker
 *   │   |                                 │
 *   │   ◯   Cycle Day 11                  │   green outline = predicted
 *   │       Cycle start                   │   inline divider
 *   │   ●   Cycle Day 1        97.79°F →  │
 *   └─────────────────────────────────────┘
 *
 * Each row is tappable; tapping calls onPickDate(iso) so the parent
 * can open a detail sheet (CycleDayDetailSheet in the existing
 * implementation).
 *
 * The rail color is keyed to the local row's phase so a continuous
 * pink stretch reads as menstruation and a green stretch reads as
 * fertile/ovulatory. NC's palette:
 *   - menstrual: solid pink fill   (#E84570)
 *   - fertile/ovulatory: solid green fill   (#5DBC82)
 *   - follicular/luteal: outlined green     (predicted-style)
 */
'use client'

import type { CSSProperties } from 'react'
import type { CyclePhase } from '@/lib/types'

export interface NCHistoryRailRow {
  /** ISO date (YYYY-MM-DD). */
  date: string
  /** 1-indexed cycle day if known. */
  cycleDay: number | null
  /** Phase at this row, drives the circle color. */
  phase: CyclePhase | null
  /** True for menstruation logged days (overrides phase coloring). */
  isMenstruation?: boolean
  /** True for confirmed-fertile/ovulatory days. */
  isFertile?: boolean
  /** Outlined (not filled) for predicted/future days. */
  isPredicted?: boolean
  /** True when this row is the user's "today". */
  isToday?: boolean
  /** Optional Fahrenheit temperature for the right-side pill. */
  tempFahrenheit?: number | null
  /** Inline label rendered below the circle ("Cycle start" etc.). */
  marker?: string | null
}

export interface NCHistoryRailGroup {
  /** Header text for the group ("April 2026"). */
  label: string
  rows: NCHistoryRailRow[]
}

export interface NCHistoryRailProps {
  groups: NCHistoryRailGroup[]
  onPickDate?: (date: string) => void
}

const PHASE_FILL: Record<NonNullable<CyclePhase>, string> = {
  menstrual: 'var(--v2-phase-menstrual, #E84570)',
  follicular: 'var(--v2-phase-follicular, #4DB8A8)',
  ovulatory: 'var(--v2-phase-ovulatory, #5DBC82)',
  luteal: 'var(--v2-phase-luteal, #9B7FE0)',
}

function colorForRow(row: NCHistoryRailRow): string {
  if (row.isMenstruation) return PHASE_FILL.menstrual
  if (row.isFertile) return '#5DBC82' // NC fertile green
  if (row.phase) return PHASE_FILL[row.phase]
  return '#5DBC82'
}

export default function NCHistoryRail({ groups, onPickDate }: NCHistoryRailProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      {groups.map((group) => (
        <section key={group.label} style={{ display: 'flex', flexDirection: 'column' }}>
          <h3
            style={{
              margin: 0,
              padding: 'var(--v2-space-3) 0',
              textAlign: 'center',
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-surface-explanatory-text, #2D193C)',
            }}
          >
            {group.label}
          </h3>
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {group.rows.map((row, i) => {
              const isLast = i === group.rows.length - 1
              const color = colorForRow(row)
              return (
                <li key={row.date}>
                  <RailRow
                    row={row}
                    color={color}
                    drawConnectorBelow={!isLast}
                    onPick={onPickDate}
                  />
                  {row.marker && <RailMarker label={row.marker} />}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

interface RailRowProps {
  row: NCHistoryRailRow
  color: string
  drawConnectorBelow: boolean
  onPick?: (date: string) => void
}

function RailRow({ row, color, drawConnectorBelow, onPick }: RailRowProps) {
  const ROW_HEIGHT = 56
  const CIRCLE = 30
  const RAIL_X = 28 // center of the rail/circle column

  const filled = !row.isPredicted
  const circleStyle: CSSProperties = filled
    ? { background: color, color: 'white', border: 'none' }
    : { background: 'transparent', color, border: `2px solid ${color}` }

  const handleClick = () => {
    if (onPick) onPick(row.date)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${row.date}${row.cycleDay ? `, cycle day ${row.cycleDay}` : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--v2-space-3)',
        minHeight: ROW_HEIGHT,
        padding: '0 var(--v2-space-3) 0 8px',
        background: 'transparent',
        border: 0,
        cursor: onPick ? 'pointer' : 'default',
        color: 'var(--v2-surface-explanatory-text, #2D193C)',
        fontFamily: 'inherit',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Connector below the circle */}
      {drawConnectorBelow && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: RAIL_X - 2,
            top: ROW_HEIGHT / 2 + CIRCLE / 2 - 4,
            width: 4,
            height: ROW_HEIGHT / 2 + 8,
            background: color,
            opacity: row.isPredicted ? 0.35 : 1,
          }}
        />
      )}
      {/* Circle */}
      <span
        aria-hidden
        style={{
          position: 'relative',
          flexShrink: 0,
          width: CIRCLE,
          height: CIRCLE,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          fontVariantNumeric: 'tabular-nums',
          ...circleStyle,
        }}
      >
        {row.cycleDay ?? ''}
        {row.isToday && (
          <span
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--v2-surface-explanatory-text, #2D193C)',
              border: '2px solid var(--v2-surface-explanatory-bg, #FAF5ED)',
            }}
          />
        )}
      </span>
      {/* Day label */}
      <span style={{ flex: 1, fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-medium)' }}>
        {row.cycleDay != null ? `Cycle Day ${row.cycleDay}` : row.date.slice(5)}
      </span>
      {/* Temperature pill */}
      {row.tempFahrenheit != null && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--v2-space-2)',
            background: 'var(--v2-surface-explanatory-secondary, #F4ECF1)',
            color: 'var(--v2-surface-explanatory-text, #2D193C)',
            padding: '6px 12px',
            borderRadius: 'var(--v2-radius-full)',
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-medium)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {row.tempFahrenheit.toFixed(2)}°F
          <Chevron />
        </span>
      )}
    </button>
  )
}

function RailMarker({ label }: { label: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        margin: 'var(--v2-space-2) 0',
        fontSize: 'var(--v2-text-base)',
        fontWeight: 'var(--v2-weight-bold)',
        color: 'var(--v2-surface-explanatory-text, #2D193C)',
      }}
    >
      {label}
    </div>
  )
}

function Chevron() {
  return (
    <svg width={10} height={10} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M4 2l4 4-4 4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
