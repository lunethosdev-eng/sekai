(() => {
'use strict';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={route:'home',searchType:'all',history:[],historyIndex:-1,controller:null,user:null,profile:null,guest:false,selectedAvatarUrl:null,conversations:[]};
const PRISM_REPO=String(window.SEKAI_MUSIC_SERVER||window.PRISM_REPO||'').trim().replace(/\/$/,'');

const PRISM_CATALOG = window.PRISM_CATALOG || [
  { id: '1', title: 'Sekai Theme', artist: 'Sekai Band', cover: '', file: '' },
  { id: '2', title: 'Cyber Pulse', artist: 'Hoshi Synth', cover: '', file: '' }
];

/* ===== DICCIONARIO DE ICONOS SVG NATIVOS ===== */
const SVG_ICONS = {
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  media: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  text: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>`,
  sticker: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`,
  music: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
  effect: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`,
  settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  arrowRight: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
  alignLeft: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>`,
  alignCenter: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="18" y1="18" x2="6" y2="18"></line></svg>`,
  alignRight: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="7" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>`,
  play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
};

function resolvePrismTrack(id){
  const t = PRISM_CATALOG.find(x => String(x.id)===String(id));
  if(!t) return null;
  return { ...t, file: prismMediaUrl(t.file), cover: prismMediaUrl(t.cover) };
}
function prismMediaUrl(path){
  if(!path) return '';
  if(/^https?:\/\//i.test(path)) return path;
  const base = PRISM_REPO || '';
  if(!base) return path;
  const p = path.startsWith('/') ? path : '/'+path;
  return base + p;
}
async function loadPrismCatalogFromRepo(){
  if(!PRISM_REPO) return;
  const urls = [PRISM_REPO + '/api/catalog', PRISM_REPO + '/catalog.json'];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data.data || data.tracks || data.catalog || []);
      if (!list.length) continue;
      PRISM_CATALOG.length = 0;
      list.forEach((t,i)=> PRISM_CATALOG.push({
        id: t.id || i+1,
        title: t.title || t.name || 'Track',
        artist: t.artist || t.author || '',
        cover: prismMediaUrl(t.cover || t.image || ''),
        file: prismMediaUrl(t.file || t.url || t.path || ''),
        duration: t.duration || null
      }));
      console.log('PRISM catalog loaded', PRISM_CATALOG.length, 'from', url);
      return;
    } catch (e) {}
  }
}

function autoFillLyrics(musicId, lyricsTextId){
  const t = resolvePrismTrack(musicId);
  if(!t) return;
  const box = document.getElementById(lyricsTextId);
  if(!box) return;
  box.placeholder = 'Buscando lyrics…';
  fetchLyrics(t.artist, t.title).then(d=>{
    if(d && d.lyrics){ box.value = d.lyrics; box.placeholder = 'Lyrics ('+(d.source||'')+')'; toast('Lyrics cargadas'); }
    else { box.placeholder = 'No se encontraron lyrics'; }
  });
}
async function fetchLyrics(artist, title){
  if(!title || !PRISM_REPO) return null;
  try{
    const u = PRISM_REPO + '/api/lyrics?artist=' + encodeURIComponent(artist||'') + '&title=' + encodeURIComponent(title);
    const r = await fetch(u, {cache:'no-store'});
    if(!r.ok) return null;
    const d = await r.json();
    return d && d.lyrics ? d : null;
  }catch(e){ return null; }
}

function musicUrl(x){if(!x)return null; return prismMediaUrl(x.file||x.url||'');}
function searchMusic(q){const n=q.toLowerCase();return PRISM_CATALOG.filter(x=>(x.title+' '+x.artist).toLowerCase().includes(n)).slice(0,12)}

