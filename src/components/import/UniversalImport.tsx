'use client'

import { useState, useCallback, useRef } from 'react'
import type { CanonicalRecord, FormatDetectionResult } from '@/lib/import/types'

type ImportPhase = 'idle' | 'uploading' | 'reviewing' | 'saving' | 'complete' | 'error'

interface ReviewData {
  format: FormatDetectionResult
  records: CanonicalRecord[]
  duplicateCount: number
  metadata: {
    totalExtracted: number
    byType: Record<string, number>
    dateRange: { earliest: string; latest: string } | null
    sourceName: string | null
  }
  warnings: string[]
  errors: string[]
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  lab_result: 'Lab Results',
  vital_sign: 'Vital Signs',
  medication: 'Medications',
  condition: 'Conditions',
  symptom: 'Symptoms',
  appointment: 'Appointments',
  procedure: 'Procedures',
  allergy: 'Allergies',
  immunization: 'Immunizations',
  food_entry: 'Food Entries',
  cycle_entry: 'Cycle Data',
  mood_entry: 'Mood Entries',
  sleep_entry: 'Sleep Data',
  activity_entry: 'Activities',
  body_measurement: 'Body Measurements',
  clinical_note: 'Clinical Notes',
  timeline_event: 'Timeline Events',
}

const RECORD_TYPE_ICONS: Record<string, string> = {
  lab_result: '\u{1F9EA}',
  vital_sign: '\u{1FA7A}',
  medication: '\u{1F48A}',
  condition: '\u{1FA7B}',
  symptom: '\u{1F915}',
  appointment: '\u{1F4C5}',
  procedure: '\u{1FA7C}',
  allergy: '\u{26A0}',
  immunization: '\u{1F489}',
  food_entry: '\u{1F34E}',
  cycle_entry: '\u{1F319}',
  mood_entry: '\u{1F60A}',
  sleep_entry: '\u{1F634}',
  activity_entry: '\u{1F3C3}',
  body_measurement: '\u{1F4CF}',
  clinical_note: '\u{1F4DD}',
  timeline_event: '\u{1F4CC}',
}

