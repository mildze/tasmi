// Service worker : garde toute l'application sur l'appareil pour un usage sans Internet.
importScripts('./offline-list.js');
const APP = 'tasmi-app-v2';   // petits fichiers de l'app : réseau d'abord, copie locale sinon
const BIG = 'tasmi-big-v2';   // moteur, runtime, polices : copie locale d'abord

async function fill(name, urls) {
  const c = await caches.open(name);
  for (const u of urls) {
    if (await c.match(u)) continue;
    const r = await fetch(u, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Téléchargement impossible : ' + u);
    await c.put(u, r);
  }
}

self.addEventListener('install', e => {
  e.waitUntil(fill(APP, self.TASMI_APP).then(() => fill(BIG, self.TASMI_BIG)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('tasmi-') && k !== APP && k !== BIG).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isBig = p => /\/(vendor|fonts|tilawa\/v1\/runtime)\//.test(p);
// Le modèle et la référence sont mis en cache par le moteur lui-même : on ne les garde pas une seconde fois.
const isEngineData = p => /\/tilawa\/v1\/(models|reference)\//.test(p);

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || isEngineData(url.pathname)) return;
  e.respondWith((async () => {
    if (isBig(url.pathname)) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) (await caches.open(BIG)).put(req, r.clone());
      return r;
    }
    try {
      const r = await fetch(req);
      if (r.ok) (await caches.open(APP)).put(req, r.clone());
      return r;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await caches.match('./index.html'); if (idx) return idx; }
      throw err;
    }
  })());
});
