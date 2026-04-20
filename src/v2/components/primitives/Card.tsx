/*
 * Card
 *
 * Oura's card surface is nearly flat : no shadow, just a tiny
 * bg lift from --v2-bg-card. Hairline divider border only when
 * the card adjoins dense content.
 *
 * Variant `explanatory` inverts to NC's cream/white surface for
 * educational content, consistent with CLAUDE.md's Warm Modern
 * palette.
 */
import { HTMLAttributes, ReactNode } from 'react'

export type CardVariant = 'default' | 'explanatory' | 'elevated'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  children?: ReactNode
}

const PADDING_MAP: Record<CardPadding, string> = {
  none: '0',
  sm: 'var(--v2-space-3)',
  md: 'var(--v2-space-4)',
  lg: 'var(--v2-space-5)',
}

export default function Card({
  variant = 'default',
  padding = 'md',
  children,
  style,
  className = '',
  ...rest
}: CardProps) {
  const variantStyle: React.CSSProperties =
    variant === 'explanatory'
      ? {
          background: 'var(--v2-surface-explanatory-card)',
          color: 'var(--v2-surface-explanatory-text)',
          border: '1px solid var(--v2-surface-explanatory-border)',
          boxShadow: 'var(--v2-shadow-explanatory-sm)',
        }
      : variant === 'elevated'
        ? {
            background: 'var(--v2-bg-elevated)',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-subtle)',
            boxShadow: 'var(--v2-shadow-md)',
          }
        : {
            background: 'var(--v2-bg-card)',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-subtle)',
          }

  return (
    <div
      className={`v2-card ${className}`.trim()}
      style={{
        ...variantStyle,
        padding: PADDING_MAP[padding],
        borderRadius: 'var(--v2-radius-lg)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
