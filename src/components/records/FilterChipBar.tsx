'use client'

// FilterChipBar - horizontal scrollable filter chip row for the unified
// medical records timeline. Matches the styling used in TimelineTab filter
// chips but adds per-chip counts and an aria-pressed state per chip.

export type RecordFilterId =
  | 'all'
  | 'lab'
  | 'imaging'
  | 'appointment'
  | 'event'
  | 'problem'

export interface RecordFilterChip {
  id: RecordFilterId
  label: string
  count: number
}

interface FilterChipBarProps {
  chips: RecordFilterChip[]
  value: RecordFilterId
  onChange: (id: RecordFilterId) => void
  ariaLabel?: string
}

export function FilterChipBar({
  chips,
  value,
  onChange,
  ariaLabel = 'Filter records',
}: FilterChipBarProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto hide-scrollbar pb-1"
      role="group"
      aria-label={ariaLabel}
    >
      {chips.map((chip) => {
        const isActive = value === chip.id
        const isDisabled = chip.count === 0 && chip.id !== 'all'
        return (
          <button
            key={chip.id}
            onClick={() => onChange(chip.id)}
            disabled={isDisabled}
            className="touch-target press-feedback rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
            aria-pressed={isActive}
            style={{
              background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
              color: isActive ? 'var(--accent-sage)' : 'var(--text-secondary)',
              border: isActive
                ? '1px solid rgba(107, 144, 128, 0.2)'
                : '1px solid transparent',
              opacity: isDisabled ? 0.4 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              transition: `background var(--duration-fast) var(--ease-standard)`,
            }}
          >
            <span>{chip.label}</span>
            <span
              className="tabular ml-1.5 text-[10px] font-semibold"
              style={{ opacity: 0.7 }}
            >
              {chip.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
