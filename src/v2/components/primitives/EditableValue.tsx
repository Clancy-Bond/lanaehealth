'use client'

/*
 * EditableValue
 *
 * The data-correction affordance. Wraps any displayed value with a
 * tiny pencil and a tap target. On tap, opens a Sheet with:
 *   - the original value (so the user knows exactly what they're
 *     replacing)
 *   - an editable input pre-filled with the current value
 *   - a reason textarea ("What's the correct value? Tell me why so I
 *     remember next time.")
 *   - a save button that POSTs to /api/v2/corrections
 *
 * The reason textarea is what makes this "remembers forever": Layer 1
 * permanent-core injects the correction into every Claude API call,
 * so the AI quotes the user's reason back next time the topic comes
 * up. A good reason compounds for months.
 *
 * Voice (per CLAUDE.md): short, kind, explanatory. No em-dashes.
 */
import { useEffect, useId, useState } from 'react'
import Sheet from './Sheet'
import Button from './Button'
import type { CorrectableTable } from '@/lib/v2/corrections/types'
import { lightTap, success, warning } from '@/v2/lib/haptics'

type Scalar = string | number | boolean | null

export interface EditableValueProps {
  /** The current displayed value. */
  value: Scalar
  /** Database table this value lives in. */
  tableName: CorrectableTable
  /** Primary-key id of the row this value lives in. */
  rowId: string
  /** Column name. Used by the API to write back. */
  fieldName: string
  /**
   * Where the affordance is being shown. The API stores this so the AI
   * understands intent ("she edited from /v2/cycle" beats "she edited").
   */
  source: 'v2_cycle' | 'v2_log' | 'v2_sleep' | 'v2_calories' | 'v2_other'
  /** Visible label (used in sheet title). Falls back to fieldName. */
  label?: string
  /**
   * Optional pre-formatted display string for the current value, e.g.
   * "72 bpm" or "Not set". Server components MUST format on the server
   * and pass the string in (functions cannot cross the RSC boundary).
   * Falls back to a default string formatter when omitted.
   */
  displayValue?: string
  /** HTML input type. Defaults based on the value type. */
  inputType?: 'text' | 'number'
  /** Notification when a save lands (e.g. to refresh parent data). */
  onSaved?: () => void
  /**
   * If known at render time, prior corrections for this exact
   * (tableName, rowId, fieldName) tuple. Used for the count chip and
   * to seed the reason textarea. Optional: callers can also let the
   * sheet lazy-load when opened.
   */
  priorCorrectionsCount?: number
}

interface PostResponse {
  id: string
  createdAt: string
  sourceUpdateError: string | null
}

function defaultInputType(value: Scalar): 'text' | 'number' {
  if (typeof value === 'number') return 'number'
  return 'text'
}