export default function UniversalImport() {
  const [phase, setPhase] = useState<ImportPhase>('idle')
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [saveResult, setSaveResult] = useState<{
    saved: Record<string, number>
    totalSaved: number
    errors: string[]
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setPhase('uploading')
    setErrorMessage(null)
    setReviewData(null)
    setSaveResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import/universal', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setPhase('error')
        setErrorMessage(data.error ?? 'Import failed')
        return
      }

      if (data.phase === 'redirect') {
        // Legacy format -- redirect to dedicated importer
        setPhase('error')
        setErrorMessage(`${data.message} Please use the dedicated import option in Settings.`)
        return
      }

      setReviewData(data)
      setPhase('reviewing')
    } catch (e) {
      setPhase('error')
      setErrorMessage(e instanceof Error ? e.message : 'Upload failed')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleConfirm = useCallback(async () => {
    if (!reviewData) return
    setPhase('saving')

    try {
      const res = await fetch('/api/import/universal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          records: reviewData.records,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPhase('error')
        setErrorMessage(data.error ?? 'Save failed')
        return
      }

      setSaveResult(data)
      setPhase('complete')
    } catch (e) {
      setPhase('error')
      setErrorMessage(e instanceof Error ? e.message : 'Save failed')
    }
  }, [reviewData])

  const handleReset = useCallback(() => {
    setPhase('idle')
    setReviewData(null)
    setSaveResult(null)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {phase === 'idle' && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="w-full rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer"
          style={{
            borderColor: dragOver ? 'var(--accent-sage)' : 'var(--border-light)',
            background: dragOver ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Drop any health file here
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                PDF, screenshots, CSV, XML, JSON, FHIR, C-CDA, and more
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.csv,.xml,.json,.txt,.png,.jpg,.jpeg,.webp,.gif,.fit,.tcx,.gpx"
            onChange={handleFileInput}
          />
        </button>
      )}

      {/* Uploading/Processing */}
      {phase === 'uploading' && (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: 'var(--accent-sage)', borderRightColor: 'var(--accent-sage)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Analyzing your file...
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Detecting format and extracting health data
            </p>
          </div>
        </div>
      )}

      {/* Review Phase */}
      {phase === 'reviewing' && reviewData && (
        <div className="space-y-3">
          {/* Detection Banner */}
          <div className="rounded-xl p-4" style={{ background: 'var(--accent-sage-muted)' }}>
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="text-sm font-semibold" style={{ color: 'var(--accent-sage)' }}>
                {reviewData.metadata.sourceName ?? reviewData.format.format}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Found {reviewData.metadata.totalExtracted} records
              {reviewData.metadata.dateRange
                ? ` from ${reviewData.metadata.dateRange.earliest} to ${reviewData.metadata.dateRange.latest}`
                : ''}
              {reviewData.duplicateCount > 0
                ? ` (${reviewData.duplicateCount} duplicates removed)`
                : ''}
            </p>
          </div>

          {/* Records by Type */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Extracted Data
            </p>
            {Object.entries(reviewData.metadata.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-1.5">
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <span>{RECORD_TYPE_ICONS[type] ?? '\u{1F4CB}'}</span>
                  {RECORD_TYPE_LABELS[type] ?? type}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent-sage)' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {reviewData.warnings.length > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: '#FFF8E1', border: '1px solid #FFE082' }}>
              {reviewData.warnings.map((w, i) => (
                <p key={i} className="text-xs" style={{ color: '#F57F17' }}>{w}</p>
              ))}
            </div>
          )}

          {/* Errors */}
          {reviewData.errors.length > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: '#FFEBEE', border: '1px solid #EF9A9A' }}>
              {reviewData.errors.map((e, i) => (
                <p key={i} className="text-xs" style={{ color: '#C62828' }}>{e}</p>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={reviewData.records.length === 0}
              className="flex-1 rounded-lg py-3 text-sm font-semibold text-white transition-opacity"
              style={{
                background: 'var(--accent-sage)',
                opacity: reviewData.records.length === 0 ? 0.5 : 1,
              }}
            >
              Import {reviewData.records.length} Records
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg px-4 py-3 text-sm font-medium"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Saving */}
      {phase === 'saving' && (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: 'var(--accent-sage)', borderRightColor: 'var(--accent-sage)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Saving to your health record...
            </p>
          </div>
        </div>
      )}

      {/* Complete */}
      {phase === 'complete' && saveResult && (
        <div className="space-y-3">
          <div className="rounded-xl p-4 text-center" style={{ background: 'var(--accent-sage-muted)' }}>
            <div className="flex flex-col items-center gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-sm font-semibold" style={{ color: 'var(--accent-sage)' }}>
                {saveResult.totalSaved} records imported successfully
              </p>
            </div>
          </div>

          {/* Saved breakdown */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            {Object.entries(saveResult.saved).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {RECORD_TYPE_ICONS[type] ?? '\u{1F4CB}'} {RECORD_TYPE_LABELS[type] ?? type}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent-sage)' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>

          {saveResult.errors.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: '#FFEBEE', border: '1px solid #EF9A9A' }}>
              <p className="text-xs font-medium" style={{ color: '#C62828' }}>
                {saveResult.errors.length} record(s) failed to save
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-lg py-3 text-sm font-semibold"
            style={{ color: 'var(--accent-sage)', background: 'var(--accent-sage-muted)' }}
          >
            Import Another File
          </button>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="space-y-3">
          <div className="rounded-xl p-4" style={{ background: '#FFEBEE', border: '1px solid #EF9A9A' }}>
            <p className="text-sm font-medium" style={{ color: '#C62828' }}>
              {errorMessage ?? 'Something went wrong'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-lg py-3 text-sm font-semibold"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
