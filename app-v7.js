
const state={
  places:[],activities:[],map:null,mapMarkers:[],mapRating:'',mapKind:'all',
  favorites:new Set(JSON.parse(localStorage.getItem('favorites')||'[]')),
  done:new Set(JSON.parse(localStorage.getItem('done')||'[]'))
};
const $=s=>document.querySelector(s);
const stars=n=>'⭐'.repeat(Number(n)||0);
const priorityText=n=>Number(n)===3?'Fort intérêt':Number(n)===2?'Intérêt moyen':'Intérêt plus faible';
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const maps=q=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const waze=q=>`https://www.waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
const fallbackPhoto='photo-fallback.svg';

async function init(){
  const data=await fetch('data.json?v=7').then(r=>r.json());
  state.places=data.places; state.activities=data.activities;
  fillFilters(); render(); renderActivities(); loadWeather(); initMap();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=7');
}
function fillFilters(){
  [...new Set(state.places.map(p=>p.zone))].sort().forEach(z=>$('#zoneFilter').insertAdjacentHTML('beforeend',`<option>${z}</option>`));
  [...new Set(state.places.map(p=>p.category))].sort().forEach(c=>$('#categoryFilter').insertAdjacentHTML('beforeend',`<option>${c}</option>`));
}
function filtered(){
  const q=$('#search').value.toLowerCase().trim(),z=$('#zoneFilter').value,c=$('#categoryFilter').value,r=$('#ratingFilter').value;
  return state.places.filter(p=>
    (!q||`${p.name} ${p.description} ${p.category} ${p.zone}`.toLowerCase().includes(q))&&
    (!z||p.zone===z)&&(!c||(c==='🌅 Coucher de soleil'?p.sunset:p.category===c))&&(!r||String(p.rating)===r)&&
    (!$('#favoritesOnly').checked||state.favorites.has(slug(p.name)))&&
    (!$('#hideDone').checked||!state.done.has(slug(p.name)))
  );
}
function render(){
  const list=filtered().sort((a,b)=>Number(b.rating)-Number(a.rating)||a.name.localeCompare(b.name));
  $('#count').textContent=`${list.length} lieu${list.length>1?'x':''}`;
  const byZone=Object.groupBy?Object.groupBy(list,p=>p.zone):list.reduce((a,p)=>((a[p.zone]??=[]).push(p),a),{});
  $('#zones').innerHTML=Object.keys(byZone).sort().map(zone=>`
    <section class="zone-block">
      <div class="zone-title"><h3>📍 ${zone}</h3><span class="pill">${byZone[zone].length}</span></div>
      <div class="grid">${byZone[zone].map(card).join('')}</div>
    </section>`).join('')||'<div class="empty card">Aucun lieu ne correspond aux filtres.</div>';
  bindCards();
  observePhotos();
}
function card(p){
  const id=slug(p.name),fav=state.favorites.has(id),done=state.done.has(id);
  return `<article class="place ${done?'done':''}" data-id="${id}">
    <div class="place-photo-wrap">
      <img class="place-thumb lazy-photo" src="${fallbackPhoto}" alt="Vue de ${p.name}" data-photo-query="${encodeURIComponent(p.query||p.name)}">
      <span class="photo-credit">Wikimedia</span>
    </div>
    <div class="place-body">
      <div class="section-head">
        <div>
          <div class="rating">${stars(p.rating)}</div>
          <span class="priority-label">${priorityText(p.rating)}</span>
          <h4>${p.name}</h4>
        </div>
        <button class="icon-btn fav" type="button" title="Favori">${fav?'❤️':'🤍'}</button>
      </div>
      <div class="meta"><span class="tag">${p.category}</span><span class="tag">${p.duration}</span></div>
      <p>${p.description}</p>
      <div class="actions">
        <button class="details" type="button">Voir la fiche</button>
        <a class="maps" href="${maps(p.query)}" target="_blank" rel="noopener">Google Maps</a>
        <a class="waze" href="${waze(p.query)}" target="_blank" rel="noopener">Waze</a>
        <button class="doneBtn" type="button">${done?'↩ À refaire':'✓ Fait'}</button>
      </div>
    </div>
  </article>`;
}
function bindCards(){
  document.querySelectorAll('.place[data-id]').forEach(el=>{
    const p=state.places.find(x=>slug(x.name)===el.dataset.id);
    el.querySelector('.fav')?.addEventListener('click',()=>toggleSet('favorites',el.dataset.id));
    el.querySelector('.doneBtn')?.addEventListener('click',()=>toggleSet('done',el.dataset.id));
    el.querySelector('.details')?.addEventListener('click',()=>openDetail(p));
  });
}
function toggleSet(which,id){
  const set=state[which];set.has(id)?set.delete(id):set.add(id);
  localStorage.setItem(which,JSON.stringify([...set]));render();
}

/* Photos Wikimedia : chargement progressif et cache local */
function photoCache(){
  try{return JSON.parse(localStorage.getItem('madeira-photo-cache-v1')||'{}')}catch{return{}}
}
function savePhotoCache(cache){localStorage.setItem('madeira-photo-cache-v1',JSON.stringify(cache))}
async function fetchWikiPhoto(query){
  const cache=photoCache();
  if(cache[query]) return cache[query];
  const languages=['pt','en'];
  for(const lang of languages){
    try{
      const url=`https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query+' Madeira')}&gsrlimit=1&prop=pageimages&pithumbsize=640&format=json&origin=*`;
      const d=await fetch(url).then(r=>r.json());
      const pages=d.query?.pages?Object.values(d.query.pages):[];
      const src=pages[0]?.thumbnail?.source;
      if(src){cache[query]=src;savePhotoCache(cache);return src}
    }catch(e){console.warn('Photo indisponible',query,e)}
  }
  cache[query]=fallbackPhoto;savePhotoCache(cache);return fallbackPhoto;
}
function observePhotos(){
  const imgs=[...document.querySelectorAll('img.lazy-photo:not([data-observed])')];
  const load=async img=>{
    img.dataset.observed='1';
    const q=decodeURIComponent(img.dataset.photoQuery||'Madeira');
    const src=await fetchWikiPhoto(q);
    img.src=src;
    img.closest('.place-photo-wrap')?.querySelector('.photo-credit')?.toggleAttribute('hidden',src===fallbackPhoto);
  };
  if(!('IntersectionObserver' in window)){imgs.forEach(load);return}
  const io=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){io.unobserve(e.target);load(e.target)}
  }),{rootMargin:'250px'});
  imgs.forEach(img=>{img.dataset.observed='1';io.observe(img)});
}

/* Fiche pratique */
function practicalFor(p){
  const c=p.category.toLowerCase(), items=[];
  if(c.includes('randonnée')){
    items.push('Vérifier l’ouverture officielle du sentier le jour même.');
    items.push('Prendre de l’eau, des chaussures adhérentes et une couche coupe-vent.');
    if(/tunnel|PR1|PR9|PR16/i.test(`${p.name} ${p.description}`)) items.push('Prévoir une lampe frontale ou une lampe de téléphone bien chargée.');
  }else if(c.includes('baignade')||c.includes('plage')){
    items.push('Contrôler la houle et les consignes locales avant d’entrer dans l’eau.');
    items.push('Prévoir maillot, serviette et chaussures adaptées aux rochers ou galets.');
  }else if(c.includes('point de vue')){
    items.push('La visibilité peut changer rapidement : consulter les webcams avant de monter.');
    items.push('Le lever ou la fin de journée donnent souvent la meilleure lumière.');
  }else if(c.includes('téléphérique')){
    items.push('Vérifier les horaires, le vent et la dernière remontée avant de descendre.');
    items.push('Prévoir de bonnes chaussures si vous marchez au pied de la falaise.');
  }else if(c.includes('cascade')){
    items.push('Le sol peut être très glissant après la pluie.');
    items.push('Respecter les fermetures de route et ne pas stationner sous une chute d’eau.');
  }else if(c.includes('village')){
    items.push('Prévoir du temps pour marcher : les meilleurs détails sont souvent hors de la route principale.');
    items.push('À combiner avec un point de vue ou une halte repas dans le même secteur.');
  }else{
    items.push('Vérifier les horaires et conditions d’accès avant le départ.');
    items.push('Conserver une veste légère : le temps change vite à Madère.');
  }
  items.push(`Temps conseillé : ${p.duration}.`);
  items.push(`Conditions idéales : ${p.weather}.`);
  return [...new Set(items)];
}
function cachedCoordinates(){
  try{return JSON.parse(localStorage.getItem('madeira-geocode-v1')||'{}')}catch{return{}}
}
function distanceKm(a,b){
  const R=6371,toRad=x=>x*Math.PI/180;
  const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);
  const s=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function nearbyFor(p){
  const cache=cachedCoordinates(), origin=cache[p.query];
  let candidates=state.places.filter(x=>x!==p);
  if(origin){
    candidates=candidates.map(x=>{
      const c=cache[x.query];
      return c?{place:x,distance:distanceKm(origin,c)}:null;
    }).filter(Boolean).filter(x=>x.distance<=22).sort((a,b)=>a.distance-b.distance||b.place.rating-a.place.rating).slice(0,5);
  }else{
    candidates=candidates.filter(x=>x.zone===p.zone).sort((a,b)=>b.rating-a.rating).slice(0,5).map(place=>({place,distance:null}));
  }
  return candidates;
}
async function openDetail(p){
  const id=slug(p.name),noteKey=`note-${id}`,nearby=nearbyFor(p);
  const cached=photoCache()[p.query||p.name]||fallbackPhoto;
  $('#dialogContent').innerHTML=`
    <img class="detail-hero detail-photo" src="${cached}" alt="Vue de ${p.name}">
    <p class="eyebrow">${p.zone}</p>
    <h2>${stars(p.rating)} ${p.name}</h2>
    <span class="priority-label">${priorityText(p.rating)}</span>
    <p>${p.description}</p>
    <div class="detail-grid">
      <div class="detail-box"><strong>Type</strong><br>${p.category}</div>
      <div class="detail-box"><strong>Temps conseillé</strong><br>${p.duration}</div>
      <div class="detail-box"><strong>Météo idéale</strong><br>${p.weather}</div>
      <div class="detail-box"><strong>Votre classement</strong><br>${stars(p.rating)} · ${priorityText(p.rating)}</div>
    </div>
    <section class="detail-section">
      <h3>Informations pratiques</h3>
      <ul class="practical-list">${practicalFor(p).map(x=>`<li>${x}</li>`).join('')}</ul>
      <p><strong>Conseil spécifique :</strong> ${p.tips}</p>
    </section>
    <section class="detail-section">
      <h3>Points d’intérêt à proximité</h3>
      <div class="nearby-list">${
        nearby.length?nearby.map(x=>`<div class="nearby-item">
          <button type="button" data-nearby-id="${slug(x.place.name)}">${stars(x.place.rating)} ${x.place.name}</button>
          <span class="nearby-distance">${x.distance!=null?`${x.distance.toFixed(1)} km`:x.place.zone}</span>
        </div>`).join(''):'<p>Aucun autre point proche n’est encore identifié.</p>'
      }</div>
    </section>
    <section class="detail-section">
      <h3>Vos notes</h3>
      <textarea class="note-area" placeholder="Ajoutez votre commentaire personnel…">${localStorage.getItem(noteKey)||''}</textarea>
      <div class="actions" style="margin-top:14px">
        <a class="maps" href="${maps(p.query)}" target="_blank" rel="noopener">Ouvrir dans Google Maps</a>
        <a class="waze" href="${waze(p.query)}" target="_blank" rel="noopener">Ouvrir dans Waze</a>
      </div>
    </section>`;
  $('#dialogContent .note-area').addEventListener('input',e=>localStorage.setItem(noteKey,e.target.value));
  $('#dialogContent').querySelectorAll('[data-nearby-id]').forEach(btn=>btn.addEventListener('click',()=>{
    const next=state.places.find(x=>slug(x.name)===btn.dataset.nearbyId);
    if(next) openDetail(next);
  }));
  if(cached===fallbackPhoto){
    const src=await fetchWikiPhoto(p.query||p.name);
    const img=$('#dialogContent .detail-photo');
    if(img) img.src=src;
  }
  if(!$('#detailDialog').open) $('#detailDialog').showModal();
}

/* Activités */
const activityEmoji=name=>{
  const n=name.toLowerCase();
  if(n.includes('surf'))return'🏄';
  if(n.includes('dauphin')||n.includes('cachalot'))return'🐬';
  if(n.includes('canyoning'))return'🧗';
  if(n.includes('tyrolienne'))return'🪂';
  if(n.includes('luge'))return'🛷';
  return'🎯';
};
function activityTips(a){
  const n=a.name.toLowerCase();
  if(n.includes('surf'))return['Choisir une école et un spot adaptés au niveau.','Vérifier la houle, le vent et les horaires de marée.'];
  if(n.includes('dauphin'))return['Réserver à l’avance en haute saison.','Privilégier un opérateur respectueux des distances avec les animaux.'];
  if(n.includes('canyoning'))return['Activité encadrée obligatoire.','Le parcours dépend du niveau et du débit des cascades.'];
  if(n.includes('tyrolienne'))return['Vérifier les limites de poids et les conditions de vent.','Réserver et confirmer le lieu exact avec le prestataire.'];
  if(n.includes('luge'))return['Vérifier les horaires et l’attente à Monte.','La descente ne ramène pas jusqu’au centre de Funchal.'];
  return['Vérifier les horaires, tarifs et conditions météo.'];
}
function renderActivities(){
  $('#activitiesGrid').innerHTML=state.activities.sort((a,b)=>b.rating-a.rating).map(a=>`
    <article class="place activity-card">
      <div class="place-photo-wrap">
        <img class="place-thumb lazy-photo" src="${fallbackPhoto}" alt="${a.name}" data-photo-query="${encodeURIComponent(a.query||a.name)}">
        <span class="photo-credit">Wikimedia</span>
      </div>
      <div class="place-body">
        <div class="activity-icon-label">${activityEmoji(a.name)} ${a.name}</div>
        <div class="rating">${stars(a.rating)} <span class="priority-label">${priorityText(a.rating)}</span></div>
        <div class="meta"><span class="tag">${a.zone}</span></div>
        <p>${a.description}</p>
        <ul class="practical-list">${activityTips(a).map(x=>`<li>${x}</li>`).join('')}</ul>
        <div class="actions">
          <a class="maps" href="${maps(a.query)}" target="_blank" rel="noopener">Google Maps</a>
          <a class="waze" href="${waze(a.query)}" target="_blank" rel="noopener">Waze</a>
        </div>
      </div>
    </article>`).join('');
  observePhotos();
}
['search','zoneFilter','categoryFilter','ratingFilter','favoritesOnly','hideDone'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',render));
$('.dialog-close').addEventListener('click',()=>$('#detailDialog').close());

/* ---------- Carte interactive ---------- */
const MADEIRA_BOUNDS=[[32.62,-17.30],[32.88,-16.65]];
function markerIcon(rating){
  return L.divIcon({
    className:'',
    html:`<div class="poi-marker rating-${rating}"><span>${rating}</span></div>`,
    iconSize:[34,34],iconAnchor:[17,32],popupAnchor:[0,-30]
  });
}
function activityMarkerIcon(a){
  return L.divIcon({
    className:'',
    html:`<div class="activity-marker"><span>${activityEmoji(a.name)}</span></div>`,
    iconSize:[38,38],iconAnchor:[19,19],popupAnchor:[0,-18]
  });
}
function saveCoordinates(cache){localStorage.setItem('madeira-geocode-v1',JSON.stringify(cache))}
async function geocodeItem(item){
  const cache=cachedCoordinates(),key=item.query;
  if(cache[key])return cache[key];
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=pt&viewbox=-17.35,32.95,-16.60,32.55&bounded=1&q=${encodeURIComponent(item.query)}`;
  const response=await fetch(url,{headers:{'Accept-Language':'fr'}});
  if(!response.ok)throw new Error(`Géocodage impossible (${response.status})`);
  const results=await response.json();
  if(!results.length)return null;
  const coords={lat:Number(results[0].lat),lon:Number(results[0].lon)};
  cache[key]=coords;saveCoordinates(cache);return coords;
}
function popupHtml(p){
  return `<div class="map-popup"><div>${stars(p.rating)} · ${priorityText(p.rating)}</div><h3>${p.name}</h3>
    <p><strong>${p.category}</strong> · ${p.zone}</p><p>${p.description}</p>
    <div class="popup-actions"><a href="${maps(p.query)}" target="_blank" rel="noopener">Google Maps</a><a href="${waze(p.query)}" target="_blank" rel="noopener">Waze</a></div></div>`;
}
function activityPopupHtml(a){
  return `<div class="map-popup"><div>${activityEmoji(a.name)} Activité</div><h3>${a.name}</h3>
    <p><strong>${a.zone}</strong></p><p>${a.description}</p>
    <div class="popup-actions"><a href="${maps(a.query)}" target="_blank" rel="noopener">Google Maps</a><a href="${waze(a.query)}" target="_blank" rel="noopener">Waze</a></div></div>`;
}
function refreshMapMarkers(){
  if(!state.map)return;
  state.mapMarkers.forEach(({marker,item,kind})=>{
    const kindOk=kind==='travel'||state.mapKind==='all'||state.mapKind===kind;
    const ratingOk=kind==='activity'||kind==='travel'||!state.mapRating||String(item.rating)===String(state.mapRating);
    const shouldShow=kindOk&&ratingOk;
    if(shouldShow){if(!state.map.hasLayer(marker))marker.addTo(state.map)}
    else if(state.map.hasLayer(marker))state.map.removeLayer(marker);
  });
  const visible=state.mapMarkers.filter(({marker})=>state.map.hasLayer(marker)).map(({marker})=>marker);
  if(visible.length)state.map.fitBounds(L.featureGroup(visible).getBounds().pad(.13),{maxZoom:12});
}
async function addMapItems(items,kind,status,totalOffset,totalCount){
  let added=0,missing=0;
  for(let i=0;i<items.length;i++){
    const item=items[i],cache=cachedCoordinates();
    let coords=cache[item.query]||null;
    if(!coords){
      try{coords=await geocodeItem(item)}catch(err){console.warn(err)}
      if(i<items.length-1)await new Promise(resolve=>setTimeout(resolve,1100));
    }
    if(coords&&Number.isFinite(coords.lat)&&Number.isFinite(coords.lon)){
      const marker=L.marker([coords.lat,coords.lon],{
        icon:kind==='activity'?activityMarkerIcon(item):markerIcon(item.rating)
      }).bindPopup(kind==='activity'?activityPopupHtml(item):popupHtml(item),{maxWidth:310});
      marker.addTo(state.map);
      state.mapMarkers.push({marker,item,kind});
      added++;
    }else missing++;
    status.textContent=`Chargement : ${totalOffset+i+1}/${totalCount} · ${state.mapMarkers.length} affichés`;
  }
  return {added,missing};
}
async function initMap(){
  const status=$('#mapStatus');
  if(typeof L==='undefined'){status.textContent='La bibliothèque de carte n’a pas pu être chargée.';return}
  state.map=L.map('map',{zoomControl:true,scrollWheelZoom:false}).fitBounds(MADEIRA_BOUNDS);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.map);
  L.control.scale({imperial:false}).addTo(state.map);
  const total=state.places.length+state.activities.length;
  status.textContent=`Chargement : 0/${total}`;
  const p=await addMapItems(state.places,'place',status,0,total);
  const a=await addMapItems(state.activities,'activity',status,state.places.length,total);
  status.textContent=`${p.added} lieux et ${a.added} activités affichés${p.missing+a.missing?` · ${p.missing+a.missing} non trouvé(s)`:''}`;
  await refreshTravelMarkers();
  refreshMapMarkers();
}
document.querySelectorAll('.map-filter').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.map-filter').forEach(b=>b.classList.remove('active'));
  button.classList.add('active');state.mapRating=button.dataset.mapRating;refreshMapMarkers();
}));
document.querySelectorAll('.map-kind-filter').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.map-kind-filter').forEach(b=>b.classList.remove('active'));
  button.classList.add('active');state.mapKind=button.dataset.mapKind;refreshMapMarkers();
}));
$('#fitMap').addEventListener('click',()=>state.mapMarkers.length?refreshMapMarkers():state.map?.fitBounds(MADEIRA_BOUNDS));

