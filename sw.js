const CACHE='madeira-v7.1';
const ASSETS=[
  './','./index.html','./leaflet-local.css?v=5','./styles-v7.css?v=7.1','./app-v7.js?v=7.1',
  './data.json?v=7.1','./manifest.webmanifest','./icon-192.svg','./icon-512.svg','./photo-fallback.svg'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin===location.origin){
    event.respondWith(fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
  }else{
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
  }
});