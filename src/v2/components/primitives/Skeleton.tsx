/*
 * Skeleton
 *
 * Placeholder shapes with a subtle shimmer. Three shapes cover
 * 90% of uses: text, circle (avatars / rings), rectangle (cards).
 */
import { CSSProperties } from 'react'

export type SkeletonShape = 'text' | 'circle' | 'rect'

export interface SkeletonProps {
  shape?: SkeletonShape
  width?: number | string
  height?: number | string
  className?: string
}

export default function Skeleton({ shape = 'rect', width, height, className }: SkeletonProps) {
  const w = width ?? (shape === 'text' ? '60%' : shape === 'circle' ? 40 : '100%')
  const h = height ?? (shape === 'text' ? 14 : shape === 'circle' ? 40 : 80)

  const style: CSSProperties = {
    width: w,
    height: h,
    borderRadius:
      shape === 'circle'
        ? 'var(--v2-radius-full)'
        : shape === 'text'
          ? 'var(--v2-radius-sm)'
          : 'var(--v2-radius-md)',
    background:
      'linear-gradient(90deg, var(--v2-bg-card) 0%, var(--v2-bg-elevated) 50%, var(--v2-bg-card) 100%)',
    backgroundSize: '200% 100%',
    animation: 'v2-skeleton-shimmer 1.6s var(--v2-ease-standard) infinite',
  }

  return (
    <>
      <span className={className} style={style} aria-hidden="true" />
      <style>{`
        @keyframes v2-skeleton-shimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </>
  )
}
