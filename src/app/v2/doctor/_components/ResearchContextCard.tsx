'use client'

import { useState } from 'react'
import { Card, Button } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import type { ResearchPayload, ResearchStudy, EvidenceGrade } from '@/lib/doctor/kb-research'

interface ResearchContextCardProps {
  payload: ResearchPayload | null
}

function gradeColor(g: EvidenceGrade): string {
  if (g === 'A' || g === 'B') return 'var(--v2-accent-success)'
  if (g === 'C') return 'var(--v2-accent-highlight)'
  if (g === 'D' || g === 'E' || g === 'F') return 'var(--v2-accent-warning)'
  return 'var(--v2-text-muted)'
}

function supportLabel(s: ResearchStudy['supports']): string {
  if (s === 'for') return 'Supports'
  if (s === 'against') return 'Cuts against'
  return 'Mixed'
}

/*
 * ResearchContextCard
 *
 * External studies that touch the active hypotheses, ranked by
 * evidence grade. Opens with the top 3 visible; rest collapse behind
 * a "more" toggle so research doesn't crowd the primary brief.
 * Respects the "no accordions that hide clinical data" rule because
 * this is background reference material, not primary findings.
 */
export default function ResearchContextCard({ payload }: ResearchContextCardProps) {
  const [expanded, setExpanded] = useState(false)
  if (!payload || payload.studies.length === 0) return null
  const top = expanded ? payload.studies : payload.studies.slice(0, 3)
  const hidden = Math.max(0, payload.studies.length - 3)
  const topGrades = payload.studies.filter((s) => s.evidenceGrade === 'A' || s.evidenceGrade === 'B').length
  const summary =
    topGrades > 0
      ? `${topGrades} grade-A/B stud${topGrades === 1 ? 'y' : 'ies'} cited`
      : `${payload.studies.length} stud${payload.studies.length === 1 ? 'y' : 'ies'} flagged`

  return (
    <Card padding="md">
      <DoctorPanelHeader
        title="Research context"
        summary={summary}
        trailing={
          payload.stale ? (
            <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontStyle: 'italic' }}>
              stale
            </span>
          ) : undefined
        }
      />
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        {top.map((s, i) => (
          <li
            key={`${s.title}-${i}`}
            style={{
              padding: 'var(--v2-space-2) 0',
              borderBottom: i < top.length - 1 ? '1px solid var(--v2-border-subtle)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--v2-space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-primary)',
                }}
              >
                {s.title}
              </span>
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: gradeColor(s.evidenceGrade),
                  fontWeight: 'var(--v2-weight-semibold)',
                  whiteSpace: 'nowrap',
                }}
              >
                Grade {s.evidenceGrade}
              </span>
            </div>
            <div
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                marginTop: 2,
              }}
            >
              {s.type} · {s.sample} · {s.journal}
            </div>
            <p
              style={{
                margin: 'var(--v2-space-2) 0 0 0',
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-normal)',
              }}
            >
              <strong style={{ color: 'var(--v2-text-primary)' }}>{supportLabel(s.supports)}:</strong>{' '}
              {s.impact}
            </p>
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <div style={{ marginTop: 'var(--v2-space-3)', display: 'flex', justifyContent: 'flex-start' }}>
          <Button variant="tertiary" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show fewer' : `Show ${hidden} more`}
          </Button>
        </div>
      )}
    </Card>
  )
}
