/*
 * MacroTilesRow
 *
 * Three stacked macro rows (Carbs / Protein / Fat) with
 * ProgressBar-driven fills. Over-target rows show "+N g" in the
 * subtext, never red panic. The bars use accent-primary when under,
 * accent-warning when over.
 *
 * Ported from legacy `src/components/calories/home/MacrosToday.tsx`
 * but redrawn for the v2 dark chrome, using the section-local
 * ProgressBar primitive with its no-shame overflow semantics.
 */
import { Card } from '@/v2/components/primitives'
import ProgressBar from './ProgressBar'

export interface MacroTilesRowProps {
  carbsCurrent: number
  carbsTarget: number
  proteinCurrent: number
  proteinTarget: number
  fatCurrent: number
  fatTarget: number
}

interface Row {
  label: 'Carbs' | 'Protein' | 'Fat'
  current: number
  target: number
}

export default function MacroTilesRow({
  carbsCurrent,
  carbsTarget,
  proteinCurrent,
  proteinTarget,
  fatCurrent,
  fatTarget,
}: MacroTilesRowProps) {
  const rows: Row[] = [
    { label: 'Carbs', current: carbsCurrent, target: carbsTarget },
    { label: 'Protein', current: proteinCurrent, target: proteinTarget },
    { label: 'Fat', current: fatCurrent, target: fatTarget },
  ]

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-4)',
        }}
      >
        {rows.map((row) => (
          <MacroRow key={row.label} row={row} />
        ))}
      </div>
    </Card>
  )
}

function MacroRow({ row }: { row: Row }) {
  const current = Math.round(row.current)
  const target = Math.round(row.target)
  const overBy = current > target ? current - target : 0
  const over = overBy > 0
  const subtext = target === 0
    ? `${current} g`
    : over
      ? `${current} / ${target} g  ·  +${overBy} g`
      : `${current} / ${target} g`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-3)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          {row.label}
        </span>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-medium)',
            color: over ? 'var(--v2-accent-warning)' : 'var(--v2-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {subtext}
        </span>
      </div>
      <ProgressBar
        value={current}
        max={target}
        intent={over ? 'warning' : 'default'}
        ariaLabel={`${row.label}: ${current} of ${target} grams${over ? `, ${overBy} over` : ''}`}
      />
    </div>
  )
}
