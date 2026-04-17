'use client'

/**
 * LabTrendRow: a single lab test rendered with its current value, flag
 * chip, delta badges vs 30-day / 90-day / 1-year rolling medians, and an
 * inline sparkline with reference-range shading.
 *
 * Data model: consumer passes every LabResult row for a given test_name
 * in `series`. We pick the latest by date as "current", the rest seed
 * the rolling medians and sparkline.
 */

import { useMemo, useState } from 'react'
import type { LabResult, LabFlag } from '@/lib/types'
import { LabSparkline } from '@/components/records/LabSparkline'
import {
  computeDeltas,
  formatDelta,
  formatPercent,
  type DeltaWindow,
} from '@/lib/labs/deltas'
import { flagForValue, resolveRefRange } from '@/lib/labs/ranges'

// ── Flag chip styling mirrors LabsTab.flagStyle for visual consistency.

interface FlagStyle {
  stripe: string
  chipBg: string
  chipFg: string
  label: string
}

function flagStyle(flag: LabFlag | 'low' | 'high' | 'normal' | null): FlagStyle | null {
  switch (flag) {
    case 'low':
      return {
        stripe: 'rgba(59, 130, 246, 0.45)',
        chipBg: 'rgba(59, 130, 246, 0.10)',
        chipFg: '#3B6FBF',
        label: 'Below range',
      }
    case 'high':
      return {
        stripe: 'rgba(217, 169, 78, 0.55)',
        chipBg: 'rgba(217, 169, 78, 0.14)',
        chipFg: '#9A7A2C',
        label: 'Above range',
      }
    case 'critical':
      return {
        stripe: 'rgba(212, 160, 160, 0.65)',
        chipBg: 'rgba(212, 160, 160, 0.18)',
        chipFg: '#8C5A5A',
        label: 'Watch closely',
      }
    default:
      return null
  }
}

// ── Delta badge rendering ───────────────────────────────────────────
//
// Positive deltas are rendered in a warm gold (same as "above range"),
// negative deltas in a soft blue (same as "below range"), zero/no-baseline
// in a neutral gray. The magnitude of the delta does NOT by itself imply
// anything clinical, so copy stays observational ("vs 30d").

function deltaBadgeStyle(
  delta: number | null,
): { bg: string; fg: string; border: string } {
  if (delta === null || delta === 0) {
    return {
      bg: 'var(--bg-elevated)',
      fg: 'var(--text-muted)',
      border: '1px solid var(--border-light)',
    }
  }
  if (delta > 0) {
    return {
      bg: 'rgba(217, 169, 78, 0.10)',
      fg: '#9A7A2C',
      border: '1px solid rgba(217, 169, 78, 0.22)',
    }
  }
  return {
    bg: 'rgba(59, 130, 246, 0.08)',
    fg: '#3B6FBF',
    border: '1px solid rgba(59, 130, 246, 0.18)',
  }
}

function DeltaBadge({ window: w, unit }: { window: DeltaWindow; unit: string | null }) {
  const style = deltaBadgeStyle(w.delta)
  const hasBaseline = w.median !== null
  const label = `vs ${w.label}`
  const primary = hasBaseline ? formatDelta(w.delta) : 'no baseline'
  const pct = hasBaseline ? ` (${formatPercent(w.percent)})` : ''

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: style.bg,
        color: style.fg,
        border: style.border,
      }}
      title={
        hasBaseline
          ? `Median over last ${w.days} days: ${w.median?.toFixed(2)}${unit ? ' ' + unit : ''} (n=${w.sampleSize})`
          : `No readings in the last ${w.days} days`
      }
    >
      <span className="tabular">{primary}</span>
      <span className="opacity-70">{label}</span>
      {hasBaseline && <span className="opacity-60 tabular">{pct}</span>}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────

export interface LabTrendRowProps {
  /** All results for this test_name, any order. Must have at least one. */
  series: LabResult[]
  /** Called when user expands/collapses the full sparkline. */
  onToggleExpanded?: (expanded: boolean) => void
  /** Start in expanded (tall sparkline + axes) mode. */
  defaultExpanded?: boolean
}

