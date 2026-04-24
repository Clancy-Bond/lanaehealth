'use client'
/*
 * MacroTilesRow
 *
 * Three stacked macro rows (Carbs / Protein / Fat) with
 * ProgressBar-driven fills. Over-target rows show "+N g" in the
 * subtext, never red panic. The bars use accent-primary when under,
 * accent-warning when over.
 *
 * Each row is also a button: tap opens a MacrosExplainer modal in
 * the Oura "Sleep regularity" educational style established by
 * PR #45 + #46. Mirrors the same one-explainer-per-tile pattern used
 * on the home strip.
 *
 * Ported from legacy `src/components/calories/home/MacrosToday.tsx`
 * but redrawn for the v2 dark chrome, using the section-local
 * ProgressBar primitive with its no-shame overflow semantics.
 */
import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
import ProgressBar from './ProgressBar'
import { MacrosExplainer, type MacroKind } from './MetricExplainers'

export interface MacroTilesRowProps {
  carbsCurrent: number
  carbsTarget: number
  proteinCurrent: number
  proteinTarget: number
  fatCurrent: number
  fatTarget: number
  /** Most recent bodyweight in kg, used for the protein g/kg banding. */
  bodyweightKg?: number | null
}

interface Row {
  kind: MacroKind
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
  bodyweightKg,
}: MacroTilesRowProps) {
  const [openKey, setOpenKey] = useState<MacroKind | null>(null)
  const close = () => setOpenKey(null)

  const rows: Row[] = [
    { kind: 'carbs', label: 'Carbs', current: carbsCurrent, target: carbsTarget },
    { kind: 'protein', label: 'Protein', current: proteinCurrent, target: proteinTarget },
    { kind: 'fat', label: 'Fat', current: fatCurrent, target: fatTarget },
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
          <MacroRow key={row.label} row={row} onOpen={() => setOpenKey(row.kind)} />
        ))}
      </div>

      {openKey !== null && (
        <MacrosExplainer
          open={true}
          onClose={close}
          kind={openKey}
          current={
            openKey === 'carbs'
              ? carbsCurrent
              : openKey === 'protein'
                ? proteinCurrent
                : fatCurrent
          }
          target={
            openKey === 'carbs'
              ? carbsTarget
              : openKey === 'protein'
                ? proteinTarget
                : fatTarget
          }
          bodyweightKg={openKey === 'protein' ? bodyweightKg : null}
        />
      )}
    </Card>
  )
}

function MacroRow({ row, onOpen }: { row: Row; onOpen: () => void }) {
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
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${row.label.toLowerCase()} explainer`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
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
    </button>
  )
}