const weatherZones=[
  {name:'Ouest',lat:32.72,lon:-17.17},{name:'Nord-Ouest',lat:32.82,lon:-17.12},{name:'Centre',lat:32.75,lon:-16.96},{name:'Est',lat:32.75,lon:-16.72},{name:'Funchal',lat:32.65,lon:-16.91}
];
function weatherLabel(code){if(code===0)return'☀️ Dégagé';if([1,2].includes(code))return'🌤 Peu nuageux';if(code===3)return'☁️ Couvert';if([45,48].includes(code))return'🌫 Brouillard';if(code>=51&&code<=67)return'🌧 Pluie';if(code>=71&&code<=77)return'🌨 Neige';if(code>=80&&code<=82)return'🌦 Averses';if(code>=95)return'⛈ Orage';return'Variable'}
async function loadWeather(){
  $('#weatherGrid').innerHTML='<p>Chargement…</p>';
  try{
    const results=await Promise.all(weatherZones.map(async z=>{
      const u=`https://api.open-meteo.com/v1/forecast?latitude=${z.lat}&longitude=${z.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FLisbon`;
      const d=await fetch(u).then(r=>r.json());return {...z,...d.current}
    }));
    $('#weatherGrid').innerHTML=results.map(x=>`<div class="weather-item"><strong>${x.name}</strong><span class="temp">${Math.round(x.temperature_2m)}°</span><br>${weatherLabel(x.weather_code)}<br><small>Vent ${Math.round(x.wind_speed_10m)} km/h</small></div>`).join('');
  }catch(e){$('#weatherGrid').innerHTML='<p>Météo indisponible. Vérifiez votre connexion.</p>'}
}
$('#refreshWeather').addEventListener('click',loadWeather);
let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').addEventListener('click',async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true}});
init();


