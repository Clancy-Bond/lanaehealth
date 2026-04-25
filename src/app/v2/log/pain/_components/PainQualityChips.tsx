'use client'

/**
 * PainQualityChips
 *
 * Multi-select chip set for MPQ-derived sensory descriptors of pain.
 *
 * Source: Melzack R (1975). "The McGill Pain Questionnaire: Major
 * properties and scoring methods." Pain 1(3):277-299. The original
 * MPQ has 78 descriptors across sensory, affective, and evaluative
 * dimensions. The Short-Form MPQ-2 (Dworkin RH et al., Pain 144:35-42,
 * 2009) trims to 22 items.
 *
 * We use a focused subset of the SENSORY dimension only, because:
 *   1. Daily logging has to stay under a minute.
 *   2. The vocabulary itself (sharp, dull, throbbing, etc.) is free
 *      to use; only the SCORED instrument is licensed.
 *   3. Quality words are what doctors quote in notes. Chips give us
 *      a structured analog without forcing the full questionnaire.
 *
 * Selecting "throbbing" or "pressure" on a head-pain day is what
 * triggers the migraine smart prompt downstream.
 */
import type { PainQuality } from '@/lib/types'

export interface PainQualityChipsProps {
  selected: PainQuality[]
  onToggle: (quality: PainQuality) => void
}

const QUALITIES: Array<{ value: PainQuality; label: string }> = [
  { value: 'sharp', label: 'Sharp' },
  { value: 'dull', label: 'Dull' },
  { value: 'throbbing', label: 'Throbbing' },
  { value: 'burning', label: 'Burning' },
  { value: 'aching', label: 'Aching' },
  { value: 'stabbing', label: 'Stabbing' },
  { value: 'shooting', label: 'Shooting' },
  { value: 'cramping', label: 'Cramping' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'tingling', label: 'Tingling' },
  { value: 'numb', label: 'Numb' },
]

export default function PainQualityChips({ selected, onToggle }: PainQualityChipsProps) {
  return (
    <div
      role="group"
      aria-label="Pain quality. Pick any that fit."
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--v2-space-2)',
      }}
    >
      {QUALITIES.map((q) => {
        const isOn = selected.includes(q.value)
        return (
          <button
            key={q.value}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(q.value)}
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
            {q.label}
          </button>
        )
      })}
    </div>
  )
}
