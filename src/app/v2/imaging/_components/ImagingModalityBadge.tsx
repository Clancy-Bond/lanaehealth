/*
 * ImagingModalityBadge (v2 imaging)
 *
 * Small presentational pill shared between ImagingStudyCard and
 * ImagingReportSheet. Shows the 2-3 letter modality code (CT / XR /
 * MRI / US / EKG) with a muted per-modality ink color so studies
 * group visually at a glance without color-blocking the whole card.
 *
 * The pill sits on --v2-bg-elevated on dark chrome; only the label
 * color tints per modality. Tints are muted intentionally : the
 * goal is quick visual grouping, not emphasis.
 *
 * No --v2 token exists for "per-modality muted ink" so the tint map
 * below uses literal hex. Background and border stay on tokens.
 */
import type { CSSProperties } from 'react'
import type { ImagingModality } from '@/lib/types'

export interface ImagingModalityBadgeProps {
  modality: ImagingModality
  style?: CSSProperties
}

// Muted tints per modality. Kept low-saturation so they read as
// grouping signal on dark chrome, not as active/alert color.
const MODALITY_TINT: Record<ImagingModality, string> = {
  CT: '#7FBFB5',   // teal
  XR: '#8BB4D9',   // blue
  MRI: '#B295C9',  // plum
  US: '#E0A27D',   // orange
  EKG: '#D9C27A',  // gold
}

export default function ImagingModalityBadge({ modality, style }: ImagingModalityBadgeProps) {
  const tint = MODALITY_TINT[modality]
  return (
    <span
      aria-label={`Modality: ${modality}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 36,
        padding: '4px 8px',
        fontSize: 'var(--v2-text-xs)',
        fontWeight: 'var(--v2-weight-semibold)',
        letterSpacing: 'var(--v2-tracking-wide)',
        color: tint,
        background: 'var(--v2-bg-elevated)',
        border: '1px solid var(--v2-border-subtle)',
        borderRadius: 'var(--v2-radius-full)',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {modality}
    </span>
  )
}
