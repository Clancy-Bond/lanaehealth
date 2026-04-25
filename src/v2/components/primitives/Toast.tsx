'use client'

/*
 * Toast
 *
 * Lightweight ephemeral notification with swipe-to-dismiss. Renders
 * in the bottom-center of the viewport above the safe-area inset and
 * auto-hides after a timeout. The user can flick the toast left or
 * right with a touch drag to dismiss it before the timer fires.
 *
 * Why this primitive: previously v2 had no toast surface, so save
 * confirmations either lived in inline text or relied on full-page
 * navigation. A discreet toast is the right place for "Saved" or
 * "Could not save" microcopy without forcing layout reflow.
 *
 * Reduced motion: the toast still renders, but the entry/exit is a
 * snap-to-place opacity transition with no slide or rubber-band, and
 * swipe-drag follows the finger but does not spring back; it just
 * commits or releases on touch-end.
 */
import { ReactNode, useEffect } from 'react'
import { motion, useMotionValue, useReducedMotion, useTransform, AnimatePresence } from 'motion/react'

export type ToastIntent = 'success' | 'warning' | 'info'

export interface ToastProps {
  /** When true, the toast is visible. Set false to dismiss. */
  open: boolean
  /** Called when the toast dismisses (swipe or auto-hide). */
  onClose: () => void
  /** Toast body. Keep it short; this is not a dialog. */
  children: ReactNode
  /** Auto-dismiss in ms. Default 3500. Pass 0 to disable. */
  duration?: number
  intent?: ToastIntent
}

const INTENT_COLOR: Record<ToastIntent, string> = {
  success: 'var(--v2-accent-success)',
  warning: 'var(--v2-accent-warning)',
  info: 'var(--v2-accent-primary)',
}

export default function Toast({
  open,
  onClose,
  children,
  duration = 3500,
  intent = 'success',
}: ToastProps) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-200, -120, 0, 120, 200], [0, 0.4, 1, 0.4, 0])

  // Auto-hide. Reset the timer every time the toast (re)opens.
  useEffect(() => {
    if (!open || duration <= 0) return
    const handle = setTimeout(onClose, duration)
    return () => clearTimeout(handle)
  }, [open, duration, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={reduce ? 0 : 0.6}
          style={{ x, opacity }}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 500) {
              onClose()
            }
          }}
        >
          <div
            style={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: `calc(var(--v2-tabbar-height) + var(--v2-safe-bottom) + var(--v2-space-4))`,
              zIndex: 60,
              minWidth: 200,
              maxWidth: 'min(420px, calc(100vw - 32px))',
              padding: 'var(--v2-space-3) var(--v2-space-4)',
              background: 'rgba(17, 17, 20, 0.92)',
              color: 'var(--v2-text-primary)',
              borderRadius: 'var(--v2-radius-lg)',
              border: `1px solid ${INTENT_COLOR[intent]}`,
              boxShadow: 'var(--v2-shadow-lg)',
              backdropFilter: 'blur(16px) saturate(140%)',
              WebkitBackdropFilter: 'blur(16px) saturate(140%)',
              fontSize: 'var(--v2-text-sm)',
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-2)' }}>
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: INTENT_COLOR[intent],
                  flex: '0 0 auto',
                }}
              />
              <span style={{ flex: '1 1 auto' }}>{children}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
