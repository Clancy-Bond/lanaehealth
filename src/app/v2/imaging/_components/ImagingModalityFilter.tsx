'use client'

/*
 * ImagingModalityFilter (v2 imaging)
 *
 * Horizontally-scrolling chip row: "All", then one chip per modality
 * present in the dataset. Each modality chip shows the code and its
 * count from the unfiltered study list so the user can see what's
 * available before narrowing.
 *
 * Styling mirrors RecordsFilterBar : active chip fills with
 * accent-primary-soft and accent-primary ink; inactive chips sit on
 * bg-card with text-secondary ink. Min tap target is 44pt per iOS
 * HIG, enforced via --v2-touch-target-min.
 */

import type { CSSProperties } from 'react'
import type { ImagingModality } from '@/lib/types'

export interface ImagingModalityFilterProps {
  modality: ImagingModality | null
  counts: Record<ImagingModality, number>
  availableModalities: ImagingModality[]
  totalCount: number
  onChange: (modality: ImagingModality | null) => void
}

function chipStyle(isActive: boolean): CSSProperties {
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

const COUNT_STYLE: CSSProperties = {
  fontSize: 'var(--v2-text-xs)',
  fontVariantNumeric: 'tabular-nums',
  opacity: 0.75,
}

export default function ImagingModalityFilter({
  modality,
  counts,
  availableModalities,
  totalCount,
  onChange,
}: ImagingModalityFilterProps) {
  return (
    <div
      className="hide-scrollbar"
      role="group"
      aria-label="Filter by modality"
      style={{
        display: 'flex',
        gap: 'var(--v2-space-2)',
        overflowX: 'auto',
        paddingBottom: 'var(--v2-space-1)',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={modality === null}
        style={chipStyle(modality === null)}
      >
        <span>All</span>
        <span style={COUNT_STYLE}>{totalCount}</span>
      </button>
      {availableModalities.map((m) => {
        const isActive = modality === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={isActive}
            style={chipStyle(isActive)}
          >
            <span>{m}</span>
            <span style={COUNT_STYLE}>{counts[m] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
