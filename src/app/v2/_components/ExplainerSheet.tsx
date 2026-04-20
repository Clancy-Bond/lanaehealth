'use client'

/**
 * ExplainerSheet
 *
 * The Oura "Sleep regularity" educational modal pattern, reused
 * across home metrics, sleep contributors, and cycle phases.
 *
 * Always renders on the NC cream explanatory palette because
 * educational surfaces are the one place we trade the dark chrome
 * for warm legibility. See tokens.css .v2-surface-explanatory.
 *
 * Usage shape:
 *   <ExplainerSheet open={open} onClose={...} title="Sleep score">
 *     <p>What Oura measures...</p>
 *     <p>What "Good" means for you...</p>
 *   </ExplainerSheet>
 *
 * Children are free-form React nodes so callers can embed lists,
 * emphasis, or a "Learn more" Button without constraint.
 */
import type { ReactNode } from 'react'
import { Sheet } from '@/v2/components/primitives'

export interface ExplainerSheetProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
}

export default function ExplainerSheet({ open, onClose, title, children }: ExplainerSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} explanatory title={title}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
          fontSize: 'var(--v2-text-sm)',
          lineHeight: 'var(--v2-leading-relaxed)',
          color: 'var(--v2-surface-explanatory-text)',
        }}
      >
        {children}
      </div>
    </Sheet>
  )
}
