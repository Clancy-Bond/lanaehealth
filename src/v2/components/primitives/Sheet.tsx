'use client'

/*
 * Sheet
 *
 * iOS-standard bottom sheet. Mount as a portal at the document body
 * so it's not clipped by parent transforms. The backdrop is a soft
 * scrim; tap-outside dismisses.
 *
 * Motion: backdrop fades in, sheet springs up from the bottom with
 * a tiny overshoot (iOS feel). On close the sheet slides down and
 * the backdrop fades out. AnimatePresence handles the exit.
 *
 * Reduced motion: backdrop snaps in/out, sheet snaps in/out.
 */
import { ReactNode, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

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
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const titleId = useId()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Escape-to-dismiss matches every other modal primitive in the
    // app and lets keyboard / screen-reader users close the sheet
    // without needing to find the explicit Got it button.
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!mounted || typeof window === 'undefined') return null

  const sheetTransition = reduce
    ? { duration: 0.001 }
    : { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.9 }
  const backdropTransition = reduce ? { duration: 0.001 } : { duration: 0.22, ease: 'easeOut' as const }

  return createPortal(
    <AnimatePresence>
      {open && (
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.55)',
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            onClick={(e) => e.stopPropagation()}
            className={explanatory ? 'v2-surface-explanatory' : ''}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetTransition}
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
                id={titleId}
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
