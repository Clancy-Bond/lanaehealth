'use client'

/*
 * Button
 *
 * Oura pairs a filled pill for primary actions ("Get help",
 * "Learn more") with an outlined pill for secondary actions
 * ("Find my ring"). We capture both plus a text-only tertiary
 * and a destructive variant for deletes. Min height 44pt per
 * iOS HIG.
 */
import { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  leading?: ReactNode
  trailing?: ReactNode
}

const SIZE_STYLES: Record<ButtonSize, { minHeight: number; paddingX: string; fontSize: string }> = {
  sm: { minHeight: 36, paddingX: 'var(--v2-space-3)', fontSize: 'var(--v2-text-sm)' },
  md: { minHeight: 44, paddingX: 'var(--v2-space-5)', fontSize: 'var(--v2-text-base)' },
  lg: { minHeight: 52, paddingX: 'var(--v2-space-6)', fontSize: 'var(--v2-text-lg)' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  leading,
  trailing,
  children,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const s = SIZE_STYLES[size]
  const variantStyle: React.CSSProperties = {
    primary: {
      background: 'var(--v2-accent-primary)',
      color: 'var(--v2-on-accent)',
      border: '1px solid var(--v2-accent-primary)',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--v2-text-primary)',
      border: '1px solid var(--v2-border-strong)',
    },
    tertiary: {
      background: 'transparent',
      color: 'var(--v2-accent-primary)',
      border: '1px solid transparent',
    },
    destructive: {
      background: 'transparent',
      color: 'var(--v2-accent-danger)',
      border: '1px solid var(--v2-accent-danger)',
    },
  }[variant]

  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...variantStyle,
        minHeight: s.minHeight,
        padding: `0 ${s.paddingX}`,
        fontSize: s.fontSize,
        fontWeight: 'var(--v2-weight-semibold)',
        borderRadius: 'var(--v2-radius-full)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--v2-space-2)',
        width: fullWidth ? '100%' : 'auto',
        transition: 'transform var(--v2-duration-fast) var(--v2-ease-standard), opacity var(--v2-duration-fast) var(--v2-ease-standard), background var(--v2-duration-fast) var(--v2-ease-standard)',
        fontFamily: 'inherit',
        ...style,
      }}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  )
}
