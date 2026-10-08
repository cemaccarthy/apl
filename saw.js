const CACHE = 'apl-studio-v1';
const SHELL = ['./', './index.html', './css/style.css', './js/app.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                    // never intercept the exec API
  const url = new URL(req.url);
  if (url.origin === location.origin) {                // app shell: stale-while-revalidate
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())); return res; }).catch(() => hit);
      return hit || net;
    }));
  } else if (url.hostname.includes('fonts.') || url.hostname.includes('jsdelivr')) {  // fonts: cache-first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { caches.open(CACHE).then(c => c.put(req, res.clone())); return res; })));
  }
});
