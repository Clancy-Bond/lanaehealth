'use client'

/*
 * RecordsFilterBar (v2 records)
 *
 * Two horizontally-scrolling chip rows: kind (labs / imaging / ...) and
 * specialty. Counts reflect the full unfiltered row set so the user can
 * see what's available before narrowing. Tap target is 44pt min on every
 * chip; chip rows themselves scroll horizontally when they overflow.
 *
 * Uses v2 dark chrome tokens. Active chip fills with accent-primary-soft
 * and the accent-primary ink. Inactive chips sit on bg-card with the
 * muted text color, matching Oura's tab underline pattern (frame_0030).
 */

import type { KindFilter } from '@/lib/records/timeline-merge'

const KIND_LABELS: Record<KindFilter, string> = {
  all: 'All',
  lab: 'Labs',
  imaging: 'Imaging',
  appointment: 'Appointments',
  event: 'Milestones',
  problem: 'Problems',
}

const KIND_ORDER: KindFilter[] = [
  'all',
  'lab',
  'imaging',
  'appointment',
  'event',
  'problem',
]

export interface RecordsFilterBarProps {
  kind: KindFilter
  specialty: string | null
  kindCounts: Record<KindFilter, number>
  availableSpecialties: string[]
  onKindChange: (kind: KindFilter) => void
  onSpecialtyChange: (specialty: string | null) => void
}

function chipStyle(isActive: boolean): React.CSSProperties {
  return {
    minHeight: 'var(--v2-touch-target-min)',
    padding: '0 var(--v2-space-4)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--v2-space-2)',
    whiteSpace: 'nowrap',
    fontSize: 'var(--v2-text-sm)',
    fontWeight: 'var(--v2-weight-medium)',
    color: isActive ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
    background: isActive ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-card)',
    border: '1px solid',
    borderColor: isActive ? 'var(--v2-accent-primary)' : 'var(--v2-border)',
    borderRadius: 'var(--v2-radius-full)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background var(--v2-duration-fast) var(--v2-ease-standard)',
  }
}

function rowStyle(): React.CSSProperties {
  return {
    display: 'flex',
    gap: 'var(--v2-space-2)',
    overflowX: 'auto',
    paddingBottom: 'var(--v2-space-1)',
    // iOS inertia feels right for horizontal chip rails.
    WebkitOverflowScrolling: 'touch',
  }
}

export default function RecordsFilterBar({
  kind,
  specialty,
  kindCounts,
  availableSpecialties,
  onKindChange,
  onSpecialtyChange,
}: RecordsFilterBarProps) {
  const visibleKinds = KIND_ORDER.filter(
    (k) => k === 'all' || (kindCounts[k] ?? 0) > 0,
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
      <div
        className="hide-scrollbar"
        role="group"
        aria-label="Filter by record type"
        style={rowStyle()}
      >
        {visibleKinds.map((k) => {
          const isActive = kind === k
          const count = kindCounts[k] ?? 0
          return (
            <button
              key={k}
              type="button"
              onClick={() => onKindChange(k)}
              aria-pressed={isActive}
              style={chipStyle(isActive)}
            >
              <span>{KIND_LABELS[k]}</span>
              {k !== 'all' && (
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    fontVariantNumeric: 'tabular-nums',
                    opacity: 0.75,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {availableSpecialties.length > 1 && (
        <div
          className="hide-scrollbar"
          role="group"
          aria-label="Filter by specialty"
          style={rowStyle()}
        >
          <button
            type="button"
            onClick={() => onSpecialtyChange(null)}
            aria-pressed={specialty === null}
            style={chipStyle(specialty === null)}
          >
            Any provider
          </button>
          {availableSpecialties.map((s) => {
            const isActive = specialty === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSpecialtyChange(s)}
                aria-pressed={isActive}
                style={chipStyle(isActive)}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
