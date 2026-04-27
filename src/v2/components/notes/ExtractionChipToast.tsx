'use client'

/**
 * ExtractionChipToast
 *
 * Floating toast above the bottom tab bar that appears ~1.5s after a
 * note save. Renders one tappable chip per AI-extracted candidate.
 * Tap = stamp a structured row + chip disappears. Other chips dismiss
 * after 30s OR when the user taps "Dismiss".
 *
 * The toast never gates the user. The verbatim note is already saved.
 * If she ignores or dismisses every chip, that is fine; the next
 * doctor-prep run still indexes the note via the embedding pipeline.
 */
import { useEffect, useState } from 'react'
import type { Extraction } from '@/lib/notes/extraction-types'

interface Props {
  noteId: string
  /** The chips to surface. Empty array = render nothing. */
  extractions: Extraction[]
  /** Auto-dismiss after this many ms. Default 30s. */
  autoDismissMs?: number
  /** Called when the toast collapses (manual dismiss OR all chips applied OR timeout). */
  onClose: () => void
}

export default function ExtractionChipToast({
  noteId,
  extractions,
  autoDismissMs = 30_000,
  onClose,
}: Props) {
  const [pending, setPending] = useState(extractions)
  const [busyChipId, setBusyChipId] = useState<string | null>(null)
  const [errorChipId, setErrorChipId] = useState<string | null>(null)

  // Auto-dismiss timer.
  useEffect(() => {
    if (pending.length === 0) return
    const t = window.setTimeout(onClose, autoDismissMs)
    return () => window.clearTimeout(t)
  }, [pending.length, autoDismissMs, onClose])

  // If the user has applied or dismissed every chip, fold the toast.
  useEffect(() => {
    if (pending.length === 0) onClose()
  }, [pending.length, onClose])

  if (pending.length === 0 || extractions.length === 0) return null

  async function applyChip(chip: Extraction) {
    setBusyChipId(chip.id)
    setErrorChipId(null)
    try {
      const resp = await fetch(`/api/notes/${noteId}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ extraction_id: chip.id }),
      })
      if (!resp.ok) {
        setErrorChipId(chip.id)
        return
      }
      // Remove the chip on success.
      setPending((cur) => cur.filter((c) => c.id !== chip.id))
    } catch {
      setErrorChipId(chip.id)
    } finally {
      setBusyChipId(null)
    }
  }

  function dismissChip(chip: Extraction) {
    setPending((cur) => cur.filter((c) => c.id !== chip.id))
  }

  return (
    <div
      role="region"
      aria-label="Suggestions from your note"
      style={{
        position: 'fixed',
        left: 'var(--v2-space-3)',
        right: 'var(--v2-space-3)',
        bottom: `calc(var(--v2-tabbar-height) + var(--v2-safe-bottom) + var(--v2-space-3))`,
        zIndex: 60,
        background: 'var(--v2-surface-explanatory-card)',
        color: 'var(--v2-surface-explanatory-text)',
        border: '1px solid var(--v2-surface-explanatory-border)',
        borderRadius: 'var(--v2-radius-lg)',
        padding: 'var(--v2-space-3)',
        boxShadow: 'var(--v2-shadow-md)',
        maxWidth: 520,
        marginLeft: 'auto',
        marginRight: 'auto',
        animation: 'v2-slide-up 220ms cubic-bezier(0.2, 0.7, 0.2, 1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--v2-space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 'var(--v2-weight-semibold)',
          }}
        >
          Pulled from your note
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            color: 'var(--v2-text-muted)',
            fontSize: 'var(--v2-text-sm)',
            padding: 'var(--v2-space-1) var(--v2-space-2)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Dismiss
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 'var(--v2-space-2)',
          flexWrap: 'wrap',
        }}
      >
        {pending.map((chip) => {
          const busy = busyChipId === chip.id
          const errored = errorChipId === chip.id
          return (
            <div
              key={chip.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--v2-space-1)',
                padding: 'var(--v2-space-1) var(--v2-space-2)',
                borderRadius: 'var(--v2-radius-full)',
                border: errored
                  ? '1px solid var(--v2-accent-danger)'
                  : '1px solid var(--v2-surface-explanatory-border)',
                background: errored
                  ? 'var(--v2-accent-danger-soft, #FEE)'
                  : 'var(--v2-surface-explanatory-bg)',
              }}
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => applyChip(chip)}
                style={{
                  appearance: 'none',
                  background: 'transparent',
                  border: 'none',
                  color: errored
                    ? 'var(--v2-accent-danger)'
                    : 'var(--v2-accent-primary)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  cursor: busy ? 'progress' : 'pointer',
                  padding: 'var(--v2-space-1) var(--v2-space-2)',
                  minHeight: 36,
                }}
              >
                {busy ? 'Saving…' : `+ ${chip.chip_label}`}
              </button>
              <button
                type="button"
                aria-label={`Dismiss ${chip.chip_label}`}
                onClick={() => dismissChip(chip)}
                style={{
                  appearance: 'none',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--v2-text-muted)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--v2-text-base)',
                  cursor: 'pointer',
                  padding: '0 var(--v2-space-1)',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