function skeletonFeed(n=4){
 return Array.from({length:n},()=>`<article class="sekai-post skel"><div class="skel-line w40"></div><div class="skel-block"></div><div class="skel-line"></div><div class="skel-line w60"></div></article>`).join('');
}
function applyCustomization(p={}){const root=document.documentElement;const saved=JSON.parse(localStorage.getItem('sekai_customization')||'{}');const c={...saved,...p};if(c.theme_color){root.style.setProperty('--theme',c.theme_color);root.style.setProperty('--purple',c.theme_color);}if(c.accent_color){root.style.setProperty('--accent',c.accent_color);root.style.setProperty('--purple2',c.accent_color);}root.style.setProperty('--glass-alpha',String(Math.max(.55,Math.min(.96,Number(c.glass_intensity??.9)))));document.body.dataset.motion=c.animation_level||'full';document.body.dataset.nav=c.navigation_style||'normal';document.body.dataset.bg=c.background_mode||'soft';document.body.classList.toggle('contrast-high',!!c.high_contrast);document.body.classList.toggle('ui-dense',!!c.dense_ui);document.body.classList.toggle('font-large',!!c.large_font||localStorage.getItem('sekai_large_font')==='1');document.body.classList.toggle('cinema-mode',localStorage.getItem('sekai_cinema')==='1');}

const cfg={
 url:String(window.CHROMI_SUPABASE_URL||'').trim(),
 key:String(window.CHROMI_SUPABASE_PUBLISHABLE_KEY||'').trim()
};
let supabase=null;
let supabaseReady=false;
async function initSupabase(){
 try{
  let url=cfg.url,key=cfg.key;
  if((!url||!key)&&location.protocol.startsWith('http')){
   const r=await fetch('/api/config',{cache:'no-store'});
   if(r.ok){const d=await r.json();url=url||String(d.supabaseUrl||'').trim();key=key||String(d.supabasePublishableKey||d.supabaseAnonKey||'').trim();}
  }
  if(url&&key&&window.supabase?.createClient){
   supabase=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   supabaseReady=true;
  }
 }catch(err){console.error('Supabase init failed',err)}
 return supabase;
}
function requireSupabase(){if(!supabaseReady||!supabase){toast('Chromi no tiene configurada la clave pública de Supabase.','error');return null}return supabase;}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function toast(msg,type='ok'){const x=document.createElement('div');x.className=`toast ${type}`;x.textContent=msg;$('#toastHost').appendChild(x);setTimeout(()=>x.remove(),3200)}
function setRoute(route,push=true){
 const allowed=['home','sekaifeed','search','messages','profile'];
 if(!allowed.includes(route))route='home';
 if(route==='profile'&&!state.user){openOnboarding('landing');return;}
 if(route==='messages'&&!state.user){openOnboarding('landing');return;}
 if(route==='sekaifeed'&&!state.user){openOnboarding('landing');return;}
 state.route=route;
 $$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${route}`));
 $$('.nav-btn,[data-route]').forEach(b=>{
  if(b.dataset.route)b.classList.toggle('active',b.dataset.route===route);
 });
 $$('.bottom-nav button').forEach(b=>{
  if(b.dataset.route)b.classList.toggle('active',b.dataset.route===route);
 });
 document.body.classList.toggle('route-search',route==='search');
 document.body.classList.toggle('route-messages',route==='messages');
 if(route!=='search')document.body.classList.remove('search-browsing');
 if(push && location.hash.slice(1)!==route)history.pushState({route},'',`#${route}`);
 if(route==='profile')renderFullProfile();
 if(route==='sekaifeed')loadSekaiFeed(activeFeed);
 if(route==='messages'){
  const w=$('.messages-wrap');
  if(w)w.classList.remove('chat-open');
  loadConversations();
 }
}

document.addEventListener('click',e=>{
 const target=e.target.closest?.('[data-route]');
 if(!target)return;
 if(target.id==='createCenter')return;
 e.preventDefault();
 setRoute(target.dataset.route);
});
window.addEventListener('popstate',()=>setRoute(location.hash.slice(1)||'home',false));
$('#profileHome2')?.addEventListener('click',()=>state.user?openSocial():openOnboarding('landing'));
$('#homeLibrary')?.addEventListener('click',()=>{if(typeof openSocial==='function'){openSocial();setTimeout(()=>renderSocial&&renderSocial('library'),50)}else toast('Abre tu perfil para ver la biblioteca')});
$('#topAccount')?.addEventListener('click',()=>state.user?openProfile():openOnboarding('landing'));
$('#profileHome')?.addEventListener('click',()=>state.user?openProfile():openOnboarding('landing'));
$('#homeCompose')?.addEventListener('click',showCreatePost);
$('#homeBell')?.addEventListener('click',()=>openNotifications());
$('#messageBell')?.addEventListener('click',()=>openNotifications());
$('#modalClose')?.addEventListener('click',()=>$('#modal').hidden=true);