function defaultFormat(v: Scalar): string {
  if (v === null) return 'Not set'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function parseToScalar(raw: string, hint: 'text' | 'number', original: Scalar): Scalar {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (hint === 'number') {
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : trimmed
  }
  // For booleans, accept the case where the user types yes/no.
  if (typeof original === 'boolean') {
    if (/^(yes|y|true|1)$/i.test(trimmed)) return true
    if (/^(no|n|false|0)$/i.test(trimmed)) return false
  }
  return trimmed
}

export default function EditableValue({
  value,
  tableName,
  rowId,
  fieldName,
  source,
  label,
  displayValue,
  inputType,
  onSaved,
  priorCorrectionsCount = 0,
}: EditableValueProps) {
  const [open, setOpen] = useState(false)
  const [draftRaw, setDraftRaw] = useState(value === null ? '' : String(value))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optimisticValue, setOptimisticValue] = useState<Scalar | null>(null)
  const [savedCount, setSavedCount] = useState(priorCorrectionsCount)
  const inputId = useId()
  const reasonId = useId()

  // Reset the draft when the underlying value changes (e.g. after a
  // parent refresh). We don't clobber a partially-typed correction.
  useEffect(() => {
    if (!open) {
      setDraftRaw(value === null ? '' : String(value))
    }
  }, [value, open])

  // Use the server-provided displayValue when no optimistic correction has
  // landed yet. Once the user saves a correction, render the optimistic
  // value through the local default formatter (the server-rendered string
  // is stale at that point).
  const renderedDisplay =
    optimisticValue !== null
      ? defaultFormat(optimisticValue)
      : (displayValue ?? defaultFormat(value))
  const labelText = label ?? fieldName
  const resolvedInputType = inputType ?? defaultInputType(value)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const corrected = parseToScalar(draftRaw, resolvedInputType, value)
    try {
      const res = await fetch('/api/v2/corrections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tableName,
          rowId,
          fieldName,
          originalValue: value,
          correctedValue: corrected,
          reason,
          source,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body as { error?: string }).error ?? `${res.status} ${res.statusText}`
        throw new Error(msg)
      }
      const json = (await res.json()) as PostResponse
      // Optimistic UI update.
      success()
      setOptimisticValue(corrected)
      setSavedCount((c) => c + 1)
      setOpen(false)
      setReason('')
      if (json.sourceUpdateError) {
        // Source-row update failed but the correction itself landed.
        // Keep the optimistic display because Layer 1 + permanent-core
        // will already serve the corrected value to the AI.
        // eslint-disable-next-line no-console
        console.warn('[EditableValue] sourceUpdateError:', json.sourceUpdateError)
      }
      onSaved?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save the correction.'
      warning()
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Edit ${labelText}`}
        onClick={() => {
          lightTap()
          setOpen(true)
        }}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          minHeight: 'var(--v2-touch-target-min)',
          minWidth: 'var(--v2-touch-target-min)',
          justifyContent: 'flex-start',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span>{renderedDisplay}</span>
          <span
            aria-hidden
            style={{
              opacity: 0.45,
              fontSize: '0.85em',
              transition: 'opacity var(--v2-duration-fast) var(--v2-ease-standard)',
            }}
          >
            ✎
          </span>
        </span>
        {savedCount > 0 && (
          <span
            aria-label={`${savedCount} prior correction${savedCount === 1 ? '' : 's'}`}
            style={{
              marginLeft: 4,
              padding: '1px 6px',
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-accent-primary)',
              color: 'var(--v2-on-accent)',
              fontSize: '0.65em',
              fontWeight: 'var(--v2-weight-semibold)',
              lineHeight: 1.4,
            }}
          >
            {savedCount}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => (saving ? undefined : setOpen(false))} title={`Edit ${labelText}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
          <div
            style={{
              padding: 'var(--v2-space-3)',
              background: 'var(--v2-bg-card)',
              border: '1px solid var(--v2-border-subtle)',
              borderRadius: 'var(--v2-radius-md)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--v2-tracking-wide)',
                marginBottom: 4,
              }}
            >
              Currently shown
            </div>
            <div style={{ fontSize: 'var(--v2-text-base)', color: 'var(--v2-text-primary)' }}>
              {displayValue ?? defaultFormat(value)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <label
              htmlFor={inputId}
              style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}
            >
              Correct value
            </label>
            <input
              id={inputId}
              type={resolvedInputType}
              value={draftRaw}
              onChange={(e) => setDraftRaw(e.target.value)}
              disabled={saving}
              style={{
                background: 'var(--v2-bg-card)',
                color: 'var(--v2-text-primary)',
                border: '1px solid var(--v2-border-strong)',
                borderRadius: 'var(--v2-radius-md)',
                padding: 'var(--v2-space-3)',
                fontSize: 'var(--v2-text-base)',
                fontFamily: 'inherit',
                minHeight: 'var(--v2-touch-target-min)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            <label
              htmlFor={reasonId}
              style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}
            >
              What is the correct value? Tell me why so I remember next time.
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={saving}
              placeholder="e.g. Oura was off my finger that night. I actually slept about 7 hours."
              style={{
                background: 'var(--v2-bg-card)',
                color: 'var(--v2-text-primary)',
                border: '1px solid var(--v2-border-strong)',
                borderRadius: 'var(--v2-radius-md)',
                padding: 'var(--v2-space-3)',
                fontSize: 'var(--v2-text-base)',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: 96,
              }}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: 'var(--v2-space-3)',
                background: 'rgba(232, 99, 119, 0.10)',
                border: '1px solid var(--v2-accent-danger)',
                borderRadius: 'var(--v2-radius-md)',
                color: 'var(--v2-accent-danger)',
                fontSize: 'var(--v2-text-sm)',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--v2-space-3)' }}>
            <Button variant="tertiary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || reason.trim().length === 0}
            >
              {saving ? 'Saving...' : 'Save and remember'}
            </Button>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Saved corrections become part of your medical narrative. The
            assistant will see them in every conversation from now on.
          </p>
        </div>
      </Sheet>
    </>
  )
}
