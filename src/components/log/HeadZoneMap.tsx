'use client'

/**
 * HeadZoneMap: tappable 10-zone head map used by HeadacheQuickLog.
 *
 * Ten zones per docs/plans/2026-04-16-wave-2a-briefs.md brief A1:
 *   frontal-l, frontal-r, frontal-c,
 *   temporal-l, temporal-r,
 *   orbital-l, orbital-r,
 *   occipital, vertex, c-spine.
 *
 * Minimum 44px touch targets per design-decisions.md section 5.
 * Uses --pain-* severity color tokens so selected zones pick up the
 * shared palette rather than raw red/orange values.
 *
 * Standalone on purpose: the existing AnatomicalBodyMap is single-use
 * (pain-point pins on front/back silhouettes) and we do not want to
 * destabilize it by overloading a head-zone multi-select on top. This
 * component can be dropped into the log page, the active-attack route,
 * or the post-hoc detail form without shared state.
 */

import { useCallback } from 'react'
import type { HeadZone } from '@/lib/api/headache'

interface HeadZoneMapProps {
  selected: HeadZone[]
  onChange: (zones: HeadZone[]) => void
  intensity?: number | null
  disabled?: boolean
}

interface ZoneDef {
  id: HeadZone
  label: string
  view: 'front' | 'back'
  // Normalized SVG coords for the 100x120 viewBox.
  bounds: { x: number; y: number; width: number; height: number }
}

// Front-view zones: frontal L/C/R, temporal L/R, orbital L/R.
// Back-view zones: occipital, vertex, c-spine.
// These coordinates are tuned for the 100x120 viewBox below.
const ZONES: ZoneDef[] = [
  { id: 'frontal-l', label: 'Frontal (left)', view: 'front', bounds: { x: 22, y: 18, width: 22, height: 14 } },
  { id: 'frontal-c', label: 'Frontal (center)', view: 'front', bounds: { x: 42, y: 16, width: 16, height: 14 } },
  { id: 'frontal-r', label: 'Frontal (right)', view: 'front', bounds: { x: 56, y: 18, width: 22, height: 14 } },
  { id: 'orbital-l', label: 'Orbital (left eye)', view: 'front', bounds: { x: 26, y: 32, width: 18, height: 10 } },
  { id: 'orbital-r', label: 'Orbital (right eye)', view: 'front', bounds: { x: 56, y: 32, width: 18, height: 10 } },
  { id: 'temporal-l', label: 'Temporal (left)', view: 'front', bounds: { x: 14, y: 40, width: 16, height: 18 } },
  { id: 'temporal-r', label: 'Temporal (right)', view: 'front', bounds: { x: 70, y: 40, width: 16, height: 18 } },
  { id: 'vertex', label: 'Vertex (top of head)', view: 'back', bounds: { x: 36, y: 8, width: 28, height: 12 } },
  { id: 'occipital', label: 'Occipital (back of head)', view: 'back', bounds: { x: 32, y: 42, width: 36, height: 18 } },
  { id: 'c-spine', label: 'Cervical spine (back of neck)', view: 'back', bounds: { x: 38, y: 62, width: 24, height: 12 } },
]

function severityColor(intensity: number | null | undefined): string {
  if (intensity === null || intensity === undefined) return 'var(--accent-sage)'
  if (intensity <= 2) return 'var(--pain-low, #9FB8A5)'
  if (intensity <= 4) return 'var(--pain-mild, #C4A35A)'
  if (intensity <= 6) return 'var(--pain-moderate, #D4874D)'
  if (intensity <= 8) return 'var(--pain-severe, #C85C5C)'
  return 'var(--pain-extreme, #8B2E2E)'
}

function FrontHeadSilhouette() {
  // Simple oval outline; the zone rects drawn on top handle hit-testing.
  return (
    <ellipse
      cx="50"
      cy="45"
      rx="34"
      ry="32"
      fill="var(--bg-elevated, #F5F5F0)"
      stroke="var(--text-secondary, #6B7280)"
      strokeWidth="0.8"
      strokeOpacity="0.4"
    />
  )
}

