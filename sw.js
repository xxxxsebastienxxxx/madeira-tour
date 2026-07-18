const CACHE='madeira-v4';
const ASSETS=['./','./index.html','./leaflet-local.css?v=4','./styles-v4.css?v=4','./app-v4.js?v=4','./data.json','./manifest.webmanifest','./icon-192.svg','./icon-512.svg'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin===location.origin){
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request).then(r=>r||caches.match('./index.html')))
    );
  }else{
    event.respondWith(fetch(request).catch(()=>caches.match(request)));
  }
});