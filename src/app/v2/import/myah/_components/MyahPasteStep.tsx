'use client'

/*
 * MyahPasteStep
 *
 * Step 2 of the MyAH paste importer. Big textarea for the pasted
 * portal text, a primary Parse button, and a tertiary Back.
 *
 * Paste sessions can be long (a full lab panel is easily a few
 * hundred lines) so we attach a beforeunload guard that fires
 * only while the textarea holds at least one non-whitespace
 * character. The guard clears the moment the parse succeeds,
 * because the wizard owns the raw text from that point on and
 * the review step is cheap to reproduce.
 *
 * The parse call POSTs JSON to /api/import/myah. The response
 * wraps each parsed record in {raw, parsed}; we hand that shape
 * straight back to the wizard so the review step can read
 * r.parsed.* without another unwrap layer.
 */
import { useEffect, useState } from 'react'
import { Banner, Button } from '@/v2/components/primitives'
import { fieldTextareaStyle } from '@/app/v2/_tail-shared/formField'
import type { MyahEntityType, MyahParsedRecord } from './MyahWizard'

interface EntityCopy {
  label: string
  hint: string
  placeholder: string
}

const ENTITY_COPY: Record<MyahEntityType, EntityCopy> = {
  labs: {
    label: 'Labs',
    hint: 'Copy the results table from Test Results. Date headers above the values help us group them.',
    placeholder: `03/15/2025  CBC with Differential
  WBC          6.2        x10^3/uL    4.5-11.0
  Hemoglobin   12.8       g/dL        12.0-16.0`,
  },
  appointments: {
    label: 'Appointments',
    hint: 'Copy your Visits or Appointments list. One visit per line works best.',
    placeholder: `03/20/2025  Dr. Sarah Chen - Gastroenterology - Follow-up
02/10/2025  Dr. James Park - Primary Care - Annual Physical`,
  },
  medications: {
    label: 'Medications',
    hint: 'Copy the Medications list. Dose and instructions parse best when kept on one line per drug.',
    placeholder: `Metformin 500mg - Take 1 tablet twice daily with meals
Vitamin D3 2000 IU - Take 1 capsule daily`,
  },
  notes: {
    label: 'Notes',
    hint: 'Paste after-visit summaries, letters, or doctor notes. They are saved as medical narrative entries.',
    placeholder: `After-visit summary

Seen by Dr. Chen on 03/20/2025 for follow-up...`,
  },
}

export interface MyahPasteStepProps {
  entityType: MyahEntityType
  rawText: string
  onRawTextChange: (rawText: string) => void
  onBack: () => void
  onParsed: (parsed: MyahParsedRecord[], warnings: string[]) => void
}

export default function MyahPasteStep({
  entityType,
  rawText,
  onRawTextChange,
  onBack,
  onParsed,
}: MyahPasteStepProps) {
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy = ENTITY_COPY[entityType]

  // Guard the window only while the textarea holds real content.
  // The wizard unmounts this step on success, so we do not need to
  // track an isDirty flag separately.
  const isDirty = rawText.trim().length > 0
  useEffect(() => {
    if (!isDirty) return
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  const handleParse = async () => {
    if (parsing) return
    const trimmed = rawText.trim()
    if (trimmed.length === 0) return
    setError(null)
    setParsing(true)
    try {
      const res = await fetch('/api/import/myah', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: entityType,
          rawText: trimmed,
          action: 'parse',
        }),
      })
      if (!res.ok) {
        let message = `Could not parse (${res.status}).`
        try {
          const body = (await res.json()) as { error?: string }
          if (body && typeof body.error === 'string' && body.error.length > 0) {
            message = body.error
          }
        } catch {
          /* non-JSON body, keep fallback */
        }
        setError(message)
        return
      }
      const body = (await res.json()) as {
        records?: MyahParsedRecord[]
        warnings?: string[]
      }
      const records = Array.isArray(body.records) ? body.records : []
      if (records.length === 0) {
        setError(
          'We could not find any records in that text. Double-check what you pasted and try again.'
        )
        return
      }
      onParsed(records, Array.isArray(body.warnings) ? body.warnings : [])
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setParsing(false)
    }
  }

  const canParse = !parsing && rawText.trim().length > 0

  return (
    <section
      aria-label={`Paste ${copy.label.toLowerCase()} text`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            color: 'var(--v2-text-muted)',
            fontWeight: 'var(--v2-weight-semibold)',
          }}
        >
          {copy.label}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          {copy.hint}
        </p>
      </div>

      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            fontWeight: 'var(--v2-weight-semibold)',
          }}
        >
          Pasted text
        </span>
        <textarea
          value={rawText}
          onChange={(e) => onRawTextChange(e.target.value)}
          placeholder={copy.placeholder}
          aria-label="Pasted text from MyAH"
          spellCheck={false}
          style={{
            ...fieldTextareaStyle,
            minHeight: 240,
            fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)',
            fontSize: 'var(--v2-text-sm)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        />
      </label>

      {error && (
        <Banner intent="danger" title="Could not parse" body={error} />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canParse}
          onClick={handleParse}
        >
          {parsing ? 'Parsing...' : 'Parse'}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="md"
          fullWidth
          onClick={onBack}
          disabled={parsing}
        >
          Back
        </Button>
      </div>
    </section>
  )
}
