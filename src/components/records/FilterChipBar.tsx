'use client'

/**
 * FilterChipBar - two-row filter header for the unified records timeline
 * (Wave 2c D1+F6). Top row gates by record kind (all/labs/imaging/...),
 * bottom row (rendered only if more than one specialty is present) gates
 * by specialty. Matches the warm-modern pill language used on /timeline.
 */

import type { KindFilter } from '@/lib/records/timeline-merge'
import { styleForSpecialty } from './ProviderBadge'

interface KindChip {
  id: KindFilter
  label: string
  count: number
}

interface FilterChipBarProps {
  kind: KindFilter
  specialty: string | null
  onKindChange: (kind: KindFilter) => void
  onSpecialtyChange: (specialty: string | null) => void
  kindCounts: Record<KindFilter, number>
  availableSpecialties: string[]
}

const KIND_LABELS: Record<KindFilter, string> = {
  all: 'All',
  lab: 'Labs',
  imaging: 'Imaging',
  appointment: 'Appointments',
  event: 'Milestones',
  problem: 'Problems',
}

export function FilterChipBar({
  kind,
  specialty,
  onKindChange,
  onSpecialtyChange,
  kindCounts,
  availableSpecialties,
}: FilterChipBarProps) {
  const chips: KindChip[] = (
    ['all', 'lab', 'imaging', 'appointment', 'event', 'problem'] as KindFilter[]
  )
    .map((id) => ({
      id,
      label: KIND_LABELS[id],
      count: kindCounts[id] ?? 0,
    }))
    // Drop chips that have zero matching rows, except "all" which always
    // shows so the user can reset.
    .filter((c) => c.id === 'all' || c.count > 0)

  return (
    <div className="space-y-2">
      {/* Kind filter row */}
      <div
        className="flex gap-2 overflow-x-auto hide-scrollbar pb-1"
        role="group"
        aria-label="Filter by record type"
      >
        {chips.map((chip) => {
          const isActive = kind === chip.id
          return (
            <button
              key={chip.id}
              onClick={() => onKindChange(chip.id)}
              className="touch-target press-feedback rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
              style={{
                background: isActive
                  ? 'var(--accent-sage-muted)'
                  : 'var(--bg-elevated)',
                color: isActive
                  ? 'var(--accent-sage)'
                  : 'var(--text-secondary)',
                border: isActive
                  ? '1px solid rgba(107, 144, 128, 0.2)'
                  : '1px solid transparent',
                transition: `background var(--duration-fast) var(--ease-standard)`,
              }}
              aria-pressed={isActive}
            >
              {chip.label}
              {chip.id !== 'all' && (
                <span
                  className="tabular ml-1.5 text-[10px]"
                  style={{ opacity: 0.7 }}
                >
                  {chip.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Specialty filter row - only render if the data has 2+ specialties */}
      {availableSpecialties.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto hide-scrollbar pb-1"
          role="group"
          aria-label="Filter by specialty"
        >
          <button
            onClick={() => onSpecialtyChange(null)}
            className="press-feedback rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap"
            style={{
              background:
                specialty === null
                  ? 'var(--accent-sage-muted)'
                  : 'var(--bg-elevated)',
              color:
                specialty === null
                  ? 'var(--accent-sage)'
                  : 'var(--text-secondary)',
              border:
                specialty === null
                  ? '1px solid rgba(107, 144, 128, 0.2)'
                  : '1px solid transparent',
            }}
            aria-pressed={specialty === null}
          >
            Any provider
          </button>
          {availableSpecialties.map((s) => {
            const isActive = specialty === s
            const { color, label } = styleForSpecialty(s)
            return (
              <button
                key={s}
                onClick={() => onSpecialtyChange(s)}
                className="press-feedback rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5"
                style={{
                  background: isActive
                    ? `color-mix(in srgb, ${color} 16%, transparent)`
                    : 'var(--bg-elevated)',
                  color: isActive ? color : 'var(--text-secondary)',
                  border: isActive
                    ? `1px solid color-mix(in srgb, ${color} 35%, transparent)`
                    : '1px solid transparent',
                }}
                aria-pressed={isActive}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
