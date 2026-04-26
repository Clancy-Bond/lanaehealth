// LanaeHealth service worker
// v3: PWA install + offline-capable v2 routes + background sync for log writes
// + push notifications.
//
// Strategy summary:
//   - Auth shell (/v2/login, /v2/signup): cache-first, precached on install.
//   - v2 navigations: stale-while-revalidate, fall back to last-good HTML
//     when offline. Final fallback is the offline HTML response.
//   - Static /_next/ assets: stale-while-revalidate.
//   - /doctor brief: explicit stale-while-revalidate (was the original v2
//     intent and stays first-class for clinic-wifi reliability).
//   - API writes for /api/v2/log/*: queued in IndexedDB and replayed on
//     'sync' event (Background Sync API). Reads still pass through.
//
// Bumping CACHE_VERSION invalidates every named cache below on activate.

const CACHE_VERSION = 'lanae-v3'
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const PAGES_CACHE = `${CACHE_VERSION}-pages`
const ASSETS_CACHE = `${CACHE_VERSION}-assets`
const DOCTOR_CACHE = `${CACHE_VERSION}-doctor`
const ALLOW_LIST = new Set([SHELL_CACHE, PAGES_CACHE, ASSETS_CACHE, DOCTOR_CACHE])

const SHELL_URLS = ['/v2/login', '/v2/signup', '/icon.svg', '/manifest.json']
const SYNC_TAG = 'lanae-log-write-queue'
const QUEUE_DB = 'lanae-sw-queue'
const QUEUE_STORE = 'requests'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // addAll is atomic; if any fails the install fails. Use individual
      // puts so a missing route does not block the SW from installing.
      Promise.all(
        SHELL_URLS.map((url) =>
          fetch(url, { credentials: 'same-origin' })
            .then((resp) => {
              if (resp && resp.ok) return cache.put(url, resp)
            })
            .catch(() => {})
        )
      )
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => !ALLOW_LIST.has(k)).map((k) => caches.delete(k)))
      ),
    ])
  )
})

// ─── Fetch handler ─────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Cross-origin: pass through.
  if (url.origin !== self.location.origin) return

  // Background-sync queue for log writes when offline.
  if (
    req.method === 'POST' &&
    (url.pathname.startsWith('/api/v2/log/') ||
      url.pathname === '/api/v2/log' ||
      url.pathname.startsWith('/api/log/'))
  ) {
    event.respondWith(handleLogWrite(req.clone()))
    return
  }

  if (req.method !== 'GET') return

  // /doctor HTML keeps its dedicated cache (preserves prior behavior).
  if (url.pathname.startsWith('/doctor') && req.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(req, DOCTOR_CACHE, offlineDoctorFallback()))
    return
  }

  // v2 navigations: stale-while-revalidate, fall back to offline page.
  if (req.mode === 'navigate' && url.pathname.startsWith('/v2')) {
    event.respondWith(staleWhileRevalidate(req, PAGES_CACHE, offlinePageFallback()))
    return
  }

  // Static /_next/ assets: stale-while-revalidate. Already immutable-hashed
  // upstream, so this is purely a cold-start latency win.
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(staleWhileRevalidate(req, ASSETS_CACHE, null))
    return
  }

  // Icons / manifest: shell cache, cache-first.
  if (
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/icon.svg'
  ) {
    event.respondWith(cacheFirst(req, SHELL_CACHE))
    return
  }
})

async function staleWhileRevalidate(req, cacheName, fallback) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req, { ignoreSearch: false })
  const networkPromise = fetch(req)
    .then((resp) => {
      if (resp && resp.ok && resp.status === 200 && resp.type !== 'opaque') {
        cache.put(req, resp.clone()).catch(() => {})
      }
      return resp
    })
    .catch(() => null)

  if (cached) {
    // Kick off revalidation but return cached response immediately.
    networkPromise.catch(() => {})
    return cached
  }
  const fresh = await networkPromise
  if (fresh) return fresh
  if (fallback) return fallback
  return new Response('', { status: 504, statusText: 'Offline' })
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const resp = await fetch(req)
    if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {})
    return resp
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' })
  }
}

