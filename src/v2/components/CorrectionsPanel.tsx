'use client'

/*
 * CorrectionsPanel
 *
 * A compact "Does this look wrong?" panel that surfaces EditableValue
 * affordances for the key auto-derived values on a surface. Designed
 * to be embedded near the bottom of /v2/cycle, /v2/sleep, /v2/log etc.
 * so the user has one obvious place to fix Oura/NC/import errors
 * without us having to retrofit a pencil onto every hero animation.
 *
 * Each row is a labeled value plus the pencil. Saves go through the
 * /api/v2/corrections POST and become part of the AI's permanent
 * memory.
 */
import { useState } from 'react'
import EditableValue from './primitives/EditableValue'
import type { CorrectableTable } from '@/lib/v2/corrections/types'
import { assertSerializable } from '@/v2/lib/rsc-serialization-guard'

export interface CorrectionField {
  /** Human-readable label, e.g. "Sleep score" */
  label: string
  value: string | number | boolean | null
  fieldName: string
  /**
   * Optional pre-formatted display string. Server components MUST format
   * on the server and pass the string in (functions cannot cross the RSC
   * boundary into this client component). Falls back to a default
   * stringifier when omitted.
   */
  displayValue?: string
  inputType?: 'text' | 'number'
}

export interface CorrectionsPanelProps {
  /** The Supabase table the rows below belong to. */
  tableName: CorrectableTable
  /** The primary-key id of the source row. */
  rowId: string | null
  /** Surface tag for the AI ("v2_cycle", "v2_sleep", ...). */
  source: 'v2_cycle' | 'v2_log' | 'v2_sleep' | 'v2_calories' | 'v2_other'
  /** The values the user can edit. */
  fields: CorrectionField[]
  /** Heading shown above the panel. */
  heading?: string
  /** One-liner subtext under the heading. */
  subtext?: string
}

export default function CorrectionsPanel(props: CorrectionsPanelProps) {
  // Dev-only guard: warn if a server caller drops a function or other
  // unserializable value into props. PR #87 was this exact bug class:
  // a `format: (v) => string` field on objects in `fields` silently
  // broke production /v2/cycle, /v2/sleep, /v2/log, and /v2/calories.
  // The current type uses `displayValue: string` instead, but a future
  // contributor could re-introduce a function field; this catches it
  // in dev before it ships.
  assertSerializable(props as unknown as Record<string, unknown>, 'CorrectionsPanel')
  const {
    tableName,
    rowId,
    source,
    fields,
    heading = 'Does this look wrong?',
    subtext = 'Tap any value to fix it. Your assistant will remember the correction for next time.',
  } = props
  const [savedCount, setSavedCount] = useState(0)

  if (!rowId) {
    // No source row to correct. Render nothing so we don't show a
    // dead panel.
    return null
  }
  if (fields.length === 0) return null

  return (
    <section
      aria-label={heading}
      style={{
        position: 'relative',
        borderRadius: 'var(--v2-radius-lg)',
        border: '1px solid var(--v2-border-subtle)',
        padding: 'var(--v2-space-4)',
        background: 'var(--v2-bg-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            letterSpacing: 'var(--v2-tracking-tight)',
          }}
        >
          {heading}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          {subtext}
        </p>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        {fields.map((f) => (
          <li
            key={f.fieldName}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--v2-space-3)',
              padding: 'var(--v2-space-2) 0',
              borderTop: '1px solid var(--v2-border-subtle)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
              }}
            >
              {f.label}
            </span>
            <EditableValue
              value={f.value}
              tableName={tableName}
              rowId={rowId}
              fieldName={f.fieldName}
              source={source}
              label={f.label}
              displayValue={f.displayValue}
              inputType={f.inputType}
              onSaved={() => setSavedCount((c) => c + 1)}
            />
          </li>
        ))}
      </ul>

      {savedCount > 0 && (
        <p
          aria-live="polite"
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-accent-success)',
          }}
        >
          Saved. The assistant will see this from now on.
        </p>
      )}
    </section>
  )
}