function renderBadges(badges){
  const map={
    verified:{label:'Verificado',icon:'✓',cls:'badge-verified'},
    developer:{label:'Dev',icon:'⌘',cls:'badge-dev'},
    celebrity:{label:'Celebridad',icon:'★',cls:'badge-celeb'},
    owner:{label:'Owner',icon:'◆',cls:'badge-owner'},
    special:{label:'Especial',icon:'✦',cls:'badge-special'}
  };
  const list=Array.isArray(badges)?badges:[];
  if(!list.length)return '';
  return `<span class="badge-row">${list.map(b=>{
    const m=map[b]||{label:b,icon:'•',cls:'badge-default'};
    return `<span class="user-badge ${m.cls}" title="${esc(m.label)}">${m.icon}<em>${esc(m.label)}</em></span>`;
  }).join('')}</span>`;
}

function showModal(html){$('#modalContent').innerHTML=html;$('#modal').hidden=false}
function studioFullscreen(html){
  showModal(`<div class="studio-fs">${html}</div>`);
  const modal=$('#modal'); if(modal){modal.classList.add('studio-modal');}
  const closeBtn=$('#modalClose'); if(closeBtn) closeBtn.style.display='none';
  const card=modal?.querySelector('.modal'); if(card) card.classList.add('studio-card-full');
}
function closeStudio(){
  const modal=$('#modal'); if(modal){modal.classList.remove('studio-modal'); modal.hidden=true;}
  const closeBtn=$('#modalClose'); if(closeBtn) closeBtn.style.display='';
  const card=modal?.querySelector('.modal'); if(card) card.classList.remove('studio-card-full');
}

function showCreatePost(){
 if(!state.user){openOnboarding('landing');return}
 showModal(`<span class="eyebrow">SEKAI STUDIO</span><h2>Crea en Sekai</h2><p class="muted">Elige un formato. Cada uno tiene su propio editor profesional.</p><div class="studio-grid">
 <button class="studio-card" data-editor="story"><b>${SVG_ICONS.sticker}</b><strong>Story</strong><small>24h · texto, foto, video, stickers y música</small></button>
 <button class="studio-card" data-editor="short"><b>${SVG_ICONS.text}</b><strong>Short</strong><small>Vertical · tipografía, filtros y ritmo</small></button>
 <button class="studio-card" data-editor="post"><b>${SVG_ICONS.media}</b><strong>Post</strong><small>Foto · filtros, marco y descripción</small></button>
 <button class="studio-card" data-editor="art"><b>${SVG_ICONS.effect}</b><strong>Art</strong><small>Ilustración · presentación pro</small></button>
 <button class="studio-card" data-editor="video"><b>${SVG_ICONS.play}</b><strong>Video</strong><small>Editor tipo CapCut · recorte, velocidad, música</small></button>
 </div>`);
 $$('[data-editor]').forEach(b=>b.onclick=()=>openEditor(b.dataset.editor));
}

function openEditor(type){
 if(type==='story')return showStoryEditor();
 if(type==='short')return showShortEditor();
 if(type==='video')return showVideoEditor();
 if(type==='art')return showImageEditor('art');
 return showImageEditor('image');
}

/* ===== MUSIC PICKER COMPONENT ===== */
function musicPicker(id='editorMusic', allowNone=true, selectedId=''){
  const opts = PRISM_CATALOG.map(m=>`
    <button type="button" class="music-opt ${String(m.id)===String(selectedId)?'active':''}" data-mid="${m.id}" data-target="${id}">
      <span>${SVG_ICONS.music}</span>
      <span><b>${esc(m.title)}</b><small>${esc(m.artist)}</small></span>
    </button>`).join('');
  return `<div class="music-picker liquid-panel">
    <div class="music-picker-head"><span>Música${allowNone?' (opcional)':''}</span>
      <label class="lyrics-toggle"><input type="checkbox" id="${id}_lyrics"> Letras</label>
    </div>
    <input type="hidden" id="${id}" value="${esc(selectedId)}">
    <div class="music-opt-list" id="${id}_list">
      ${allowNone?`<button type="button" class="music-opt ${!selectedId?'active':''}" data-mid="" data-target="${id}"><span>${SVG_ICONS.close}</span><span><b>Sin música</b><small>Opcional</small></span></button>`:''}
      ${opts}
    </div>
    <div class="lyrics-box" id="${id}_lyricsBox" hidden>
      <textarea id="${id}_lyricsText" rows="4" placeholder="Pega o escribe la letra (solo si quieres)…"></textarea>
    </div>
    <div class="music-note">${PRISM_REPO?'Catálogo listo.':'Catálogo local cargado.'}</div>
  </div>`;
}