function offlinePageFallback() {
  // NC voice: short, kind, explanatory. Mirrors v2 dark chrome.
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<title>Offline · LanaeHealth</title>' +
    '<style>' +
    'html,body{margin:0;background:#0A0A0B;color:#F2F2F4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased}' +
    'main{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:24px;max-width:480px;margin:0 auto}' +
    'h1{font-size:22px;font-weight:600;margin:0 0 12px;color:#F2F2F4}' +
    'p{font-size:15px;line-height:1.55;color:#B0B3BD;margin:0 0 12px}' +
    '.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#D9775C;margin-right:8px;vertical-align:middle}' +
    'button{margin-top:24px;background:#4DB8A8;color:#1A1A1E;border:0;border-radius:999px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}' +
    '</style></head><body><main>' +
    '<p><span class="dot" aria-hidden="true"></span><span style="color:#B0B3BD;font-size:13px;letter-spacing:0.4px;text-transform:uppercase">Offline</span></p>' +
    '<h1>You are offline.</h1>' +
    '<p>This page has not been opened on this device yet, so there is nothing cached to show.</p>' +
    '<p>Anything you log here will save and sync the next time you are back online.</p>' +
    '<button onclick="location.reload()">Try again</button>' +
    '</main></body></html>'
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  })
}

function offlineDoctorFallback() {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Offline · Doctor brief</title>' +
    '<style>html,body{margin:0;background:#0A0A0B;color:#F2F2F4;font-family:system-ui,sans-serif;padding:24px}' +
    'h1{font-size:22px;margin:0 0 12px}p{color:#B0B3BD;line-height:1.5}</style>' +
    '</head><body><h1>Offline</h1><p>Doctor brief has not been cached on this device yet. Open it once while online and it will be available here next time.</p></body></html>'
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    status: 200,
  })
}

// ─── Background sync for log writes ────────────────────────────────────

async function handleLogWrite(req) {
  // Try the network first. On success, return the real response.
  try {
    return await fetch(req)
  } catch {
    // Offline. Queue the request body for replay and tell the page we
    // accepted it. The page can show a "queued, will sync later" toast.
    try {
      const body = await req.text()
      const headers = {}
      req.headers.forEach((v, k) => {
        headers[k] = v
      })
      await enqueue({
        url: req.url,
        method: req.method,
        headers,
        body,
        ts: Date.now(),
      })
      if ('sync' in self.registration) {
        try {
          await self.registration.sync.register(SYNC_TAG)
        } catch {
          // Sync registration not allowed (e.g. private mode). The
          // queued write will be replayed on the next 'online' event
          // via replayQueue() called by the page on reconnect.
        }
      }
      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(JSON.stringify({ queued: false, error: 'queue-failed' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueue())
  }
})

// Pages can also ping the SW to drain the queue (covers browsers without
// Background Sync).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'replay-log-queue') {
    event.waitUntil(replayQueue())
  }
})

async function replayQueue() {
  const items = await readAll()
  for (const item of items) {
    try {
      const resp = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        credentials: 'same-origin',
      })
      if (resp.ok) {
        await remove(item.id)
      }
    } catch {
      // Still offline. Stop and retry on the next sync event.
      return
    }
  }
}

// ─── Tiny IndexedDB queue ─────────────────────────────────────────────

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function enqueue(item) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite')
        tx.objectStore(QUEUE_STORE).add(item)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
  )
}

function readAll() {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly')
        const req = tx.objectStore(QUEUE_STORE).getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => reject(req.error)
      })
  )
}

function remove(id) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readwrite')
        tx.objectStore(QUEUE_STORE).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
  )
}

// ─── Push notifications (preserved from v2) ───────────────────────────

function actionsForCategory(category) {
  switch (category) {
    case 'daily_checkin':
      return [
        { action: 'log', title: 'Log now' },
        { action: 'snooze', title: 'Later' },
      ]
    case 'cycle_predictions':
      return [{ action: 'open', title: 'Open cycle' }]
    case 'doctor_visits':
      return [{ action: 'open', title: 'Doctor brief' }]
    case 'health_alerts':
      return [{ action: 'open', title: 'See details' }]
    default:
      return []
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'LanaeHealth', body: event.data.text() }
  }
  const data = payload.data || {}
  event.waitUntil(
    self.registration.showNotification(payload.title || 'LanaeHealth', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || 'lanae-notification',
      data,
      actions: actionsForCategory(data.category),
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const action = event.action || 'open'

  if (action === 'snooze') return

  let target = data.url || '/v2'
  if (action === 'log') target = '/v2/log'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})
