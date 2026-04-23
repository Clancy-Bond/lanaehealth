'use client'

/*
 * MyahWizard
 *
 * Three-step paste importer for the Adventist Health (MyAH) patient
 * portal. State machine flows:
 *
 *   choose  -> pick what you're pasting (labs / appointments / meds / notes)
 *   paste   -> big textarea + Parse button
 *   review  -> delete-before-import list + Import button + Start over
 *
 * The actual network work lives in the child step components so this
 * file stays focused on state transitions. Parse + Import errors are
 * surfaced inline by the step that triggered them; they do not bleed
 * across transitions.
 *
 * Shape of parsed records, confirmed against /api/import/myah:
 *   POST {type, rawText, action:'parse'}
 *     -> {records: [{raw:'', parsed:{...}}], warnings, parser}
 *   POST {type, rawText, action:'import', records: [flat parsed objs]}
 *     -> {imported, skipped, errors}
 *
 * The import payload expects a flat array of parsed objects, not the
 * {raw, parsed} wrapper. We unwrap on submit, not on receive, so the
 * review step can still render the wrapped shape consistently.
 */
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import MyahCategoryChooser from './MyahCategoryChooser'
import MyahPasteStep from './MyahPasteStep'
import MyahReviewStep from './MyahReviewStep'

export type MyahEntityType = 'labs' | 'appointments' | 'medications' | 'notes'

export interface MyahParsedRecord {
  raw: string
  parsed: Record<string, string | number | null>
}

type WizardStep = 'choose' | 'paste' | 'review'

interface WizardState {
  step: WizardStep
  entityType: MyahEntityType | null
  rawText: string
  parsed: MyahParsedRecord[]
  warnings: string[]
}

function initialState(): WizardState {
  return {
    step: 'choose',
    entityType: null,
    rawText: '',
    parsed: [],
    warnings: [],
  }
}

const DESTINATION_BY_TYPE: Record<MyahEntityType, string> = {
  // Lab results land on the labs route where grouped trends live.
  labs: '/v2/labs',
  // Legacy appointment rows surface in the unified timeline.
  appointments: '/v2/records',
  // Medications are stored inside health_profile; settings is the
  // only v2 surface that reads that today.
  medications: '/v2/settings',
  // Notes write to medical_narrative, which the records timeline
  // consumes alongside appointments, labs and imaging.
  notes: '/v2/records',
}

export default function MyahWizard() {
  const [state, setState] = useState<WizardState>(initialState)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const router = useRouter()

  const pickEntityType = useCallback((entityType: MyahEntityType) => {
    setState((prev) => ({ ...prev, step: 'paste', entityType }))
  }, [])

  const backToChoose = useCallback(() => {
    // Dropping back to 'choose' clears the draft so the chooser does
    // not look like it remembers a previous pick.
    setState(initialState())
    setImportError(null)
  }, [])

  const updateRawText = useCallback((rawText: string) => {
    setState((prev) => ({ ...prev, rawText }))
  }, [])

  const applyParse = useCallback(
    (parsed: MyahParsedRecord[], warnings: string[]) => {
      setState((prev) => ({
        ...prev,
        step: 'review',
        parsed,
        warnings,
      }))
    },
    []
  )

  const backToPaste = useCallback(() => {
    // Keep rawText + parsed so the user can tweak without retyping.
    setState((prev) => ({ ...prev, step: 'paste' }))
    setImportError(null)
  }, [])

  const startOver = useCallback(() => {
    setState(initialState())
    setImportError(null)
  }, [])

  const removeRecordAt = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      parsed: prev.parsed.filter((_, i) => i !== index),
    }))
  }, [])

  const submitImport = useCallback(async () => {
    if (!state.entityType || state.parsed.length === 0) return
    if (importing) return
    setImporting(true)
    setImportError(null)
    try {
      const res = await fetch('/api/import/myah', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: state.entityType,
          rawText: state.rawText,
          action: 'import',
          // The import handler takes flat parsed records, not the
          // {raw, parsed} wrapper the parse response returns.
          records: state.parsed.map((r) => r.parsed),
        }),
      })
      if (!res.ok) {
        let message = `Could not import (${res.status}).`
        try {
          const body = (await res.json()) as { error?: string }
          if (body && typeof body.error === 'string' && body.error.length > 0) {
            message = body.error
          }
        } catch {
          /* non-JSON body, keep fallback */
        }
        setImportError(message)
        return
      }
      const destination = DESTINATION_BY_TYPE[state.entityType]
      router.push(destination)
    } catch {
      setImportError('Network error. Check your connection and try again.')
    } finally {
      setImporting(false)
    }
  }, [state.entityType, state.parsed, state.rawText, importing, router])

  if (state.step === 'choose') {
    return <MyahCategoryChooser onPick={pickEntityType} />
  }

  if (state.step === 'paste' && state.entityType) {
    return (
      <MyahPasteStep
        entityType={state.entityType}
        rawText={state.rawText}
        onRawTextChange={updateRawText}
        onBack={backToChoose}
        onParsed={applyParse}
      />
    )
  }

  if (state.step === 'review' && state.entityType) {
    return (
      <MyahReviewStep
        entityType={state.entityType}
        parsed={state.parsed}
        warnings={state.warnings}
        importing={importing}
        error={importError}
        onRemoveAt={removeRecordAt}
        onBack={backToPaste}
        onStartOver={startOver}
        onImport={submitImport}
      />
    )
  }

  // Unreachable in practice : fall back to the chooser rather than
  // render nothing if state drifts.
  return <MyahCategoryChooser onPick={pickEntityType} />
}
