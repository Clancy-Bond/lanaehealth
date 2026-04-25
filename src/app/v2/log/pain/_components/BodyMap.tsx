'use client'

/**
 * BodyMap
 *
 * Simplified body region picker. Doctors care more about REGION than
 * exact pixel coords for trend tracking, so we render a chip set with
 * common labels rather than a draggable canvas. A future enhancement
 * (deferred) is a tap-to-pin SVG body diagram.
 *
 * The chosen value writes to PainPoint.body_region (existing column
 * in the pain_points schema). Single-select; user can re-tap to clear.
 */

export type BodyRegion =
  | 'head'
  | 'neck'
  | 'chest'
  | 'abdomen'
  | 'pelvis'
  | 'lower_back'
  | 'upper_back'
  | 'arms'
  | 'legs'
  | 'whole_body'

export interface BodyMapProps {
  selected: BodyRegion | null
  onChange: (region: BodyRegion | null) => void
}

const REGIONS: Array<{ value: BodyRegion; label: string }> = [
  { value: 'head', label: 'Head' },
  { value: 'neck', label: 'Neck' },
  { value: 'chest', label: 'Chest' },
  { value: 'abdomen', label: 'Abdomen' },
  { value: 'pelvis', label: 'Pelvis' },
  { value: 'lower_back', label: 'Lower back' },
  { value: 'upper_back', label: 'Upper back' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'whole_body', label: 'All over' },
]

export default function BodyMap({ selected, onChange }: BodyMapProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Where is the pain? Pick the closest match."
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--v2-space-2)',
      }}
    >
      {REGIONS.map((r) => {
        const isOn = selected === r.value
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={isOn}
            onClick={() => onChange(isOn ? null : r.value)}
            style={{
              background: isOn ? 'var(--v2-accent-primary)' : 'var(--v2-bg-base)',
              color: isOn ? 'var(--v2-bg-base)' : 'var(--v2-text-primary)',
              border: `1px solid ${isOn ? 'var(--v2-accent-primary)' : 'var(--v2-border)'}`,
              borderRadius: 'var(--v2-radius-pill)',
              padding: '8px 14px',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-medium)',
              cursor: 'pointer',
              minHeight: 'var(--v2-touch-target-min)',
            }}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Map a free-form body_region string back to a known enum, or null
 * if it does not match. Used when reading legacy pain_points rows
 * back into the editor.
 */
export function parseBodyRegion(raw: string | null | undefined): BodyRegion | null {
  if (!raw) return null
  const norm = raw.toLowerCase().trim().replace(/[^a-z]+/g, '_')
  const set = new Set<BodyRegion>([
    'head',
    'neck',
    'chest',
    'abdomen',
    'pelvis',
    'lower_back',
    'upper_back',
    'arms',
    'legs',
    'whole_body',
  ])
  if (set.has(norm as BodyRegion)) return norm as BodyRegion
  return null
}
