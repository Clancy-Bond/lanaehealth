'use client'

/*
 * AppleHealthWizard
 *
 * Three-step state machine for Apple Health imports:
 *
 *   pick    -> drop / pick a .zip or .xml file
 *   preview -> show what we found (no DB write yet) + Confirm button
 *   done    -> success summary with counts that landed
 *
 * We split preview from confirm so a user always knows what is
 * about to be saved before we touch the DB. /api/import/apple-health
 * accepts mode=preview (returns counts only) and mode=confirm
 * (writes everything).
 *
 * The browser uploads the same file twice - once for preview, once
 * for confirm - because a sensible "session token" would mean
 * stashing 100MB of XML in memory or disk on the server. The
 * second upload is fast on the same network.
 */
import { useCallback, useRef, useState } from 'react'
import { Button, Card } from '@/v2/components/primitives'

type Step = 'pick' | 'previewing' | 'preview' | 'confirming' | 'done' | 'error'

interface PreviewCounts {
  sleepHours: number
  workouts: number
  weightEntries: number
  heartRateSamples: number
  bpReadings: number
  stepDays: number
  cycleDays: number
  nutritionDays: number
}

interface PreviewResponse {
  recordCount: number
  daysProcessed: number
  dateRange: { start: string; end: string }
  sources: string[]
  counts: PreviewCounts
}

interface ConfirmResponse {
  records: number
  daysProcessed: number
  dateRange: { start: string; end: string }
  cycleEntries: number
  nutritionEntries: number
  biometricEntries: number
  sources: string[]
  errors?: string[]
}

const ACCEPTED_TYPES = '.zip,.xml,application/zip,application/x-zip-compressed,text/xml,application/xml'

