'use client'

/*
 * FormField
 *
 * Thin <label>-wrapping helper that pairs an eyebrow label with any
 * child control (input, textarea, select). Keeps the orthostatic log
 * form terse while preserving hit-target minimums and the v2 label
 * voice.
 *
 * Optional `hint` renders below the control for explanatory copy (e.g.
 * the lying-down-first reminder). Optional `error` swaps to the danger
 * accent and sets aria-invalid on the wrapping label.
 */
import type { ReactNode } from 'react'
import { fieldLabelStyle } from '@/app/v2/_tail-shared/formField'

export interface FormFieldProps {
  label: string
  children: ReactNode
  hint?: string
  error?: string
}

export default function FormField({ label, children, hint, error }: FormFieldProps) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
      }}
    >
      <span style={fieldLabelStyle}>{label}</span>
      {children}
      {hint && !error && (
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {hint}
        </span>
      )}
      {error && (
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-accent-danger)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {error}
        </span>
      )}
    </label>
  )
}
