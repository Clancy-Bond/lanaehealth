/*
 * MetricRing
 *
 * Oura's signature circular progress ring. We mirror the Readiness
 * ring proportions observed on frame_0001.png: a 10-12% stroke
 * relative to diameter, rounded caps, dimmed track, and a large
 * centered number + tiny caption.
 */
import { ReactNode } from 'react'

export type MetricRingSize = 'sm' | 'md' | 'lg'

export interface MetricRingProps {
  /** 0-100. Clamped. */
  value: number
  label?: string
  /** Big number at center. Defaults to the value. */
  displayValue?: ReactNode
  /** Colored ring stroke; use a v2-ring-* or v2-accent-* token. */
  color?: string
  size?: MetricRingSize
}

const SIZE_MAP: Record<MetricRingSize, { d: number; stroke: number; fontBig: string; fontLabel: string }> = {
  sm: { d: 56, stroke: 6, fontBig: 'var(--v2-text-lg)', fontLabel: 'var(--v2-text-xs)' },
  md: { d: 96, stroke: 10, fontBig: 'var(--v2-text-2xl)', fontLabel: 'var(--v2-text-sm)' },
  lg: { d: 168, stroke: 16, fontBig: 'var(--v2-text-3xl)', fontLabel: 'var(--v2-text-base)' },
}

export default function MetricRing({
  value,
  label,
  displayValue,
  color = 'var(--v2-accent-primary)',
  size = 'md',
}: MetricRingProps) {
  const { d, stroke, fontBig, fontLabel } = SIZE_MAP[size]
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (d - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div
      style={{
        width: d,
        height: d,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={d / 2} cy={d / 2} r={radius} stroke="var(--v2-border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={d / 2}
          cy={d / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset var(--v2-duration-slow) var(--v2-ease-emphasized)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          color: 'var(--v2-text-primary)',
        }}
      >
        <span style={{ fontSize: fontBig, fontWeight: 'var(--v2-weight-medium)', lineHeight: 1, letterSpacing: 'var(--v2-tracking-tight)' }}>
          {displayValue ?? Math.round(clamped)}
        </span>
        {label && (
          <span style={{ fontSize: fontLabel, color: 'var(--v2-text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--v2-tracking-wide)' }}>
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
