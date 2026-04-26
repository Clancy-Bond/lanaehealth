'use client'

/*
 * NotificationsCard
 *
 * Six checkboxes plus a single "Enable notifications" CTA. The CTA
 * triggers the browser permission prompt, registers the service
 * worker, asks PushManager for an endpoint, and POSTs to
 * /api/v2/push/subscribe with the currently-checked categories.
 *
 * Default OFF for every category. The user opts in per-type. NC voice
 * is enforced through CATEGORY_DEFS.subtext, not free-form copy here.
 *
 * Permission flow copy:
 *   - Pre-prompt sentence: "We will only notify you when something
 *     matters." That single line sets expectations; the browser
 *     dialog fires next.
 *   - Denied-state: explanatory link to OS settings, not a re-prompt
 *     button (browsers ignore repeated calls anyway).
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, ListRow, Toggle } from '@/v2/components/primitives'
import { CATEGORY_DEFS, type NotificationCategory } from '@/lib/notifications/categories'

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

interface SubscriptionState {
  endpoint: string | null
  enabledTypes: Set<NotificationCategory>
}

export default function NotificationsCard() {
  const [mounted, setMounted] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [state, setState] = useState<SubscriptionState>({ endpoint: null, enabledTypes: new Set() })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return
        const json = sub.toJSON() as { endpoint?: string }
        if (!json.endpoint) return
        const res = await fetch(`/api/v2/push/preferences?endpoint=${encodeURIComponent(json.endpoint)}`)
        if (!res.ok) return
        const body = (await res.json()) as { enabledTypes: string[] }
        setState({ endpoint: json.endpoint, enabledTypes: new Set(body.enabledTypes as NotificationCategory[]) })
      })
      .catch(() => {})
  }, [])

  const ensureSubscription = useCallback(async (): Promise<string | null> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Your browser does not support push notifications.')
      return null
    }
    if (!VAPID_KEY) {
      setError('Push notifications are not configured on the server. Try again later.')
      return null
    }
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const keyArray = urlBase64ToUint8Array(VAPID_KEY)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer as ArrayBuffer,
      })
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      setError('Push subscription returned no keys. Try again.')
      return null
    }
    const res = await fetch('/api/v2/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        enabledTypes: Array.from(state.enabledTypes),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    })
    if (!res.ok) {
      setError('Could not save subscription. Try again?')
      return null
    }
    return json.endpoint
  }, [state.enabledTypes])

  const enable = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    setBusy(true)
    setError(null)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return
      const endpoint = await ensureSubscription()
      if (endpoint) setState((prev) => ({ ...prev, endpoint }))
    } finally {
      setBusy(false)
    }
  }, [ensureSubscription])

  const toggleCategory = useCallback(
    async (key: NotificationCategory, value: boolean) => {
      const next = new Set(state.enabledTypes)
      if (value) next.add(key)
      else next.delete(key)
      const previous = state.enabledTypes
      setState((prev) => ({ ...prev, enabledTypes: next }))
      setError(null)
      const endpoint = state.endpoint ?? (permission === 'granted' ? await ensureSubscription() : null)
      if (!endpoint) {
        // Permission still missing or subscription refused: revert.
        setState((prev) => ({ ...prev, enabledTypes: previous }))
        if (permission !== 'granted') {
          setError('Allow notifications first so we have a place to send them.')
        }
        return
      }
      try {
        const res = await fetch('/api/v2/push/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, enabledTypes: Array.from(next) }),
        })
        if (!res.ok) {
          setState((prev) => ({ ...prev, enabledTypes: previous }))
          setError('Save failed. Try again?')
        }
      } catch {
        setState((prev) => ({ ...prev, enabledTypes: previous }))
        setError('Save failed. Try again?')
      }
    },
    [ensureSubscription, permission, state.enabledTypes, state.endpoint],
  )

  if (!mounted) return null

  const denied = permission === 'denied'
  const granted = permission === 'granted'

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <h2
          style={{
            fontSize: 'var(--v2-text-lg)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            margin: 0,
            marginBottom: 'var(--v2-space-1)',
          }}
        >
          Notifications
        </h2>

        <p
          style={{
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            margin: 0,
            marginBottom: 'var(--v2-space-2)',
          }}
        >
          We will only notify you when something matters. Pick the kinds you want.
        </p>

        {!granted && !denied && (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            aria-label="Enable notifications"
            style={{
              alignSelf: 'flex-start',
              padding: 'var(--v2-space-2) var(--v2-space-4)',
              borderRadius: 'var(--v2-radius-pill)',
              background: 'var(--v2-accent-primary)',
              color: 'var(--v2-on-accent)',
              fontWeight: 'var(--v2-weight-semibold)',
              fontSize: 'var(--v2-text-sm)',
              border: 'none',
              cursor: busy ? 'wait' : 'pointer',
              marginBottom: 'var(--v2-space-2)',
            }}
          >
            {busy ? 'One moment...' : 'Enable notifications'}
          </button>
        )}

        {denied && (
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-warning)',
              margin: 0,
              marginBottom: 'var(--v2-space-2)',
            }}
          >
            Notifications are blocked at the browser level. Open your browser site settings to allow them.
          </p>
        )}

        <div>
          {CATEGORY_DEFS.map((def, idx) => {
            const checked = state.enabledTypes.has(def.key)
            return (
              <ListRow
                key={def.key}
                label={def.label}
                subtext={def.subtext}
                divider={idx < CATEGORY_DEFS.length - 1}
                trailing={
                  <Toggle
                    checked={checked}
                    onChange={(next) => toggleCategory(def.key, next)}
                    disabled={denied}
                  />
                }
              />
            )
          })}
        </div>

        {error && (
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-danger)',
              margin: 0,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </Card>
  )
}
