/*
 * ProgressBar
 *
 * Horizontal progress primitive with no-shame overflow treatment:
 * when `value > max`, the filled portion caps at 100% and a soft
 * tinted segment extends past the 100% mark, sized proportionally
 * to the overflow magnitude up to a 35% visual cap. The cap keeps
 * the segment from running far past mobile viewports while still
 * giving small overflows their proportional visual weight. Callers
 * are expected to surface exact magnitude in adjacent text (e.g.
 * "+40 g"). Keeps the visual kind (no angry red spike). The host
 * element does not clip overflow, so callers should leave a little
 * room to the right of the bar.
 *
 * Callers: v2 calories dashboard (macros row), calories plan
 * (calorie + macro target editors). Added as foundation after
 * Session 02 validated the pattern across multiple surfaces.
 */

export interface ProgressBarProps {
  value: number
  max: number
  color?: string
  overflowColor?: string
  intent?: 'default' | 'warning' | 'success'
  showLabel?: boolean
  ariaLabel?: string
}

export default function ProgressBar({
  value,
  max,
  color,
  overflowColor,
  intent = 'default',
  showLabel = false,
  ariaLabel,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const raw = value / safeMax
  const filled = Math.max(0, Math.min(1, raw))
  const overflow = raw > 1 ? raw - 1 : 0
  const overflowVisual = Math.min(overflow, 0.35)

  const filledColor =
    color ??
    (intent === 'warning'
      ? 'var(--v2-accent-warning)'
      : intent === 'success'
        ? 'var(--v2-accent-success)'
        : 'var(--v2-accent-primary)')
  const softOverflow = overflowColor ?? 'var(--v2-accent-warning)'

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(Math.max(value, max))}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: '100%',
        height: 8,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--v2-border)',
          borderRadius: 'var(--v2-radius-full)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${filled * 100}%`,
          background: filledColor,
          borderRadius: 'var(--v2-radius-full)',
          transition:
            'width var(--v2-duration-medium) var(--v2-ease-standard)',
        }}
      />
      {overflowVisual > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: '100%',
            height: '100%',
            width: `${overflowVisual * 100}%`,
            background: softOverflow,
            opacity: 0.35,
            boxShadow: `inset 0 0 0 1px ${softOverflow}`,
            borderRadius: '0 var(--v2-radius-full) var(--v2-radius-full) 0',
            transition:
              'width var(--v2-duration-medium) var(--v2-ease-standard)',
          }}
        />
      )}
      {showLabel && (
        <span
          style={{
            position: 'absolute',
            right: 'var(--v2-space-2)',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round((value / safeMax) * 100)}%
        </span>
      )}
    </div>
  )
}