function BackHeadSilhouette() {
  return (
    <>
      <ellipse
        cx="50"
        cy="38"
        rx="30"
        ry="30"
        fill="var(--bg-elevated, #F5F5F0)"
        stroke="var(--text-secondary, #6B7280)"
        strokeWidth="0.8"
        strokeOpacity="0.4"
      />
      {/* Neck hint below for c-spine zone */}
      <rect
        x="38"
        y="60"
        width="24"
        height="18"
        rx="4"
        fill="var(--bg-elevated, #F5F5F0)"
        stroke="var(--text-secondary, #6B7280)"
        strokeWidth="0.8"
        strokeOpacity="0.4"
      />
    </>
  )
}

export default function HeadZoneMap({
  selected,
  onChange,
  intensity = null,
  disabled = false,
}: HeadZoneMapProps) {
  const toggleZone = useCallback(
    (zone: HeadZone) => {
      if (disabled) return
      if (selected.includes(zone)) {
        onChange(selected.filter(z => z !== zone))
      } else {
        onChange([...selected, zone])
      }
    },
    [selected, onChange, disabled],
  )

  const selectedColor = severityColor(intensity)
  const frontZones = ZONES.filter(z => z.view === 'front')
  const backZones = ZONES.filter(z => z.view === 'back')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}
      >
        <HeadView
          title="Front and sides"
          zones={frontZones}
          selected={selected}
          selectedColor={selectedColor}
          onToggle={toggleZone}
          silhouette={<FrontHeadSilhouette />}
          disabled={disabled}
        />
        <HeadView
          title="Top and back"
          zones={backZones}
          selected={selected}
          selectedColor={selectedColor}
          onToggle={toggleZone}
          silhouette={<BackHeadSilhouette />}
          disabled={disabled}
        />
      </div>

      {selected.length > 0 && (
        <div
          style={{
            fontSize: 'var(--text-sm, 0.875rem)',
            color: 'var(--text-secondary, #6B7280)',
          }}
        >
          Selected:{' '}
          {selected
            .map(z => ZONES.find(def => def.id === z)?.label ?? z)
            .join(', ')}
        </div>
      )}
    </div>
  )
}

interface HeadViewProps {
  title: string
  zones: ZoneDef[]
  selected: HeadZone[]
  selectedColor: string
  onToggle: (zone: HeadZone) => void
  silhouette: React.ReactNode
  disabled: boolean
}

function HeadView({
  title,
  zones,
  selected,
  selectedColor,
  onToggle,
  silhouette,
  disabled,
}: HeadViewProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 'var(--text-xs, 0.75rem)',
          color: 'var(--text-secondary, #6B7280)',
          marginBottom: '0.5rem',
          textAlign: 'center',
        }}
      >
        {title}
      </div>
      <svg
        viewBox="0 0 100 100"
        style={{
          width: '100%',
          maxWidth: 200,
          display: 'block',
          margin: '0 auto',
        }}
        role="group"
        aria-label={title}
      >
        {silhouette}
        {zones.map(zone => {
          const isSelected = selected.includes(zone.id)
          return (
            <g key={zone.id}>
              <rect
                x={zone.bounds.x}
                y={zone.bounds.y}
                width={zone.bounds.width}
                height={zone.bounds.height}
                rx={2}
                fill={isSelected ? selectedColor : 'transparent'}
                fillOpacity={isSelected ? 0.6 : 0}
                stroke={isSelected ? selectedColor : 'var(--text-secondary, #6B7280)'}
                strokeOpacity={isSelected ? 1 : 0.3}
                strokeWidth={0.7}
                style={{
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'fill-opacity 120ms ease, stroke-opacity 120ms ease',
                }}
                onClick={() => onToggle(zone.id)}
                role="button"
                aria-label={`${zone.label}${isSelected ? ' (selected)' : ''}`}
                aria-pressed={isSelected}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggle(zone.id)
                  }
                }}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
