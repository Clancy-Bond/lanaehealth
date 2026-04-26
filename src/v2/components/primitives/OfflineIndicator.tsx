'use client'

/*
 * OfflineIndicator
 *
 * Subscribes to window 'online' / 'offline' events and renders a small
 * fixed banner at the top of the v2 shell so the reader knows their
 * device dropped the network. Two states:
 *
 *   - offline: persistent banner reading "You are offline. Showing your
 *     last view. New entries will sync when you are back online."
 *   - back-online flash: a brief "Back online, syncing." pill that
 *     auto-dismisses after 2.5s. The flash also pings the SW with
 *     'replay-log-queue' to drain any writes queued while offline.
 *
 * This component is purely additive: it does not change the shell layout
 * and never blocks taps. State is read via useSyncExternalStore from the
 * browser's online/offline events so we never call setState in an effect
 * body. The reconnect flash is timer-driven and updated only inside the
 * timeout callback (allowed by react-hooks/set-state-in-effect).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

type Status = 'online' | 'offline' | 'reconnecting'

const FLASH_MS = 2500

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
function getOnlineSnapshot() {
  return navigator.onLine
}
function getOnlineServerSnapshot() {
  // Assume online on the server; the indicator stays hidden until the
  // client has measured the real value.
  return true
}

export default function OfflineIndicator() {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot)
  // Flash is a boolean signal raised on the offline -> online edge by the
  // effect below, lowered by a setTimeout callback. setState only happens
  // inside microtasks / timer callbacks, never the effect body, which
  // satisfies react-hooks/set-state-in-effect.
  const [showFlash, setShowFlash] = useState(false)
  const prevOnlineRef = useRef<boolean>(isOnline)

  useEffect(() => {
    const wasOnline = prevOnlineRef.current
    prevOnlineRef.current = isOnline
    if (wasOnline === isOnline) return undefined
    if (!isOnline) {
      // Offline transition: cancel any pending flash from a prior cycle.
      queueMicrotask(() => setShowFlash(false))
      return undefined
    }
    // Online transition: drain SW queue, raise flash, schedule auto-hide.
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const ctrl = navigator.serviceWorker.controller
      if (ctrl) ctrl.postMessage({ type: 'replay-log-queue' })
    }
    queueMicrotask(() => setShowFlash(true))
    const id = window.setTimeout(() => setShowFlash(false), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [isOnline])

  const status: Status = !isOnline ? 'offline' : showFlash ? 'reconnecting' : 'online'

  if (status === 'online') return null

  const isOffline = status === 'offline'
  const accent = isOffline ? 'var(--v2-accent-warning)' : 'var(--v2-accent-success)'
  const message = isOffline
    ? 'You are offline. Showing your last view. New entries will sync when you are back online.'
    : 'Back online, syncing.'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-indicator"
      data-status={status}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        left: 12,
        right: 12,
        zIndex: 80,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 'var(--v2-radius-md, 12px)',
        background: 'rgba(31, 31, 37, 0.96)',
        border: `1px solid ${accent}`,
        color: 'var(--v2-text-primary)',
        fontSize: 13,
        lineHeight: 1.4,
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: accent,
          marginTop: 6,
          flex: '0 0 auto',
        }}
      />
      <span>{message}</span>
    </div>
  )
}
