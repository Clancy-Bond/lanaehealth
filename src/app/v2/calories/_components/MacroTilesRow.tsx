'use client'
/*
 * MacroTilesRow
 *
 * MFN-anchored macro display. MyNetDiary's macro presentation uses
 * three small donut/ring tiles (Carbs / Protein / Fat) each with the
 * gram value at center and a colored arc whose fill ratio matches the
 * percent-of-target. Carbs use the warm yellow band, protein the
 * primary green, fat the soft purple. The tiles read from left to
 * right as a single rhythm rather than a stacked list.
 *
 * Each tile is also a button: tap opens a MacrosExplainer modal in the
 * Oura "Sleep regularity" educational style established by PR #45/#46.
 *
 * Per CLAUDE.md design philosophy: this section deliberately mirrors
 * MFN's per-section UX language; only the global chrome stays Oura.
 */
import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
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

interface Tile {
  kind: MacroKind
  label: 'Carbs' | 'Protein' | 'Fat'
  current: number
  target: number
  /** Track + arc color tokens. */
  ringColor: string
}

const RING_BG = 'rgba(255,255,255,0.10)'

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

  const tiles: Tile[] = [
    { kind: 'carbs', label: 'Carbs', current: carbsCurrent, target: carbsTarget, ringColor: '#E5C952' },
    { kind: 'protein', label: 'Protein', current: proteinCurrent, target: proteinTarget, ringColor: '#4DB8A8' },
    { kind: 'fat', label: 'Fat', current: fatCurrent, target: fatTarget, ringColor: '#B79CD9' },
  ]

  return (
    <Card padding="md">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 'var(--v2-space-3)',
        }}
      >
        {tiles.map((t) => (
          <MacroDonutTile key={t.label} tile={t} onOpen={() => setOpenKey(t.kind)} />
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

function MacroDonutTile({ tile, onOpen }: { tile: Tile; onOpen: () => void }) {
  const current = Math.round(tile.current)
  const target = Math.round(tile.target)
  const overBy = current > target ? current - target : 0
  const over = overBy > 0
  const safeTarget = target > 0 ? target : 1
  const rawPct = (current / safeTarget) * 100
  const MIN_VISIBLE_PCT = 4
  const pct =
    current > 0 ? Math.max(MIN_VISIBLE_PCT, Math.min(100, rawPct)) : 0

  const displayColor = over ? 'var(--v2-accent-warning)' : tile.ringColor
  const subtext =
    target === 0
      ? `${current} g`
      : over
        ? `${current} / ${target} g  ·  +${overBy}`
        : `${current} / ${target} g`

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${tile.label.toLowerCase()} explainer. ${current} of ${target} grams${over ? `, ${overBy} over` : ''}.`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--v2-space-2)',
        background: 'transparent',
        border: 'none',
        padding: 'var(--v2-space-2) 0',
        margin: 0,
        cursor: 'pointer',
        color: 'inherit',
        font: 'inherit',
        width: '100%',
      }}
    >
      <Donut pct={pct} color={displayColor} centerValue={`${current}`} centerUnit="g" />
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        {tile.label}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: over ? 'var(--v2-accent-warning)' : 'var(--v2-text-muted)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'center',
        }}
      >
        {subtext}
      </span>
    </button>
  )
}

function Donut({
  pct,
  color,
  centerValue,
  centerUnit,
}: {
  pct: number
  color: string
  centerValue: string
  centerUnit: string
}) {
  const d = 64
  const stroke = 7
  const r = (d - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)
  return (
    <div
      style={{
        position: 'relative',
        width: d,
        height: d,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={RING_BG} strokeWidth={stroke} />
        <circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition:
              'stroke-dashoffset var(--v2-duration-slow) var(--v2-ease-emphasized)',
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          {centerValue}
        </span>
        <span
          style={{
            fontSize: 9,
            color: 'var(--v2-text-muted)',
            marginTop: 2,
          }}
        >
          {centerUnit}
        </span>
      </div>
    </div>
  )
}
