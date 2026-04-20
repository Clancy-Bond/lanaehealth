'use client'

import { SegmentedControl } from '@/v2/components/primitives'
import { SPECIALIST_CONFIG, type SpecialistView } from '@/lib/doctor/specialist-config'

interface SpecialistToggleRowProps {
  view: SpecialistView
  onChange: (next: SpecialistView) => void
}

/*
 * SpecialistToggleRow
 *
 * Sticky row right under the TopAppBar. Shows the current specialist
 * label and subtitle above the toggle. The toggle drives bucket
 * filtering on every panel below via bucketVisible().
 *
 * The label / subtitle live on the same row as the toggle on tablet,
 * and stack on phone to keep the toggle comfortably thumb-reachable.
 */
export default function SpecialistToggleRow({ view, onChange }: SpecialistToggleRowProps) {
  const config = SPECIALIST_CONFIG[view]
  const segments: Array<{ value: SpecialistView; label: string }> = [
    { value: 'pcp', label: 'PCP' },
    { value: 'obgyn', label: 'OB/GYN' },
    { value: 'cardiology', label: 'Cardiology' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-3) var(--v2-space-4)',
        background: 'var(--v2-bg-surface)',
        borderBottom: '1px solid var(--v2-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--v2-space-3)' }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--v2-text-sm)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              lineHeight: 'var(--v2-leading-tight)',
            }}
          >
            {config.label}
          </div>
          <div
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            {config.subtitle}
          </div>
        </div>
        <SegmentedControl<SpecialistView> segments={segments} value={view} onChange={onChange} />
      </div>
    </div>
  )
}
