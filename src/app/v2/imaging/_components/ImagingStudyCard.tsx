/*
 * ImagingStudyCard (v2 imaging)
 *
 * One card per imaging study. Renders the modality badge, body part
 * as the card title, the study date, the indication (if present),
 * and a 6-line preview of findings_summary. A "Read full report"
 * trailing button opens the report sheet; if report_text is null or
 * empty the button is disabled and relabeled "No full report".
 *
 * Findings preview logic: if findings_summary contains ';' or '\n',
 * split into bullet items so clinician-style shorthand reads as a
 * list. Otherwise render a single paragraph. Either way, the 6-line
 * clamp caps the preview via CSS (-webkit-line-clamp: 6).
 *
 * No 'use client' directive : rendered by ImagingClient (client),
 * so React will treat this as a client subtree at build time. Keeps
 * the card file free of hooks and lets it be reused server-side
 * later if we surface a single-study page.
 */
import { Button, Card } from '@/v2/components/primitives'
import type { ImagingStudy } from '@/lib/types'
import ImagingModalityBadge from './ImagingModalityBadge'

function formatDate(iso: string): string {
  // Parse as local so study_date (YYYY-MM-DD) doesn't shift by tz.
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Split findings into bullets when the radiologist used ';' or line
// breaks to separate points. Otherwise return a single-item array so
// the caller can render one paragraph. Mirrors the legacy splitter
// at src/components/imaging/ImagingViewerClient.tsx:65 without the
// sentence fallback (we only split on author-intent delimiters).
function splitFindings(text: string): string[] {
  if (text.includes(';')) {
    return text.split(';').map((s) => s.trim()).filter(Boolean)
  }
  if (text.includes('\n')) {
    return text.split('\n').map((s) => s.trim()).filter(Boolean)
  }
  return [text]
}

export interface ImagingStudyCardProps {
  study: ImagingStudy
  onOpenReport: (study: ImagingStudy) => void
}

export default function ImagingStudyCard({ study, onOpenReport }: ImagingStudyCardProps) {
  const findings = study.findings_summary ? splitFindings(study.findings_summary) : []
  const hasReport = !!study.report_text && study.report_text.trim().length > 0

  return (
    <Card>
      {/* Header : modality badge + body-part title + right-aligned date */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--v2-space-3)',
          marginBottom: findings.length > 0 || study.indication ? 'var(--v2-space-3)' : 0,
        }}
      >
        <ImagingModalityBadge modality={study.modality} />
        <h3
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontSize: 'var(--v2-text-lg)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            lineHeight: 'var(--v2-leading-tight)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {study.body_part}
        </h3>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {formatDate(study.study_date)}
        </span>
      </div>

      {study.indication && (
        <p
          style={{
            margin: '0 0 var(--v2-space-2) 0',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          <span style={{ color: 'var(--v2-text-muted)' }}>Indication: </span>
          {study.indication}
        </p>
      )}

      {findings.length > 0 && (
        <div
          style={{
            // 6-line clamp via -webkit-line-clamp. Full text lives in
            // the report sheet; this is preview-only on the card.
            display: '-webkit-box',
            WebkitLineClamp: 6,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-primary)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {findings.length > 1 ? (
            <ul style={{ margin: 0, paddingLeft: 'var(--v2-space-5)' }}>
              {findings.map((f, i) => (
                <li key={i} style={{ marginBottom: 'var(--v2-space-1)' }}>
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0 }}>{findings[0]}</p>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 'var(--v2-space-4)',
        }}
      >
        <Button
          variant="tertiary"
          onClick={() => onOpenReport(study)}
          disabled={!hasReport}
          aria-label={hasReport ? `Read full report for ${study.body_part}` : 'No full report'}
        >
          {hasReport ? 'Read full report' : 'No full report'}
        </Button>
      </div>
    </Card>
  )
}
