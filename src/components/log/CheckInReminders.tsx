'use client'

import { useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'lanae.checkin.reminders.v1'

interface ReminderPrefs {
  enabled: boolean
  morning: string
  evening: string
}

const DEFAULT_PREFS: ReminderPrefs = {
  enabled: false,
  morning: '08:00',
  evening: '21:00',
}

function loadPrefs(): ReminderPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<ReminderPrefs>
    return { ...DEFAULT_PREFS, ...parsed }
  } catch {
    return DEFAULT_PREFS
  }
}

function savePrefs(p: ReminderPrefs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function subscribePush(prefs: ReminderPrefs): Promise<void> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      const keyArray = urlBase64ToUint8Array(vapidKey)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer as ArrayBuffer,
      })
    } catch {
      return
    }
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      morningTime: prefs.morning,
      eveningTime: prefs.evening,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  }).catch(() => {})
}

async function unsubscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, { method: 'DELETE' }).catch(() => {})
  } catch {}
}

function msUntilNext(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const next = new Date(now)
  next.setHours(h, m, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

function scheduleNotification(label: string, body: string, delayMs: number, onFire: () => void): () => void {
  const id = window.setTimeout(() => {
    try {
      new Notification(label, { body, tag: `lanae-checkin-${label}`, icon: '/favicon.ico' })
    } catch {}
    onFire()
  }, delayMs)
  return () => window.clearTimeout(id)
}

export default function CheckInReminders() {
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setPrefs(loadPrefs())
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (!mounted || !prefs.enabled || permission !== 'granted') return

    let cancelMorning = () => {}
    let cancelEvening = () => {}

    const schedule = () => {
      cancelMorning()
      cancelEvening()
      cancelMorning = scheduleNotification(
        'Morning check-in',
        'Take 30 seconds to log your night.',
        msUntilNext(prefs.morning),
        () => {}
      )
      cancelEvening = scheduleNotification(
        'Evening check-in',
        'How was today? A quick tap to log.',
        msUntilNext(prefs.evening),
        () => {}
      )
    }

    schedule()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', schedule)

    return () => {
      cancelMorning()
      cancelEvening()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', schedule)
    }
  }, [mounted, prefs, permission])

  const requestEnable = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      const next = { ...prefs, enabled: true }
      setPrefs(next)
      savePrefs(next)
      subscribePush(next)
    }
  }, [prefs])

  const disable = useCallback(() => {
    const next = { ...prefs, enabled: false }
    setPrefs(next)
    savePrefs(next)
    unsubscribePush()
  }, [prefs])

  const updateTime = useCallback(
    (key: 'morning' | 'evening', value: string) => {
      const next = { ...prefs, [key]: value }
      setPrefs(next)
      savePrefs(next)
      if (next.enabled && permission === 'granted') subscribePush(next)
    },
    [prefs, permission]
  )

  if (!mounted) return null

  const denied = permission === 'denied'
  const active = prefs.enabled && permission === 'granted'

  return (
    <div
      className="rounded-2xl p-4 text-sm"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-medium" style={{ color: '#3a3a3a' }}>
          Check-in reminders
        </span>
        {active ? (
          <button
            onClick={disable}
            className="text-xs underline"
            style={{ color: '#6B9080' }}
          >
            Turn off
          </button>
        ) : denied ? (
          <span className="text-xs" style={{ color: '#D4A0A0' }}>Blocked in browser settings</span>
        ) : (
          <button
            onClick={requestEnable}
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: '#6B9080', color: '#fff' }}
          >
            Enable
          </button>
        )}
      </div>

      {active ? (
        <div className="flex gap-4">
          <label className="flex-1 text-xs" style={{ color: '#6a6a6a' }}>
            Morning
            <input
              type="time"
              value={prefs.morning}
              onChange={e => updateTime('morning', e.target.value)}
              className="mt-1 w-full rounded-lg px-2 py-1"
              style={{ background: '#FAFAF7', border: '1px solid rgba(107, 144, 128, 0.2)', color: '#3a3a3a' }}
            />
          </label>
          <label className="flex-1 text-xs" style={{ color: '#6a6a6a' }}>
            Evening
            <input
              type="time"
              value={prefs.evening}
              onChange={e => updateTime('evening', e.target.value)}
              className="mt-1 w-full rounded-lg px-2 py-1"
              style={{ background: '#FAFAF7', border: '1px solid rgba(107, 144, 128, 0.2)', color: '#3a3a3a' }}
            />
          </label>
        </div>
      ) : (
        <p className="text-xs" style={{ color: '#8a8a8a' }}>
          Get a quick nudge at your chosen morning and evening times &mdash; works even when the app is closed once you enable and allow notifications.
        </p>
      )}
    </div>
  )
}