function bindMusicPickers(root=document, onSelectCallback=null){
  root.querySelectorAll('.music-opt').forEach(b=>{
    b.onclick=()=>{
      const id=b.dataset.target;
      const list=document.getElementById(id+'_list');
      list?.querySelectorAll('.music-opt').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const val = b.dataset.mid || '';
      const inp=document.getElementById(id); 
      if(inp) inp.value=val;

      const lyrCb=document.getElementById(id+'_lyrics');
      const textId=id+'_lyricsText';
      if(lyrCb && lyrCb.checked && val) autoFillLyrics(val, textId);

      if(typeof onSelectCallback === 'function'){
        onSelectCallback(val);
      }
    };
  });
  root.querySelectorAll('[id$=_lyrics]').forEach(cb=>{
    if(cb.type!=='checkbox')return;
    cb.onchange=()=>{
      const id=cb.id.replace(/_lyrics$/,'');
      const box=document.getElementById(id+'_lyricsBox');
      if(box) box.hidden=!cb.checked;
      if(cb.checked){
        const mid=document.getElementById(id)?.value;
        if(mid) autoFillLyrics(mid, id+'_lyricsText');
      }
    };
  });
}

/* ========== STORY EDITOR ========== */
function showStoryEditor(){
  studioFullscreen(`
  <div class="ig-story-editor">
    <header class="ig-top">
      <button type="button" class="ig-close" id="storyClose">${SVG_ICONS.close}</button>
      <span class="ig-title">Nueva historia</span>
      <button type="button" class="ig-settings">${SVG_ICONS.settings}</button>
    </header>
    <div class="ig-canvas" id="storyCanvas">
      <div class="ig-media-layer" id="storyMediaLayer">
        <div class="ig-placeholder" id="storyPlaceholder">
          <span>${SVG_ICONS.media}</span>
          <p>Toca para añadir foto o video</p>
          <small>o escribe una nota</small>
        </div>
      </div>
      <div class="ig-text-layer" id="storyTextLayer"></div>
      <div class="ig-stickers-layer" id="storyStickersLayer"></div>
    </div>
    <div class="ig-tools" id="storyTools">
      <button type="button" class="ig-tool active" data-tool="media"><span>${SVG_ICONS.media}</span><small>Media</small></button>
      <button type="button" class="ig-tool" data-tool="text"><span>${SVG_ICONS.text}</span><small>Texto</small></button>
      <button type="button" class="ig-tool" data-tool="sticker"><span>${SVG_ICONS.sticker}</span><small>Stickers</small></button>
      <button type="button" class="ig-tool" data-tool="music"><span>${SVG_ICONS.music}</span><small>Música</small></button>
      <button type="button" class="ig-tool" data-tool="effect"><span>${SVG_ICONS.effect}</span><small>Efectos</small></button>
    </div>
    <div class="ig-panel" id="storyPanel" hidden></div>
    <div class="ig-bottom">
      <button type="button" class="ig-share-btn" id="storyToClose">Tu historia</button>
      <button type="button" class="ig-share-btn friends" id="storyToFriends">★ Mejores amigos</button>
      <button type="button" class="ig-next" id="storyPublish">${SVG_ICONS.arrowRight}</button>
    </div>
    <input type="file" id="storyFile" accept="image/*,video/*" hidden>
    <input type="hidden" id="storyType" value="note">
    <input type="hidden" id="storyBg" value="soft">
    <input type="hidden" id="storyAlign" value="center">
    <input type="hidden" id="storyMusicId" value="">
  </div>`);
  $('#storyClose').onclick=()=>{closeStudio(); showCreatePost();};
  initStoryEditor();
}

