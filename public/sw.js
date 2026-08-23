self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('rentra-gps-v1').then((cache) => cache.addAll(['/field', '/rentralogo.png', '/manifest.json']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.pathname.startsWith('/api/')) return
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((hit) => hit || caches.match('/field')))
  )
})
