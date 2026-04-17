'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  ChevronDown,
  Activity,
  Stethoscope,
  Monitor,
  Upload,
  Image as ImageIcon,
} from 'lucide-react'
import type { ImagingStudy, ImagingModality } from '@/lib/types'
import { ScanUploader } from './ScanUploader'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Modality metadata. Neutral card surface, single thin sage accent stripe on
 * the left. No per-modality hues. Label is the canonical user-facing name.
 */
function modalityMeta(modality: ImagingModality): {
  label: string
  stripe: string
} {
  switch (modality) {
    case 'CT':
      return { label: 'CT Scan', stripe: 'var(--accent-sage)' }
    case 'XR':
      return { label: 'X-Ray', stripe: 'var(--accent-sage)' }
    case 'MRI':
      return { label: 'MRI', stripe: 'var(--accent-sage)' }
    case 'US':
      return { label: 'Ultrasound', stripe: 'var(--accent-sage)' }
    case 'EKG':
      return { label: 'EKG', stripe: 'var(--accent-sage)' }
    default:
      return { label: modality, stripe: 'var(--border)' }
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Split findings text into bullet points when it contains semicolons or newlines. */
function splitFindings(text: string): string[] {
  if (text.includes(';')) {
    return text
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (text.includes('\n')) {
    return text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const sentences = text
    .split(/\.(?=\s+[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length > 2) {
    return sentences.map((s) => (s.endsWith('.') ? s : s + '.'))
  }
  return [text]
}

/* ------------------------------------------------------------------ */
/*  Study Card                                                        */
/* ------------------------------------------------------------------ */

function StudyCard({ study }: { study: ImagingStudy }) {
  const [reportExpanded, setReportExpanded] = useState(false)
  const meta = modalityMeta(study.modality)
  const findings = study.findings_summary ? splitFindings(study.findings_summary) : []

  return (
    <article
      className="rounded-2xl overflow-hidden press-feedback"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        borderLeft: `3px solid ${meta.stripe}`,
        transition: 'box-shadow var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard)',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        {/* Modality badge: neutral pill */}
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 uppercase tracking-wide"
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-light)',
            letterSpacing: '0.04em',
          }}
        >
          {meta.label}
        </span>

        <div className="flex-1 min-w-0">
          <p
            className="text-base font-semibold leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {study.body_part}
          </p>
          <p
            className="text-xs mt-0.5 tabular"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatDate(study.study_date)}
          </p>
        </div>
      </div>

      <div
        className="px-5 py-4"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        {/* Indication */}
        {study.indication && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Stethoscope
                size={14}
                strokeWidth={2}
                style={{ color: 'var(--text-muted)' }}
              />
              <p
                className="text-xs font-semibold uppercase"
                style={{
                  color: 'var(--text-muted)',
                  letterSpacing: '0.06em',
                }}
              >
                Clinical Indication
              </p>
            </div>
            <p
              className="text-sm tabular"
              style={{
                color: 'var(--text-secondary)',
                lineHeight: '1.55',
              }}
            >
              {study.indication}
            </p>
          </div>
        )}

        {/* Findings: single cream-tinted bg, no per-modality hue */}
        {findings.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity
                size={14}
                strokeWidth={2}
                style={{ color: 'var(--accent-sage)' }}
              />
              <p
                className="text-xs font-semibold uppercase"
                style={{
                  color: 'var(--text-muted)',
                  letterSpacing: '0.06em',
                }}
              >
                Findings
              </p>
            </div>

            <div
              className="rounded-xl"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-light)',
                padding: 'var(--space-3) var(--space-4)',
              }}
            >
              {findings.length === 1 ? (
                <p
                  className="text-sm tabular"
                  style={{
                    color: 'var(--text-primary)',
                    lineHeight: '1.6',
                  }}
                >
                  {findings[0]}
                </p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {findings.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2 text-sm tabular"
                      style={{
                        color: 'var(--text-primary)',
                        lineHeight: '1.55',
                      }}
                    >
                      <span
                        className="shrink-0 mt-1.5 block rounded-full"
                        style={{
                          width: 5,
                          height: 5,
                          background: 'var(--accent-sage)',
                          opacity: 0.5,
                        }}
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Expandable full report */}
        {study.report_text && (
          <div>
            <button
              onClick={() => setReportExpanded((v) => !v)}
              className="press-feedback flex items-center gap-1.5 w-full text-left rounded-lg"
              type="button"
              aria-expanded={reportExpanded}
              style={{
                padding: 'var(--space-2) 0',
                transition: 'opacity var(--duration-fast) var(--ease-standard)',
              }}
            >
              <FileText
                size={14}
                strokeWidth={2}
                style={{ color: 'var(--text-muted)' }}
              />
              <p
                className="text-xs font-semibold uppercase flex-1"
                style={{
                  color: 'var(--text-muted)',
                  letterSpacing: '0.06em',
                }}
              >
                Full Radiology Report
              </p>
              <ChevronDown
                size={16}
                style={{
                  color: 'var(--text-muted)',
                  transform: reportExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform var(--duration-fast) var(--ease-standard)',
                }}
              />
            </button>

            {reportExpanded && (
              <div
                className="mt-2 rounded-xl"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-light)',
                  padding: 'var(--space-3) var(--space-4)',
                }}
              >
                <p
                  className="whitespace-pre-wrap tabular"
                  style={{
                    color: 'var(--text-secondary)',
                    lineHeight: '1.65',
                    fontFamily: 'var(--font-mono), monospace',
                    fontSize: '13px',
                  }}
                >
                  {study.report_text}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

type ViewMode = 'reports' | 'viewer'

interface ImagingViewerClientProps {
  studies: ImagingStudy[]
}

export function ImagingViewerClient({ studies }: ImagingViewerClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('reports')
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [modalityFilter, setModalityFilter] = useState<ImagingModality | 'all'>('all')

  const filteredStudies = useMemo(() => {
    if (modalityFilter === 'all') return studies
    return studies.filter((s) => s.modality === modalityFilter)
  }, [studies, modalityFilter])

  // Build unique modality chips from the actual data
  const modalityChips = useMemo(() => {
    const seen = new Map<ImagingModality, number>()
    studies.forEach((s) => {
      seen.set(s.modality, (seen.get(s.modality) || 0) + 1)
    })
    return Array.from(seen.entries())
  }, [studies])

  return (
    <div
      className="flex flex-col pb-safe"
      style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Link
          href="/records"
          className="touch-target press-feedback"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Back to Records"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="page-title" style={{ fontSize: 'var(--text-lg)' }}>
            Imaging
          </h1>
          <p
            className="text-xs tabular"
            style={{ color: 'var(--text-muted)' }}
          >
            {studies.length} {studies.length === 1 ? 'study' : 'studies'} on file
          </p>
        </div>

        {/* Upload button (neutral pill; not the primary sage action) */}
        <button
          type="button"
          onClick={() => setUploaderOpen((v) => !v)}
          className="pill press-feedback"
          aria-pressed={uploaderOpen}
          aria-label={uploaderOpen ? 'Close uploader' : 'Add imaging study'}
          style={{
            gap: 6,
            padding: '6px 14px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            ...(uploaderOpen
              ? {
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }
              : {}),
          }}
        >
          <Upload size={14} strokeWidth={2} />
          Upload
        </button>
      </div>

      {/* Tab pills: one sage active at a time */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <button
          type="button"
          onClick={() => setViewMode('reports')}
          className={`pill press-feedback ${viewMode === 'reports' ? 'pill-active' : ''}`}
          aria-pressed={viewMode === 'reports'}
          style={{ gap: 6, fontSize: 'var(--text-xs)', fontWeight: 600 }}
        >
          <FileText size={14} strokeWidth={2} />
          Reports
        </button>

        <button
          type="button"
          onClick={() => setViewMode('viewer')}
          className={`pill press-feedback ${viewMode === 'viewer' ? 'pill-active' : ''}`}
          aria-pressed={viewMode === 'viewer'}
          style={{ gap: 6, fontSize: 'var(--text-xs)', fontWeight: 600 }}
        >
          <Monitor size={14} strokeWidth={2} />
          Viewer
        </button>
      </div>

      {/* Upload section (collapsible) */}
      {uploaderOpen && (
        <div
          className="route-desktop-wide"
          style={{
            padding: 'var(--space-4) var(--space-4) 0',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <ScanUploader
            onSuccess={() => {
              setUploaderOpen(false)
              window.location.reload()
            }}
          />
        </div>
      )}

      {/* Viewer (iframe) */}
      {viewMode === 'viewer' && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
          <div
            className="px-4 py-2 tabular"
            style={{
              background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-light)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}
          >
            DICOM viewer: pinch or drag to navigate slices.
          </div>
          <iframe
            src="/pacs.html"
            title="PACS DICOM Viewer"
            className="flex-1 w-full"
            style={{
              border: 'none',
              minHeight: 'calc(100vh - 140px)',
              background: '#000',
            }}
            allow="fullscreen"
          />
        </div>
      )}

      {/* Report view */}
      {viewMode === 'reports' && (
        <>
          {studies.length > 0 ? (
            <div
              className="route-desktop-wide"
              style={{
                margin: '0 auto',
                width: '100%',
                padding: 'var(--space-4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
              }}
            >
              {/* Modality filter chips */}
              {modalityChips.length > 1 && (
                <div
                  className="flex gap-2 flex-wrap"
                  role="group"
                  aria-label="Filter by modality"
                >
                  <button
                    type="button"
                    onClick={() => setModalityFilter('all')}
                    className={`pill press-feedback ${modalityFilter === 'all' ? 'pill-active' : ''}`}
                    aria-pressed={modalityFilter === 'all'}
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      padding: '5px 12px',
                    }}
                  >
                    All
                    <span
                      className="tabular"
                      style={{ marginLeft: 6, opacity: 0.7 }}
                    >
                      {studies.length}
                    </span>
                  </button>
                  {modalityChips.map(([mod, count]) => {
                    const m = modalityMeta(mod)
                    const isActive = modalityFilter === mod
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setModalityFilter(mod)}
                        className={`pill press-feedback ${isActive ? 'pill-active' : ''}`}
                        aria-pressed={isActive}
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          padding: '5px 12px',
                        }}
                      >
                        {m.label}
                        <span
                          className="tabular"
                          style={{ marginLeft: 6, opacity: 0.7 }}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Study cards */}
              {filteredStudies.length > 0 ? (
                filteredStudies.map((study) => (
                  <StudyCard key={study.id} study={study} />
                ))
              ) : (
                <div className="empty-state">
                  <ImageIcon
                    className="empty-state__icon"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <p className="empty-state__title">No studies match this filter.</p>
                  <p className="empty-state__hint tabular">
                    Tap {`"`}All{`"`} to see every study on file.
                  </p>
                </div>
              )}

              {/* Filtered-count footer line, tabular */}
              {modalityFilter !== 'all' && filteredStudies.length > 0 && (
                <p
                  className="text-xs tabular"
                  style={{
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    marginTop: 'var(--space-2)',
                  }}
                >
                  Showing {filteredStudies.length} of {studies.length} studies.
                </p>
              )}

              {/* Short hint to tap-through for viewer */}
              <p
                className="text-xs"
                style={{
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  marginTop: 'var(--space-2)',
                }}
              >
                Need the slices? Tap Viewer above to open the DICOM viewer.
              </p>
            </div>
          ) : (
            /* Empty state: per brief copy */
            <div
              className="route-desktop-wide"
              style={{ margin: '0 auto', width: '100%' }}
            >
              <div className="empty-state">
                <ImageIcon
                  className="empty-state__icon"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <p className="empty-state__title">No imaging on file.</p>
                <p className="empty-state__hint">
                  Your imaging reports will show up here once uploaded.
                </p>
                <button
                  type="button"
                  onClick={() => setUploaderOpen(true)}
                  className="pill press-feedback pill-active"
                  style={{
                    gap: 6,
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    marginTop: 'var(--space-2)',
                  }}
                >
                  <Upload size={14} strokeWidth={2} />
                  Add a study
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
