/*
 * ProgressBar
 *
 * Horizontal progress primitive with no-shame overflow treatment:
 * when `value > max`, the filled portion caps at 100% and overflow
 * renders as a softer tint layered over the track. Keeps the visual
 * kind (no angry red spike) while still communicating "past target."
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
  const overflow = raw > 1 ? Math.min(1, raw - 1) : 0

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
      aria-valuemax={Math.round(max)}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: '100%',
        height: 8,
        borderRadius: 'var(--v2-radius-full)',
        background: 'var(--v2-border)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${filled * 100}%`,
          background: filledColor,
          borderRadius: 'var(--v2-radius-full)',
          transition:
            'width var(--v2-duration-medium) var(--v2-ease-standard)',
        }}
      />
      {overflow > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            opacity: 0.35,
            background: softOverflow,
            borderRadius: 'var(--v2-radius-full)',
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
