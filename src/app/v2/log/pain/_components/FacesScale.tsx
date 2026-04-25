'use client'

/**
 * FacesScale
 *
 * Wong-Baker FACES alternative scale. Six faces map to NRS values
 * 0, 2, 4, 6, 8, 10. Useful when verbal/numeric communication is
 * hard (POTS brain fog, migraine, low energy_mode days).
 *
 * Validation: Garra G et al. (2010). "Validation of the Wong-Baker
 * FACES Pain Rating Scale in pediatric emergency department patients."
 * Acad Emerg Med 17(1):50-54. Strong convergent validity with NRS in
 * adults; original work by Wong DL & Baker CM (1988).
 *
 * Free for clinical use per the Wong-Baker FACES Foundation
 * (https://wongbakerfaces.org/). The COPYRIGHTED images are the
 * Wong-Baker artwork, which we do not ship; the SVGs below are our
 * own minimal line-drawing analogs following the same six anchors:
 * smile, slight smile, neutral, frown, grimace, cry.
 */

export interface FacesScaleProps {
  value: number // 0..10 in steps of 2
  onChange: (value: number) => void
}

interface FaceDef {
  value: number
  label: string
  /** Mouth path: relative to a 36-wide, 36-tall viewBox. */
  mouth: string
  /** Optional eyebrows for higher-pain faces. */
  brows?: string
  /** Optional teardrops for the worst face. */
  tears?: boolean
}

const FACES: FaceDef[] = [
  { value: 0, label: 'No pain', mouth: 'M10 22 Q18 30 26 22' },
  { value: 2, label: 'Hurts a little', mouth: 'M11 23 Q18 27 25 23' },
  { value: 4, label: 'Hurts a little more', mouth: 'M11 24 L25 24' },
  { value: 6, label: 'Hurts even more', mouth: 'M11 26 Q18 22 25 26', brows: 'M9 12 L13 14 M27 12 L23 14' },
  { value: 8, label: 'Hurts a whole lot', mouth: 'M11 27 Q18 21 25 27', brows: 'M9 11 L14 14 M27 11 L22 14' },
  { value: 10, label: 'Hurts worst', mouth: 'M10 27 Q18 19 26 27', brows: 'M8 10 L14 14 M28 10 L22 14', tears: true },
]

function FaceIcon({ face, selected, color }: { face: FaceDef; selected: boolean; color: string }) {
  const stroke = selected ? color : 'var(--v2-text-muted)'
  return (
    <svg
      viewBox="0 0 36 36"
      width="44"
      height="44"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <circle cx="18" cy="18" r="15" fill="none" stroke={stroke} strokeWidth="1.75" />
      <circle cx="13" cy="15" r="1.4" fill={stroke} />
      <circle cx="23" cy="15" r="1.4" fill={stroke} />
      <path d={face.mouth} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      {face.brows && <path d={face.brows} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />}
      {face.tears && (
        <>
          <path d="M11 18 L11 22" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 18 L25 22" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function colorFor(v: number): string {
  if (v === 0) return 'var(--v2-accent-success)'
  if (v <= 4) return 'var(--v2-accent-highlight)'
  if (v <= 6) return 'var(--v2-accent-warning)'
  return 'var(--v2-accent-danger)'
}

export default function FacesScale({ value, onChange }: FacesScaleProps) {
  const current = FACES.find((f) => f.value === value) ?? FACES[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      <div
        role="radiogroup"
        aria-label="Pain face scale"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 'var(--v2-space-1)',
        }}
      >
        {FACES.map((face) => {
          const selected = face.value === value
          return (
            <button
              key={face.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${face.value} ${face.label}`}
              onClick={() => onChange(face.value)}
              style={{
                background: selected ? 'var(--v2-accent-primary-soft)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--v2-radius-md)',
                padding: 'var(--v2-space-2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                minHeight: 'var(--v2-touch-target-min)',
              }}
            >
              <FaceIcon face={face} selected={selected} color={colorFor(face.value)} />
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: selected ? 'var(--v2-text-primary)' : 'var(--v2-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {face.value}
              </span>
            </button>
          )
        })}
      </div>

      <p
        style={{
          margin: 0,
          textAlign: 'center',
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
        }}
      >
        {current.label}
      </p>
    </div>
  )
}
