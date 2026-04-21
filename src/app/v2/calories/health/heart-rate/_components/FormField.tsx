'use client'

/*
 * FormField
 *
 * Route-local label+hint+error wrapper mirroring the orthostatic
 * log form's FormField. Intentionally a route-local duplicate rather
 * than a shared export : _tail-shared/ already ships a lowercase
 * formField.ts (input style objects), and a shared FormField.tsx
 * would collide on case-insensitive filesystems. Tiny (60 lines)
 * so route-local is the cheaper fix.
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
