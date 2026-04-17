// LanaeHealth service worker
// Minimal v1: enables PWA install + primes for future web-push subscription.
// True background reminders require server-side push (not yet wired).

const CACHE_NAME = 'lanae-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Pass-through fetch: network first, no caching so that dev builds never get stale.
self.addEventListener('fetch', (event) => {
  // Intentionally empty: let the browser handle requests.
})

// Future: web-push handler. Left here so adding server push later only needs
// VAPID keys + a /api/push/subscribe route, not SW surgery.
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'LanaeHealth', body: event.data.text() }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'LanaeHealth', {
      body: payload.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.tag || 'lanae-checkin',
      data: payload.data || {},
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data && event.notification.data.url ? event.notification.data.url : '/log'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})
