/**
 * Piso's service worker.
 *
 * The ledger already lives in localStorage, so the app's data was never the
 * problem — the app *itself* was, because a phone with no signal cannot fetch
 * index.html. This caches the shell on first visit and serves it from there
 * afterwards, which is what turns the installed icon into something that opens
 * on the MRT.
 *
 * Deliberately not caching /api: a stale answer about your money is worse than
 * no answer, and the chat screen already falls back to the canned library when
 * the server cannot be reached.
 */
const CACHE = 'piso-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest'])),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Navigations: network first so a deploy is picked up, cache as the parachute.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          return response
        })
        .catch(() => caches.match('./index.html').then((r) => r ?? caches.match('./'))),
    )
    return
  }

  // Assets are content-hashed by the build, so a hit is always current.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
