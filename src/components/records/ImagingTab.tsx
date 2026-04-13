'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Monitor } from 'lucide-react'
import type { ImagingStudy, ImagingModality } from '@/lib/types'

function modalityBadge(modality: ImagingModality): { label: string; bg: string; color: string } {
  switch (modality) {
    case 'CT':
      return { label: 'CT Scan', bg: 'rgba(91, 155, 213, 0.12)', color: '#5B9BD5' }
    case 'XR':
      return { label: 'X-Ray', bg: 'rgba(107, 144, 128, 0.12)', color: 'var(--accent-sage)' }
    case 'MRI':
      return { label: 'MRI', bg: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6' }
    case 'US':
      return { label: 'Ultrasound', bg: 'rgba(6, 182, 212, 0.12)', color: '#06B6D4' }
    default:
      return { label: modality, bg: 'var(--bg-elevated)', color: 'var(--text-secondary)' }
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

interface ImagingTabProps {
  studies: ImagingStudy[]
}

export function ImagingTab({ studies }: ImagingTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (studies.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          No imaging studies yet
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Imaging records will appear here once added
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {studies.map((study) => {
        const badge = modalityBadge(study.modality)
        const isExpanded = expandedId === study.id

        return (
          <button
            key={study.id}
            onClick={() => toggle(study.id)}
            className="card w-full text-left p-4 transition-shadow"
            style={{
              boxShadow: isExpanded ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center gap-3">
              {/* Modality badge */}
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={{ background: badge.bg, color: badge.color }}
              >
                {badge.label}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {study.body_part}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(study.study_date)}
                </p>
              </div>

              {/* Chevron */}
              <svg
                className="w-4 h-4 shrink-0 transition-transform"
                style={{
                  color: 'var(--text-muted)',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mt-4 space-y-3" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                {study.indication && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Indication
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      {study.indication}
                    </p>
                  </div>
                )}

                {study.findings_summary && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Findings Summary
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      {study.findings_summary}
                    </p>
                  </div>
                )}

                {study.report_text && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Full Report
                    </p>
                    <p
                      className="text-sm mt-0.5 whitespace-pre-wrap"
                      style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}
                    >
                      {study.report_text}
                    </p>
                  </div>
                )}

                {/* View in PACS button */}
                <Link
                  href={`/imaging?study=${study.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-shadow"
                  style={{
                    background: 'var(--accent-sage-muted)',
                    color: 'var(--accent-sage)',
                    border: '1px solid rgba(107, 144, 128, 0.2)',
                  }}
                >
                  <Monitor size={16} strokeWidth={2} />
                  View in PACS Viewer
                </Link>

                <p className="text-xs mt-1 text-center" style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  PACS viewer requires the local imaging server to be running.
                </p>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