/* ---------- Voyage simplifié et documents locaux ---------- */
const TRAVEL_KEY='madeira-travel-v2';
let travelGeocodeTimer;
function getTravelData(){try{const current=JSON.parse(localStorage.getItem(TRAVEL_KEY)||'null');if(current)return current;const old=JSON.parse(localStorage.getItem('madeira-travel-v1')||'{}');if(old['car-rental']&&!old['car-rental'].address)old['car-rental'].address=old['car-rental'].pickupAddress||old['car-rental'].returnAddress||'';localStorage.setItem(TRAVEL_KEY,JSON.stringify(old));return old}catch{return{}}}
function saveTravelRecord(id,form){
  const all=getTravelData();
  all[id]=Object.fromEntries(new FormData(form).entries());
  localStorage.setItem(TRAVEL_KEY,JSON.stringify(all));
  renderLocationActions(id,all[id]);
  clearTimeout(travelGeocodeTimer);
  travelGeocodeTimer=setTimeout(refreshTravelMarkers,700);
}
function loadTravelForms(){
  const all=getTravelData();
  document.querySelectorAll('.travel-form[data-record]').forEach(form=>{
    const id=form.dataset.record,saved=all[id]||{};
    Object.entries(saved).forEach(([name,value])=>{const field=form.elements.namedItem(name);if(field&&field.type!=='file')field.value=value});
    form.addEventListener('input',()=>saveTravelRecord(id,form));
    form.addEventListener('change',()=>saveTravelRecord(id,form));
    renderLocationActions(id,saved);
  });
}
function travelAddress(id,data){return data.address||''}
function renderLocationActions(id,data){
  const box=document.querySelector(`[data-location-actions="${id}"]`);if(!box)return;
  const address=travelAddress(id,data);
  box.innerHTML=address?`<a href="${maps(address)}" target="_blank" rel="noopener">Google Maps</a><a href="${waze(address)}" target="_blank" rel="noopener">Waze</a>`:'';
}
function travelMarkerIcon(type){
  return L.divIcon({className:'',html:`<div class="travel-marker"><span>${type==='car'?'🚗':'🏠'}</span></div>`,iconSize:[40,40],iconAnchor:[20,36],popupAnchor:[0,-32]});
}
async function geocodeTravel(address){
  if(!address)return null;
  const key=`travel:${address}`,cache=cachedCoordinates();
  if(cache[key])return cache[key];
  const query=/madeira|funchal|santana|portugal/i.test(address)?address:`${address}, Madeira, Portugal`;
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=pt&viewbox=-17.35,32.95,-16.60,32.55&bounded=1&q=${encodeURIComponent(query)}`;
  const response=await fetch(url,{headers:{'Accept-Language':'fr'}});
  if(!response.ok)return null;
  const results=await response.json();if(!results.length)return null;
  const coords={lat:Number(results[0].lat),lon:Number(results[0].lon)};
  cache[key]=coords;saveCoordinates(cache);return coords;
}
async function refreshTravelMarkers(){
  if(!state.map||typeof L==='undefined')return;
  state.mapMarkers.filter(x=>x.kind==='travel').forEach(x=>state.map.removeLayer(x.marker));
  state.mapMarkers=state.mapMarkers.filter(x=>x.kind!=='travel');
  const data=getTravelData();
  const entries=[
    {id:'airbnb-1',label:data['airbnb-1']?.name||'Airbnb 1',address:data['airbnb-1']?.address,type:'home'},
    {id:'airbnb-2',label:data['airbnb-2']?.name||'Airbnb 2',address:data['airbnb-2']?.address,type:'home'},
    {id:'car-rental',label:data['car-rental']?.company||'Location de voiture',address:data['car-rental']?.address,type:'car'}
  ];
  for(const item of entries){
    const status=document.querySelector(`[data-location-status="${item.id}"]`);
    if(!item.address){if(status)status.textContent='';continue}
    if(status)status.textContent='Recherche de l’adresse sur la carte…';
    try{
      const coords=await geocodeTravel(item.address);
      if(!coords){if(status)status.textContent='Adresse non trouvée. Ajoutez la ville et « Madère » pour la préciser.';continue}
      const popup=`<div class="map-popup"><h3>${item.type==='car'?'🚗':'🏠'} ${item.label}</h3><p>${item.address}</p><div class="popup-actions"><a href="${maps(item.address)}" target="_blank" rel="noopener">Google Maps</a><a href="${waze(item.address)}" target="_blank" rel="noopener">Waze</a></div></div>`;
      const marker=L.marker([coords.lat,coords.lon],{icon:travelMarkerIcon(item.type)}).bindPopup(popup,{maxWidth:310}).addTo(state.map);
      state.mapMarkers.push({marker,item,kind:'travel'});
      if(status)status.textContent='✓ Affiché sur la carte';
    }catch(e){if(status)status.textContent='Impossible de rechercher cette adresse pour le moment.'}
  }
}
function openDocsDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('madeira-documents',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('docs')){const store=db.createObjectStore('docs',{keyPath:'id'});store.createIndex('owner','owner')}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function saveDocuments(owner,files){const db=await openDocsDb();await Promise.all([...files].map(file=>new Promise((resolve,reject)=>{const tx=db.transaction('docs','readwrite');tx.objectStore('docs').put({id:crypto.randomUUID(),owner,name:file.name,type:file.type,size:file.size,created:Date.now(),blob:file});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})));renderDocuments(owner)}
async function listDocuments(owner){const db=await openDocsDb();return new Promise((resolve,reject)=>{const tx=db.transaction('docs','readonly');const req=tx.objectStore('docs').index('owner').getAll(owner);req.onsuccess=()=>resolve(req.result.sort((a,b)=>b.created-a.created));req.onerror=()=>reject(req.error)})}
async function deleteDocument(id,owner){const db=await openDocsDb();await new Promise((resolve,reject)=>{const tx=db.transaction('docs','readwrite');tx.objectStore('docs').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});renderDocuments(owner)}
function docUrl(doc){return URL.createObjectURL(doc.blob)}
async function renderDocuments(owner){
  const box=document.querySelector(`[data-doc-list="${owner}"]`);if(!box)return;
  const docs=await listDocuments(owner);
  box.innerHTML=docs.length?docs.map(doc=>`<div class="document-item"><span>📄 ${doc.name}</span><div class="document-item-actions"><button type="button" data-open-doc="${doc.id}">Ouvrir</button><button type="button" data-download-doc="${doc.id}">Télécharger</button><button type="button" data-delete-doc="${doc.id}">Supprimer</button></div></div>`).join(''):'<small>Aucun document ajouté.</small>';
  box.querySelectorAll('[data-open-doc]').forEach(btn=>btn.onclick=()=>{const doc=docs.find(x=>x.id===btn.dataset.openDoc);if(doc){const url=docUrl(doc);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),60000)}});
  box.querySelectorAll('[data-download-doc]').forEach(btn=>btn.onclick=()=>{const doc=docs.find(x=>x.id===btn.dataset.downloadDoc);if(doc){const url=docUrl(doc),a=document.createElement('a');a.href=url;a.download=doc.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}});
  box.querySelectorAll('[data-delete-doc]').forEach(btn=>btn.onclick=()=>deleteDocument(btn.dataset.deleteDoc,owner));
}
function initDocuments(){document.querySelectorAll('.document-input').forEach(input=>{input.addEventListener('change',async()=>{if(input.files?.length){await saveDocuments(input.dataset.owner,input.files);input.value=''}});renderDocuments(input.dataset.owner)})}
function initTravel(){loadTravelForms();initDocuments();refreshTravelMarkers()}
document.addEventListener('DOMContentLoaded',initTravel);
