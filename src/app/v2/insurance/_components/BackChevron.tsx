/*
 * BackChevron
 *
 * Standard left-aligned back affordance for /v2/insurance/* pages.
 * Mirrors the chevron used in /v2/topics/orthostatic so the
 * navigation gesture is consistent across the v2 surface. Pure
 * server component, no client JS.
 */
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export interface BackChevronProps {
  href: string
  label: string
}

export default function BackChevron({ href, label }: BackChevronProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      style={{
        color: 'var(--v2-text-secondary)',
        padding: 'var(--v2-space-2)',
        textDecoration: 'none',
        minHeight: 'var(--v2-touch-target-min)',
        minWidth: 'var(--v2-touch-target-min)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  )
}