function initStoryEditor(){
  const stateS = {type:'note', text:'', mediaUrl:null, mediaFile:null, bg:'soft', align:'center', musicId:'', stickers:[], effect:'none'};
  window._storyState = stateS;
  $$('#storyTools .ig-tool').forEach(b=>b.onclick=()=>{
    $$('#storyTools .ig-tool').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    openStoryPanel(b.dataset.tool);
  });
  $('#storyPlaceholder')?.addEventListener('click',()=>$('#storyFile').click());
  $('#storyFile').onchange = e=>{
    const f=e.target.files?.[0]; if(!f)return;
    stateS.mediaFile=f;
    stateS.type = f.type.startsWith('video') ? 'video' : 'image';
    $('#storyType').value = stateS.type;
    const url = URL.createObjectURL(f);
    stateS.mediaUrl = url;
    const layer = $('#storyMediaLayer');
    if(stateS.type==='video'){
      layer.innerHTML = `<video src="${url}" autoplay muted loop playsinline class="ig-media"></video>`;
    } else {
      layer.innerHTML = `<img src="${url}" class="ig-media" alt="">`;
    }
  };
  $('#storyPublish').onclick = ()=>publishStoryAdvanced();
  $('#storyToClose').onclick = ()=>publishStoryAdvanced('public');
  $('#storyToFriends').onclick = ()=>publishStoryAdvanced('friends');
  openStoryPanel('media');
}

function openStoryPanel(tool){
  const panel = $('#storyPanel');
  if(!panel) return;
  panel.hidden = false;
  if(tool==='media'){
    panel.innerHTML = `
      <div class="ig-panel-inner">
        <button type="button" class="ig-chip" id="pickMedia">Elegir foto/video</button>
        <button type="button" class="ig-chip" id="pickNote">Solo nota</button>
        <div class="ig-bg-row">
          <span>Fondo</span>
          <button type="button" class="ig-bg" data-bg="soft" style="background:linear-gradient(160deg,#c4b5fd,#a78bfa)"></button>
          <button type="button" class="ig-bg" data-bg="night" style="background:#1e1b2e"></button>
          <button type="button" class="ig-bg" data-bg="paper" style="background:#f5f0e8"></button>
          <button type="button" class="ig-bg" data-bg="clear" style="background:#111"></button>
        </div>
      </div>`;
    $('#pickMedia').onclick=()=>$('#storyFile').click();
    $('#pickNote').onclick=()=>{
      window._storyState.type='note'; $('#storyType').value='note';
      $('#storyMediaLayer').innerHTML = `<div class="ig-note-bg" data-bg="${window._storyState.bg}"></div>`;
    };
    $$('.ig-bg').forEach(b=>b.onclick=()=>{
      window._storyState.bg=b.dataset.bg; $('#storyBg').value=b.dataset.bg;
      const note=$('.ig-note-bg'); if(note) note.dataset.bg=b.dataset.bg;
      $('#storyCanvas').dataset.bg=b.dataset.bg;
    });
  } else if(tool==='text'){
    panel.innerHTML = `
      <div class="ig-panel-inner">
        <textarea id="storyTextInput" maxlength="700" placeholder="Escribe algo..." rows="3"></textarea>
        <div class="ig-align-row">
          <button type="button" data-align="left">${SVG_ICONS.alignLeft}</button>
          <button type="button" data-align="center" class="active">${SVG_ICONS.alignCenter}</button>
          <button type="button" data-align="right">${SVG_ICONS.alignRight}</button>
        </div>
        <button type="button" class="ig-chip primary" id="addStoryText">Añadir texto</button>
      </div>`;
    $('#storyTextInput').value = window._storyState.text || '';
    $$('[data-align]').forEach(b=>b.onclick=()=>{
      $$('[data-align]').forEach(x=>x.classList.remove('active')); b.classList.add('active');
      window._storyState.align=b.dataset.align; $('#storyAlign').value=b.dataset.align;
    });
    $('#addStoryText').onclick=()=>{
      const t=$('#storyTextInput').value.trim(); if(!t)return;
      window._storyState.text=t;
      const layer=$('#storyTextLayer');
      layer.innerHTML = `<div class="ig-text-bubble" style="text-align:${window._storyState.align}">${esc(t)}</div>`;
    };
  } else if(tool==='sticker'){
    panel.innerHTML = `
      <div class="ig-panel-inner stickers-grid">
        <button type="button" class="sticker-item" data-st="location">Ubicación</button>
        <button type="button" class="sticker-item" data-st="mention">Mención</button>
        <button type="button" class="sticker-item" data-st="music">Música</button>
        <button type="button" class="sticker-item" data-st="poll">Encuesta</button>
        <button type="button" class="sticker-item" data-st="hashtag">Hashtag</button>
      </div>`;
    $$('.sticker-item').forEach(b=>b.onclick=()=>addStorySticker(b.dataset.st));
  } else if(tool==='music'){
    panel.innerHTML = `<div class="ig-panel-inner">${musicPicker('storyMusicSelect', true, window._storyState.musicId)}</div>`; 
    bindMusicPickers(panel, (selectedId) => {
      window._storyState.musicId = selectedId;
      $('#storyMusicId').value = selectedId;
      const track = resolvePrismTrack(selectedId);
      if(track) toast('Música seleccionada: ' + track.title);
    });
  } else if(tool==='effect'){
    panel.innerHTML = `
      <div class="ig-panel-inner">
        <div class="ig-effects">
          <button type="button" class="fx" data-fx="none">Original</button>
          <button type="button" class="fx" data-fx="soft">Soft</button>
          <button type="button" class="fx" data-fx="vivid">Vivid</button>
          <button type="button" class="fx" data-fx="mono">B&W</button>
        </div>
      </div>`;
    $$('.fx').forEach(b=>b.onclick=()=>{
      window._storyState.effect=b.dataset.fx;
      const media=$('.ig-media'); if(media) media.dataset.filter=b.dataset.fx;
    });
  }
}

