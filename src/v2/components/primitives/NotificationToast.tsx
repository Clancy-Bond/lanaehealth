'use client'

/*
 * NotificationToast
 *
 * In-app surface for the bubble-up system. Polls
 * /api/v2/notifications/pending every 30s for unread entries from
 * notification_log. When an item is found, renders a top-anchored
 * toast with the title + body. Tap navigates to the item URL and
 * marks it read; the dismiss button only marks it read.
 *
 * Why poll instead of websocket: this app has no websocket layer,
 * the data volume is at most a handful of entries per day, and the
 * service worker push handler already takes care of out-of-app
 * delivery. Polling keeps the in-app surface honest without
 * standing up new infra.
 *
 * Reduced-motion: the toast skips slide animation; it just fades.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

const POLL_INTERVAL_MS = 30_000

interface PendingItem {
  id: string
  notification_key: string
  category: string
  title: string
  body: string
  url: string | null
  sent_at: string
}

async function fetchPending(): Promise<PendingItem[]> {
  try {
    const res = await fetch('/api/v2/notifications/pending', { cache: 'no-store' })
    if (!res.ok) return []
    const body = (await res.json()) as { items?: PendingItem[] }
    return body.items ?? []
  } catch {
    return []
  }
}

async function markRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  try {
    await fetch('/api/v2/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  } catch {}
}

export default function NotificationToast() {
  const [items, setItems] = useState<PendingItem[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const reduce = useReducedMotion()

  // Poll on mount and every 30s while the tab is visible.
  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      const next = await fetchPending()
      if (!cancelled) setItems(next)
    }

    tick()
    const handle = window.setInterval(tick, POLL_INTERVAL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      window.clearInterval(handle)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const visible = useMemo(() => items.find((i) => !dismissed.has(i.id)) ?? null, [items, dismissed])

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
    void markRead([id])
  }, [])

  const open = useCallback((item: PendingItem) => {
    setDismissed((prev) => new Set(prev).add(item.id))
    void markRead([item.id])
    if (item.url) window.location.assign(item.url)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={visible.id}
          role="status"
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            left: 'var(--v2-space-3)',
            right: 'var(--v2-space-3)',
            zIndex: 90,
            background: 'var(--v2-bg-elevated)',
            color: 'var(--v2-text-primary)',
            border: '1px solid var(--v2-border-subtle)',
            borderRadius: 'var(--v2-radius-lg)',
            boxShadow: 'var(--v2-shadow-lg)',
            padding: 'var(--v2-space-3)',
            display: 'flex',
            gap: 'var(--v2-space-3)',
            alignItems: 'flex-start',
          }}
        >
          <button
            type="button"
            onClick={() => open(visible)}
            data-testid="notification-toast-open"
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 'var(--v2-weight-semibold)', fontSize: 'var(--v2-text-base)' }}>
              {visible.title}
            </div>
            <div style={{ marginTop: 4, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
              {visible.body}
            </div>
          </button>
          <button
            type="button"
            onClick={() => dismiss(visible.id)}
            aria-label="Dismiss notification"
            data-testid="notification-toast-dismiss"
            style={{
              minWidth: 32,
              minHeight: 32,
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--v2-text-muted)',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            x
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
