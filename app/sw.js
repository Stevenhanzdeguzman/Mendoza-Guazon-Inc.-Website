// Offline shell (stale-while-revalidate). Private data (/api, /uploads) is NEVER cached. Bump CACHE after big changes.
const CACHE='mg-v3',FILES=['./','index.html','config.js','api.js','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||/^\/(api|uploads)\//.test(u.pathname))return;
  e.respondWith(caches.match(e.request).then(c=>{
    const n=fetch(e.request).then(r=>{if(r.ok){const x=r.clone();caches.open(CACHE).then(k=>k.put(e.request,x))}return r}).catch(()=>c||caches.match('index.html'));
    return c||n}))});
