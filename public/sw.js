// LanaeHealth service worker
// v2: enables PWA install, web push, and offline-capable /doctor route.
// The doctor brief is safety-critical during clinic visits with spotty wifi,
// so we stale-while-revalidate the HTML response.

const CACHE_NAME = 'lanae-v2'
const DOCTOR_CACHE = 'lanae-doctor-v2'
const DOCTOR_PATHS = ['/doctor', '/doctor?v=pcp', '/doctor?v=obgyn', '/doctor?v=cardiology']

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear old cache versions so stale HTML doesn't linger.
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== DOCTOR_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
    ])
  )
})

// Stale-while-revalidate for /doctor routes. Everything else passes through.
// We keep the last successful HTML response around so if Lanae is in an exam
// room with bad wifi she still has the brief.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Only cache the /doctor HTML document, not its internal assets (avoids
  // caching API JSON which must stay fresh).
  const isDoctorDoc =
    url.pathname.startsWith('/doctor') && req.mode === 'navigate'

  if (!isDoctorDoc) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(DOCTOR_CACHE)
      const networkPromise = fetch(req)
        .then((resp) => {
          // Only cache successful full responses.
          if (resp && resp.ok && resp.status === 200) {
            cache.put(req, resp.clone())
          }
          return resp
        })
        .catch(() => null)

      const cached = await cache.match(req, { ignoreSearch: false })
      return cached || (await networkPromise) || new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<body style="font-family:system-ui;padding:20px;color:#1A1A2E">' +
          '<h1>Offline</h1><p>Doctor brief not cached yet. Open /doctor once ' +
          'while online and it will be available next time.</p></body>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
      )
    })()
  )
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
