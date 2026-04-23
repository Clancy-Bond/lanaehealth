'use client'

/*
 * ImagingReportSheet (v2 imaging)
 *
 * Bottom sheet that renders a study's full report_text for mobile
 * reading. The Sheet primitive already handles portal, scrim,
 * swipe-to-close, and internal scroll (maxHeight: 90vh, overflowY).
 *
 * Layout:
 *   - Title (modality + body part)
 *   - Subheader (study date + indication)
 *   - Full report_text in a monospace-feeling block with relaxed
 *     line-height so radiology reports stay readable.
 *   - Explicit Close button at the bottom for users who don't know
 *     the swipe-down gesture.
 *
 * Voice on the close button: short, kind. No em-dashes.
 */
import { Button, Sheet } from '@/v2/components/primitives'
import type { ImagingStudy } from '@/lib/types'
import ImagingModalityBadge from './ImagingModalityBadge'

function formatDate(iso: string): string {
  // Parse as local to avoid UTC shifting study_date back a day.
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export interface ImagingReportSheetProps {
  study: ImagingStudy | null
  open: boolean
  onClose: () => void
}

export default function ImagingReportSheet({ study, open, onClose }: ImagingReportSheetProps) {
  // Render a placeholder-free empty sheet if we somehow open without
  // a study selected. The Sheet primitive bails when !open anyway.
  if (!study) return null

  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
      <ImagingModalityBadge modality={study.modality} />
      <span>{study.body_part}</span>
    </span>
  )

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <div
          style={{
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(study.study_date)}</div>
          {study.indication && (
            <div style={{ marginTop: 'var(--v2-space-1)' }}>
              <span style={{ color: 'var(--v2-text-muted)' }}>Indication: </span>
              {study.indication}
            </div>
          )}
        </div>

        {study.report_text ? (
          <pre
            style={{
              margin: 0,
              padding: 'var(--v2-space-4)',
              background: 'var(--v2-bg-card)',
              border: '1px solid var(--v2-border-subtle)',
              borderRadius: 'var(--v2-radius-md)',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
              color: 'var(--v2-text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {study.report_text}
          </pre>
        ) : (
          <p
            style={{
              margin: 0,
              color: 'var(--v2-text-muted)',
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            No full report on file for this study.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--v2-space-2)' }}>
          <Button variant="secondary" onClick={onClose} aria-label="Close report">
            Close
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
