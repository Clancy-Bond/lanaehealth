'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Monitor, AlertCircle } from 'lucide-react'
import type { ImagingStudy, ImagingModality } from '@/lib/types'

const PACS_URL = 'http://localhost:3003/pacs.html'

function modalityLabel(modality: ImagingModality): string {
  switch (modality) {
    case 'CT': return 'CT Scan'
    case 'XR': return 'X-Ray'
    case 'MRI': return 'MRI'
    case 'US': return 'Ultrasound'
    default: return modality
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

interface ImagingViewerClientProps {
  studies: ImagingStudy[]
}

export function ImagingViewerClient({ studies }: ImagingViewerClientProps) {
  const searchParams = useSearchParams()
  const studyParam = searchParams.get('study')

  const [selectedStudyId, setSelectedStudyId] = useState<string>(
    studyParam || (studies.length > 0 ? studies[0].id : '')
  )
  const [pacsAvailable, setPacsAvailable] = useState<boolean | null>(null)

  const selectedStudy = studies.find((s) => s.id === selectedStudyId) || null

  // Check if PACS server is reachable
  useEffect(() => {
    const checkPacs = async () => {
      try {
        const response = await fetch(PACS_URL, { method: 'HEAD', mode: 'no-cors' })
        // no-cors means opaque response, but if it does not throw, the server is up
        setPacsAvailable(true)
      } catch {
        setPacsAvailable(false)
      }
    }
    checkPacs()
  }, [])

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-light)',
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
            Imaging Viewer
          </h1>
        </div>
        <Monitor size={20} style={{ color: 'var(--text-muted)' }} />
      </div>

      {/* Study selector */}
      {studies.length > 0 && (
        <div
          className="px-4 py-3"
          style={{
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <label
            htmlFor="study-select"
            className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Select Study
          </label>
          <select
            id="study-select"
            value={selectedStudyId}
            onChange={(e) => setSelectedStudyId(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: '36px',
            }}
          >
            {studies.map((study) => (
              <option key={study.id} value={study.id}>
                {modalityLabel(study.modality)} - {study.body_part} ({formatDate(study.study_date)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* PACS Viewer iframe */}
      <div className="flex-1 relative" style={{ background: '#000' }}>
        {pacsAvailable === false && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
            style={{ background: 'rgba(0, 0, 0, 0.85)' }}
          >
            <AlertCircle size={32} style={{ color: '#F97316' }} />
            <p className="text-sm font-medium text-white text-center px-6">
              PACS imaging server is not running
            </p>
            <p
              className="text-xs text-center px-8"
              style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}
            >
              Start the PACS viewer server on port 3003 to view imaging studies.
              Run the server from the ct_web_viewer directory.
            </p>
          </div>
        )}

        <iframe
          src={PACS_URL}
          title="PACS Radiology Viewer"
          className="w-full border-0"
          style={{
            height: 'calc(100vh - 200px)',
            minHeight: '400px',
          }}
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>

      {/* Study details panel */}
      {selectedStudy && (
        <div
          className="px-4 py-4 space-y-3"
          style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-light)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(91, 155, 213, 0.12)',
                color: '#5B9BD5',
              }}
            >
              {modalityLabel(selectedStudy.modality)}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {selectedStudy.body_part}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatDate(selectedStudy.study_date)}
            </span>
          </div>

          {selectedStudy.indication && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Indication
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {selectedStudy.indication}
              </p>
            </div>
          )}

          {selectedStudy.findings_summary && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Findings Summary
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {selectedStudy.findings_summary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {studies.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <Monitor size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium mt-3" style={{ color: 'var(--text-secondary)' }}>
            No imaging studies
          </p>
          <p className="text-sm mt-1 text-center" style={{ color: 'var(--text-muted)' }}>
            Imaging studies will appear here once added to your records.
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
    </div>
  )
}
