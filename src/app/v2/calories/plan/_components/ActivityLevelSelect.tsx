'use client'

/*
 * ActivityLevelSelect
 *
 * Five-step SegmentedControl for sedentary -> very active. The helper
 * line under the strip changes with the selection so the user can sanity-
 * check what they picked. Voice is concrete, no gym-bro.
 */

import { SegmentedControl } from '@/v2/components/primitives'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export interface ActivityLevelSelectProps {
  value: ActivityLevel
  onChange: (next: ActivityLevel) => void
}

const SEGMENTS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
]

const HELPERS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly still. Desk, little movement.',
  light: 'Easy walks most days.',
  moderate: 'Some sweat 3 to 5 days a week.',
  active: 'Sweat-inducing exercise most days.',
  very_active: 'Training hard, most days.',
}

export default function ActivityLevelSelect({ value, onChange }: ActivityLevelSelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
      <input type="hidden" name="activityLevel" value={value} />
      <div style={{ overflowX: 'auto' }}>
        <SegmentedControl<ActivityLevel>
          fullWidth
          segments={SEGMENTS}
          value={value}
          onChange={onChange}
        />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        {HELPERS[value]}
      </p>
    </div>
  )
}
