// Service worker : l'app et le dictionnaire s'ouvrent hors ligne.
// Les données des parties à deux (Firestore, Firebase) ne passent jamais par ce cache.
// Incrémenter VERSION quand l'icône, la coque de l'app ou le dictionnaire change.
const VERSION = 'v2'
const COQUE = `coque-${VERSION}`
const DICO = `dico-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(COQUE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png'])),
      caches.open(DICO).then((c) => c.add('./dico/mots.dawg')),
    ]),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== COQUE && k !== DICO).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Firebase, Google, polices… : on laisse passer sans rien mettre en cache.
  if (url.origin !== self.location.origin) return

  // Page : réseau d'abord, cache en secours (hors ligne).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copie = res.clone()
          caches.open(COQUE).then((c) => c.put('./index.html', copie))
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  // Dictionnaire : cache d'abord (il ne change qu'avec VERSION).
  if (url.pathname.endsWith('/dico/mots.dawg')) {
    event.respondWith(
      caches.open(DICO).then(async (cache) => {
        const enCache = await cache.match(req, { ignoreSearch: true })
        if (enCache) return enCache
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  // Fichiers de l'app (noms hashés par Vite) : cache puis mise à jour en arrière-plan.
  event.respondWith(
    caches.open(COQUE).then(async (cache) => {
      const enCache = await cache.match(req)
      const reseau = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone())
          return res
        })
        .catch(() => enCache)
      return enCache || reseau
    }),
  )
})

// Toucher une notification « À toi de jouer » : ramène l'app au premier plan sur la partie.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const hash = (event.notification.data && event.notification.data.url) || '#/parties'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const f = fenetres.find((w) => 'focus' in w)
      if (f) {
        f.postMessage({ type: 'ouvrir', hash })
        return f.focus()
      }
      return self.clients.openWindow(self.registration.scope + hash)
    }),
  )
})