export default function AppleHealthWizard() {
  const [step, setStep] = useState<Step>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [confirm, setConfirm] = useState<ConfirmResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const reset = useCallback(() => {
    setStep('pick')
    setFile(null)
    setPreview(null)
    setConfirm(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const handleFile = useCallback(async (picked: File) => {
    setFile(picked)
    setError(null)
    setStep('previewing')

    const fd = new FormData()
    fd.append('file', picked)
    fd.append('mode', 'preview')

    try {
      const res = await fetch('/api/import/apple-health', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not read the file.')
        setStep('error')
        return
      }
      setPreview(json.preview as PreviewResponse)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
      setStep('error')
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!file) return
    setStep('confirming')
    setError(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', 'confirm')

    try {
      const res = await fetch('/api/import/apple-health', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Import failed.')
        setStep('error')
        return
      }
      setConfirm(json as ConfirmResponse)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
      setStep('error')
    }
  }, [file])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  if (step === 'pick' || step === 'previewing' || step === 'error') {
    return (
      <Card padding="md">
        <div
          data-testid="apple-health-dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? 'var(--v2-accent-primary)' : 'var(--v2-border-strong)'}`,
            borderRadius: 'var(--v2-radius-lg)',
            padding: 'var(--v2-space-6) var(--v2-space-4)',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'var(--v2-bg-elevated)' : 'transparent',
            transition: 'background var(--v2-duration-fast) var(--v2-ease-standard)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            {step === 'previewing' ? 'Reading your export...' : 'Drop export.zip here'}
          </p>
          <p
            style={{
              margin: 'var(--v2-space-2) 0 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            or tap to choose a file. Up to 50 MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={onInputChange}
            data-testid="apple-health-file-input"
            style={{ display: 'none' }}
          />
        </div>

        {file && step !== 'error' && (
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0 0',
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              textAlign: 'center',
            }}
          >
            {file.name} ({Math.round(file.size / 1024 / 1024 * 10) / 10} MB)
          </p>
        )}

        {step === 'error' && error && (
          <div
            data-testid="apple-health-error"
            style={{
              marginTop: 'var(--v2-space-3)',
              padding: 'var(--v2-space-3)',
              border: '1px solid var(--v2-accent-danger)',
              borderRadius: 'var(--v2-radius-md)',
              color: 'var(--v2-accent-danger)',
              fontSize: 'var(--v2-text-sm)',
            }}
          >
            <p style={{ margin: 0 }}>{error}</p>
            <Button
              variant="secondary"
              size="sm"
              style={{ marginTop: 'var(--v2-space-2)' }}
              onClick={reset}
            >
              Try another file
            </Button>
          </div>
        )}
      </Card>
    )
  }

  if (step === 'preview' && preview) {
    return (
      <PreviewCard
        preview={preview}
        onConfirm={handleConfirm}
        onCancel={reset}
        confirming={false}
      />
    )
  }

  if (step === 'confirming' && preview) {
    return (
      <PreviewCard preview={preview} onConfirm={() => {}} onCancel={() => {}} confirming />
    )
  }

  if (step === 'done' && confirm) {
    return (
      <Card padding="md" data-testid="apple-health-done">
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-lg)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Imported.
        </p>
        <p
          style={{
            margin: 'var(--v2-space-2) 0 var(--v2-space-4) 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
          }}
        >
          {formatDateRange(confirm.dateRange)} from {confirm.sources.length || 'your'} sources.
        </p>
        <SummaryRow label="Records read" value={confirm.records.toLocaleString()} />
        <SummaryRow label="Days processed" value={confirm.daysProcessed.toLocaleString()} />
        <SummaryRow label="Cycle days saved" value={confirm.cycleEntries.toLocaleString()} />
        <SummaryRow label="Nutrition days saved" value={confirm.nutritionEntries.toLocaleString()} />
        <SummaryRow label="Biometric days saved" value={confirm.biometricEntries.toLocaleString()} />
        {confirm.errors && confirm.errors.length > 0 && (
          <p
            style={{
              margin: 'var(--v2-space-3) 0 0 0',
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            {confirm.errors.length} rows had issues and were skipped.
          </p>
        )}
        <div style={{ marginTop: 'var(--v2-space-4)', display: 'flex', gap: 'var(--v2-space-3)' }}>
          <Button variant="secondary" size="md" onClick={reset}>
            Import another
          </Button>
          <a href="/v2" style={{ textDecoration: 'none', flex: 1 }}>
            <Button variant="primary" size="md" fullWidth>
              Done
            </Button>
          </a>
        </div>
      </Card>
    )
  }

  return null
}

function PreviewCard({
  preview,
  onConfirm,
  onCancel,
  confirming,
}: {
  preview: PreviewResponse
  onConfirm: () => void
  onCancel: () => void
  confirming: boolean
}) {
  const c = preview.counts
  return (
    <Card padding="md" data-testid="apple-health-preview">
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-lg)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
        }}
      >
        We found {preview.recordCount.toLocaleString()} records
      </p>
      <p
        style={{
          margin: 'var(--v2-space-2) 0 var(--v2-space-4) 0',
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
        }}
      >
        Across {preview.daysProcessed.toLocaleString()} days, {formatDateRange(preview.dateRange)}.
      </p>

      <SummaryRow label="Sleep nights" value={c.sleepHours.toLocaleString()} />
      <SummaryRow label="Workouts" value={c.workouts.toLocaleString()} />
      <SummaryRow label="Weight entries" value={c.weightEntries.toLocaleString()} />
      <SummaryRow label="Days with heart rate" value={c.heartRateSamples.toLocaleString()} />
      <SummaryRow label="Days with blood pressure" value={c.bpReadings.toLocaleString()} />
      <SummaryRow label="Days with steps" value={c.stepDays.toLocaleString()} />
      <SummaryRow label="Cycle days" value={c.cycleDays.toLocaleString()} />
      <SummaryRow label="Days with nutrition" value={c.nutritionDays.toLocaleString()} />

      {preview.sources.length > 0 && (
        <p
          style={{
            margin: 'var(--v2-space-3) 0 0 0',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
          }}
        >
          Sources: {preview.sources.slice(0, 6).join(', ')}
          {preview.sources.length > 6 ? ` and ${preview.sources.length - 6} more` : ''}
        </p>
      )}

      <div style={{ marginTop: 'var(--v2-space-5)', display: 'flex', gap: 'var(--v2-space-3)' }}>
        <Button variant="secondary" size="md" onClick={onCancel} disabled={confirming}>
          Choose another file
        </Button>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={onConfirm}
          disabled={confirming}
          data-testid="apple-health-confirm"
        >
          {confirming ? 'Saving...' : 'Save to my account'}
        </Button>
      </div>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: 'var(--v2-space-2) 0',
        borderBottom: '1px solid var(--v2-border-subtle)',
      }}
    >
      <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function formatDateRange(range: { start: string; end: string }): string {
  if (!range.start || range.start === '9999-99-99') return 'an unknown range'
  if (range.start === range.end) return range.start
  return `${range.start} to ${range.end}`
}