function addStorySticker(type){
  const layer=$('#storyStickersLayer'); if(!layer)return;
  const labels={location:'📍 Aquí',mention:'@amigo',music:'🎵 Now Playing',poll:'📊 Sí / No',hashtag:'#Sekai'};
  const el=document.createElement('div');
  el.className='ig-sticker';
  el.textContent=labels[type]||type;
  el.style.left=(20+Math.random()*50)+'%';
  el.style.top=(20+Math.random()*40)+'%';
  layer.appendChild(el);
  window._storyState.stickers.push({type,label:labels[type]});
}

async function publishStoryAdvanced(vis='public'){
  const sb=requireSupabase(); if(!sb||!state.user)return;
  const s=window._storyState||{};
  const type=s.type||'note';
  let media_url=null;
  const btn=$('#storyPublish'); if(btn){btn.disabled=true; btn.textContent='…';}
  try{
    if((type==='image'||type==='video') && s.mediaFile){
      const ext=(s.mediaFile.name.split('.').pop()||'jpg').toLowerCase();
      const path=`${state.user.id}/stories/${crypto.randomUUID()}.${ext}`;
      const up=await sb.storage.from('sekai-media').upload(path,s.mediaFile,{upsert:false,contentType:s.mediaFile.type,cacheControl:'31536000'});
      if(up.error)throw up.error;
      media_url=sb.storage.from('sekai-media').getPublicUrl(path).data.publicUrl;
    }
    const m=resolvePrismTrack(s.musicId);
    const payload={
      user_id:state.user.id, type, media_url,
      text:s.text||'', background:s.bg||'soft', align:s.align||'center',
      music_id:m?.id||null, music_title:m?.title||null, music_artist:m?.artist||null, music_url:m?musicUrl(m):null,
      expires_at:new Date(Date.now()+24*60*60*1000).toISOString()
    };
    const {error}=await sb.from('stories').insert(payload);
    if(error)throw error;
    closeStudio(); toast('Story publicada. ✨');
  }catch(err){ toast('No pude publicar la Story: '+err.message,'error'); }
  finally{ if(btn){btn.disabled=false; btn.textContent='›';} }
}

