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
 * Severity vocabulary (post polish pass):
 *   - 'low' / 'high' : terracotta on a soft tint with a directional
 *     arrow glyph (down for low, up for high) so the pill reads at a
 *     glance even peripherally.
 *   - 'critical' : red accent on a stronger tint with a thin border so
 *     it visually pops above the warning rows. Critical is the only
 *     flag that crosses palettes (warning + danger), per Oura's
 *     observed two-step alert treatment.
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
  border?: string
  /** Optional directional glyph rendered before the label. */
  glyph?: string
}

const FLAG_STYLES: Record<Exclude<LabFlag, 'normal'>, FlagStyle> = {
  low: {
    label: 'Low',
    // Soft terracotta tint, directional down arrow for at-a-glance read.
    background: 'rgba(217, 119, 92, 0.16)',
    color: 'var(--v2-accent-warning)',
    glyph: '\u2193',
  },
  high: {
    label: 'High',
    background: 'rgba(217, 119, 92, 0.16)',
    color: 'var(--v2-accent-warning)',
    glyph: '\u2191',
  },
  critical: {
    label: 'Critical',
    // Critical jumps to the danger hue with a thin border so it pulls
    // the eye even in a dense list. Glyph dropped to keep the strong
    // word legible at small sizes.
    background: 'rgba(239, 93, 93, 0.18)',
    color: 'var(--v2-accent-danger)',
    border: '1px solid rgba(239, 93, 93, 0.45)',
  },
}

export default function AbnormalFlag({ flag }: AbnormalFlagProps) {
  if (!flag || flag === 'normal') return null
  const style = FLAG_STYLES[flag]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 11,
        fontWeight: 'var(--v2-weight-semibold)',
        lineHeight: 1,
        padding: '3px 6px',
        borderRadius: 4,
        background: style.background,
        color: style.color,
        border: style.border ?? '1px solid transparent',
        letterSpacing: 'var(--v2-tracking-wide)',
        textTransform: 'uppercase',
      }}
    >
      {style.glyph && (
        <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>
          {style.glyph}
        </span>
      )}
      {style.label}
    </span>
  )
}
