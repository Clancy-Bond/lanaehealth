'use client'

/*
 * SegmentedControl
 *
 * NC Calendar uses this for Today/Calendar tab swaps. Oura uses it
 * for Yesterday/Today on Readiness/Activity headers. Single-select.
 */
import { useState } from 'react'

export interface Segment<T extends string = string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string = string> {
  segments: Segment<T>[]
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
  fullWidth?: boolean
}

export default function SegmentedControl<T extends string = string>({
  segments,
  value,
  defaultValue,
  onChange,
  fullWidth,
}: SegmentedControlProps<T>) {
  const [internal, setInternal] = useState<T>(defaultValue ?? segments[0]?.value)
  const active = value ?? internal

  const pick = (v: T) => {
    if (value === undefined) setInternal(v)
    onChange?.(v)
  }

  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        padding: 2,
        background: 'var(--v2-bg-card)',
        borderRadius: 'var(--v2-radius-md)',
        border: '1px solid var(--v2-border-subtle)',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {segments.map((s) => {
        const isActive = s.value === active
        return (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => pick(s.value)}
            style={{
              flex: fullWidth ? 1 : undefined,
              minHeight: 36,
              padding: '0 var(--v2-space-4)',
              border: 0,
              borderRadius: 'var(--v2-radius-sm)',
              background: isActive ? 'var(--v2-bg-elevated)' : 'transparent',
              color: isActive ? 'var(--v2-text-primary)' : 'var(--v2-text-muted)',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: isActive ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-medium)',
              cursor: 'pointer',
              transition: 'background var(--v2-duration-fast) var(--v2-ease-standard), color var(--v2-duration-fast) var(--v2-ease-standard)',
              fontFamily: 'inherit',
            }}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
