'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, Check, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import type { LabResult } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────

interface ScannedResult {
  test_name: string
  value: number | null
  unit: string | null
  reference_range_low: number | null
  reference_range_high: number | null
  date: string | null
  category: string
  uncertain?: boolean
  selected: boolean
}

type ScanPhase = 'capture' | 'preview' | 'scanning' | 'review' | 'importing' | 'done'

interface PhotoLabScannerProps {
  onClose: () => void
  onImported: (results: LabResult[]) => void
}

// ── Helpers ───────────────────────────────────────────────────────────

function computeFlag(
  value: number | null,
  low: number | null,
  high: number | null
): 'normal' | 'low' | 'high' {
  if (value === null) return 'normal'
  if (low !== null && value < low) return 'low'
  if (high !== null && value > high) return 'high'
  return 'normal'
}

function flagColor(flag: string): string {
  switch (flag) {
    case 'low': return '#3B82F6'
    case 'high': return '#F97316'
    default: return 'var(--accent-sage)'
  }
}

function flagLabel(flag: string): string {
  switch (flag) {
    case 'low': return 'Low'
    case 'high': return 'High'
    default: return 'Normal'
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ── Component ─────────────────────────────────────────────────────────

export function PhotoLabScanner({ onClose, onImported }: PhotoLabScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('capture')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMediaType, setImageMediaType] = useState<string>('image/jpeg')
  const [results, setResults] = useState<ScannedResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importCount, setImportCount] = useState(0)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File handling ─────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    setError(null)

    if (file.size > MAX_FILE_SIZE) {
      setError('Image is too large. Maximum size is 10MB.')
      return
    }

    // Determine media type
    let mediaType = file.type || 'image/jpeg'
    if (mediaType === 'image/heic' || mediaType === 'image/heif') {
      // HEIC will be converted to JPEG via canvas
      mediaType = 'image/jpeg'
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) {
        setError('Could not read the image file.')
        return
      }

      // For HEIC or any image, render through canvas to ensure JPEG output
      const img = new Image()
      img.onload = () => {
        // Resize if needed (max 2048px on longest side for API efficiency)
        const maxDim = 2048
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setError('Could not process the image.')
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to base64 JPEG
        const outputType = mediaType === 'image/png' ? 'image/png' : 'image/jpeg'
        const quality = 0.85
        const base64Url = canvas.toDataURL(outputType, quality)
        const base64Data = base64Url.split(',')[1]

        setImagePreview(base64Url)
        setImageBase64(base64Data)
        setImageMediaType(outputType)
        setPhase('preview')
      }
      img.onerror = () => {
        setError('Could not load the image. Please try a different file.')
      }
      img.src = dataUrl
    }
    reader.onerror = () => {
      setError('Could not read the file.')
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      // Reset input so same file can be re-selected
      e.target.value = ''
    },
    [processFile]
  )

  // ── Scan ──────────────────────────────────────────────────────────

  const handleScan = async () => {
    if (!imageBase64) return

    setPhase('scanning')
    setError(null)

    try {
      const res = await fetch('/api/labs/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          mediaType: imageMediaType,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to scan the image.')
        setPhase('preview')
        return
      }

      if (!data.results || data.results.length === 0) {
        setError('No lab results found in the image. Try a clearer photo.')
        setPhase('preview')
        return
      }

      // Mark all results as selected by default
      const scanned: ScannedResult[] = data.results.map((r: ScannedResult) => ({
        ...r,
        selected: true,
      }))

      setResults(scanned)
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
      setPhase('preview')
    }
  }

  // ── Import ────────────────────────────────────────────────────────

  const handleImport = async () => {
    const selected = results.filter((r) => r.selected)
    if (selected.length === 0) {
      setError('No results selected for import.')
      return
    }

    setPhase('importing')
    setError(null)

    const today = new Date().toISOString().split('T')[0]

    try {
      const res = await fetch('/api/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: selected.map((r) => ({
            date: r.date || today,
            test_name: r.test_name,
            value: r.value,
            unit: r.unit,
            reference_range_low: r.reference_range_low,
            reference_range_high: r.reference_range_high,
            category: r.category,
          })),
          source: 'photo_scan',
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to import results.')
        setPhase('review')
        return
      }

      setImportCount(data.count || selected.length)
      setPhase('done')

      if (data.results) {
        onImported(data.results)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
      setPhase('review')
    }
  }

  // ── Edit helpers ──────────────────────────────────────────────────

  const updateResult = (index: number, field: keyof ScannedResult, value: unknown) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  const toggleResult = (index: number) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    )
  }

  const toggleAll = () => {
    const allSelected = results.every((r) => r.selected)
    setResults((prev) => prev.map((r) => ({ ...r, selected: !allSelected })))
  }

  const removeResult = (index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index))
  }

  const resetScanner = () => {
    setPhase('capture')
    setImagePreview(null)
    setImageBase64(null)
    setResults([])
    setError(null)
    setImportCount(0)
  }

  // ── Render ────────────────────────────────────────────────────────

  const selectedCount = results.filter((r) => r.selected).length

  return (
    <div
      className="card p-4 mb-4"
      style={{ border: '1.5px solid var(--accent-sage)', boxShadow: 'var(--shadow-md)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {phase === 'capture' && 'Scan Lab Results'}
          {phase === 'preview' && 'Photo Preview'}
          {phase === 'scanning' && 'Reading Lab Results...'}
          {phase === 'review' && `Review Results (${results.length} found)`}
          {phase === 'importing' && 'Importing...'}
          {phase === 'done' && 'Import Complete'}
        </h3>
        <button
          onClick={onClose}
          className="touch-target p-1 rounded-lg"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close scanner"
        >
          <X size={18} />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div
          className="flex items-start gap-2 p-3 rounded-xl mb-4 text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            color: 'var(--pain-severe)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── CAPTURE PHASE ─────────────────────────────────────────── */}
      {phase === 'capture' && (
        <div className="space-y-3">
          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Take photo of lab results"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload photo of lab results"
          />

          {/* Camera button - large and prominent */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 rounded-2xl text-base font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'var(--accent-sage)',
              color: 'var(--text-inverse)',
              height: '60px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <Camera size={24} />
            Take Photo of Lab Results
          </button>

          {/* Upload button - secondary */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-medium py-3 transition-all"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <Upload size={16} />
            Or upload an existing photo
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Supports JPEG, PNG, WebP, HEIC. Max 10MB.
          </p>
        </div>
      )}

      {/* ── PREVIEW PHASE ─────────────────────────────────────────── */}
      {phase === 'preview' && imagePreview && (
        <div className="space-y-3">
          {/* Photo preview */}
          <div
            className="relative rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Lab results photo"
              className="w-full max-h-[300px] object-contain"
              style={{ background: 'var(--bg-elevated)' }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetScanner}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              Retake
            </button>
            <button
              onClick={handleScan}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: 'var(--accent-sage)',
                color: 'var(--text-inverse)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              Scan Results
            </button>
          </div>
        </div>
      )}

      {/* ── SCANNING PHASE ────────────────────────────────────────── */}
      {phase === 'scanning' && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2
            size={40}
            className="animate-spin"
            style={{ color: 'var(--accent-sage)' }}
          />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Reading lab results...
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              This usually takes 5-10 seconds
            </p>
          </div>
        </div>
      )}

      {/* ── REVIEW PHASE ──────────────────────────────────────────── */}
      {phase === 'review' && results.length > 0 && (
        <div className="space-y-3">
          {/* Select all / count */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleAll}
              className="text-xs font-medium px-2 py-1 rounded-md"
              style={{
                color: 'var(--accent-sage)',
                background: 'var(--accent-sage-muted)',
              }}
            >
              {results.every((r) => r.selected) ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {selectedCount} of {results.length} selected
            </span>
          </div>

          {/* Results table - scrollable on mobile */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {results.map((r, idx) => {
              const flag = computeFlag(r.value, r.reference_range_low, r.reference_range_high)
              return (
                <div
                  key={idx}
                  className="relative"
                  style={{
                    background: r.selected ? 'var(--bg-card)' : 'var(--bg-elevated)',
                    opacity: r.selected ? 1 : 0.5,
                  }}
                >
                  {idx > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-light)' }} />
                  )}
                  <div className="px-3 py-2.5">
                    {/* Row 1: checkbox, name, value, flag */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleResult(idx)}
                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
                        style={{
                          border: r.selected
                            ? 'none'
                            : '1.5px solid var(--border)',
                          background: r.selected
                            ? 'var(--accent-sage)'
                            : 'transparent',
                        }}
                        aria-label={r.selected ? 'Deselect' : 'Select'}
                      >
                        {r.selected && <Check size={12} color="white" strokeWidth={3} />}
                      </button>

                      {/* Editable test name */}
                      <input
                        type="text"
                        value={r.test_name}
                        onChange={(e) => updateResult(idx, 'test_name', e.target.value)}
                        className="flex-1 min-w-0 text-sm font-medium bg-transparent border-none outline-none"
                        style={{ color: 'var(--text-primary)' }}
                      />

                      {/* Value + unit */}
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          step="any"
                          value={r.value ?? ''}
                          onChange={(e) =>
                            updateResult(
                              idx,
                              'value',
                              e.target.value === '' ? null : parseFloat(e.target.value)
                            )
                          }
                          className="w-16 text-right text-sm font-semibold bg-transparent border-none outline-none"
                          style={{ color: 'var(--text-primary)' }}
                          placeholder="--"
                        />
                        <input
                          type="text"
                          value={r.unit ?? ''}
                          onChange={(e) =>
                            updateResult(idx, 'unit', e.target.value || null)
                          }
                          className="w-14 text-xs bg-transparent border-none outline-none"
                          style={{ color: 'var(--text-muted)' }}
                          placeholder="unit"
                        />
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: flagColor(flag) }}
                          title={flagLabel(flag)}
                        />
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => removeResult(idx)}
                        className="shrink-0 p-1 rounded"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label="Remove result"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Row 2: ref range, date, category, uncertain badge */}
                    <div className="flex items-center gap-2 mt-1 ml-7 flex-wrap">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Ref:
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={r.reference_range_low ?? ''}
                        onChange={(e) =>
                          updateResult(
                            idx,
                            'reference_range_low',
                            e.target.value === '' ? null : parseFloat(e.target.value)
                          )
                        }
                        className="w-14 text-xs bg-transparent border-none outline-none text-center"
                        style={{ color: 'var(--text-muted)' }}
                        placeholder="low"
                      />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>
                      <input
                        type="number"
                        step="any"
                        value={r.reference_range_high ?? ''}
                        onChange={(e) =>
                          updateResult(
                            idx,
                            'reference_range_high',
                            e.target.value === '' ? null : parseFloat(e.target.value)
                          )
                        }
                        className="w-14 text-xs bg-transparent border-none outline-none text-center"
                        style={{ color: 'var(--text-muted)' }}
                        placeholder="high"
                      />

                      <span className="text-xs mx-1" style={{ color: 'var(--border)' }}>|</span>

                      <input
                        type="date"
                        value={r.date ?? ''}
                        onChange={(e) =>
                          updateResult(idx, 'date', e.target.value || null)
                        }
                        className="text-xs bg-transparent border-none outline-none"
                        style={{ color: 'var(--text-muted)', maxWidth: '120px' }}
                      />

                      <span className="text-xs mx-1" style={{ color: 'var(--border)' }}>|</span>

                      <select
                        value={r.category}
                        onChange={(e) => updateResult(idx, 'category', e.target.value)}
                        className="text-xs bg-transparent border-none outline-none appearance-none"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {['CBC', 'Chemistry', 'Hormones', 'Iron Studies', 'Vitamins',
                          'Lipids', 'Thyroid', 'Coagulation', 'Liver', 'Other'].map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>

                      {r.uncertain && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                          style={{
                            background: 'rgba(249, 115, 22, 0.1)',
                            color: '#F97316',
                          }}
                        >
                          uncertain
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={resetScanner}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              Rescan
            </button>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: selectedCount > 0 ? 'var(--accent-sage)' : 'var(--bg-elevated)',
                color: selectedCount > 0 ? 'var(--text-inverse)' : 'var(--text-muted)',
                boxShadow: selectedCount > 0 ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Import {selectedCount} Result{selectedCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── IMPORTING PHASE ───────────────────────────────────────── */}
      {phase === 'importing' && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2
            size={40}
            className="animate-spin"
            style={{ color: 'var(--accent-sage)' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Importing {selectedCount} result{selectedCount !== 1 ? 's' : ''}...
          </p>
        </div>
      )}

      {/* ── DONE PHASE ────────────────────────────────────────────── */}
      {phase === 'done' && (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-sage-muted)' }}
          >
            <Check size={24} style={{ color: 'var(--accent-sage)' }} />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {importCount} lab result{importCount !== 1 ? 's' : ''} imported
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Results have been added to your records.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'var(--accent-sage)',
              color: 'var(--text-inverse)',
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
