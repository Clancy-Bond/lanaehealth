'use client'

/*
 * Sheet
 *
 * iOS-standard bottom sheet. Mount as a portal at the document body
 * so it's not clipped by parent transforms. The backdrop is a soft
 * scrim; tap-outside dismisses.
 *
 * Phase 0 ships a two-state sheet (open / closed). Snap-points are
 * declared in the API but the drag handle is non-interactive for
 * now; the 5 parallel sessions can bolt on gesture handling.
 */
import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Declarative snap points (e.g. [0.4, 0.9]). Currently informational. */
  snapPoints?: number[]
  /** Render into light explanatory palette. */
  explanatory?: boolean
}

export default function Sheet({ open, onClose, title, children, explanatory }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof window === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          animation: 'v2-sheet-fade var(--v2-duration-medium) var(--v2-ease-standard)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={explanatory ? 'v2-surface-explanatory' : ''}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: explanatory ? 'var(--v2-surface-explanatory-bg)' : 'var(--v2-bg-elevated)',
          color: explanatory ? 'var(--v2-surface-explanatory-text)' : 'var(--v2-text-primary)',
          borderTopLeftRadius: 'var(--v2-radius-xl)',
          borderTopRightRadius: 'var(--v2-radius-xl)',
          paddingBottom: 'var(--v2-safe-bottom)',
          boxShadow: 'var(--v2-shadow-lg)',
          animation: 'v2-sheet-rise var(--v2-duration-medium) var(--v2-ease-emphasized)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--v2-space-2)' }}>
          <span
            style={{
              width: 36,
              height: 4,
              borderRadius: 'var(--v2-radius-full)',
              background: explanatory ? 'var(--v2-surface-explanatory-border)' : 'var(--v2-border-strong)',
            }}
          />
        </div>
        {title && (
          <h2
            style={{
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              margin: 0,
              padding: `0 var(--v2-space-5) var(--v2-space-3)`,
            }}
          >
            {title}
          </h2>
        )}
        <div style={{ padding: `0 var(--v2-space-5) var(--v2-space-5)` }}>{children}</div>
      </div>
      <style>{`
        @keyframes v2-sheet-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes v2-sheet-rise { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>,
    document.body,
  )
}
