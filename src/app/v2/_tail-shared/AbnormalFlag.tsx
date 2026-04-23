/*
 * AbnormalFlag
 *
 * Small pill-shaped badge that surfaces a single lab flag value. Used
 * beside a lab value on both /v2/labs and /v2/records so the "pay
 * attention" signal reads the same everywhere.
 *
 * Renders nothing for 'normal' or nullish flags : noise stays out of
 * the list when the row is fine.
 *
 * Intensity maps to the v2 warning palette:
 *   - 'low'      : low-alpha warning, "Low"
 *   - 'high'     : low-alpha warning, "High"
 *   - 'critical' : higher-alpha warning, "Critical"
 *
 * Shared across Session 05 weekly-tail routes. See ./README.md for the
 * promotion policy.
 */
import type { LabFlag } from '@/lib/types'

export interface AbnormalFlagProps {
  flag: LabFlag | null | undefined
}

interface FlagStyle {
  label: string
  background: string
  color: string
}

const FLAG_STYLES: Record<Exclude<LabFlag, 'normal'>, FlagStyle> = {
  low: {
    label: 'Low',
    // --v2-accent-warning at low alpha; rgba used so the token's intent
    // still shines through on dark chrome.
    background: 'rgba(217, 119, 92, 0.18)',
    color: 'var(--v2-accent-warning)',
  },
  high: {
    label: 'High',
    background: 'rgba(217, 119, 92, 0.18)',
    color: 'var(--v2-accent-warning)',
  },
  critical: {
    label: 'Critical',
    // Stronger alpha conveys the heavier severity without jumping to a
    // separate accent token : the v2 palette only defines one warning
    // hue, and intensity is the legible signal.
    background: 'rgba(217, 119, 92, 0.32)',
    color: 'var(--v2-accent-warning)',
  },
}

export default function AbnormalFlag({ flag }: AbnormalFlagProps) {
  if (!flag || flag === 'normal') return null
  const style = FLAG_STYLES[flag]
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 'var(--v2-weight-semibold)',
        lineHeight: 1,
        padding: '3px 6px',
        borderRadius: 4,
        background: style.background,
        color: style.color,
        letterSpacing: 'var(--v2-tracking-wide)',
        textTransform: 'uppercase',
      }}
    >
      {style.label}
    </span>
  )
}
