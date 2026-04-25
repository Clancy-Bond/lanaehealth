'use client'

/*
 * PullToRefresh
 *
 * iOS-style pull-to-refresh wrapper. The user pulls the page down
 * past a threshold; we fire `onRefresh` and show a small spinner
 * over the content while it resolves. After that the page snaps
 * back up.
 *
 * Touch-only. Mouse-drag is intentionally not supported : on
 * desktop the user can hit Cmd-R or use any in-page refresh button.
 *
 * Reduced motion: the pull indicator does not bounce; it appears
 * and disappears instantly. The actual refresh callback still fires
 * normally so the data still updates.
 */
import { ReactNode, TouchEvent, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useReducedMotion } from 'motion/react'

export interface PullToRefreshProps {
  /** Async callback fired once the user crosses the pull threshold. */
  onRefresh: () => Promise<void> | void
  children: ReactNode
  /** Pixels of pull required to trigger refresh. Default 80. */
  threshold?: number
}

export default function PullToRefresh({ onRefresh, children, threshold = 80 }: PullToRefreshProps) {
  const reduce = useReducedMotion()
  const startY = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const handleStart = (e: TouchEvent) => {
    if (window.scrollY > 0) {
      startY.current = null
      return
    }
    startY.current = e.touches[0].clientY
  }

  const handleMove = (e: TouchEvent) => {
    if (startY.current == null || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) return
    setPull(Math.min(threshold * 1.4, dy * 0.5))
  }

  const handleEnd = async () => {
    if (startY.current == null) return
    if (pull >= threshold && !refreshing) {
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    }
    startY.current = null
    setPull(0)
  }

  const indicatorOpacity = refreshing ? 1 : Math.min(1, pull / threshold)
  const indicatorOffset = refreshing ? 28 : Math.max(0, pull - 12)
  const transition = reduce ? 'none' : 'transform 220ms var(--v2-ease-emphasized), opacity 160ms ease-out'

  return (
    <div
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      style={{ position: 'relative', minHeight: '100%' }}
    >
      <div
        aria-hidden={!refreshing}
        role={refreshing ? 'status' : undefined}
        aria-live={refreshing ? 'polite' : undefined}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: `translate(-50%, ${indicatorOffset}px)`,
          opacity: indicatorOpacity,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--v2-space-2)',
          padding: '6px 14px',
          borderRadius: 'var(--v2-radius-full)',
          background: 'rgba(17,17,20,0.85)',
          color: 'var(--v2-text-primary)',
          fontSize: 'var(--v2-text-xs)',
          letterSpacing: 'var(--v2-tracking-wide)',
          textTransform: 'uppercase',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--v2-border-subtle)',
          transition,
          zIndex: 5,
        }}
      >
        <Loader2
          size={14}
          style={{
            animation: refreshing && !reduce ? 'v2-ptr-spin 1s linear infinite' : 'none',
          }}
          aria-hidden
        />
        <span>{refreshing ? 'Refreshing' : pull >= threshold ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>
      <style>{`@keyframes v2-ptr-spin { to { transform: rotate(360deg); } }`}</style>
      {children}
    </div>
  )
}
