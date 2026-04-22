'use client'

/*
 * MyahPasteStep
 *
 * Step 2 of the MyAH paste importer. Big textarea for pasted portal
 * text plus an optional file picker so PDFs or exports that were
 * never copy-pasteable can still flow through. Primary Parse
 * submits whichever input is present; tertiary Back returns to the
 * category chooser.
 *
 * Paste sessions can be long (a full lab panel is easily a few
 * hundred lines) so we attach a beforeunload guard that fires
 * while either input has content. The guard clears the moment the
 * parse succeeds, because the wizard owns the raw text / records
 * from that point on and the review step is cheap to reproduce.
 *
 * Submission pathways:
 *   - No file : POST JSON {type, rawText, action:'parse'}. Response
 *     shape {records: [{raw, parsed}], warnings}.
 *   - File present : POST multipart FormData {file, categories:
 *     '["<type>"]'}. Response shape {results: [{category, records,
 *     warnings}]}; we read results[0] so the wizard keeps a single
 *     MyahParsedRecord[] shape.
 * When both exist we prefer the file and surface a small hint so the
 * user isn't confused about which input won.
 */
import { useEffect, useRef, useState } from 'react'
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

// Permissive accept list. MyAH exports show up in odd shapes
// (patient-portal HTML saves, PDFs, CSV rips), so we keep the picker
// forgiving instead of gating on extension.
const ACCEPT_TYPES = '.txt,.csv,.pdf,.json,.html,.htm,.xml,text/plain'

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
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copy = ENTITY_COPY[entityType]

  // Guard the window while either input holds real content. The
  // wizard unmounts this step on success, so no separate isDirty
  // flag is needed : unmount clears the listener.
  const isDirty = rawText.trim().length > 0 || file !== null
  useEffect(() => {
    if (!isDirty) return
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  const handleFilePick = (next: File | null) => {
    setFile(next)
    setError(null)
  }

  const clearFile = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleParse = async () => {
    if (parsing) return
    const trimmed = rawText.trim()
    const hasFile = file !== null
    if (!hasFile && trimmed.length === 0) return
    setError(null)
    setParsing(true)
    try {
      // Prefer file when present : PDFs cannot be read client-side
      // into the textarea usefully, and the route already handles
      // extraction server-side.
      if (hasFile && file) {
        const form = new FormData()
        form.set('file', file)
        form.set('categories', JSON.stringify([entityType]))

        const res = await fetch('/api/import/myah', {
          method: 'POST',
          body: form,
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
          results?: Array<{
            category?: string
            records?: MyahParsedRecord[]
            warnings?: string[]
          }>
        }
        const bucket = Array.isArray(body.results)
          ? body.results.find((r) => r.category === entityType) ??
            body.results[0]
          : null
        const records: MyahParsedRecord[] = Array.isArray(bucket?.records)
          ? bucket!.records!
          : []
        if (records.length === 0) {
          setError(
            'We could not find any records in that file. Double-check the export and try again, or paste the text instead.',
          )
          return
        }
        onParsed(records, Array.isArray(bucket?.warnings) ? bucket!.warnings! : [])
        return
      }

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
          'We could not find any records in that text. Double-check what you pasted and try again.',
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

  const canParse = !parsing && (file !== null || rawText.trim().length > 0)
  const showBothHint = file !== null && rawText.trim().length > 0

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

      <div
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
          Or upload a file
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--v2-space-2)',
            flexWrap: 'wrap',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_TYPES}
            aria-label="Upload MyAH export file"
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
            disabled={parsing}
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              minHeight: 44,
            }}
          />
          {file !== null && (
            <button
              type="button"
              onClick={clearFile}
              disabled={parsing}
              aria-label="Remove selected file"
              style={{
                minHeight: 44,
                padding: '0 var(--v2-space-3)',
                background: 'transparent',
                color: 'var(--v2-text-muted)',
                border: '1px solid var(--v2-border-subtle)',
                borderRadius: 'var(--v2-radius-sm)',
                fontSize: 'var(--v2-text-sm)',
                fontFamily: 'inherit',
                cursor: parsing ? 'not-allowed' : 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
        {file !== null && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Selected: {file.name}
          </p>
        )}
        {showBothHint && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Both a file and pasted text are set. We&apos;ll use the file.
          </p>
        )}
      </div>

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
