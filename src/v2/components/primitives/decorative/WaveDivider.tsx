'use client'

/*
 * WaveDivider
 *
 * Soft horizontal SVG wave used to separate sections inside long
 * pages. The wave shifts horizontally on a 12-second loop so the
 * surface feels alive without distracting the eye. The amplitude is
 * gentle (about 4px) and the stroke is sage at low alpha so it reads
 * as decoration, not a chart line.
 *
 * Reduced motion: the wave renders static.
 */
import { useReducedMotion } from 'motion/react'

export interface WaveDividerProps {
  /** Total width of the divider in CSS pixels (defaults 100% via SVG). */
  width?: number | string
  /** Height of the SVG box. Default 24. */
  height?: number
  /** Stroke color. Default sage at low alpha. */
  color?: string
}

export default function WaveDivider({
  width = '100%',
  height = 24,
  color = 'rgba(106, 207, 137, 0.35)',
}: WaveDividerProps) {
  const reduce = useReducedMotion()
  const wavePath = 'M0 12 Q 25 4 50 12 T 100 12 T 150 12 T 200 12'

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 24"
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden
      style={{ display: 'block' }}
    >
      <g>
        <path
          d={wavePath}
          stroke={color}
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        >
          {!reduce && (
            <animateTransform
              attributeName="transform"
              type="translate"
              from="0 0"
              to="-50 0"
              dur="12s"
              repeatCount="indefinite"
            />
          )}
        </path>
      </g>
    </svg>
  )
}
