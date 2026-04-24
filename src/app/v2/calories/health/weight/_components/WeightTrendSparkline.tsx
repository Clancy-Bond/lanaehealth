'use client'
/*
 * WeightTrendSparkline
 *
 * Thirty-day bar chart of weigh-ins. Shape follows the calorie
 * sparkline so the dashboard, analysis, and weight routes all read
 * as the same chart language (see ../../../analysis/_components/
 * MonthlyCalorieSparkline.tsx). The difference is the vertical scale:
 * weight readings cluster in a narrow band (e.g. 198-205 lb), so
 * scaling from zero would flatten every bar into an even row. We
 * scale from (min - 2) to (max + 2) in lb to expose trend without
 * exaggerating noise.
 *
 * Empty days (no weigh-in) render as a short grey stub so a sparse
 * log still reads as a full month of ticks. The latest day picks up
 * the teal accent fill.
 *
 * The header is a tap-to-explain target: opens WeightTrendExplainer
 * in the Oura "Sleep regularity" educational style established by
 * PR #45 + #46.
 *
 * LEARNING-MODE HOOK G9: Weight scale choice.
 *   Bars from zero vs. local-band bars: we picked the latter
 *   because weight is a coordinate, not a count. The eye wants to
 *   see "is the line falling or rising", and only the local-band
 *   scale makes that legible on 30 narrow bars. If we ever add
 *   a per-bar label, we'll need the extra vertical room the
 *   local-band approach provides.
 */
import { useState } from 'react'
import { addDays, format } from 'date-fns'
import { Card } from '@/v2/components/primitives'
import { kgToLb, type WeightEntry } from '@/lib/calories/weight'
import WeightTrendExplainer from './WeightTrendExplainer'

export interface WeightTrendSparklineProps {
  /** All log entries. Only the last 30 days' window is drawn. */
  entries: WeightEntry[]
  /** ISO date to anchor the 30-day window on (inclusive right edge). */
  anchorISO: string
}

interface DayCell {
  date: string
  lb: number | null
  isLatest: boolean
}

function buildWindow(entries: WeightEntry[], anchorISO: string): DayCell[] {
  const byDate = new Map<string, number>()
  for (const e of entries) byDate.set(e.date, kgToLb(e.kg))
  const anchor = new Date(anchorISO + 'T00:00:00')

  // Find the ISO of the latest entry on or before the anchor so we
  // can flag it with the accent fill. If the latest weigh-in is
  // older than 30 days we still mark it inside the window when
  // visible; otherwise no cell picks up the accent.
  let latestISO: string | null = null
  for (const e of entries) {
    if (e.date <= anchorISO && (!latestISO || e.date > latestISO)) latestISO = e.date
  }

  const cells: DayCell[] = []
  for (let i = 29; i >= 0; i--) {
    const d = format(addDays(anchor, -i), 'yyyy-MM-dd')
    const lb = byDate.get(d) ?? null
    cells.push({ date: d, lb, isLatest: d === latestISO })
  }
  return cells
}

function lookupLb(cells: DayCell[], daysAgo: number): number | null {
  // cells[29] is the anchor day; cells[0] is 29 days earlier. Walk
  // back from the target index to find the nearest earlier reading.
  const targetIdx = 29 - daysAgo
  for (let i = Math.min(targetIdx, cells.length - 1); i >= 0; i--) {
    const lb = cells[i]?.lb
    if (typeof lb === 'number' && Number.isFinite(lb)) return lb
  }
  return null
}

export default function WeightTrendSparkline({
  entries,
  anchorISO,
}: WeightTrendSparklineProps) {
  const [open, setOpen] = useState(false)
  const cells = buildWindow(entries, anchorISO)
  const readings = cells.map((c) => c.lb).filter((lb): lb is number => lb !== null)

  if (readings.length === 0) return null

  const min = Math.min(...readings)
  const max = Math.max(...readings)
  // Pad the band so a flat log doesn't collapse to zero height and
  // a single weigh-in still has a visible bar.
  const lower = min - 2
  const upper = max + 2
  const range = Math.max(1, upper - lower)

  // Derive anchor, 7-days-ago, and 29-days-ago readings from the
  // rendered cells so the explainer can quote concrete deltas.
  const latestLb =
    cells[cells.length - 1]?.lb ?? readings[readings.length - 1] ?? null
  const weekAgoLb = lookupLb(cells, 7)
  const monthAgoLb = lookupLb(cells, 29)

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open weight trend explainer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: 'inherit',
            textAlign: 'left',
            font: 'inherit',
            width: '100%',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Last 30 days
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Each bar is a weigh-in. Empty days are short ticks.
          </p>
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            height: 72,
            width: '100%',
          }}
          aria-hidden
        >
          {cells.map((cell) => {
            const isEmpty = cell.lb === null
            const heightPct = isEmpty
              ? 0
              : Math.max(6, Math.min(100, ((cell.lb! - lower) / range) * 100))
            return (
              <div
                key={cell.date}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: '100%',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: isEmpty ? 4 : `${heightPct}%`,
                    borderRadius: 'var(--v2-radius-sm)',
                    background: cell.isLatest
                      ? 'var(--v2-accent-primary)'
                      : isEmpty
                        ? 'var(--v2-border)'
                        : 'var(--v2-accent-primary-soft)',
                    border: cell.isLatest ? 'none' : '1px solid var(--v2-border-subtle)',
                    transition:
                      'background var(--v2-duration-medium) var(--v2-ease-standard)',
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <WeightTrendExplainer
        open={open}
        onClose={() => setOpen(false)}
        latestLb={latestLb}
        weekAgoLb={weekAgoLb}
        monthAgoLb={monthAgoLb}
      />
    </Card>
  )
}
