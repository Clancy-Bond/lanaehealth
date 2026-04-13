'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  FileText,
  ChevronDown,
  ChevronUp,
  Activity,
  Stethoscope,
  Monitor,
  Upload,
} from 'lucide-react'
import type { ImagingStudy, ImagingModality } from '@/lib/types'
import { ScanUploader } from './ScanUploader'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function modalityMeta(modality: ImagingModality): {
  label: string
  bg: string
  color: string
  borderColor: string
} {
  switch (modality) {
    case 'CT':
      return {
        label: 'CT Scan',
        bg: 'rgba(91, 155, 213, 0.10)',
        color: '#5B9BD5',
        borderColor: 'rgba(91, 155, 213, 0.25)',
      }
    case 'XR':
      return {
        label: 'X-Ray',
        bg: 'rgba(107, 144, 128, 0.10)',
        color: 'var(--accent-sage)',
        borderColor: 'rgba(107, 144, 128, 0.25)',
      }
    case 'MRI':
      return {
        label: 'MRI',
        bg: 'rgba(139, 92, 246, 0.10)',
        color: '#8B5CF6',
        borderColor: 'rgba(139, 92, 246, 0.25)',
      }
    case 'US':
      return {
        label: 'Ultrasound',
        bg: 'rgba(6, 182, 212, 0.10)',
        color: '#06B6D4',
        borderColor: 'rgba(6, 182, 212, 0.25)',
      }
    case 'EKG':
      return {
        label: 'EKG',
        bg: 'rgba(139, 92, 246, 0.10)',
        color: '#8B5CF6',
        borderColor: 'rgba(139, 92, 246, 0.25)',
      }
    default:
      return {
        label: modality,
        bg: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
        borderColor: 'var(--border)',
      }
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
  // Try splitting by semicolons first, then newlines
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
  // If it contains periods followed by uppercase letters, split on those boundaries
  const sentences = text.split(/\.(?=\s+[A-Z])/).map((s) => s.trim()).filter(Boolean)
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
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid var(--border-light)`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        {/* Modality badge */}
        <span
          className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0 uppercase tracking-wide"
          style={{
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.borderColor}`,
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
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {formatDate(study.study_date)}
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
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
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Clinical Indication
              </p>
            </div>
            <p
              className="text-sm"
              style={{ color: 'var(--text-secondary)', lineHeight: '1.55' }}
            >
              {study.indication}
            </p>
          </div>
        )}

        {/* Findings */}
        {findings.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity
                size={14}
                strokeWidth={2}
                style={{ color: meta.color }}
              />
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: meta.color }}
              >
                Findings
              </p>
            </div>

            <div
              className="rounded-xl px-4 py-3.5"
              style={{
                background: meta.bg,
                border: `1px solid ${meta.borderColor}`,
              }}
            >
              {findings.length === 1 ? (
                <p
                  className="text-sm"
                  style={{
                    color: 'var(--text-primary)',
                    lineHeight: '1.6',
                  }}
                >
                  {findings[0]}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {findings.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex gap-2 text-sm"
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
                          background: meta.color,
                          opacity: 0.6,
                        }}
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
              className="flex items-center gap-1.5 w-full text-left"
              type="button"
            >
              <FileText
                size={14}
                strokeWidth={2}
                style={{ color: 'var(--text-muted)' }}
              />
              <p
                className="text-xs font-semibold uppercase tracking-wide flex-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Full Radiology Report
              </p>
              {reportExpanded ? (
                <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
              ) : (
                <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
              )}
            </button>

            {reportExpanded && (
              <div
                className="mt-2 rounded-xl px-4 py-3.5"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <p
                  className="text-sm whitespace-pre-wrap"
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

type ViewMode = 'reports' | 'pacs'

interface ImagingViewerClientProps {
  studies: ImagingStudy[]
}

export function ImagingViewerClient({ studies }: ImagingViewerClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('reports')
  const [uploaderOpen, setUploaderOpen] = useState(false)

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
          className="touch-target"
          style={{ color: 'var(--accent-sage)' }}
          aria-label="Back to Records"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Imaging
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {studies.length} {studies.length === 1 ? 'study' : 'studies'} on file
          </p>
        </div>

        {/* Upload button */}
        <button
          type="button"
          onClick={() => setUploaderOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
          style={{
            background: uploaderOpen
              ? 'rgba(107, 144, 128, 0.15)'
              : 'var(--bg-elevated)',
            color: uploaderOpen ? 'var(--accent-sage)' : 'var(--text-secondary)',
            border: `1px solid ${uploaderOpen ? 'rgba(107, 144, 128, 0.3)' : 'var(--border-light)'}`,
          }}
        >
          <Upload size={14} strokeWidth={2} />
          Upload
        </button>
      </div>

      {/* View toggle bar */}
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
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
          style={{
            background:
              viewMode === 'reports'
                ? 'rgba(107, 144, 128, 0.15)'
                : 'transparent',
            color:
              viewMode === 'reports'
                ? 'var(--accent-sage)'
                : 'var(--text-muted)',
            border:
              viewMode === 'reports'
                ? '1px solid rgba(107, 144, 128, 0.3)'
                : '1px solid transparent',
          }}
        >
          <FileText size={14} strokeWidth={2} />
          Reports
        </button>

        <button
          type="button"
          onClick={() => setViewMode('pacs')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
          style={{
            background:
              viewMode === 'pacs'
                ? 'rgba(91, 155, 213, 0.15)'
                : 'transparent',
            color:
              viewMode === 'pacs' ? '#5B9BD5' : 'var(--text-muted)',
            border:
              viewMode === 'pacs'
                ? '1px solid rgba(91, 155, 213, 0.3)'
                : '1px solid transparent',
          }}
        >
          <Monitor size={14} strokeWidth={2} />
          View PACS
        </button>
      </div>

      {/* Upload section (collapsible) */}
      {uploaderOpen && (
        <div className="px-4 pt-4">
          <ScanUploader
            onSuccess={() => {
              setUploaderOpen(false)
              // Reload to pick up the new study from the server component
              window.location.reload()
            }}
          />
        </div>
      )}

      {/* PACS Viewer (iframe) */}
      {viewMode === 'pacs' && (
        <div className="flex-1 flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
          <iframe
            src="/pacs.html"
            title="PACS DICOM Viewer"
            className="flex-1 w-full"
            style={{
              border: 'none',
              minHeight: 'calc(100vh - 120px)',
              background: '#000',
            }}
            allow="fullscreen"
          />
        </div>
      )}

      {/* Report View (card-based) */}
      {viewMode === 'reports' && (
        <>
          {studies.length > 0 ? (
            <div className="px-4 py-4 space-y-4">
              {/* Quick summary bar */}
              <div
                className="flex gap-2 flex-wrap"
                style={{ marginBottom: '4px' }}
              >
                {studies.map((s) => {
                  const m = modalityMeta(s.modality)
                  return (
                    <span
                      key={s.id}
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: m.bg,
                        color: m.color,
                        border: `1px solid ${m.borderColor}`,
                      }}
                    >
                      {m.label} - {formatShortDate(s.study_date)}
                    </span>
                  )
                })}
              </div>

              {/* Study cards */}
              {studies.map((study) => (
                <StudyCard key={study.id} study={study} />
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
              <FileText size={40} style={{ color: 'var(--text-muted)' }} />
              <p
                className="text-lg font-medium mt-3"
                style={{ color: 'var(--text-secondary)' }}
              >
                No imaging studies
              </p>
              <p
                className="text-sm mt-1 text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                Imaging reports will appear here once studies are added to your
                records.
              </p>
              <Link
                href="/records"
                className="mt-4 text-sm font-medium"
                style={{ color: 'var(--accent-sage)' }}
              >
                Back to Records
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
