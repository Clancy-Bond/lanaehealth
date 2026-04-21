'use client'

import { useState, useRef, useCallback } from 'react'
import { FileText, Upload, X, Check, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import type { LabResult } from '@/lib/types'
import { renderPdfPages } from '@/lib/pdf/render-pdf-pages'
import {
  aggregateScannedPages,
  type ExtractedResult,
} from '@/lib/labs/aggregate-scanned'

interface ScannedResult extends ExtractedResult {
  selected: boolean
}

type ScanPhase = 'capture' | 'scanning' | 'review' | 'importing' | 'done'

interface PdfLabScannerProps {
  onClose: () => void
  onImported: (results: LabResult[]) => void
}

interface ScanProgress {
  stage: 'rendering' | 'extracting'
  pageNumber: number
  totalPages: number
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB PDF

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

export function PdfLabScanner({ onClose, onImported }: PdfLabScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('capture')
  const [fileName, setFileName] = useState<string | null>(null)
  const [results, setResults] = useState<ScannedResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importCount, setImportCount] = useState(0)
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const scanPdf = useCallback(async (file: File) => {
    setError(null)
    setFileName(file.name)

    if (file.size > MAX_FILE_SIZE) {
      setError('PDF is too large. Maximum size is 25MB.')
      return
    }
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.')
      return
    }

    setPhase('scanning')
    setProgress({ stage: 'rendering', pageNumber: 0, totalPages: 0 })

    try {
      const pages = await renderPdfPages(file, {
        onProgress: (pageNumber, totalPages) => {
          setProgress({ stage: 'rendering', pageNumber, totalPages })
        },
      })

      if (pages.length === 0) {
        setError('PDF has no pages.')
        setPhase('capture')
        return
      }

      const perPageResults: ExtractedResult[][] = []
      for (const page of pages) {
        setProgress({
          stage: 'extracting',
          pageNumber: page.pageNumber,
          totalPages: pages.length,
        })

        const res = await fetch('/api/labs/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: page.base64,
            mediaType: page.mediaType,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          // A page without a table is expected (cover page, disclaimers).
          // Only bail on hard errors, not "not a lab document" 422s.
          if (res.status >= 500) {
            throw new Error(data.error || `Scan failed on page ${page.pageNumber}.`)
          }
          perPageResults.push([])
          continue
        }

        perPageResults.push(Array.isArray(data.results) ? data.results : [])
      }

      const aggregated = aggregateScannedPages(perPageResults)

      if (aggregated.length === 0) {
        setError('No lab results found in this PDF. Try a clearer scan or a different file.')
        setPhase('capture')
        return
      }

      setResults(aggregated.map((r) => ({ ...r, selected: true })))
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something broke while reading the PDF.')
      setPhase('capture')
    } finally {
      setProgress(null)
    }
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) scanPdf(file)
      e.target.value = ''
    },
    [scanPdf]
  )

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
          source: 'pdf_scan',
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
    setFileName(null)
    setResults([])
    setError(null)
    setImportCount(0)
    setProgress(null)
  }

  const selectedCount = results.filter((r) => r.selected).length

  return (
    <div
      className="card p-4 mb-4"
      style={{ border: '1.5px solid var(--accent-sage)', boxShadow: 'var(--shadow-md)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {phase === 'capture' && 'Upload Lab PDF'}
          {phase === 'scanning' && 'Reading PDF...'}
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

      {phase === 'capture' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload lab results PDF"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 rounded-2xl text-base font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'var(--accent-sage)',
              color: 'var(--text-inverse)',
              height: '60px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <Upload size={22} />
            Choose PDF file
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Each page is scanned and results are combined. Max 25MB.
          </p>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2
            size={40}
            className="animate-spin"
            style={{ color: 'var(--accent-sage)' }}
          />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {progress?.stage === 'rendering' && progress.totalPages > 0 &&
                `Opening PDF page ${progress.pageNumber} of ${progress.totalPages}`}
              {progress?.stage === 'rendering' && progress.totalPages === 0 &&
                'Opening PDF...'}
              {progress?.stage === 'extracting' &&
                `Scanning page ${progress.pageNumber} of ${progress.totalPages}`}
              {!progress && 'Reading PDF...'}
            </p>
            {fileName && (
              <p className="text-xs mt-1 truncate max-w-[280px]" style={{ color: 'var(--text-muted)' }}>
                {fileName}
              </p>
            )}
          </div>
        </div>
      )}

      {phase === 'review' && results.length > 0 && (
        <div className="space-y-3">
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleResult(idx)}
                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
                        style={{
                          border: r.selected ? 'none' : '1.5px solid var(--border)',
                          background: r.selected ? 'var(--accent-sage)' : 'transparent',
                        }}
                        aria-label={r.selected ? 'Deselect' : 'Select'}
                      >
                        {r.selected && <Check size={12} color="white" strokeWidth={3} />}
                      </button>

                      <input
                        type="text"
                        value={r.test_name}
                        onChange={(e) => updateResult(idx, 'test_name', e.target.value)}
                        className="flex-1 min-w-0 text-sm font-medium bg-transparent border-none outline-none"
                        style={{ color: 'var(--text-primary)' }}
                      />

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

                      <button
                        onClick={() => removeResult(idx)}
                        className="shrink-0 p-1 rounded"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label="Remove result"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

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
              Choose different PDF
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
