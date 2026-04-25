/*
 * SectionHeading
 *
 * Shared section title used across the insurance navigator pages.
 * Keeps the typography choice in one place so all five surfaces
 * look like one feature. Pure server component.
 */
import type { ReactNode } from 'react'

export interface SectionHeadingProps {
  level: 'h2' | 'h3'
  children: ReactNode
}

export default function SectionHeading({ level, children }: SectionHeadingProps) {
  const Tag = level
  const fontSize = level === 'h2' ? 'var(--v2-text-lg)' : 'var(--v2-text-base)'
  return (
    <Tag
      style={{
        fontSize,
        fontWeight: 'var(--v2-weight-semibold)',
        color: 'var(--v2-text-primary)',
        margin: 0,
        marginBottom: 'var(--v2-space-2)',
        lineHeight: 'var(--v2-leading-normal)',
      }}
    >
      {children}
    </Tag>
  )
}
