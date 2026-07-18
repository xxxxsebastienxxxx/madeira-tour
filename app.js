
const state={places:[],activities:[],favorites:new Set(JSON.parse(localStorage.getItem('favorites')||'[]')),done:new Set(JSON.parse(localStorage.getItem('done')||'[]'))};
const $=s=>document.querySelector(s);
const stars=n=>'⭐'.repeat(n);
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const maps=q=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const waze=q=>`https://www.waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;

async function init(){
  const data=await fetch('data.json').then(r=>r.json());
  state.places=data.places; state.activities=data.activities;
  fillFilters(); render(); renderActivities(); loadWeather();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}
function fillFilters(){
  [...new Set(state.places.map(p=>p.zone))].sort().forEach(z=>$('#zoneFilter').insertAdjacentHTML('beforeend',`<option>${z}</option>`));
  [...new Set(state.places.map(p=>p.category))].sort().forEach(c=>$('#categoryFilter').insertAdjacentHTML('beforeend',`<option>${c}</option>`));
}
function filtered(){
  const q=$('#search').value.toLowerCase().trim(),z=$('#zoneFilter').value,c=$('#categoryFilter').value,r=$('#ratingFilter').value;
  return state.places.filter(p=>(!q||`${p.name} ${p.description} ${p.category} ${p.zone}`.toLowerCase().includes(q))&&(!z||p.zone===z)&&(!c||p.category===c)&&(!r||String(p.rating)===r)&&(!$('#favoritesOnly').checked||state.favorites.has(slug(p.name)))&&(!$('#hideDone').checked||!state.done.has(slug(p.name))));
}
function render(){
  const list=filtered().sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name));
  $('#count').textContent=`${list.length} lieu${list.length>1?'x':''}`;
  const byZone=Object.groupBy?Object.groupBy(list,p=>p.zone):list.reduce((a,p)=>((a[p.zone]??=[]).push(p),a),{});
  $('#zones').innerHTML=Object.keys(byZone).sort().map(zone=>`<section class="zone-block"><div class="zone-title"><h3>📍 ${zone}</h3><span class="pill">${byZone[zone].length}</span></div><div class="grid">${byZone[zone].map(card).join('')}</div></section>`).join('')||'<div class="empty card">Aucun lieu ne correspond aux filtres.</div>';
  bindCards();
}
function card(p){
  const id=slug(p.name),fav=state.favorites.has(id),done=state.done.has(id);
  return `<article class="place ${done?'done':''}" data-id="${id}">
    <div class="section-head"><div><div class="rating">${stars(p.rating)}</div><h4>${p.name}</h4></div><button class="icon-btn fav" title="Favori">${fav?'❤️':'🤍'}</button></div>
    <div class="meta"><span class="tag">${p.category}</span><span class="tag">${p.duration}</span></div>
    <p>${p.description}</p>
    <div class="actions">
      <button class="details">Voir la fiche</button>
      <a class="maps" href="${maps(p.query)}" target="_blank" rel="noopener">Google Maps</a>
      <a class="waze" href="${waze(p.query)}" target="_blank" rel="noopener">Waze</a>
      <button class="doneBtn">${done?'↩ À refaire':'✓ Fait'}</button>
    </div></article>`;
}
function bindCards(){
  document.querySelectorAll('.place').forEach(el=>{
    const p=state.places.find(x=>slug(x.name)===el.dataset.id);
    el.querySelector('.fav').onclick=()=>toggleSet('favorites',el.dataset.id);
    el.querySelector('.doneBtn').onclick=()=>toggleSet('done',el.dataset.id);
    el.querySelector('.details').onclick=()=>openDetail(p);
  });
}
function toggleSet(which,id){const set=state[which];set.has(id)?set.delete(id):set.add(id);localStorage.setItem(which,JSON.stringify([...set]));render()}
function openDetail(p){
  const id=slug(p.name),noteKey=`note-${id}`;
  $('#dialogContent').innerHTML=`<p class="eyebrow">${p.zone}</p><h2>${stars(p.rating)} ${p.name}</h2>
  <p>${p.description}</p>
  <div class="detail-grid">
    <div class="detail-box"><strong>Type</strong><br>${p.category}</div>
    <div class="detail-box"><strong>Temps conseillé</strong><br>${p.duration}</div>
    <div class="detail-box"><strong>Météo idéale</strong><br>${p.weather}</div>
    <div class="detail-box"><strong>Votre priorité</strong><br>${p.rating===3?'Priorité maximale':p.rating===2?'À privilégier':'Complément'}</div>
  </div>
  <h3>Conseil pratique</h3><p>${p.tips}</p>
  <h3>Vos notes</h3><textarea class="note-area" placeholder="Ajoutez votre commentaire personnel…">${localStorage.getItem(noteKey)||''}</textarea>
  <div class="actions" style="margin-top:14px"><a class="maps" href="${maps(p.query)}" target="_blank">Ouvrir dans Google Maps</a><a class="waze" href="${waze(p.query)}" target="_blank">Ouvrir dans Waze</a></div>`;
  $('#dialogContent .note-area').oninput=e=>localStorage.setItem(noteKey,e.target.value);
  $('#detailDialog').showModal();
}
function renderActivities(){
  $('#activitiesGrid').innerHTML=state.activities.sort((a,b)=>b.rating-a.rating).map(a=>`<article class="place"><div class="rating">${stars(a.rating)}</div><h4>${a.name}</h4><div class="meta"><span class="tag">${a.zone}</span></div><p>${a.description}</p><div class="actions"><a class="maps" href="${maps(a.query)}" target="_blank">Google Maps</a><a class="waze" href="${waze(a.query)}" target="_blank">Waze</a></div></article>`).join('');
}
['search','zoneFilter','categoryFilter','ratingFilter','favoritesOnly','hideDone'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',render));
$('.dialog-close').onclick=()=>$('#detailDialog').close();

const weatherZones=[
  {name:'Ouest',lat:32.72,lon:-17.17},{name:'Nord-Ouest',lat:32.82,lon:-17.12},{name:'Centre',lat:32.75,lon:-16.96},{name:'Est',lat:32.75,lon:-16.72},{name:'Funchal',lat:32.65,lon:-16.91}
];
function weatherLabel(code){if(code===0)return'☀️ Dégagé';if([1,2].includes(code))return'🌤 Peu nuageux';if(code===3)return'☁️ Couvert';if([45,48].includes(code))return'🌫 Brouillard';if(code>=51&&code<=67)return'🌧 Pluie';if(code>=71&&code<=77)return'🌨 Neige';if(code>=80&&code<=82)return'🌦 Averses';if(code>=95)return'⛈ Orage';return'Variable'}
async function loadWeather(){
  $('#weatherGrid').innerHTML='<p>Chargement…</p>';
  try{
    const results=await Promise.all(weatherZones.map(async z=>{const u=`https://api.open-meteo.com/v1/forecast?latitude=${z.lat}&longitude=${z.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FLisbon`;const d=await fetch(u).then(r=>r.json());return {...z,...d.current}}));
    $('#weatherGrid').innerHTML=results.map(x=>`<div class="weather-item"><strong>${x.name}</strong><span class="temp">${Math.round(x.temperature_2m)}°</span><br>${weatherLabel(x.weather_code)}<br><small>Vent ${Math.round(x.wind_speed_10m)} km/h</small></div>`).join('');
  }catch(e){$('#weatherGrid').innerHTML='<p>Météo indisponible. Vérifiez votre connexion.</p>'}
}
$('#refreshWeather').onclick=loadWeather;
let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true}};
init();