export function LabTrendRow({
  series,
  onToggleExpanded,
  defaultExpanded = false,
}: LabTrendRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const { current, points, range, effectiveFlag } = useMemo(() => {
    const sorted = [...series]
      .filter((r) => r.value !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]

    const points = sorted.map((r) => ({
      date: r.date,
      value: r.value as number,
    }))

    const range = resolveRefRange(
      latest?.test_name ?? '',
      latest?.unit ?? null,
      latest?.reference_range_low ?? null,
      latest?.reference_range_high ?? null,
    )

    // If the row already has a flag, trust it. Otherwise derive from the
    // resolved range so canonical-range rows still flag correctly.
    const derived = flagForValue(latest?.value ?? null, range.low, range.high)
    const effectiveFlag: LabFlag | 'low' | 'high' | 'normal' | null =
      latest?.flag ?? derived

    return { current: latest, points, range, effectiveFlag }
  }, [series])

  const deltas = useMemo(() => computeDeltas(points), [points])

  if (!current) {
    return (
      <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        No numeric data to chart.
      </div>
    )
  }

  const fStyle = flagStyle(effectiveFlag)
  const outOfRange = effectiveFlag === 'low' || effectiveFlag === 'high' || effectiveFlag === 'critical'
  const sparkPoints = points // already sorted

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    if (onToggleExpanded) onToggleExpanded(next)
  }

  return (
    <div
      className="px-4 py-3 relative"
      style={
        outOfRange
          ? { borderLeft: `2px solid ${fStyle?.stripe ?? 'var(--accent-sage)'}` }
          : undefined
      }
    >
      {/* Header row: name, current value, flag chip */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-sm font-medium flex-1 min-w-0 truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {current.test_name}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="tabular text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {current.value ?? '-'}
            {current.unit && (
              <span
                className="text-xs font-normal ml-1"
                style={{ color: 'var(--text-muted)' }}
              >
                {current.unit}
              </span>
            )}
          </span>
          {fStyle ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
              style={{ background: fStyle.chipBg, color: fStyle.chipFg }}
            >
              {fStyle.label}
            </span>
          ) : effectiveFlag === 'normal' ? (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: 'var(--text-muted)', opacity: 0.45 }}
              aria-label="In range"
              title="In range"
            />
          ) : null}
        </div>
      </div>

      {/* Inline sparkline (always shown when we have 2+ points) */}
      {sparkPoints.length >= 2 && (
        <div className="mt-2">
          <LabSparkline
            data={sparkPoints}
            refLow={range.low}
            refHigh={range.high}
            height={expanded ? 140 : 36}
            showAxes={expanded}
            ariaLabel={`${current.test_name} trend over ${sparkPoints.length} readings`}
          />
        </div>
      )}

      {/* Reference range caption */}
      {(range.low !== null || range.high !== null) && (
        <p className="tabular text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Ref {range.low ?? '-'} to {range.high ?? '-'} {current.unit || ''}
          {range.source === 'canonical' && (
            <span
              className="ml-1 opacity-70"
              title="Reference range not on this row; using canonical adult-female range."
            >
              (canonical)
            </span>
          )}
        </p>
      )}

      {/* Delta badges */}
      {deltas && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {deltas.windows.map((w) => (
            <DeltaBadge key={w.label} window={w} unit={current.unit} />
          ))}
        </div>
      )}

      {/* Expand/collapse full chart */}
      {sparkPoints.length >= 2 && (
        <button
          onClick={handleToggle}
          className="touch-target press-feedback mt-2 text-xs font-medium rounded-md px-2 py-1"
          style={{
            color: 'var(--accent-sage)',
            background: expanded ? 'var(--accent-sage-muted)' : 'transparent',
            transition: `background var(--duration-fast) var(--ease-standard)`,
          }}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide chart' : 'Expand chart'}
        </button>
      )}
    </div>
  )
}