/* ========== SHORT EDITOR ========== */
function showShortEditor(){
  studioFullscreen(`
  <div class="cap-editor short-mode">
    <header class="cap-top">
      <button type="button" class="cap-back" id="shortBack">‹</button>
      <span>Short</span>
      <button type="button" class="cap-export" id="shortPublish">Publicar</button>
    </header>
    <div class="cap-preview-wrap">
      <div class="cap-preview short-preview" id="shortPreview">
        <div class="cap-text-overlay" id="shortTextOverlay">Tu texto aquí</div>
      </div>
    </div>
    <div class="cap-toolbar">
      <button type="button" class="cap-tool active" data-cap="text"><span>${SVG_ICONS.text}</span>Texto</button>
      <button type="button" class="cap-tool" data-cap="music"><span>${SVG_ICONS.music}</span>Música</button>
      <button type="button" class="cap-tool" data-cap="fx"><span>${SVG_ICONS.effect}</span>Efectos</button>
    </div>
    <div class="cap-panel" id="shortPanel"></div>
  </div>`);
  $('#shortBack').onclick=()=>{closeStudio(); showCreatePost();};
  initShortEditor();
}

function initShortEditor(){
  const st={text:'', font:'Jakarta', size:34, bg:'gradient', align:'center', musicId:'', fx:'none'};
  window._shortState=st;
  const render=()=>{
    const ov=$('#shortTextOverlay'); if(!ov)return;
    ov.textContent=st.text||'Tu texto aquí';
    ov.style.fontSize=st.size+'px';
    ov.style.textAlign=st.align;
    $('#shortPreview').dataset.bg=st.bg;
    $('#shortPreview').dataset.fx=st.fx;
  };
  $$('.cap-tool').forEach(b=>b.onclick=()=>{
    $$('.cap-tool').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const p=$('#shortPanel');
    if(b.dataset.cap==='text'){
      p.innerHTML=`<textarea id="shortText" maxlength="900" placeholder="Escribe tu Short..." rows="4">${esc(st.text)}</textarea>`;
      $('#shortText').oninput=e=>{st.text=e.target.value; render();};
    } else if(b.dataset.cap==='music'){
      p.innerHTML=musicPicker('shortMusic', true, st.musicId); 
      bindMusicPickers(p, (selectedId) => {
        st.musicId = selectedId;
      });
    } else if(b.dataset.cap==='fx'){
      p.innerHTML=`<div class="cap-fx-row">
        <button type="button" data-fx="none">Original</button>
        <button type="button" data-fx="soft">Soft</button>
        <button type="button" data-fx="mono">B&W</button>
      </div>`;
      $$('[data-fx]').forEach(x=>x.onclick=()=>{st.fx=x.dataset.fx;render();});
    }
  });
  $$('.cap-tool')[0].click();
  $('#shortPublish').onclick=async()=>{
    const sb=requireSupabase(); if(!sb||!state.user)return;
    const m=resolvePrismTrack(st.musicId);
    const payload={user_id:state.user.id,type:'short',media_url:null,title:'',caption:st.text.trim(),visibility:'public',
      music_id:m?.id||null,music_title:m?.title||null,music_artist:m?.artist||null,music_url:m?musicUrl(m):null,
      editor_data:{font:st.font,size:st.size,background:st.bg,align:st.align,fx:st.fx}};
    const btn=$('#shortPublish'); btn.disabled=true; btn.textContent='…';
    try{
      const {error}=await sb.from('posts').insert(payload);
      if(error)throw error;
      closeStudio(); toast('Short publicado. ✨');
    }catch(err){toast('No pude publicar el Short: '+err.message,'error');}
    finally{btn.disabled=false; btn.textContent='Publicar';}
  };
}

/* ========== SKELETON FUNCTIONS ========== */
function showImageEditor(kind){ showModal(`<h2>Editor de Imagen/Arte en construcción</h2>`); }
function showVideoEditor(){ showModal(`<h2>Editor de Video en construcción</h2>`); }

async function loadSekaiFeed(){ }
async function loadHomeFeed(){ }
async function openNotifications(){ }
async function openProfile(){ setRoute('profile'); }
function renderFullProfile(){ }
function openOnboarding(){ }

(async()=>{
  setRoute(location.hash.slice(1)||'home',false);
  await initSupabase();
  loadPrismCatalogFromRepo();
})();

})();
