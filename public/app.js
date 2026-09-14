(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={route:'home',searchType:'all',history:[],historyIndex:-1,controller:null,user:null,profile:null,guest:false,selectedAvatarUrl:null,conversations:[]};
const PRISM_REPO=String(window.SEKAI_MUSIC_SERVER||window.PRISM_REPO||'').trim().replace(/\/$/,'');
let prismCatalogPromise=null;

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
  if(prismCatalogPromise) return prismCatalogPromise;
  prismCatalogPromise=(async()=>{
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
  console.log('PRISM catalog remoto no disponible, catálogo local');
  })();
  return prismCatalogPromise;
}

loadPrismCatalogFromRepo();

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
function requireSupabase(){if(!supabaseReady||!supabase){toast('Chromi no tiene configurada la clave pública de Supabase. Configura SUPABASE_PUBLISHABLE_KEY en el servidor.','error');return null}return supabase;}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
window.__chromiHandleOAuthCallback=async function(raw){try{const u=new URL(raw);const code=u.searchParams.get('code');if(code&&supabase){const {error}=await supabase.auth.exchangeCodeForSession(code);if(error)toast(error.message,'error');else toast('Sesión iniciada con Google.')}}catch(e){toast('No se pudo completar Google Sign-In.','error')}};

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

// Navegación global: cualquier botón/enlace con data-route funciona, incluso
// cuando el elemento fue creado dinámicamente después de cargar la página.
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
$('#topAccount').addEventListener('click',()=>state.user?openProfile():openOnboarding('landing'));
$('#profileHome')?.addEventListener('click',()=>state.user?openProfile():openOnboarding('landing'));
$('#homeCompose')?.addEventListener('click',showCreatePost);
$('#homeBell')?.addEventListener('click',()=>openNotifications());
$('#messageBell')?.addEventListener('click',()=>openNotifications());
async function refreshNotificationBadges(){
 const sb=requireSupabase(); if(!sb||!state.user)return;
 const {count}=await sb.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',state.user.id).eq('read',false);
 ['homeBell','messageBell'].forEach(id=>{const el=$('#'+id);if(!el)return;el.dataset.unread=String(count||0);el.title=(count||0)?`Notificaciones sin leer: ${count}`:'Notificaciones';el.setAttribute('aria-label',(count||0)?`Notificaciones, ${count} sin leer`:'Notificaciones');});
}

$('#groupsBtn')?.addEventListener('click',()=>toast('Los grupos todavía no están habilitados en tu base de datos.','ok'));
$('#requestsBtn')?.addEventListener('click',()=>state.user?openSocial('requests'):openOnboarding('landing'));
$('#modalClose').addEventListener('click',()=>$('#modal').hidden=true);['onboarding','modal'].forEach(id=>$('#'+id).addEventListener('click',e=>{if(e.target.id===id)e.currentTarget.hidden=true}));

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

function openOnboarding(step='landing'){const o=$('#onboarding');o.hidden=false;renderOnboarding(step)}
function renderOnboarding(step){
 const c=$('#onboardContent'),o=$('#onboarding');
 const draft=state.onboardDraft||{};
 if(step==='intro1'){
  c.innerHTML=`<div class="cinematic-intro"><div class="intro-sky"></div><div class="intro-stars">✦　·　✧　·　✦</div><div class="intro-character"></div><div class="intro-copy"><span class="intro-star">✦</span><div class="intro-wordmark">Sekai</div><p>Conecta · Explora · Comparte</p></div><div class="intro-caption">Un mundo para las cosas que te hacen feliz.</div></div>`;
  clearTimeout(window.__sekaiIntroTimer);window.__sekaiIntroTimer=setTimeout(()=>renderOnboarding('landing'),4800);return;
 }
 if(step==='landing')c.innerHTML=`<div class="ob-page cinematic-card"><div class="ob-brandline"><span class="onboard-mark">✦</span><b>Sekai</b><small>1/5</small></div><div class="ob-art ob-art-welcome"></div><span class="eyebrow">BIENVENIDO A SEKAI</span><h1>Un espacio social y de exploración para fans.</h1><p>Conecta, explora y comparte anime, manga, web y mucho más.</p><div class="ob-feature"><span>♧</span><div><b>Conecta</b><small>Conecta con personas que comparten tus mismos gustos.</small></div></div><div class="ob-feature"><span>▣</span><div><b>Explora</b><small>Explora contenido de anime, manga, video, arte y web.</small></div></div><div class="ob-feature"><span>◉</span><div><b>Chromi</b><small>Usa Chromi, nuestro navegador integrado y mucho más.</small></div></div><button class="primary wide ob-cta" data-onboard="choose"><span>Empezar</span><span class="ob-cta-arrow">→</span></button><div class="ob-dots"><i class="active"></i><i></i><i></i><i></i><i></i></div></div>`;
 else if(step==='choose')c.innerHTML=`<div class="ob-page"><div class="ob-brandline"><span class="onboard-mark small">✦</span><b>Sekai</b><small>2/5</small></div><div class="ob-art ob-art-account"></div><span class="eyebrow">TU CUENTA</span><h1>Entra o crea tu espacio.</h1><p>Un solo perfil para conectar, publicar y explorar.</p><button class="oauth" id="googleBtn"><span class="google-g">G</span><b>Continuar con Google</b><em>›</em></button><button class="oauth" data-onboard="signup"><span>✉</span><b>Registrarse con correo</b><em>›</em></button>
<button class="oauth" data-onboard="login"><span>🔑</span><b>Iniciar sesión</b><em>›</em></button>
<div class="ob-divider"><span></span>o<span></span></div>
<button class="oauth guest-choice" data-onboard="guest"><span>♙</span><b>Continuar como invitado</b><em>›</em></button><small class="legal">Al continuar, aceptas nuestros Términos de servicio y Política de privacidad.</small></div>`;
 else if(step==='profile')c.innerHTML=`<div class="ob-page compact-ob"><div class="ob-brandline"><span class="onboard-mark small">✦</span><b>Sekai</b><small>3/5</small></div><span class="eyebrow">ELIGE TU NOMBRE DE USUARIO</span><h1>Tu identidad en Sekai.</h1><p>Será tu identidad única dentro de Sekai.</p><form id="profileForm" class="form onboarding-profile-form"><label>Nickname (visible en la app)<input id="profileNick" maxlength="32" required placeholder="Ej. Alex" value="${esc(draft.nick||'')}"></label><label>Nombre de usuario (único)<div class="username-input"><span>@</span><input id="profileUsername" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required placeholder="Ej. alex" value="${esc(draft.username||'')}"></div></label><div class="visibility"><span>¿Quién puede ver tu perfil?</span><label class="choice-card"><input type="radio" name="visibility" value="public" ${draft.visibility!=='private'?'checked':''}><span><b>Público</b><small>Todos pueden ver tu perfil.</small></span></label><label class="choice-card"><input type="radio" name="visibility" value="private" ${draft.visibility==='private'?'checked':''}><span><b>Privado</b><small>Solo tus amigos pueden verlo.</small></span></label></div><button class="primary wide" type="submit">Siguiente <span>→</span></button></form><div class="ob-dots"><i></i><i></i><i class="active"></i><i></i><i></i></div></div>`;
 else if(step==='avatar')c.innerHTML=`<div class="ob-page compact-ob"><div class="ob-brandline"><span class="onboard-mark small">✦</span><b>Sekai</b><small>4/5</small></div><span class="eyebrow">TU FOTO DE PERFIL</span><h1>Elige una imagen para representarte.</h1><p>Puedes cambiarla más tarde.</p><div class="avatar-preview" id="avatarPreview">${state.selectedAvatarUrl?`<img src="${esc(state.selectedAvatarUrl)}" alt="">`:'U'}<span class="camera-badge">⌾</span></div><div class="avatar-grid">${['1000059278-Photoroom.png','1000059279-Photoroom.png','1000059280-Photoroom.png','1000059281-Photoroom.png','1000059282-Photoroom.png','1000059283-Photoroom.png','1000059284-Photoroom.png'].map((f,i)=>`<button type="button" class="avatar-choice ${state.selectedAvatarUrl===`assets/${f}`?'selected':''}" data-avatar="assets/${f}"><img src="assets/${f}" alt="Avatar ${i+1}"></button>`).join('')}<button type="button" class="avatar-choice add-avatar" id="customAvatarBtn">＋</button></div><input id="profileAvatar" type="file" accept="image/*" hidden><div class="avatar-note">También puedes subir tu propia foto.</div><button class="primary wide" id="avatarNext">Siguiente <span>→</span></button><div class="ob-dots"><i></i><i></i><i></i><i class="active"></i><i></i></div></div>`;
 else if(step==='welcome')c.innerHTML=`<div class="ob-page welcome-final cinematic-card"><div class="welcome-art"></div><span class="eyebrow">5/5 · SEKAI LISTO</span><h1>¡Bienvenido a Sekai!</h1><p>Tu aventura comienza ahora.</p><div class="welcome-id"><span>▣</span><div><small>ID DE SEKAI</small><b>${esc(state.profile?.chromi_id||'')}</b><small>Guarda esto, es único y te identifica en la comunidad.</small></div></div><button class="primary wide" id="enterSekai">Comenzar</button><div class="ob-dots"><i></i><i></i><i></i><i></i><i class="active"></i></div></div>`;
 else if(step==='login')c.innerHTML=`<div class="ob-page compact-ob"><button class="back-onboard" data-onboard="choose">‹</button><span class="eyebrow">INICIAR SESIÓN</span><h1>Vuelve a tu Sekai.</h1><p>Recupera tu perfil, amigos y conversaciones.</p><form id="loginForm" class="form"><label>Correo<input id="loginEmail" type="email" required autocomplete="email" placeholder="tu@email.com"></label><label>Contraseña<input id="loginPassword" type="password" required autocomplete="current-password" placeholder="••••••••"></label><button class="primary wide">Iniciar sesión</button></form><button class="oauth" id="googleLogin"><span class="google-g">G</span><b>Continuar con Google</b></button><button class="text-link" data-onboard="signup">Crear una cuenta</button></div>`;
 else if(step==='signup')c.innerHTML=`<div class="ob-page compact-ob"><button class="back-onboard" data-onboard="choose">‹</button><span class="eyebrow">REGISTRARSE</span><h1>Tu acceso al Sekai.</h1><p>Crea tu cuenta y después personalizamos tu perfil.</p><form id="signupForm" class="form"><label>Correo electrónico<input id="signupEmail" type="email" required autocomplete="email" placeholder="tu@email.com"></label><label>Contraseña<input id="signupPassword" type="password" minlength="8" required autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label><button class="primary wide">Crear cuenta</button></form><button class="text-link" data-onboard="choose">Volver</button></div>`;
 else return;
 $$('[data-onboard]').forEach(b=>b.addEventListener('click',()=>{const s=b.dataset.onboard;if(s==='guest')return guestSignIn();renderOnboarding(s)}));
 $('#googleBtn')?.addEventListener('click',googleSignIn);$('#googleLanding')?.addEventListener('click',googleSignIn);$('#googleLogin')?.addEventListener('click',googleSignIn);$('#loginForm')?.addEventListener('submit',login);$('#signupForm')?.addEventListener('submit',signup);
 $('#profileForm')?.addEventListener('submit',e=>{e.preventDefault();state.onboardDraft={nick:$('#profileNick').value.trim(),username:$('#profileUsername').value.trim().toLowerCase(),visibility:$('input[name="visibility"]:checked').value};renderOnboarding('avatar')});
 $('#customAvatarBtn')?.addEventListener('click',()=>$('#profileAvatar').click());$('#profileAvatar')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;state.selectedAvatarUrl=URL.createObjectURL(f);$('#avatarPreview').innerHTML=`<img src="${esc(state.selectedAvatarUrl)}" alt=""> <span class="camera-badge">⌾</span>`});
 $$('[data-avatar]').forEach(b=>b.addEventListener('click',()=>{state.selectedAvatarUrl=b.dataset.avatar;$$('[data-avatar]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');$('#avatarPreview').innerHTML=`<img src="${esc(state.selectedAvatarUrl)}" alt=""> <span class="camera-badge">⌾</span>`}));
 $('#avatarNext')?.addEventListener('click',async()=>{if(!state.user)return toast('Tu sesión no está disponible.','error');const draft=state.onboardDraft||{};
 let username=(draft.username||'').trim().toLowerCase();
 let nick=(draft.nick||'').trim();
 if(!username||username.length<3){toast('Primero elige tu nombre de usuario.','error');return renderOnboarding('profile');}
 if(!nick)nick=username;
 const bio='',visibility=draft.visibility||'public',status_text='';let avatar_url=state.profile?.avatar_url||null;const file=$('#profileAvatar')?.files?.[0];if(file){const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${state.user.id}/avatar.${ext}`;const up=await supabase.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});if(up.error)return toast('No pude subir la foto: '+up.error.message,'error');avatar_url=supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}else if(state.selectedAvatarUrl){avatar_url=state.selectedAvatarUrl}
 const chromi_id = (state.profile && state.profile.chromi_id) || ('CHR-' + crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase());
 const payload={id:state.user.id,username,display_name:nick,bio,visibility,avatar_url,status_text,chromi_id};
 const {data,error}=await supabase.from('profiles').upsert(payload,{onConflict:'id'}).select().single();if(error){if(error.code==='23505')return toast('Ese nombre de usuario ya está ocupado.','error');return toast(error.message,'error')}state.profile=data;state.onboardDraft=null;localStorage.removeItem('chromi_onboarding_pending');$('#topName').textContent=data.display_name||data.username;$('#homeProfileText').textContent='@'+data.username+' · '+data.chromi_id;renderOnboarding('welcome')});
 $('#enterSekai')?.addEventListener('click',()=>{$('#onboarding').hidden=true;localStorage.setItem('chromi_onboarding_seen','1');setRoute('home')});
}
async function googleSignIn(){if(!supabase)return toast('Supabase no está configurado.','error');const redirect=window.CHROMI_AUTH_REDIRECT||location.origin;const {data,error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect,skipBrowserRedirect:!!window.CHROMI_NATIVE}});if(error)return toast(error.message,'error');if(window.CHROMI_NATIVE&&data?.url&&window.AndroidBridge?.openExternal)window.AndroidBridge.openExternal(data.url);else if(data?.url)location.href=data.url}
async function login(e){e.preventDefault();const sb=requireSupabase();if(!sb)return;const btn=e.submitter||e.target.querySelector('button[type="submit"],button.primary');if(btn){btn.disabled=true;btn.textContent='Entrando…'}
try{
 const {data,error}=await sb.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});
 if(error)return toast(error.message,'error');
 await applySession(data.session);
 // Perfil listo → salir del overlay; si falta perfil → pantalla de perfil
 if(state.profile && !String(state.profile.username||'').startsWith('guest_')){
  $('#onboarding').hidden=true;
  localStorage.setItem('chromi_onboarding_seen','1');
  setRoute('home');
  toast('Bienvenido de nuevo.');
 }else{
  toast('Sesión iniciada. Completa tu perfil.');
  renderOnboarding('profile');
 }
}finally{if(btn){btn.disabled=false;btn.textContent='Iniciar sesión'}}}
async function signup(e){e.preventDefault();const sb=requireSupabase();if(!sb)return;const email=$('#signupEmail').value.trim(),password=$('#signupPassword').value;if(password.length<8)return toast('Usa una contraseña de al menos 8 caracteres.','error');localStorage.setItem('chromi_onboarding_pending','1');localStorage.setItem('chromi_signup_email',email);const {data,error}=await sb.auth.signUp({email,password});if(error)return toast(error.message,'error');if(data.session)renderOnboarding('profile');else {toast('Cuenta creada. Si Supabase todavía exige confirmación de correo, desactívala en Authentication → Providers → Email.','error');renderOnboarding('login')}}
async function guestSignIn(){const sb=requireSupabase();if(!sb)return;const {data,error}=await sb.auth.signInAnonymously();if(error)return toast('No se pudo entrar como Guest. Activa Anonymous Sign-Ins en Supabase.','error');state.guest=true;await applySession(data.session);renderOnboarding('welcome');}
async function finishProfile(e){e.preventDefault();if(!state.user)return toast('Tu sesión no está disponible.','error');const username=$('#profileUsername').value.trim().toLowerCase(),nick=$('#profileNick').value.trim(),bio=$('#profileBio').value.trim(),visibility=$('input[name="visibility"]:checked').value,status_text=($('#profileStatus')?.value||'').trim();let avatar_url=state.profile?.avatar_url||null;const file=$('#profileAvatar').files[0];if(file){const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${state.user.id}/avatar.${ext}`;const up=await supabase.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});if(up.error)return toast('No pude subir la foto: '+up.error.message,'error');avatar_url=supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}
const {data,error}=await supabase.from('profiles').upsert({id:state.user.id,username,display_name:nick,bio,visibility,avatar_url,status_text},{onConflict:'id'}).select().single();if(error){if(error.code==='23505')return toast('Ese nombre de usuario ya está ocupado.','error');return toast(error.message,'error')}await supabase.auth.updateUser({data:{display_name:nick,username}});state.profile=data;localStorage.removeItem('chromi_onboarding_pending');$('#topName').textContent=data.display_name||data.username;$('#homeProfileText').textContent='@'+data.username+' · '+data.chromi_id;renderOnboarding('welcome')}
async function openProfile(){
 setRoute('profile');
 renderFullProfile();
}
function profileAvatarMarkup(p,cls=''){return p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="" class="${cls}">`:esc((p.display_name||'U')[0]).toUpperCase()}
function renderFullProfile(){
 const p=state.profile||{};
 const cover=$('#profileCover');
 if(cover)cover.style.background=p.banner_url?`center/cover url('${esc(p.banner_url)}')`:`radial-gradient(circle at 78% 18%,rgba(255,255,255,.8),transparent 20%),linear-gradient(135deg,${esc(p.theme_color||'#9278df')},${esc(p.accent_color||'#d8ccff')} 52%,#f8f4ff)`;
 const av=$('#profileAvatarFull');if(av)av.innerHTML=profileAvatarMarkup(p);
 const name=$('#profileNameFull');if(name)name.textContent=p.display_name||'Usuario';
 const handle=$('#profileHandleFull');if(handle)handle.textContent='@'+(p.username||'guest');
 const status=$('#profileStatusFull');if(status){status.textContent=p.status_text||'';status.hidden=!p.status_text}
 const bio=$('#profileBioFull');if(bio)bio.textContent=p.bio||'Sin bio todavía. Personaliza tu perfil para contarle al Sekai quién eres.';
 const id=$('#profileIdFull');if(id)id.textContent=p.chromi_id||state.user?.id||'—';
 const pb=$('#profileBadges');if(pb)pb.innerHTML=renderBadges(p.badges);
 $('#statPosts').textContent='0';$('#statFollowers').textContent='0';$('#statFollowing').textContent='0';
 renderProfileTab('posts');
 loadProfileStats();
 $$('#profileTabContent').forEach(()=>{});
 $$('.profile-tabs-full [data-profile-tab]').forEach(b=>{b.onclick=()=>{$$('.profile-tabs-full button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderProfileTab(b.dataset.profileTab)}});
 $('#profileEditFull').onclick=openEditProfile;
 $('#profileMoreFull').onclick=()=>openSocial();
 $('#copyProfileId').onclick=async()=>{try{await navigator.clipboard.writeText(p.chromi_id||state.user?.id||'');toast('ID copiado.')}catch{toast('No se pudo copiar el ID.','error')}};
}
async function loadProfileStats(){
 if(!state.user||!supabase)return;
 const {count:postCount}=await supabase.from('posts').select('id',{count:'exact',head:true}).eq('user_id',state.user.id);
 const {data:friends}=await supabase.from('friendships').select('requester_id,addressee_id').or(`requester_id.eq.${state.user.id},addressee_id.eq.${state.user.id}`).eq('status','accepted');
 const rows=friends||[];
 $('#statPosts').textContent=String(postCount||0);
 $('#statFollowing').textContent=String(rows.filter(x=>x.requester_id===state.user.id).length);
 $('#statFollowers').textContent=String(rows.filter(x=>x.addressee_id===state.user.id).length);
}
async function renderProfileTab(tab){
 const c=$('#profileTabContent');if(!c)return;
 if(tab==='posts'){
  if(!state.user){c.innerHTML='<div class="profile-empty"><p>Inicia sesión para ver tu perfil.</p></div>';return}
  c.innerHTML='<div class="empty-state">Cargando tus publicaciones…</div>';
  const {data,error}=await supabase.from('posts').select('id,user_id,type,media_url,thumbnail_url,title,caption,visibility,duration_seconds,music_id,music_title,music_artist,music_url,editor_data,created_at,profiles(username,display_name,avatar_url,badges)').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(40);
  if(error){c.innerHTML=`<div class="empty-state">No se pudieron cargar tus publicaciones.<br><small>${esc(error.message)}</small></div>`;return}
  c.innerHTML=(data||[]).map(renderPost).join('')||`<div class="profile-empty"><div class="empty-glyph">✦</div><h2>Tu espacio empieza aquí</h2><p>Aún no has publicado nada.</p><button class="primary" id="profileCreatePost">Crear publicación</button></div>`;
  $('#profileCreatePost')?.addEventListener('click',showCreatePost);
  bindPostActions(c);
 } else if(tab==='info'){
  const p=state.profile||{};c.innerHTML=`<div class="info-grid"><div><small>Nombre de usuario</small><b>@${esc(p.username||'guest')}</b></div><div><small>Visibilidad</small><b>${p.visibility==='private'?'Privado':'Público'}</b></div><div><small>ID único</small><b>${esc(p.chromi_id||state.user?.id||'—')}</b></div><div><small>Estado</small><b>${esc(p.status_text||'Sin estado')}</b></div></div>`
 } else {
  const friends=await loadFriends();c.innerHTML=(friends||[]).map(f=>`<div class="friend-row"><span class="mini-avatar">${f.avatar_url?`<img src="${esc(f.avatar_url)}">`:esc((f.display_name||'U')[0])}</span><div><b>${esc(f.display_name||f.username)}</b><small>@${esc(f.username)}</small></div><button class="secondary" data-chat-friend="${esc(f.id)}">Mensaje</button></div>`).join('')||`<div class="profile-empty"><div class="empty-glyph">◎</div><h2>Aún no tienes amigos</h2><p>Busca personas y envía solicitudes para que aparezcan aquí.</p><button class="secondary" id="profileFriends">Buscar personas</button></div>`;$('#profileFriends')?.addEventListener('click',()=>openSocial('friends'));$$('[data-chat-friend]').forEach(b=>b.onclick=async()=>{setRoute('messages');await loadConversations();openConversation(b.dataset.chatFriend)})
 }
}
async function openEditProfile(){
 const p=state.profile||{};
 const links=Array.isArray(p.links)?p.links:(typeof p.links==='string'?(()=>{try{return JSON.parse(p.links)}catch{return[]}})():[]);
 const linkRows=(links.length?links:[{label:'',url:''}]).map((l,i)=>`<div class="link-row"><input data-i="${i}" data-k="label" placeholder="Etiqueta (Discord, Carrd…)" value="${esc(l.label||'')}"><input data-i="${i}" data-k="url" placeholder="https://..." value="${esc(l.url||'')}"></div>`).join('');
 const mv=p.message_privacy||'friends';
 const fv=p.friend_privacy||'everyone';
 const disc=p.discoverable!==false;
 const act=p.show_activity!==false;
 const dl=p.allow_downloads===true;
 showModal(`<div class="settings-shell">
 <span class="eyebrow">AJUSTES</span>
 <h2>Perfil, privacidad y estilo</h2>
 <div class="settings-tabs">
  <button type="button" class="st-tab active" data-st="profile">Perfil</button>
  <button type="button" class="st-tab" data-st="look">Apariencia</button>
  <button type="button" class="st-tab" data-st="privacy">Privacidad</button>
 </div>
 <form id="editProfileForm" class="form profile-edit-form">
  <div class="st-panel active" data-panel="profile">
   <label>Apodo<input id="epNick" maxlength="32" value="${esc(p.display_name||'')}" required></label>
   <label>Usuario<input id="epUser" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" value="${esc(p.username||'')}" required></label>
   <label>Bio<textarea id="epBio" maxlength="160">${esc(p.bio||'')}</textarea></label>
   <label>Estado / tagline<input id="epStatus" maxlength="48" placeholder="ej. Explorando Sekai" value="${esc(p.status_text||'')}"></label>
   <label>URL del banner<input id="epBanner" type="url" placeholder="https://..." value="${esc(p.banner_url||'')}"></label>
   <label>URL del avatar<input id="epAvatar" type="url" placeholder="https://..." value="${esc(p.avatar_url||'')}"></label>
   <div class="links-edit"><span class="eyebrow">ENLACES</span>${linkRows}<button type="button" id="addLink" class="text-link">＋ Añadir enlace</button></div>
  </div>
  <div class="st-panel" data-panel="look" hidden>
   <p class="muted settings-lead">Personaliza cómo se siente Sekai en tu dispositivo.</p>
   <div class="color-row">
    <label>Color tema<input id="epTheme" type="color" value="${esc(p.theme_color||'#7068e8')}"></label>
    <label>Acento<input id="epAccent" type="color" value="${esc(p.accent_color||'#a29cf5')}"></label>
   </div>
   <div class="preset-row">
    <button type="button" class="preset-chip" data-preset="lavender">Lavanda</button>
    <button type="button" class="preset-chip" data-preset="night">Noche</button>
    <button type="button" class="preset-chip" data-preset="paper">Papel</button>
    <button type="button" class="preset-chip" data-preset="ocean">Océano</button>
   </div>
   <div class="two-col"><label>Animaciones<select id="epMotion"><option value="full">Completas</option><option value="reduced">Reducidas</option><option value="off">Desactivadas</option></select></label><label>Glass<select id="epGlass"><option value="0.72">Suave</option><option value="0.86">Medio</option><option value="0.95">Intenso</option></select></label></div>
   <div class="two-col"><label>Fondo<select id="epBg"><option value="soft">Suave</option><option value="plain">Limpio</option><option value="night">Noche</option></select></label><label>Navegación<select id="epNav"><option value="normal">Normal</option><option value="compact">Compacta</option></select></label></div>
   <label class="check-row"><input type="checkbox" id="epContrast"> Alto contraste</label>
   <label class="check-row"><input type="checkbox" id="epDense"> Densidad compacta</label>
   <label class="check-row"><input type="checkbox" id="epFont"> Texto grande</label>
   <label class="check-row"><input type="checkbox" id="epCinema"> Modo cine (menos UI en video)</label>
  </div>
  <div class="st-panel" data-panel="privacy" hidden>
   <p class="muted settings-lead">Controla quién ve tu perfil y cómo pueden contactarte.</p>
   <div class="visibility privacy-block"><span>Visibilidad del perfil</span>
    <label class="choice-card"><input type="radio" name="epVis" value="public" ${p.visibility!=='private'?'checked':''}><span><b>Público</b><small>Cualquiera puede ver tu perfil y posts públicos.</small></span></label>
    <label class="choice-card"><input type="radio" name="epVis" value="private" ${p.visibility==='private'?'checked':''}><span><b>Privado</b><small>Solo amigos ven tu actividad completa.</small></span></label>
   </div>
   <label>Quién puede enviarte mensajes
    <select id="epMsgPriv"><option value="everyone">Todos</option><option value="friends">Solo amigos</option><option value="nobody">Nadie</option></select>
   </label>
   <label>Quién puede enviarte solicitud de amistad
    <select id="epFriendPriv"><option value="everyone">Todos</option><option value="friends_of_friends">Amigos de amigos</option><option value="nobody">Nadie</option></select>
   </label>
   <label class="check-row"><input type="checkbox" id="epDiscover" ${disc?'checked':''}> Aparecer en búsquedas</label>
   <label class="check-row"><input type="checkbox" id="epActivity" ${act?'checked':''}> Mostrar estado de actividad</label>
   <label class="check-row"><input type="checkbox" id="epDownload" ${dl?'checked':''}> Permitir descargar mi media</label>
   <div class="privacy-actions">
    <button type="button" class="secondary wide" id="epBlocked">Usuarios bloqueados</button>
    <button type="button" class="secondary wide" id="epPause">Pausar cuenta</button>
   </div>
   <p class="muted tiny">Pausar oculta tu perfil sin borrar datos. Puedes reactivarlo cuando quieras.</p>
  </div>
  <button class="primary wide" id="epSave">Guardar cambios</button>
 </form></div>`);

 // restore selects
 $('#epMotion').value=p.animation_level||'full';
 $('#epGlass').value=String(p.glass_intensity??0.86);
 $('#epBg').value=p.background_mode||'soft';
 $('#epNav').value=p.navigation_style||'normal';
 $('#epMsgPriv').value=mv;
 $('#epFriendPriv').value=fv;
 $('#epContrast').checked=!!p.high_contrast;
 $('#epDense').checked=!!p.dense_ui;
 $('#epFont').checked=!!p.large_font||localStorage.getItem('sekai_large_font')==='1';
 $('#epCinema').checked=localStorage.getItem('sekai_cinema')==='1';

 $$('.st-tab').forEach(b=>b.onclick=()=>{
  $$('.st-tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  $$('.st-panel').forEach(p=>{p.hidden=p.dataset.panel!==b.dataset.st; p.classList.toggle('active',p.dataset.panel===b.dataset.st);});
 });

 $$('[data-preset]').forEach(b=>b.onclick=()=>{
  const presets={
   lavender:{theme:'#7068e8',accent:'#a29cf5',bg:'soft'},
   night:{theme:'#8b7cf7',accent:'#c4b5fd',bg:'night'},
   paper:{theme:'#6b7280',accent:'#a8a29e',bg:'plain'},
   ocean:{theme:'#0ea5e9',accent:'#67e8f9',bg:'soft'}
  };
  const pr=presets[b.dataset.preset]; if(!pr)return;
  $('#epTheme').value=pr.theme; $('#epAccent').value=pr.accent; $('#epBg').value=pr.bg;
  applyCustomization({theme_color:pr.theme,accent_color:pr.accent,background_mode:pr.bg,animation_level:$('#epMotion').value,glass_intensity:+$('#epGlass').value,navigation_style:$('#epNav').value});
 });

 // live preview look
 ['epTheme','epAccent','epMotion','epGlass','epBg','epNav'].forEach(id=>{
  $('#'+id)?.addEventListener('change',()=>{
   applyCustomization({
    theme_color:$('#epTheme').value,
    accent_color:$('#epAccent').value,
    animation_level:$('#epMotion').value,
    glass_intensity:+$('#epGlass').value,
    background_mode:$('#epBg').value,
    navigation_style:$('#epNav').value,
    high_contrast:$('#epContrast').checked,
    dense_ui:$('#epDense').checked
   });
  });
 });
 $('#epContrast')?.addEventListener('change',()=>document.body.classList.toggle('contrast-high',$('#epContrast').checked));
 $('#epDense')?.addEventListener('change',()=>document.body.classList.toggle('ui-dense',$('#epDense').checked));

 let linkCount=Math.max(links.length,1);
 $('#addLink').onclick=()=>{
  const box=$('.links-edit');
  const row=document.createElement('div');
  row.className='link-row';
  row.innerHTML=`<input data-i="${linkCount}" data-k="label" placeholder="Etiqueta"><input data-i="${linkCount}" data-k="url" placeholder="https://...">`;
  box.insertBefore(row,$('#addLink'));
  linkCount++;
 };

 $('#epBlocked')?.addEventListener('click',async()=>{
  const sb=requireSupabase(); if(!sb||!state.user)return;
  try{
   const {data,error}=await sb.from('user_blocks').select('blocked_id,profiles:blocked_id(username,display_name)').eq('blocker_id',state.user.id);
   if(error)throw error;
   const rows=(data||[]).map(r=>`<div class="block-row"><span>@${esc(r.profiles?.username||'?')}</span><button type="button" data-unblock="${r.blocked_id}">Quitar</button></div>`).join('')||'<p class="muted">Nadie bloqueado.</p>';
   showModal(`<h2>Bloqueados</h2>${rows}<button class="secondary wide" id="backPriv">Volver</button>`);
   $('#backPriv')?.addEventListener('click',openEditProfile);
   $$('[data-unblock]').forEach(b=>b.onclick=async()=>{
    await sb.from('user_blocks').delete().eq('blocker_id',state.user.id).eq('blocked_id',b.dataset.unblock);
    toast('Desbloqueado'); openEditProfile();
   });
  }catch(e){toast(e.message,'error');}
 });

 $('#epPause')?.addEventListener('click',async()=>{
  if(!confirm('¿Pausar tu cuenta? Tu perfil se ocultará hasta que la reactives.'))return;
  const sb=requireSupabase(); if(!sb||!state.user)return;
  const {error}=await sb.from('profiles').update({paused:true,visibility:'private'}).eq('id',state.user.id);
  if(error)return toast(error.message,'error');
  toast('Cuenta en pausa'); state.profile={...state.profile,paused:true,visibility:'private'};
 });

 $('#editProfileForm').onsubmit=async e=>{
  e.preventDefault();const sb=requireSupabase();if(!sb||!state.user)return;
  const newLinks=[];
  $$('.link-row').forEach(row=>{
   const label=row.querySelector('[data-k=label]')?.value.trim();
   const url=row.querySelector('[data-k=url]')?.value.trim();
   if(label||url) newLinks.push({label:label||'Link',url:url||'#'});
  });
  const payload={
   display_name:$('#epNick').value.trim(),
   username:$('#epUser').value.trim(),
   bio:$('#epBio').value.trim(),
   status_text:$('#epStatus').value.trim(),
   theme_color:$('#epTheme').value,
   accent_color:$('#epAccent').value,
   animation_level:$('#epMotion').value,
   glass_intensity:+$('#epGlass').value,
   background_mode:$('#epBg').value,
   navigation_style:$('#epNav').value,
   banner_url:$('#epBanner').value.trim()||null,
   avatar_url:$('#epAvatar').value.trim()||null,
   visibility:document.querySelector('input[name=epVis]:checked')?.value||'public',
   links:newLinks,
   message_privacy:$('#epMsgPriv').value,
   friend_privacy:$('#epFriendPriv').value,
   discoverable:$('#epDiscover').checked,
   show_activity:$('#epActivity').checked,
   allow_downloads:$('#epDownload').checked,
   high_contrast:$('#epContrast').checked,
   dense_ui:$('#epDense').checked,
   paused:false
  };
  const {data,error}=await sb.from('profiles').update(payload).eq('id',state.user.id).select().single();
  if(error){toast(error.message,'error');return}
  state.profile=data;applyCustomization(data);
  document.body.classList.toggle('contrast-high',!!data.high_contrast);
  document.body.classList.toggle('ui-dense',!!data.dense_ui);
  document.body.classList.toggle('font-large', !!$('#epFont')?.checked);
  document.body.classList.toggle('cinema-mode', !!$('#epCinema')?.checked);
  localStorage.setItem('sekai_large_font', $('#epFont')?.checked?'1':'0');
  localStorage.setItem('sekai_cinema', $('#epCinema')?.checked?'1':'0');
  localStorage.setItem('sekai_customization',JSON.stringify({
    theme_color:data.theme_color,accent_color:data.accent_color,animation_level:data.animation_level,
    glass_intensity:data.glass_intensity,background_mode:data.background_mode,navigation_style:data.navigation_style,
    high_contrast:data.high_contrast,dense_ui:data.dense_ui
  }));
  toast('Cambios guardados ✨');openProfile();
 }
}
function showModal(html){$('#modalContent').innerHTML=html;$('#modal').hidden=false}
async function initAuth(){const sb=requireSupabase();if(!sb)return;const {data}=await sb.auth.getSession();await applySession(data.session);if(state.user){loadConversations();loadHomeFeed();}sb.auth.onAuthStateChange(async(_event,session)=>{setTimeout(()=>{applySession(session);if(session){loadConversations();loadHomeFeed();}},0)});}
async function applySession(session){state.user=session?.user||null;if(!state.user){state.profile=null;$('#topName').textContent='Guest';if(!localStorage.getItem('chromi_onboarding_seen'))openOnboarding('landing');return}state.guest=!!state.user.is_anonymous;const {data:profile}=await supabase.from('profiles').select('*').eq('id',state.user.id).maybeSingle();state.profile=profile;applyCustomization(profile||{});if(!state.guest && !profile){setTimeout(()=>openOnboarding('profile'),150)}else if(!state.guest && profile && String(profile.username||'').startsWith('guest_')){setTimeout(()=>openOnboarding('profile'),150)}else if(state.guest&&!profile){const {data:p}=await supabase.from('profiles').insert({id:state.user.id,display_name:'Guest',username:'guest_'+state.user.id.slice(0,8)}).select().single();state.profile=p;setTimeout(()=>renderOnboarding('welcome'),100)}if(state.profile){$('#topName').textContent=state.profile.display_name||state.profile.username||'Guest';
 $$('#homeProfileText').forEach(hp=>{hp.textContent='@'+(state.profile.username||'guest')+' · '+(state.profile.chromi_id||'')});
 const hh=$('#homeHello');if(hh)hh.textContent=state.profile.display_name||state.profile.username||'nakama';
 // Si el overlay de login sigue abierto y ya hay perfil real, cerrarlo
 const onboard=$('#onboarding');
 if(onboard&&!onboard.hidden&&!state.guest&&state.profile.username&&!String(state.profile.username).startsWith('guest_')){
  onboard.hidden=true;localStorage.setItem('chromi_onboarding_seen','1');
 }}
}
// Search
state.searchType='all';
$$('#searchTabs [data-search-type]').forEach(b=>b.addEventListener('click',()=>{
 state.searchType=b.dataset.searchType||'all';
 $$('#searchTabs [data-search-type]').forEach(x=>x.classList.toggle('active',x===b));
 const q=$('#searchInput')?.value.trim(); if(q) runSearch(q,false);
}));
$('#networkInfoBtn')?.addEventListener('click',async()=>{
 try{const r=await fetch(apiUrl('/api/network/status'));const d=await r.json();showModal(`<span class="eyebrow">RED SEKAI</span><h2>Protección de navegación</h2><div class="network-status-list"><div><b>Proxy</b><span>${d.proxy?.enabled?'Activo':'No disponible'}</span></div><div><b>DNS privado</b><span>${d.privateDns?.enabled?'DoH activo':'No disponible'}</span></div><div><b>VPN</b><span>Preparada para perfiles .ovpn manuales</span></div></div><p class="muted">Los archivos VPN se colocan en <code>public/vpn/</code>. Sekai no incluye credenciales.</p>`)}catch{toast('No se pudo consultar el estado de red','error')}
});
$$('#searchShortcuts button').forEach(b=>b.onclick=()=>{const q=b.dataset.q;$('#searchInput').value=q;runSearch(q)});
function normalizeWebTarget(q){try{if(/^https?:\/\//i.test(q))return new URL(q).href;if(/^www\./i.test(q))return 'https://'+q;if(/^([a-z0-9-]+\.)+[a-z]{2,}([\/].*)?$/i.test(q))return 'https://'+q;}catch(e){}return null}
function openWebTarget(target,addHistory=true){const url=normalizeWebTarget(target)||target;if(!/^https?:\/\//i.test(url))return false;const frame=$('#webBrowserFrame'),iframe=$('#webFrame');if(!frame||!iframe)return false;$('#searchView').hidden=true;$('#searchResults').innerHTML='';frame.hidden=false;document.body.classList.add('search-browsing');$('#webBrowserUrl').textContent=url;const useHoshi=BROWSER_ENGINE!=='local';iframe.src=useHoshi?hoshiEmbedUrl(url):apiUrl('/api/browser?url='+encodeURIComponent(url));if(addHistory){state.history=state.history.slice(0,state.historyIndex+1);state.history.push(url);state.historyIndex=state.history.length-1}$('#webOpenExternal').onclick=()=>window.open(url,'_blank','noopener');return true}
$('#searchForm').onsubmit=e=>{e.preventDefault();const q=$('#searchInput').value.trim();if(!q)return;if(openWebTarget(q))return;runSearch(q)};$('#searchInput').oninput=()=>{clearTimeout(window.searchTimer);const q=$('#searchInput').value.trim();if(!q){showSearchWelcome();return}window.searchTimer=setTimeout(()=>runSearch(q,false),500)};
function closeBrowser(){const frame=$('#webBrowserFrame');if(frame)frame.hidden=true;document.body.classList.remove('search-browsing');const q=$('#searchInput').value.trim();if(q&&!normalizeWebTarget(q))runSearch(q,false);else showSearchWelcome()}
$('#browserBack')&&($('#browserBack').onclick=()=>closeBrowser());
$('#browserBack2')&&($('#browserBack2').onclick=()=>closeBrowser());
$('#browserForward')&&($('#browserForward').onclick=()=>searchHistory(1));
$('#browserRefresh')&&($('#browserRefresh').onclick=()=>{const iframe=$('#webFrame');if(iframe&&iframe.src)iframe.src=iframe.src});
function searchHistory(d){const n=state.historyIndex+d;if(n<0||n>=state.history.length)return;state.historyIndex=n;const q=state.history[n];$('#searchInput').value=q;if(normalizeWebTarget(q))openWebTarget(q,false);else runSearch(q,false)}
function showSearchWelcome(){document.body.classList.remove('search-browsing');$('#searchView').innerHTML='<span class="big-mark">C</span><h1>Search</h1><p>Escribe lo que buscas. Sekai rastrea, indexa y ordena sus propios resultados.</p>';$('#searchView').hidden=false;$('#searchResults').innerHTML='';const wf=$('#webBrowserFrame');if(wf)wf.hidden=true}
const API_BASE=String(window.CHROMI_API_BASE||window.CHROMI_API_BASE_URL||'').replace(/\/$/,'');
function apiUrl(path){return API_BASE+path}
function apiBaseMissing(){
  // file:// (APK WebView) or empty base → backend unreachable
  if(API_BASE) return false;
  if(location.protocol==='file:') return true;
  return false;
}
let HOSHI_URL=String(window.CHROMI_HOSHI_URL||'https://backendv3-188.onrender.com').replace(/\/$/,'');
let BROWSER_ENGINE=String(window.CHROMI_BROWSER_ENGINE||'hoshi');
async function loadBrowserConfig(){try{const r=await fetch(apiUrl('/api/config'),{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(d.hoshiUrl)HOSHI_URL=String(d.hoshiUrl).replace(/\/$/,'');if(d.browserEngine)BROWSER_ENGINE=String(d.browserEngine);}catch(e){}}
loadBrowserConfig();
function hoshiEmbedUrl(target){return HOSHI_URL+'/?go='+encodeURIComponent(target)+'&embed=1';}async function api(type,q){const endpoint=type==='manga'?'/api/search/manga':type==='anime'?'/api/search/anime':'/api/search/characters';try{const r=await fetch(`${apiUrl(endpoint)}?q=${encodeURIComponent(q)}&limit=12`,
      {signal:AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined});const d=await r.json().catch(()=>({}));if(!r.ok){console.warn('api',type,d.error||r.status);return []}return d.data||[]}catch(e){console.warn('api fail',type,e);return []}}
function resultCard(x){const meta=[x.year,x.score?'★ '+x.score:'',x.episodes?x.episodes+' eps':'',x.status,x.language,x.stars!=null?'★ '+x.stars:'',x.source].filter(Boolean).join(' · ');const badge=x.badge||x.type||'';const host=(()=>{try{return x.url?new URL(x.url).hostname.replace(/^www\./,''):''}catch{return ''}})();const alt=[x.titleEnglish,x.titleJapanese].filter(t=>t&&t!==x.title).slice(0,2).join(' · ');return `<button class="result-card ${x.type==='web'||x.type==='github'?'result-web':''}" data-json='${esc(JSON.stringify(x))}'><div class="cover">${x.cover?`<img src="${esc(x.cover)}" alt="" loading="lazy">`:esc((badge||'C')[0].toUpperCase())}</div><div class="result-body"><span class="result-type">${esc(badge)}</span>${host?`<span class="result-host">${esc(host)}</span>`:''}<strong>${esc(x.title)}</strong>${alt?`<small class="result-alt">${esc(alt)}</small>`:''}<small>${esc(meta)}</small><p>${esc((x.description||x.synopsis||x.extract||'').slice(0,180))}</p></div></button>`}
async function runSearch(q,add=true){
 q=q.trim();if(!q)return;
 document.body.classList.remove('search-browsing');
 const wf=$('#webBrowserFrame');if(wf)wf.hidden=true;
 if(add){state.history=state.history.slice(0,state.historyIndex+1);state.history.push(q);state.historyIndex=state.history.length-1}
 if(state.controller)state.controller.abort();state.controller=new AbortController();const signal=state.controller.signal;
 const type=state.searchType||'all';
 if(apiBaseMissing()){
  const localMusic=searchMusic(q);
  $('#searchView').hidden=true;
  if(localMusic.length){
   $('#searchResults').innerHTML=`<div class="serp-meta">Música · ${esc(q)}</div><div class="music-results">${localMusic.map(m=>`<button type="button" class="music-result" data-music-id="${m.id}"><img src="${esc(m.cover)}" alt=""><span><b>${esc(m.title)}</b><small>${esc(m.artist)}</small></span><span>▶</span></button>`).join('')}</div><div class="empty-state search-error"><p>El backend de búsqueda no está conectado. La búsqueda musical local sí está disponible.</p></div>`;
   $$('.music-result').forEach(b=>b.onclick=()=>{const m=resolvePrismTrack(b.dataset.musicId);if(m)showModal(`<span class="eyebrow">MÚSICA</span><h2>${esc(m.title)}</h2><p>${esc(m.artist)}</p><img class="music-cover" src="${esc(m.cover)}" alt=""><audio controls src="${esc(musicUrl(m))}"></audio>`)});
  }else $('#searchResults').innerHTML=`<div class="empty-state search-error"><h2>Backend no configurado</h2><p>La búsqueda de anime, manga y web necesita CHROMI_API_BASE. La música se puede buscar sin backend.</p></div>`;
  return;
 }
 $('#searchView').innerHTML='<span class="big-mark pulse">C</span><h1>Buscando…</h1>';$('#searchView').hidden=false;$('#searchResults').innerHTML='';

 const wantWeb=type==='all'||type==='web';
 const wantAnime=type==='all'||type==='anime'||type==='manga';
 const wantUsers=type==='all'||type==='users';
 const jobs=[];

 if(wantWeb){
  jobs.push(fetch(`${apiUrl('/api/search/web')}?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`,{signal})
   .then(async r=>{if(!r.ok)throw new Error('web');return {web:await r.json()}})
   .catch(()=>({web:{data:[],knowledge:null,questions:[]}})));
 }
 if(wantAnime){
  const types=type==='all'?['anime','manga','character']:(type==='anime'?['anime']:(type==='manga'?['manga']:[]));
  jobs.push(Promise.allSettled(types.map(t=>api(t,q))).then(settled=>{
   const media=[];settled.forEach(r=>{if(r.status==='fulfilled')media.push(...(r.value||[]))});
   return {media};
  }));
 }
 if(wantUsers){
  jobs.push((async()=>{
   try{
    const sb=requireSupabase();if(!sb)return{users:[]};
    const {data}=await sb.from('profiles').select('id,username,display_name,avatar_url,bio').or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(10);
    return{users:(data||[]).map(u=>({type:'user',title:u.display_name||u.username,username:u.username,description:u.bio||'',cover:u.avatar_url||'',userId:u.id}))};
   }catch{return{users:[]}}
  })());
 }

 const parts=await Promise.all(jobs);
 let web={data:[]},media=[],users=[];
 parts.forEach(p=>{if(p.web)web=p.web;if(p.media)media=p.media;if(p.users)users=p.users});

 let html=`<div class="serp-meta">Resultados para <b>${esc(q)}</b></div>`;

 if(web.knowledge){
  const k=web.knowledge;
  html+=`<article class="serp-card knowledge" data-url="${esc(k.url||'')}">
   ${k.cover?`<img class="serp-thumb" src="${esc(k.cover)}" alt="">`:''}
   <div class="serp-body"><div class="serp-host">${esc(k.source||'Info')}</div>
   <h3 class="serp-title">${esc(k.title)}</h3>
   <p class="serp-snip">${esc((k.extract||k.description||'').slice(0,220))}</p></div></article>`;
 }

 const music=searchMusic(q);
 if(music.length){html+=`<div class="serp-group-label">Música</div><div class="music-results">${music.map(m=>`<button type="button" class="music-result" data-music-id="${m.id}"><img src="${esc(m.cover)}" alt=""><span><b>${esc(m.title)}</b><small>${esc(m.artist)}</small></span><span>▶</span></button>`).join('')}</div>`;}

 if(users.length){
  html+=`<div class="serp-group-label">Usuarios en Chromi</div>`;
  users.forEach(u=>{
   html+=`<button type="button" class="serp-card user-row" data-user='${esc(JSON.stringify(u))}'>
    <span class="user-av">${u.cover?`<img src="${esc(u.cover)}" alt="">`:esc((u.title||'U')[0])}</span>
    <div class="serp-body"><h3 class="serp-title">${esc(u.title)}</h3>
    <div class="serp-host">@${esc(u.username||'')}</div>
    <p class="serp-snip">${esc((u.description||'').slice(0,100))}</p></div></button>`;
  });
 }

 if(web.data&&web.data.length){
  html+=`<div class="serp-group-label">Web · Índice de Sekai</div>`;
  web.data.forEach(x=>{
   const host=x.host||(()=>{try{return new URL(x.url).hostname.replace(/^www\./,'')}catch{return ''}})();
   html+=`<article class="serp-card" data-url="${esc(x.url||'')}">
    <div class="serp-body">
     <div class="serp-host">${esc(host)} · ${esc(x.badge||x.source||'WEB')}</div>
     <h3 class="serp-title">${esc(x.title)}</h3>
     <p class="serp-snip">${esc((x.description||'').slice(0,180))}</p>
    </div></article>`;
  });
 }

 if(media.length){
  html+=`<div class="serp-group-label">Anime · Manga · Personajes</div>`;
  media.forEach(x=>{
   const alt = [x.titleEnglish, x.titleJapanese].filter(t => t && t !== x.title).slice(0,2).join(' · ');
   const metaBits = [x.year, x.score != null ? '★ '+x.score : '', x.episodes ? x.episodes+' eps' : ''].filter(Boolean).join(' · ');
   html+=`<article class="serp-card media-row" data-json='${esc(JSON.stringify(x))}'>
    <div class="serp-thumb-sm">${x.cover?`<img src="${esc(x.cover)}" alt="" loading="lazy">`:'C'}</div>
    <div class="serp-body">
     <div class="serp-host">${esc(x.type)} · ${esc(x.source||'')}${metaBits ? ' · '+esc(metaBits) : ''}</div>
     <h3 class="serp-title">${esc(x.title)}</h3>
     ${alt ? `<div class="serp-alt muted">${esc(alt)}</div>` : ''}
     <p class="serp-snip">${esc((x.description||x.synopsis||'').slice(0,140))}</p>
    </div></article>`;
  });
 }

 if(web.questions&&web.questions.length){
  html+=`<div class="serp-group-label">Más búsquedas</div><div class="related-questions">`;
  web.questions.forEach(qq=>{html+=`<button type="button" class="related-q" data-q="${esc(qq.query||qq.title)}">${esc(qq.title)}</button>`});
  html+=`</div>`;
 }

 $('#searchView').hidden=true;
 const hasAny=(web.data&&web.data.length)||media.length||users.length||web.knowledge||music.length;
 if(!hasAny){
  html=`<div class="empty-results"><b>Sin resultados para “${esc(q)}”.</b><span>Prueba con otras palabras, o un título más completo (ej. “Naruto”, “One Piece”).</span>
  <div class="search-tips"><small>Consejo: nombres cortos como “tate” suelen funcionar mejor que iniciales. Si siempre falla, revisa que el backend esté online y <code>CHROMI_API_BASE</code> apunte a él.</small></div></div>`;
 }
 $('#searchResults').innerHTML=html;

 $$('.serp-card[data-url]').forEach(card=>{
  card.onclick=(e)=>{if(e.target.closest('button'))return;const url=card.dataset.url;if(url)openWebTarget(url,true)};
 });
 $$('.media-row').forEach(card=>{
  card.onclick=()=>{const x=JSON.parse(card.dataset.json);if(x.type==='manga'&&x.id){openMangaReader(x);return}
  showModal(`<span class="eyebrow">${esc(x.type)} · ${esc(x.source||'')}</span><h2>${esc(x.title)}</h2>${x.cover?`<img class="modal-cover" src="${esc(x.cover)}">`:''}<p>${esc(x.description||x.synopsis||'')}</p>${x.url?`<button id="openResult" class="primary wide">Abrir</button>`:''}`);const ob=$('#openResult');if(ob)ob.onclick=()=>{$('#modal').hidden=true;if(x.url)openWebTarget(x.url,true)}};
 });
 $$('.user-row').forEach(b=>{
  b.onclick=()=>{const u=JSON.parse(b.dataset.user);showModal(`<span class="eyebrow">Usuario</span><h2>${esc(u.title)}</h2><p>@${esc(u.username||'')}</p><p>${esc(u.description||'')}</p>`)};
 });
 $$('.music-result').forEach(b=>b.onclick=()=>{const m=resolvePrismTrack(b.dataset.musicId);if(!m)return;showModal(`<span class="eyebrow">MÚSICA</span><h2>${esc(m.title)}</h2><p>${esc(m.artist)}</p><img class="music-cover" src="${esc(m.cover)}" alt=""><audio controls preload="none" src="${esc(musicUrl(m))}"></audio><p class="muted">Puedes usar esta pista en los editores que admiten sonido.</p>`)});
 $$('.related-q').forEach(b=>b.onclick=()=>{$('#searchInput').value=b.dataset.q;runSearch(b.dataset.q,true)});
}


async function loadHomeFeed(){
 const box=$('#homeFeed'),stories=$('#storyRow');
 if(!box)return;
 if(!state.user){
  box.innerHTML='<div class="empty-state">Inicia sesión para ver las publicaciones reales de la comunidad.</div>';
  if(stories)stories.innerHTML='<button class="story" id="profileHome"><span class="story-ring">U</span><small>Tu perfil</small></button>';
  return;
 }
 const sb=requireSupabase();if(!sb)return;
 box.innerHTML=skeletonFeed(3);
 const {data,error}=await sb.from('posts').select('id,user_id,type,media_url,thumbnail_url,title,caption,visibility,duration_seconds,music_id,music_title,music_artist,music_url,editor_data,created_at,profiles(username,display_name,avatar_url)').eq('visibility','public').order('created_at',{ascending:false}).limit(20);
 if(error){const missing=/schema cache|relation .*posts.* does not exist|Could not find the table .*posts/i.test(error.message||'');box.innerHTML=`<div class="empty-state"><h3>${missing?'Falta la tabla de publicaciones':'No se pudieron cargar las publicaciones'}</h3><small>${esc(error.message)}</small>${missing?'<p class="muted">La app está conectada a Supabase, pero este proyecto todavía no tiene publicada la tabla <code>public.posts</code>. Ejecuta el archivo <code>supabase_schema.sql</code> completo en Supabase SQL Editor y recarga la app.</p>':''}</div>`;return}
 const posts=data||[];
 box.innerHTML=posts.map(renderHomePost).join('')||'<div class="empty-state">Todavía no hay publicaciones públicas. Cuando alguien publique, aparecerán aquí.</div>';
 bindPostActions(box);
 if(stories){
  const p=state.profile||{};
  stories.innerHTML=`<button class="story" id="profileHome"><span class="story-ring">${profileAvatarMarkup(p)}</span><small>Tu historia</small></button><button class="story" id="chromiStory"><span class="story-ring chromi-ring"><span>✦</span></span><small>Chromi</small></button>`;
  $('#profileHome')?.addEventListener('click',()=>state.user?openProfile():openOnboarding('landing'));
  $('#chromiStory')?.addEventListener('click',()=>{setRoute('messages');loadConversations().then(()=>openConversation('chromi'))});
 }
 const av=$('#homeThoughtAvatar');if(av)av.innerHTML=profileAvatarMarkup(state.profile||{});
}
function renderHomePost(p){
 const name=p.profiles?.display_name||p.profiles?.username||'Usuario';
 const uname=p.profiles?.username||'usuario';
 const avatar=p.profiles?.avatar_url?`<img src="${esc(p.profiles.avatar_url)}" alt="">`:esc(name[0]||'U');
 const isVid=p.type==='video'||(p.type==='short'&&p.media_url);
 const media=p.type==='short'&&!p.media_url?`<div class="text-short-card"><span>SHORT</span><strong>${esc(p.caption||p.title||'')}</strong></div>`:(isVid?`<video class="feed-image" src="${esc(p.media_url)}" controls playsinline preload="metadata"></video>`:`<img class="feed-image" src="${esc(p.media_url)}" alt="${esc(p.title||'Publicación')}" loading="lazy">`);
 const when=p.created_at?new Date(p.created_at).toLocaleDateString('es',{day:'numeric',month:'short'}):'';
 return `<article class="home-post" data-post-id="${esc(p.id)}"><header><span class="post-avatar">${avatar}</span><div><b>${esc(name)}</b><small>@${esc(uname)}${when?' · '+when:''}</small></div><button class="post-more-home" data-act="more" aria-label="Más">•••</button></header>${p.caption?`<p>${esc(p.caption)}</p>`:''}${media}<div class="feed-actions"><button data-act="like" data-id="${esc(p.id)}">♡ <small>Me gusta</small></button><button data-act="comment" data-id="${esc(p.id)}">◌ <small>Comentar</small></button><button data-act="share" data-id="${esc(p.id)}">↗ <small>Compartir</small></button></div>${p.title?`<h3 class="post-title">${esc(p.title)}</h3>`:''}</article>`;
}
function bindPostActions(box){
 box.querySelectorAll('[data-act="like"]').forEach(b=>b.onclick=()=>toggleLike(b.dataset.id,b));
 box.querySelectorAll('[data-act="comment"]').forEach(b=>b.onclick=()=>commentPost(b.dataset.id));
 box.querySelectorAll('[data-act="share"]').forEach(b=>b.onclick=()=>sharePost(b.dataset.id));
 box.querySelectorAll('[data-act="more"]').forEach(b=>b.onclick=()=>toast('Las opciones de esta publicación aparecerán aquí cuando estén habilitadas.'));
}
async function toggleLike(postId,button){
 const sb=requireSupabase();if(!sb||!state.user)return openOnboarding('landing');
 const {data:existing}=await sb.from('post_likes').select('post_id').eq('post_id',postId).eq('user_id',state.user.id).maybeSingle();
 if(existing){const {error}=await sb.from('post_likes').delete().eq('post_id',postId).eq('user_id',state.user.id);if(error)return toast(error.message,'error');button.classList.remove('liked'); if(button.firstChild) button.firstChild.textContent='♡ '; animateLike(button);}
 else {const {error}=await sb.from('post_likes').insert({post_id:postId,user_id:state.user.id});if(error)return toast(error.message,'error');button.classList.add('liked'); if(button.firstChild) button.firstChild.textContent='♥ '; animateLike(button);}
}
async function commentPost(postId){
 const text=prompt('Escribe tu comentario');if(!text?.trim())return;
 const sb=requireSupabase();if(!sb||!state.user)return;
 const {error}=await sb.from('post_comments').insert({post_id:postId,user_id:state.user.id,body:text.trim()});
 if(error)return toast(error.message,'error');toast('Comentario publicado.');
}
async function sharePost(postId){
 const url=`${location.origin}${location.pathname}#sekaifeed?post=${encodeURIComponent(postId)}`;
 try{await navigator.clipboard.writeText(url);toast('Enlace copiado.')}catch{toast(url)}
}
refreshNotificationBadges();
setInterval(refreshNotificationBadges,30000);

function notificationTime(iso){const d=new Date(iso),sec=Math.max(1,Math.floor((Date.now()-d.getTime())/1000));if(sec<60)return 'hace unos segundos';if(sec<3600)return 'hace '+Math.floor(sec/60)+' min';if(sec<86400)return 'hace '+Math.floor(sec/3600)+' h';return 'hace '+Math.floor(sec/86400)+' d';}
async function deleteNotification(id){const sb=requireSupabase();if(!sb)return;const {error}=await sb.from('notifications').delete().eq('id',id).eq('user_id',state.user.id);if(error)return toast(error.message,'error');const row=document.querySelector('[data-notification="'+CSS.escape(id)+'"]');row?.remove();refreshNotificationBadges();}
async function openNotifications(){
 if(!state.user)return openOnboarding('landing');
 const sb=requireSupabase();if(!sb)return;
 const {data,error}=await sb.from('notifications').select('id,title,body,read,created_at').order('created_at',{ascending:false}).limit(30);
 if(error)return toast(error.message,'error');
 showModal(`<span class="eyebrow">SEKAI</span><h2>Notificaciones</h2><div class="notification-actions"><button id="markAllNotifications" class="secondary">Marcar todas como leídas</button></div><div class="notification-list">${(data||[]).map(n=>`<button class="notification-row ${n.read?'':'unread'}" data-notification="${esc(n.id)}"><b>${esc(n.title)}</b><small>${esc(n.body||'')} · ${notificationTime(n.created_at)}</small><span class=\"notification-delete\" data-delete-notification=\"${esc(n.id)}\">×</span></button>`).join('')||'<p class="muted">No tienes notificaciones.</p>'}</div>`);
 $$('.notification-row').forEach(b=>b.onclick=async(e)=>{if(e.target.closest('[data-delete-notification]')){e.stopPropagation();return deleteNotification(b.dataset.notification);}await sb.from('notifications').update({read:true}).eq('id',b.dataset.notification).eq('user_id',state.user.id);b.classList.remove('unread');refreshNotificationBadges();});
 $('#markAllNotifications')?.addEventListener('click',async()=>{const {error}=await sb.from('notifications').update({read:true}).eq('user_id',state.user.id).eq('read',false);if(error)return toast(error.message,'error');$$('.notification-row').forEach(b=>b.classList.remove('unread'));refreshNotificationBadges();toast('Todas las notificaciones están leídas.');});
 refreshNotificationBadges();
}


async function openMangaReader(manga){
  const themeMode = document.body.getAttribute('data-bg') || 'soft';
  studioFullscreen(`
  <div class="manga-fs liquid-glass" data-theme="${themeMode}">
    <header class="manga-top">
      <button type="button" class="glass-icon" id="mangaClose">✕</button>
      <div class="manga-top-meta">
        <b id="mangaTitle">${esc(manga.title||'Manga')}</b>
        <small id="mangaSub">Elige un capítulo</small>
      </div>
      <button type="button" class="glass-icon" id="mangaChaptersBtn" title="Capítulos">☰</button>
    </header>
    <div class="manga-hero" id="mangaHero">
      <div class="manga-hero-bg" style="${manga.cover?`background-image:url('${esc(manga.cover)}')`:''}"></div>
      <div class="manga-hero-card liquid-panel">
        ${manga.cover?`<img src="${esc(manga.cover)}" alt="" class="manga-cover-lg">`:''}
        <div class="manga-hero-info">
          <span class="eyebrow">MANGA</span>
          <h2>${esc(manga.title||'')}</h2>
          <p>${esc((manga.description||'').slice(0,280))}</p>
          <button type="button" class="primary" id="mangaStartRead">Leer</button>
        </div>
      </div>
      <section class="manga-similar" id="mangaSimilar">
        <h3>Similares</h3>
        <div class="manga-similar-row" id="mangaSimilarRow"><span class="muted">Cargando…</span></div>
      </section>
    </div>
    <div class="manga-reader" id="mangaReader" hidden>
      <div class="manga-pages" id="readerPages"></div>
      <div class="manga-reader-bar liquid-panel">
        <button type="button" id="readerPrev">‹</button>
        <button type="button" id="readerLabel" class="reader-label">Capítulo</button>
        <button type="button" id="readerNext">›</button>
      </div>
    </div>
    <div class="manga-drawer" id="mangaDrawer" hidden>
      <div class="manga-drawer-sheet liquid-panel">
        <header><b>Capítulos</b><button type="button" id="drawerClose">✕</button></header>
        <div id="chapterList" class="chapter-list-fs"><div class="muted">Cargando…</div></div>
      </div>
    </div>
  </div>`);

  $('#mangaClose').onclick = () => closeStudio();
  $('#drawerClose')?.addEventListener('click', () => { $('#mangaDrawer').hidden = true; });
  $('#mangaChaptersBtn').onclick = () => { $('#mangaDrawer').hidden = false; };
  $('#readerLabel')?.addEventListener('click', () => { $('#mangaDrawer').hidden = false; });

  let chapters = [];
  let currentIdx = -1;

  async function loadChapters(){
    try{
      const r = await fetch(`${apiUrl('/api/manga/'+manga.id+'/chapters')}?limit=120&lang=es,en`);
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||'Error');
      chapters = d.data || [];
    }catch(e){
      $('#chapterList').innerHTML = `<p class="muted">No se pudieron cargar capítulos. ${esc(e.message||'')}</p>`;
      return;
    }
    if(!chapters.length){
      $('#chapterList').innerHTML = '<p class="muted">No hay capítulos disponibles.</p>';
      return;
    }
    $('#chapterList').innerHTML = chapters.map((ch,i)=>{
      const label = [ch.chapter?`Cap. ${ch.chapter}`:'Capítulo', ch.title, ch.lang?`(${ch.lang})`:''].filter(Boolean).join(' · ');
      return `<button type="button" class="chapter-item-fs" data-i="${i}"><span>${esc(label)}</span><small>${esc(ch.group||'')}</small></button>`;
    }).join('');
    $$('.chapter-item-fs').forEach(b => b.onclick = () => { $('#mangaDrawer').hidden = true; loadChapter(+b.dataset.i); });
    $('#mangaStartRead').onclick = () => loadChapter(0);
  }

  async function loadChapter(i){
    if(i<0||i>=chapters.length) return;
    currentIdx = i;
    const ch = chapters[i];
    const label = [ch.chapter?`Cap. ${ch.chapter}`:'Capítulo', ch.title].filter(Boolean).join(' · ');
    $('#readerLabel').textContent = label;
    $('#mangaSub').textContent = label;
    $('#mangaHero').hidden = true;
    $('#mangaReader').hidden = false;
    $('#readerPages').innerHTML = '<div class="manga-loading">Cargando páginas…</div>';
    $$('.chapter-item-fs').forEach((b,j)=>b.classList.toggle('active', j===i));
    try{
      const r = await fetch(apiUrl('/api/manga/chapter/'+ch.id+'/pages'));
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||'Error');
      const pages = d.pages||[];
      if(!pages.length){ $('#readerPages').innerHTML = '<div class="manga-loading">Sin páginas.</div>'; return; }
      $('#readerPages').innerHTML = pages.map((p,idx)=>`<div class="manga-page-wrap"><img class="manga-page" src="${esc(p.url)}" alt="" data-i="${idx+1}" loading="${idx<3?'eager':'lazy'}" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.manga-page-wrap').classList.add('failed')"></div>`).join('');
      $('#readerPages').scrollTop = 0;
    }catch(e){
      $('#readerPages').innerHTML = `<div class="manga-loading">No se pudo abrir. ${esc(e.message||'')}</div>`;
    }
  }

  $('#readerPrev').onclick = () => loadChapter(currentIdx-1);
  $('#readerNext').onclick = () => loadChapter(currentIdx+1);

  // Similares
  (async()=>{
    try{
      const q = encodeURIComponent((manga.title||'').split(/[:\-–]/)[0].trim()||'manga');
      const r = await fetch(apiUrl('/api/search?q='+q+'&type=manga&limit=8'));
      const d = await r.json();
      const items = (d.data||d.results||[]).filter(x => String(x.id)!==String(manga.id)).slice(0,8);
      const row = $('#mangaSimilarRow');
      if(!items.length){ row.innerHTML = '<span class="muted">Sin similares</span>'; return; }
      row.innerHTML = items.map(m => `
        <button type="button" class="similar-card" data-mid="${esc(m.id)}">
          ${m.cover||m.image?`<img src="${esc(m.cover||m.image)}" alt="">`:''}
          <span>${esc(m.title||'')}</span>
        </button>`).join('');
      $$('.similar-card').forEach(b => b.onclick = () => {
        const id = b.dataset.mid;
        const item = items.find(x => String(x.id)===String(id));
        if(item) openMangaReader({ id:item.id, title:item.title, cover:item.cover||item.image, description:item.description||'' });
      });
    }catch(e){
      const row = $('#mangaSimilarRow');
      if(row) row.innerHTML = '<span class="muted">—</span>';
    }
  })();

  loadChapters();
}


// SEKAI: social publishing feed
let activeFeed='all';
const MEDIA_BUCKET='sekai-media';
function saveToCollection(postId){
  const col=JSON.parse(localStorage.getItem('sekai_saved')||'[]');
  if(col.includes(postId)){ toast('Ya estaba guardado'); return; }
  col.unshift(postId); localStorage.setItem('sekai_saved', JSON.stringify(col.slice(0,200)));
  toast('Guardado en colección');
}
function animateLike(el){
  if(!el) return;
  el.classList.remove('like-pop');
  void el.offsetWidth;
  el.classList.add('like-pop');
}
function postTypeLabel(t){return ({image:'Post',art:'Art',short:'Short',video:'Video'})[t]||'Post'}
function mediaAccept(t){return t==='image'||t==='art'?'image/*':'video/*'}
function showCreatePost(){
 if(!state.user){openOnboarding('landing');return}
 showModal(`<span class="eyebrow">SEKAI STUDIO</span><h2>Crea en Sekai</h2><p class="muted">Elige un formato. Cada uno tiene su propio editor profesional.</p><div class="studio-grid">
 <button class="studio-card" data-editor="story"><b>◌</b><strong>Story</strong><small>24h · texto, foto, video, stickers y música</small></button>
 <button class="studio-card" data-editor="short"><b>Aa</b><strong>Short</strong><small>Vertical · tipografía, filtros y ritmo</small></button>
 <button class="studio-card" data-editor="post"><b>▧</b><strong>Post</strong><small>Foto · filtros, marco y descripción</small></button>
 <button class="studio-card" data-editor="art"><b>✦</b><strong>Art</strong><small>Ilustración · presentación pro</small></button>
 <button class="studio-card" data-editor="video"><b>▶</b><strong>Video</strong><small>Editor tipo CapCut · recorte, velocidad, música</small></button>
 </div>`);
 $$('[data-editor]').forEach(b=>b.onclick=()=>openEditor(b.dataset.editor));
}

/* ========== MUSIC LYRICS SYNC v18 ========== */
function parseLrcLines(raw){
  return String(raw||'').split(/\r?\n/).flatMap(line=>{
    const tags=[...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text=line.replace(/\[[^\]]+\]/g,'').trim();
    return tags.map(m=>({time:Number(m[1])*60+Number(m[2])+Number(m[3]||0)/1000,text})).filter(x=>x.text);
  }).sort((a,b)=>a.time-b.time);
}
function renderSyncedLyrics(root, raw, currentTime, style='clean'){
  const lines=parseLrcLines(raw);
  if(!root) return;
  if(!lines.length){root.innerHTML=raw?`<strong>${esc(String(raw).split(/\r?\n/).find(Boolean)||'')}</strong>`:'';return;}
  let idx=0; for(let i=0;i<lines.length;i++){if(lines[i].time<=currentTime)idx=i;else break;}
  const visible=lines.slice(Math.max(0,idx-1),Math.min(lines.length,idx+2));
  root.dataset.style=style;
  root.innerHTML=visible.map((l,i)=>`<span class="${l===lines[idx]?'is-current':''}">${esc(l.text)}</span>`).join('');
}
function attachLyricsSync(audio, lyricsRoot, raw, style='clean', start=0, end=15){
  if(!audio||!lyricsRoot) return;
  const paint=()=>renderSyncedLyrics(lyricsRoot,raw,Math.max(0,(audio.currentTime||0)-start),style);
  audio.addEventListener('timeupdate',paint);
  audio.addEventListener('loadedmetadata',()=>{ if(Number.isFinite(audio.duration)){const e=document.getElementById(audio.id.replace(/_audio$/,'')+'_end'); if(e)e.max=Math.max(15,Math.ceil(audio.duration));}});
  paint();
}

function musicPicker(id='editorMusic',allowNone=true){
  const opts = PRISM_CATALOG.map(m=>`<button type="button" class="music-opt" data-mid="${esc(m.id)}" data-target="${id}"><span class="music-opt-art">${m.cover?`<img src="${esc(m.cover)}" alt="">`:'🎵'}</span><span><b>${esc(m.title)}</b><small>${esc(m.artist)}</small></span><span class="music-opt-play">▶</span></button>`).join('');
  return `<div class="music-picker music-studio-panel">
    <div class="music-picker-head"><div><b>Elige tu audio</b><small>Selecciona una canción y prepara el fragmento.</small></div><label class="lyrics-toggle"><input type="checkbox" id="${id}_lyrics"> Letras</label></div>
    <input class="music-search" id="${id}_search" placeholder="Buscar canción o artista…" autocomplete="off">
    <input type="hidden" id="${id}" value="">
    <div class="music-opt-list" id="${id}_list">${allowNone?`<button type="button" class="music-opt active" data-mid="" data-target="${id}"><span class="music-opt-art">✕</span><span><b>Sin música</b><small>Opcional</small></span></button>`:''}${opts}</div>
    <div class="music-preview" id="${id}_preview" hidden><div class="music-preview-title">Vista previa</div><audio id="${id}_audio" controls preload="metadata"></audio><label>Fragmento seleccionado <output id="${id}_rangeOut">0–15 s</output></label><input type="range" id="${id}_start" min="0" max="180" step="1" value="0"><input type="range" id="${id}_end" min="15" max="180" step="1" value="15"><div class="music-range-labels"><span>Inicio</span><span>Final</span></div><label>Estilo de letras<select id="${id}_lyricStyle"><option value="clean">Limpio</option><option value="bold">Grande</option><option value="karaoke">Karaoke</option><option value="glass">Glass</option><option value="neon">Neon</option></select></label></div>
    <div class="lyrics-box" id="${id}_lyricsBox" hidden><textarea id="${id}_lyricsText" rows="4" placeholder="Las letras aparecerán aquí…"></textarea><small class="music-note">Puedes corregir las letras manualmente.</small></div>
    <div class="music-note">${PRISM_REPO?'Catálogo conectado.':'Configura el servidor de música para cargar audio.'}</div>
  </div>`;
}
function bindMusicPickers(root=document){
  root.querySelectorAll('.music-opt').forEach(b=>b.onclick=()=>{
    const id=b.dataset.target, track=resolvePrismTrack(b.dataset.mid);
    const list=document.getElementById(id+'_list'); list?.querySelectorAll('.music-opt').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const inp=document.getElementById(id); if(inp) inp.value=b.dataset.mid||'';
    const preview=document.getElementById(id+'_preview'), audio=document.getElementById(id+'_audio');
    if(track && audio){audio.src=musicUrl(track)||''; preview.hidden=false; audio.load();}
    else if(preview){preview.hidden=true; if(audio){audio.pause();audio.removeAttribute('src');}}
    const cb=document.getElementById(id+'_lyrics'); if(cb?.checked && track) autoFillLyrics(track.id,id+'_lyricsText');
    const event=new CustomEvent('sekai:music-selected',{detail:{id,track}}); root.dispatchEvent(event);
  });
  root.querySelectorAll('.music-search').forEach(input=>input.oninput=()=>{const q=input.value.trim().toLowerCase(); const id=input.id.replace(/_search$/,''); document.getElementById(id+'_list')?.querySelectorAll('.music-opt').forEach(b=>{b.hidden=!!q&&!b.textContent.toLowerCase().includes(q);});});
  root.querySelectorAll('[id$=_lyrics]').forEach(cb=>{if(cb.type!=='checkbox')return;cb.onchange=()=>{const id=cb.id.replace(/_lyrics$/,'');const box=document.getElementById(id+'_lyricsBox');if(box)box.hidden=!cb.checked;const mid=document.getElementById(id)?.value;if(cb.checked&&mid)autoFillLyrics(mid,id+'_lyricsText');};});
  root.querySelectorAll('input[id$=_start],input[id$=_end]').forEach(r=>r.oninput=()=>{const id=r.id.replace(/_(start|end)$/,'');const a=Number(document.getElementById(id+'_start')?.value||0),b=Number(document.getElementById(id+'_end')?.value||15);const end=Math.max(a+1,b);const out=document.getElementById(id+'_rangeOut');if(out)out.textContent=`${a}–${end} s`;const audio=document.getElementById(id+'_audio');if(audio&&r.id.endsWith('_start'))audio.currentTime=a;});
}

function editorShell(title,subtitle,body){showModal(`<button class="editor-back" id="editorBack">‹</button><span class="eyebrow">SEKAI STUDIO · EDITOR</span><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p>${body}`);$('#editorBack').onclick=showCreatePost}
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
function bindLivePreview(){ $$('[data-preview]').forEach(i=>i.oninput=()=>{const t=$('#'+i.dataset.preview);if(t)t.textContent=i.value||''}); }
function openEditor(type){
 if(type==='story')return showStoryEditor();
 if(type==='short')return showShortEditor();
 if(type==='video')return showVideoEditor();
 if(type==='art')return showImageEditor('art');
 return showImageEditor('image');
}

/* ========== STORY EDITOR (Instagram-style) ========== */
function showStoryEditor(){
  studioFullscreen(`
  <div class="ig-story-editor">
    <header class="ig-top">
      <button type="button" class="ig-close" id="storyClose">✕</button>
      <span class="ig-title">Nueva historia</span>
      <button type="button" class="ig-settings">⚙</button>
    </header>
    <div class="ig-canvas" id="storyCanvas">
      <div class="ig-media-layer" id="storyMediaLayer">
        <div class="ig-placeholder" id="storyPlaceholder">
          <span>📷</span>
          <p>Toca para añadir foto o video</p>
          <small>o escribe una nota</small>
        </div>
      </div>
      <div class="ig-text-layer" id="storyTextLayer"></div>
      <div class="ig-stickers-layer" id="storyStickersLayer"></div>
    </div>
    <div class="ig-tools" id="storyTools">
      <button type="button" class="ig-tool active" data-tool="media"><span>📷</span><small>Media</small></button>
      <button type="button" class="ig-tool" data-tool="text"><span>Aa</span><small>Texto</small></button>
      <button type="button" class="ig-tool" data-tool="sticker"><span>😊</span><small>Stickers</small></button>
      <button type="button" class="ig-tool" data-tool="music"><span>🎵</span><small>Música</small></button>
      <button type="button" class="ig-tool" data-tool="effect"><span>✨</span><small>Efectos</small></button>
    </div>
    <div class="ig-panel" id="storyPanel" hidden></div>
    <div class="ig-bottom">
      <button type="button" class="ig-share-btn" id="storyToClose">Tu historia</button>
      <button type="button" class="ig-share-btn friends" id="storyToFriends">★ Mejores amigos</button>
      <button type="button" class="ig-next" id="storyPublish">›</button>
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
  const stateS = {type:'note', text:'', mediaUrl:null, mediaFile:null, bg:'soft', align:'center', musicId:'', musicStart:0, musicEnd:15, lyricsText:'', lyricsStyle:'clean', stickers:[], effect:'none'};
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
        <button type="button" class="ig-chip" id="pickMedia">📷 Elegir foto/video</button>
        <button type="button" class="ig-chip" id="pickNote">Aa Solo nota</button>
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
          <button type="button" data-align="left">⬅</button>
          <button type="button" data-align="center" class="active">⬛</button>
          <button type="button" data-align="right">➡</button>
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
        <button type="button" class="sticker-item" data-st="location">📍 Ubicación</button>
        <button type="button" class="sticker-item" data-st="mention">@ Mención</button>
        <button type="button" class="sticker-item" data-st="music">🎵 Música</button>
        <button type="button" class="sticker-item" data-st="gif">GIF</button>
        <button type="button" class="sticker-item" data-st="poll">📊 Encuesta</button>
        <button type="button" class="sticker-item" data-st="question">❓ Pregunta</button>
        <button type="button" class="sticker-item" data-st="hashtag"># Hashtag</button>
        <button type="button" class="sticker-item" data-st="countdown">⏱ Cuenta regresiva</button>
        <button type="button" class="sticker-item" data-st="emoji">😊 Emoji</button>
      </div>`;
    $$('.sticker-item').forEach(b=>b.onclick=()=>addStorySticker(b.dataset.st));
  } else if(tool==='music'){
    panel.innerHTML = `<div class="ig-panel-inner">${musicPicker('storyMusicSelect')}</div>`; bindMusicPickers(panel);
    panel.addEventListener('sekai:music-selected',e=>{
      const track=e.detail.track; window._storyState.musicId=e.detail.track?.id||''; $('#storyMusicId').value=window._storyState.musicId;
      const old=$('#storyMusicOverlay'); if(old)old.remove();
      if(track){const lyr=$('#storyMusicSelect_lyricsText')?.value||''; const overlay=document.createElement('div');overlay.id='storyMusicOverlay';overlay.className='story-lyrics-overlay';overlay.dataset.style=$('#storyMusicSelect_lyricStyle')?.value||'clean';overlay.innerHTML=`<small>♪ ${esc(track.title)} · ${esc(track.artist)}</small><div class="lyrics-sync-lines"></div>`; renderSyncedLyrics(overlay.querySelector('.lyrics-sync-lines'),lyr,0,$('#storyMusicSelect_lyricStyle')?.value||'clean');$('#storyCanvas')?.appendChild(overlay);}
    });
    const syncStoryLyrics=()=>{
      const audio=$('#storyMusicSelect_audio'), overlay=$('#storyMusicOverlay');
      const raw=$('#storyMusicSelect_lyricsText')?.value||'';
      const style=$('#storyMusicSelect_lyricStyle')?.value||'clean';
      window._storyState.lyricsText=raw; window._storyState.lyricsStyle=style;
      window._storyState.musicStart=Number($('#storyMusicSelect_start')?.value||0);
      window._storyState.musicEnd=Number($('#storyMusicSelect_end')?.value||15);
      if(overlay)renderSyncedLyrics(overlay,raw,Math.max(0,(audio?.currentTime||0)-window._storyState.musicStart),style);
    };
    $('#storyMusicSelect_lyricsText')?.addEventListener('input',syncStoryLyrics);
    $('#storyMusicSelect_lyricStyle')?.addEventListener('change',syncStoryLyrics);
    $('#storyMusicSelect_start')?.addEventListener('input',syncStoryLyrics);
    $('#storyMusicSelect_end')?.addEventListener('input',syncStoryLyrics);
    $('#storyMusicSelect_audio')?.addEventListener('timeupdate',syncStoryLyrics);
  } else if(tool==='effect'){
    panel.innerHTML = `
      <div class="ig-panel-inner">
        <div class="ig-effects">
          <button type="button" class="fx" data-fx="none">Original</button>
          <button type="button" class="fx" data-fx="soft">Soft</button>
          <button type="button" class="fx" data-fx="vivid">Vivid</button>
          <button type="button" class="fx" data-fx="mono">B&W</button>
          <button type="button" class="fx" data-fx="dream">Dream</button>
          <button type="button" class="fx" data-fx="warm">Warm</button>
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
  const labels={location:'📍 Aquí',mention:'@amigo',music:'🎵 Now Playing',gif:'GIF',poll:'📊 Sí / No',question:'❓ Pregúntame',hashtag:'#Sekai',countdown:'⏱ 24h',emoji:'✨'};
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
      const up=await sb.storage.from(MEDIA_BUCKET).upload(path,s.mediaFile,{upsert:false,contentType:s.mediaFile.type,cacheControl:'31536000'});
      if(up.error)throw up.error;
      media_url=sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const m=resolvePrismTrack(s.musicId);
    const payload={
      user_id:state.user.id, type, media_url,
      text:s.text||'', background:s.bg||'soft', align:s.align||'center',
      music_id:m?.id||null, music_title:m?.title||null, music_artist:m?.artist||null, music_url:m?musicUrl(m):null,
      music_start:Number(s.musicStart||0), music_end:Number(s.musicEnd||15), lyrics_text:s.lyricsText||'', lyrics_style:s.lyricsStyle||'clean',
      expires_at:new Date(Date.now()+24*60*60*1000).toISOString()
    };
    const {error}=await sb.from('stories').insert(payload);
    if(error)throw error;
    closeStudio(); toast('Story publicada. ✨'); await loadStories();
  }catch(err){ toast('No pude publicar la Story: '+err.message,'error'); }
  finally{ if(btn){btn.disabled=false; btn.textContent='›';} }
}

/* ========== SHORT EDITOR (vertical, CapCut-ish) ========== */
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
    <div class="cap-timeline">
      <div class="cap-track"><span class="cap-clip">Texto · 0:00 – 0:15</span></div>
    </div>
    <div class="cap-toolbar">
      <button type="button" class="cap-tool active" data-cap="text"><span>Aa</span>Texto</button>
      <button type="button" class="cap-tool" data-cap="style"><span>🎨</span>Estilo</button>
      <button type="button" class="cap-tool" data-cap="music"><span>🎵</span>Música</button>
      <button type="button" class="cap-tool" data-cap="fx"><span>✨</span>Efectos</button>
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
    ov.dataset.font=st.font;
    $('#shortPreview').dataset.bg=st.bg;
    $('#shortPreview').dataset.fx=st.fx;
  };
  $$('.cap-tool').forEach(b=>b.onclick=()=>{
    $$('.cap-tool').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const p=$('#shortPanel');
    if(b.dataset.cap==='text'){
      p.innerHTML=`<textarea id="shortText" maxlength="900" placeholder="Escribe tu Short..." rows="4">${esc(st.text)}</textarea>`;
      $('#shortText').oninput=e=>{st.text=e.target.value; render();};
    } else if(b.dataset.cap==='style'){
      p.innerHTML=`
        <div class="cap-style-grid">
          <label>Fuente<select id="shortFont"><option>Jakarta</option><option>Serif</option><option>Mono</option></select></label>
          <label>Tamaño<input id="shortSize" type="range" min="20" max="56" value="${st.size}"></label>
          <label>Fondo<select id="shortBg"><option value="gradient">Gradiente</option><option value="lavender">Lavanda</option><option value="night">Noche</option><option value="paper">Papel</option></select></label>
          <label>Alineación<select id="shortAlign"><option>center</option><option>left</option><option>right</option></select></label>
        </div>`;
      $('#shortFont').value=st.font; $('#shortBg').value=st.bg; $('#shortAlign').value=st.align;
      $('#shortFont').onchange=e=>{st.font=e.target.value;render();};
      $('#shortSize').oninput=e=>{st.size=+e.target.value;render();};
      $('#shortBg').onchange=e=>{st.bg=e.target.value;render();};
      $('#shortAlign').onchange=e=>{st.align=e.target.value;render();};
    } else if(b.dataset.cap==='music'){
      p.innerHTML=musicPicker('shortMusic'); bindMusicPickers(p);
      $('#shortMusic').onchange=e=>st.musicId=e.target.value;
    } else if(b.dataset.cap==='fx'){
      p.innerHTML=`<div class="cap-fx-row">
        <button type="button" data-fx="none">Original</button>
        <button type="button" data-fx="soft">Soft</button>
        <button type="button" data-fx="vivid">Vivid</button>
        <button type="button" data-fx="mono">B&W</button>
        <button type="button" data-fx="glitch">Glitch</button>
      </div>`;
      $$('[data-fx]').forEach(x=>x.onclick=()=>{st.fx=x.dataset.fx;render();});
    }
  });
  $$('.cap-tool')[0].click();
  $('#shortPublish').onclick=async()=>{
    const sb=requireSupabase(); if(!sb||!state.user)return;
    const m=resolvePrismTrack(st.musicId);
    const payload={user_id:state.user.id,type:'short',media_url:null,title:'',caption:st.text.trim(),visibility:'public',duration_seconds:null,
      music_id:m?.id||null,music_title:m?.title||null,music_artist:m?.artist||null,music_url:m?musicUrl(m):null,
      editor_data:{font:st.font,size:st.size,background:st.bg,align:st.align,fx:st.fx}};
    const btn=$('#shortPublish'); btn.disabled=true; btn.textContent='…';
    try{
      const {error}=await sb.from('posts').insert(payload);
      if(error)throw error;
      closeStudio(); toast('Short publicado. ✨'); await loadSekaiFeed(activeFeed); await loadHomeFeed();
    }catch(err){toast('No pude publicar el Short: '+err.message,'error');}
    finally{btn.disabled=false; btn.textContent='Publicar';}
  };
}

/* ========== IMAGE / POST / ART EDITOR ========== */
function showImageEditor(kind){
  const label=kind==='art'?'Art':'Post';
  studioFullscreen(`
  <div class="cap-editor image-mode">
    <header class="cap-top">
      <button type="button" class="cap-back" id="imgBack">‹</button>
      <span>${label}</span>
      <button type="button" class="cap-export" id="imagePublish">Publicar</button>
    </header>
    <div class="cap-preview-wrap">
      <div class="cap-preview img-preview" id="imgPreview">
        <div class="img-placeholder">Toca para elegir imagen</div>
      </div>
    </div>
    <div class="cap-toolbar">
      <button type="button" class="cap-tool active" data-cap="media"><span>🖼</span>Media</button>
      <button type="button" class="cap-tool" data-cap="filter"><span>🎨</span>Filtro</button>
      <button type="button" class="cap-tool" data-cap="frame"><span>⬜</span>Marco</button>
      <button type="button" class="cap-tool" data-cap="caption"><span>Aa</span>Texto</button>
    </div>
    <div class="cap-panel" id="imgPanel"></div>
    <input type="file" id="imageFile" accept="image/*" hidden>
  </div>`);
  $('#imgBack').onclick=()=>{closeStudio(); showCreatePost();};
  initImageEditor(kind);
}
function initImageEditor(kind){
  const st={file:null,url:null,filter:'none',frame:'none',title:'',caption:'',visibility:'public'};
  window._imgState=st;
  const render=()=>{
    const prev=$('#imgPreview'); if(!prev)return;
    if(st.url){
      prev.innerHTML=`<img src="${st.url}" class="cap-media" data-filter="${st.filter}" data-frame="${st.frame}" alt="">`;
    }
  };
  $('#imgPreview').onclick=()=>$('#imageFile').click();
  $('#imageFile').onchange=e=>{
    const f=e.target.files?.[0]; if(!f)return;
    st.file=f; st.url=URL.createObjectURL(f); render();
  };
  $$('.cap-tool').forEach(b=>b.onclick=()=>{
    $$('.cap-tool').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const p=$('#imgPanel');
    if(b.dataset.cap==='media'){
      p.innerHTML=`<button type="button" class="ig-chip" id="pickImg">Elegir imagen</button>`;
      $('#pickImg').onclick=()=>$('#imageFile').click();
    } else if(b.dataset.cap==='filter'){
      p.innerHTML=`<div class="cap-fx-row">
        <button type="button" data-f="none">Original</button>
        <button type="button" data-f="soft">Soft</button>
        <button type="button" data-f="mono">Mono</button>
        <button type="button" data-f="dream">Dream</button>
        <button type="button" data-f="vivid">Vivid</button>
        <button type="button" data-f="warm">Warm</button>
      </div>`;
      $$('[data-f]').forEach(x=>x.onclick=()=>{st.filter=x.dataset.f; render();});
    } else if(b.dataset.cap==='frame'){
      p.innerHTML=`<div class="cap-fx-row">
        <button type="button" data-fr="none">Ninguno</button>
        <button type="button" data-fr="soft">Soft</button>
        <button type="button" data-fr="rounded">Rounded</button>
        <button type="button" data-fr="paper">Paper</button>
      </div>`;
      $$('[data-fr]').forEach(x=>x.onclick=()=>{st.frame=x.dataset.fr; render();});
    } else if(b.dataset.cap==='caption'){
      p.innerHTML=`
        <input id="imageTitle" maxlength="120" placeholder="Título" value="${esc(st.title)}">
        <textarea id="imageCaption" maxlength="2000" placeholder="Descripción..." rows="3">${esc(st.caption)}</textarea>
        <select id="imageVisibility"><option value="public">Público</option><option value="friends">Amigos</option></select>`;
      $('#imageTitle').oninput=e=>st.title=e.target.value;
      $('#imageCaption').oninput=e=>st.caption=e.target.value;
      $('#imageVisibility').onchange=e=>st.visibility=e.target.value;
    }
  });
  $$('.cap-tool')[0].click();
  $('#imagePublish').onclick=async()=>{
    const sb=requireSupabase(); if(!sb||!state.user)return;
    if(!st.file)return toast('Selecciona una imagen.','error');
    const btn=$('#imagePublish'); btn.disabled=true; btn.textContent='Subiendo…';
    try{
      const ext=(st.file.name.split('.').pop()||'jpg').toLowerCase();
      const path=`${state.user.id}/${crypto.randomUUID()}.${ext}`;
      const up=await sb.storage.from(MEDIA_BUCKET).upload(path,st.file,{upsert:false,contentType:st.file.type,cacheControl:'31536000'});
      if(up.error)throw up.error;
      const url=sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
      const {error}=await sb.from('posts').insert({
        user_id:state.user.id, type:kind, media_url:url,
        title:st.title.trim(), caption:st.caption.trim(), visibility:st.visibility,
        editor_data:{filter:st.filter, frame:st.frame}
      });
      if(error)throw error;
      closeStudio(); toast(`${kind==='art'?'Art':'Post'} publicado. ✨`);
      await loadSekaiFeed(activeFeed); await loadHomeFeed();
    }catch(err){toast('No pude publicar: '+err.message,'error');}
    finally{btn.disabled=false; btn.textContent='Publicar';}
  };
}

/* ========== VIDEO EDITOR (CapCut-style) ========== */
function showVideoEditor(){
  studioFullscreen(`
  <div class="cap-editor video-mode">
    <header class="cap-top">
      <button type="button" class="cap-back" id="vidBack">‹</button>
      <span>Video Editor</span>
      <button type="button" class="cap-export" id="videoPublish">Publicar</button>
    </header>
    <div class="cap-preview-wrap">
      <div class="cap-preview vid-preview" id="vidPreview">
        <div class="img-placeholder">Toca para elegir video</div>
        <video id="videoPreview" playsinline hidden></video>
      </div>
    </div>
    <div class="cap-timeline">
      <div class="cap-track-label">Timeline</div>
      <div class="cap-track">
        <input type="range" id="vidStart" min="0" max="100" value="0" class="cap-trim">
        <input type="range" id="vidEnd" min="0" max="100" value="100" class="cap-trim">
      </div>
      <div class="cap-time-labels"><span id="vidTimeStart">0:00</span><span id="vidTimeEnd">0:00</span></div>
    </div>
    <div class="cap-toolbar">
      <button type="button" class="cap-tool active" data-cap="media"><span>🎬</span>Media</button>
      <button type="button" class="cap-tool" data-cap="trim"><span>✂</span>Recorte</button>
      <button type="button" class="cap-tool" data-cap="speed"><span>⏱</span>Velocidad</button>
      <button type="button" class="cap-tool" data-cap="filter"><span>🎨</span>Filtro</button>
      <button type="button" class="cap-tool" data-cap="music"><span>🎵</span>Música</button>
      <button type="button" class="cap-tool" data-cap="text"><span>Aa</span>Texto</button>
    </div>
    <div class="cap-panel" id="vidPanel"></div>
    <input type="file" id="videoFile" accept="video/*" hidden>
  </div>`);
  $('#vidBack').onclick=()=>{closeStudio(); showCreatePost();};
  initVideoEditor();
}
function initVideoEditor(){
  const st={file:null,url:null,speed:1,filter:'Original',title:'',caption:'',visibility:'public',musicId:'',start:0,end:1,duration:0};
  window._vidState=st;
  const v=$('#videoPreview');
  const renderFilter=()=>{ if(v) v.dataset.filter=st.filter.toLowerCase(); };
  $('#vidPreview').onclick=()=>{ if(!st.file) $('#videoFile').click(); };
  $('#videoFile').onchange=e=>{
    const f=e.target.files?.[0]; if(!f)return;
    st.file=f; st.url=URL.createObjectURL(f);
    v.src=st.url; v.hidden=false; v.controls=true;
    $('.img-placeholder')?.remove();
    v.onloadedmetadata=()=>{
      st.duration=v.duration||0;
      $('#vidTimeEnd').textContent=fmtTime(st.duration);
      $('#vidEnd').value=100;
    };
  };
  function fmtTime(s){ const m=Math.floor(s/60); const sec=Math.floor(s%60); return m+':'+String(sec).padStart(2,'0'); }
  $('#vidStart').oninput=e=>{
    st.start=(+e.target.value)/100;
    if(v && st.duration) v.currentTime=st.start*st.duration;
    $('#vidTimeStart').textContent=fmtTime(st.start*st.duration);
  };
  $('#vidEnd').oninput=e=>{
    st.end=(+e.target.value)/100;
    $('#vidTimeEnd').textContent=fmtTime(st.end*st.duration);
  };
  $$('.cap-tool').forEach(b=>b.onclick=()=>{
    $$('.cap-tool').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const p=$('#vidPanel');
    if(b.dataset.cap==='media'){
      p.innerHTML=`<button type="button" class="ig-chip" id="pickVid">Elegir video</button>
        <input id="videoTitle" maxlength="120" placeholder="Título" value="${esc(st.title)}">
        <textarea id="videoCaption" maxlength="2000" placeholder="Descripción" rows="2">${esc(st.caption)}</textarea>
        <select id="videoVisibility"><option value="public">Público</option><option value="friends">Amigos</option></select>`;
      $('#pickVid').onclick=()=>$('#videoFile').click();
      $('#videoTitle').oninput=e=>st.title=e.target.value;
      $('#videoCaption').oninput=e=>st.caption=e.target.value;
      $('#videoVisibility').onchange=e=>st.visibility=e.target.value;
    } else if(b.dataset.cap==='trim'){
      p.innerHTML=`<p class="muted">Arrastra los controles de la timeline para recortar.</p>
        <div class="cap-trim-info">Inicio: <b id="tStartInfo">${fmtTime(st.start*st.duration)}</b> · Fin: <b id="tEndInfo">${fmtTime(st.end*st.duration)}</b></div>`;
    } else if(b.dataset.cap==='speed'){
      p.innerHTML=`<div class="cap-speed-row">
        <button type="button" data-sp="0.5">0.5×</button>
        <button type="button" data-sp="0.75">0.75×</button>
        <button type="button" data-sp="1" class="active">1×</button>
        <button type="button" data-sp="1.25">1.25×</button>
        <button type="button" data-sp="1.5">1.5×</button>
        <button type="button" data-sp="2">2×</button>
      </div>`;
      $$('[data-sp]').forEach(x=>x.onclick=()=>{
        $$('[data-sp]').forEach(y=>y.classList.remove('active')); x.classList.add('active');
        st.speed=+x.dataset.sp; if(v) v.playbackRate=st.speed;
      });
    } else if(b.dataset.cap==='filter'){
      p.innerHTML=`<div class="cap-fx-row">
        <button type="button" data-f="Original">Original</button>
        <button type="button" data-f="Soft">Soft</button>
        <button type="button" data-f="Mono">Mono</button>
        <button type="button" data-f="Dream">Dream</button>
        <button type="button" data-f="Vivid">Vivid</button>
        <button type="button" data-f="Warm">Warm</button>
      </div>`;
      $$('[data-f]').forEach(x=>x.onclick=()=>{st.filter=x.dataset.f; renderFilter();});
    } else if(b.dataset.cap==='music'){
      p.innerHTML=musicPicker('videoMusic'); bindMusicPickers(p);
      $('#videoMusic').onchange=e=>st.musicId=e.target.value;
    } else if(b.dataset.cap==='text'){
      p.innerHTML=`<p class="muted">El texto se guarda en la descripción. Próximamente overlays animados.</p>
        <textarea id="vidOverlayText" placeholder="Texto sobre el video..." rows="2"></textarea>`;
    }
  });
  $$('.cap-tool')[0].click();
  $('#videoPublish').onclick=async()=>{
    const sb=requireSupabase(); if(!sb||!state.user)return;
    if(!st.file)return toast('Selecciona un video.','error');
    const btn=$('#videoPublish'); btn.disabled=true; btn.textContent='Subiendo…';
    try{
      const ext=(st.file.name.split('.').pop()||'mp4').toLowerCase();
      const path=`${state.user.id}/${crypto.randomUUID()}.${ext}`;
      const up=await sb.storage.from(MEDIA_BUCKET).upload(path,st.file,{upsert:false,contentType:st.file.type,cacheControl:'31536000'});
      if(up.error)throw up.error;
      const url=sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
      const m=resolvePrismTrack(st.musicId);
      const dur=st.duration ? Math.round(st.duration*(st.end-st.start)) : (Number.isFinite(v.duration)?Math.round(v.duration):null);
      const {error}=await sb.from('posts').insert({
        user_id:state.user.id, type:'video', media_url:url, thumbnail_url:null,
        title:st.title.trim(), caption:st.caption.trim(), visibility:st.visibility,
        duration_seconds:dur,
        music_id:m?.id||null, music_title:m?.title||null, music_artist:m?.artist||null, music_url:m?musicUrl(m):null,
        editor_data:{speed:st.speed, filter:st.filter, trimStart:st.start, trimEnd:st.end}
      });
      if(error)throw error;
      closeStudio(); toast('Video publicado. ✨');
      await loadSekaiFeed(activeFeed); await loadHomeFeed();
    }catch(err){toast('No pude publicar el video: '+err.message,'error');}
    finally{btn.disabled=false; btn.textContent='Publicar';}
  };
}

async function loadStories(){const box=$('#storyRow');if(!box||!state.user)return;if(!supabase)return;const now=new Date().toISOString();const {data,error}=await supabase.from('stories').select('id,user_id,type,media_url,text,background,align,music_id,music_title,music_artist,music_url,music_start,music_end,lyrics_text,lyrics_style,created_at,expires_at,profiles(username,display_name,avatar_url)').gt('expires_at',now).order('created_at',{ascending:false}).limit(24);const mine=state.profile||{};if(error){box.innerHTML=`<button class="story" id="profileHome"><span class="story-ring">${profileAvatarMarkup(mine)}</span><small>Tu historia</small></button><button class="story story-add" id="storyAdd">＋<small>Crear</small></button>`;$('#storyAdd').onclick=showStoryEditor;return}const groups=new Map();(data||[]).forEach(s=>{if(!groups.has(s.user_id))groups.set(s.user_id,s)});let html=`<button class="story story-add" id="storyAdd"><span class="story-ring">＋</span><small>Tu historia</small></button>`;for(const s of groups.values()){const p=s.profiles||{};html+=`<button class="story" data-story-id="${esc(s.id)}"><span class="story-ring">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:esc((p.display_name||'U')[0])}</span><small>${esc(p.display_name||p.username||'Usuario')}</small></button>`}box.innerHTML=html;$('#storyAdd').onclick=showStoryEditor;$$('[data-story-id]').forEach(b=>b.onclick=()=>openStoryViewer(b.dataset.storyId,data||[]));}
function openStoryViewer(id, stories){
  const list = (stories||[]).slice();
  let idx = Math.max(0, list.findIndex(x=>x.id===id));
  if(idx<0) idx=0;
  let timer=null, progress=0, paused=false;
  const DUR = 5500;

  function paint(){
    const s=list[idx]; if(!s) return;
    const p=s.profiles||{};
    const bars=list.map((_,i)=>`<i class="${i<idx?'done':i===idx?'on':''}"><em></em></i>`).join('');
    const media=s.type==='note'
      ? `<div class="story-view-note" data-bg="${esc(s.background||'soft')}" style="text-align:${esc(s.align||'center')}">${esc(s.text||'')}</div>`
      : (s.type==='video'
        ? `<video class="story-media" src="${esc(s.media_url||'')}" autoplay playsinline></video>`
        : `<img class="story-media" src="${esc(s.media_url||'')}" alt="">`);
    studioFullscreen(`<div class="story-fs" data-theme="${document.body.dataset.bg||'soft'}">
      <div class="story-progress">${bars}</div>
      <header class="story-top">
        <span class="mini-avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}">`:esc((p.display_name||p.username||'?')[0])}</span>
        <div><b>${esc(p.display_name||p.username||'Usuario')}</b><small>Story</small></div>
        <button type="button" class="glass-icon" id="storyClose">✕</button>
      </header>
      <div class="story-stage" id="storyStage">${media}
        ${s.lyrics_text?`<div class="story-lyrics-overlay" id="storyLyricsOverlay" data-style="${esc(s.lyrics_style||'clean')}"><small>♪ ${esc(s.music_title||'Música')} · ${esc(s.music_artist||'')}</small><div class="lyrics-sync-lines"></div></div>`:''}
        ${s.text&&s.type!=='note'?`<p class="story-caption">${esc(s.text)}</p>`:''}
      </div>
      <div class="story-footer">
        ${state.user && s.user_id===state.user.id ? `<button type="button" class="story-views-btn" id="storyViews">Vistas</button>`:''}
        <button type="button" class="story-reply-btn" id="storyReply">Responder</button>
      </div>
      ${s.music_url?`<audio id="storyAudio" src="${esc(s.music_url)}" autoplay loop></audio>`:''}
    </div>`);
    $('#storyClose').onclick=()=>{ clearInterval(timer); closeStudio(); };
    $('#storyViews')?.addEventListener('click', ()=>showStoryViews(s.id));
    $('#storyReply')?.addEventListener('click', ()=>{ toast('Respuesta a story (próximamente chat)'); });
    const storyAudio=$('#storyAudio'), storyLyrics=$('#storyLyricsOverlay .lyrics-sync-lines');
    if(storyAudio&&storyLyrics) attachLyricsSync(storyAudio,storyLyrics,s.lyrics_text||'',s.lyrics_style||'clean',Number(s.music_start||0),Number(s.music_end||15));
    const stage=$('#storyStage');
    stage.onclick=(e)=>{
      const x=e.clientX / window.innerWidth;
      if(x<0.3) prev(); else if(x>0.7) next(); else togglePause();
    };
    // record view
    recordStoryView(s.id);
    progress=0; startTimer();
    // animate progress bar
    requestAnimationFrame(()=>{
      const em=document.querySelector('.story-progress i.on em');
      if(em){ em.style.transition='none'; em.style.width='0%'; requestAnimationFrame(()=>{ em.style.transition=`width ${DUR}ms linear`; em.style.width='100%'; }); }
    });
  }
  function startTimer(){
    clearInterval(timer);
    const t0=Date.now();
    timer=setInterval(()=>{
      if(paused) return;
      if(Date.now()-t0>=DUR) next();
    }, 80);
  }
  function togglePause(){
    paused=!paused;
    const em=document.querySelector('.story-progress i.on em');
    const vid=document.querySelector('.story-media');
    if(paused){ if(em) em.style.animationPlayState='paused'; if(vid && vid.pause) vid.pause(); $('#storyAudio')?.pause(); }
    else { if(vid && vid.play) vid.play(); $('#storyAudio')?.play(); startTimer(); }
  }
  function next(){ clearInterval(timer); if(idx<list.length-1){ idx++; paint(); } else closeStudio(); }
  function prev(){ clearInterval(timer); if(idx>0){ idx--; paint(); } else { progress=0; paint(); } }
  paint();
}
async function recordStoryView(storyId){
  if(!supabase||!state.user||!storyId) return;
  try{
    await supabase.from('story_views').upsert({ story_id:storyId, viewer_id:state.user.id, seen_at:new Date().toISOString() },{ onConflict:'story_id,viewer_id' });
  }catch(e){}
}
async function showStoryViews(storyId){
  if(!supabase) return;
  try{
    const {data,error}=await supabase.from('story_views').select('viewer_id,seen_at,profiles:viewer_id(username,display_name,avatar_url)').eq('story_id',storyId).order('seen_at',{ascending:false}).limit(50);
    if(error) throw error;
    const rows=(data||[]).map(v=>`<div class="view-row"><span class="mini-avatar">${v.profiles?.avatar_url?`<img src="${esc(v.profiles.avatar_url)}">`:''}</span><span>@${esc(v.profiles?.username||'?')}</span></div>`).join('')||'<p class="muted">Nadie ha visto esta story aún.</p>';
    showModal(`<h2>Vistas</h2><div class="views-list">${rows}</div><button class="secondary wide" onclick="document.getElementById('modal').hidden=true">Cerrar</button>`);
  }catch(e){ toast(e.message,'error'); }
}

async function loadSekaiFeed(filter='all'){
 const box=$('#sekaiFeed');if(!box)return;box.innerHTML=skeletonFeed(3);const sb=requireSupabase();if(!sb){box.innerHTML='<div class="empty-state">Inicia sesión para explorar Sekai.</div>';return}
 let q=sb.from('posts').select('id,user_id,type,media_url,thumbnail_url,title,caption,visibility,duration_seconds,music_id,music_title,music_artist,music_url,editor_data,created_at,profiles(username,display_name,avatar_url)').order('created_at',{ascending:false}).limit(40);if(filter!=='all')q=q.eq('type',filter);const {data,error}=await q;if(error){const missing=/schema cache|relation .*posts.* does not exist|Could not find the table .*posts/i.test(error.message||'');box.innerHTML=`<div class="empty-state"><h3>${missing?'Falta la tabla de publicaciones':'No se pudo cargar Sekai'}</h3><small>${esc(error.message)}</small>${missing?'<p class="muted">Supabase responde, pero <code>public.posts</code> aún no está disponible. Ejecuta <code>supabase_schema.sql</code> completo y vuelve a cargar.</p>':''}</div>`;return}box.innerHTML=(data||[]).map(renderPost).join('')||'<div class="empty-state">Todavía no hay publicaciones aquí. Sé la primera persona en compartir algo. ✨</div>';
}
function renderPost(p){
 const name=p.profiles?.display_name||p.profiles?.username||'Usuario';
 const uname=p.profiles?.username||'usuario';
 const avatar=p.profiles?.avatar_url?`<img src="${esc(p.profiles.avatar_url)}" alt="">`:esc(name[0]||'U');
 const isVid=p.type==='video'||(p.type==='short'&&p.media_url);
 const media=p.type==='short'&&!p.media_url?`<div class="post-media-wrap"><div class="text-short-card"><span>SHORT</span><strong>${esc(p.caption||p.title||'')}</strong></div></div>`:(isVid
  ?`<div class="post-media-wrap video"><video class="post-media" src="${esc(p.media_url)}" controls playsinline preload="metadata" ${p.thumbnail_url?`poster="${esc(p.thumbnail_url)}"`:''}></video><span class="post-type-badge">${esc(postTypeLabel(p.type))}</span></div>`
  :`<div class="post-media-wrap"><img class="post-media image" src="${esc(p.media_url)}" alt="${esc(p.title||'Arte')}" loading="lazy"><span class="post-type-badge">${esc(postTypeLabel(p.type))}</span></div>`);
 const when=p.created_at?new Date(p.created_at).toLocaleDateString('es',{day:'numeric',month:'short'}):'';
 return `<article class="sekai-post">
  <header class="post-author">
   <span class="mini-avatar">${avatar}</span>
   <div class="post-author-meta"><b>${esc(name)}</b>${renderBadges(p.profiles?.badges)}<small>@${esc(uname)}${when?' · '+when:''}</small></div>
   <button class="post-more" aria-label="Más">•••</button>
  </header>
  ${media}
  <div class="post-body">
   <div class="post-actions">
    <button type="button" class="pa-btn" data-act="like" data-id="${esc(p.id)}">♡ <span>Me gusta</span></button>
    <button type="button" class="pa-btn" data-act="comment" data-id="${esc(p.id)}">◌ <span>Comentar</span></button>
    <button type="button" class="pa-btn" data-act="share" data-id="${esc(p.id)}">↗ <span>Compartir</span></button>
   </div>
   ${p.title?`<h3 class="post-title">${esc(p.title)}</h3>`:''}
   ${p.caption?`<p class="post-caption">${esc(p.caption)}</p>`:''}${p.music_url?`<div class="attached-music"><span>♫</span><div><b>${esc(p.music_title||'Música')}</b><small>${esc(p.music_artist||'')}</small></div><audio controls preload="none" src="${esc(p.music_url)}"></audio></div>`:''}
  </div>
 </article>`
}
$$('[data-feed]').forEach(b=>b.onclick=()=>{$$('[data-feed]').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeFeed=b.dataset.feed;loadSekaiFeed(activeFeed)});
$('#createPostBtn')?.addEventListener('click',showCreatePost);$('#createPostBtnDesktop')?.addEventListener('click',showCreatePost);
$('#createCenter')?.addEventListener('click',showCreatePost);

// Messages + Chromi
let activeConversation=null;
async function loadFriends(){
 if(!supabase||!state.user)return [];
 const {data,error}=await supabase.from('friendships').select('id,requester_id,addressee_id,status,profiles!friendships_requester_id_fkey(id,username,display_name,avatar_url),addressee:profiles!friendships_addressee_id_fkey(id,username,display_name,avatar_url)').or(`requester_id.eq.${state.user.id},addressee_id.eq.${state.user.id}`).eq('status','accepted');
 if(error)return [];
 return (data||[]).map(x=>x.requester_id===state.user.id?x.addressee:x.profiles).filter(Boolean);
}
async function loadConversations(){
 const friends=await loadFriends();
 const muted=JSON.parse(localStorage.getItem('sekai_muted_chats')||'{}');
 state.conversations=[{id:'chromi',name:'Chromi',status:'Asistente',userId:null,lastMessage:'Tu asistente',unread:0},
  ...friends.map(f=>({id:f.id,name:f.display_name||f.username,status:'Amigo',userId:f.id,avatar:f.avatar_url,lastMessage:'',unread:0,muted:!!muted[f.id]}))];
 renderConversations();
 enrichConversations();
 ensureMessagesRealtime();
}
async function enrichConversations(){
 if(!supabase||!state.user)return;
 const me=state.user.id;
 try{
  const {data}=await supabase.from('messages').select('id,sender_id,recipient_id,body,created_at,read_at')
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`).order('created_at',{ascending:false}).limit(200);
  const rows=data||[];
  const lastBy={}; const unreadBy={};
  for(const m of rows){
    const other=m.sender_id===me?m.recipient_id:m.sender_id;
    if(!lastBy[other]) lastBy[other]={text:m.body||'', at:m.created_at};
    if(m.recipient_id===me && !m.read_at) unreadBy[other]=(unreadBy[other]||0)+1;
  }
  state.conversations=state.conversations.map(c=>{
    if(!c.userId) return c;
    return {...c, lastMessage:lastBy[c.userId]?.text||c.lastMessage||'', lastAt:lastBy[c.userId]?.at, unread:unreadBy[c.userId]||0};
  });
  // sort: unread first, then by lastAt
  state.conversations.sort((a,b)=>{
    if(a.id==='chromi') return -1; if(b.id==='chromi') return 1;
    if((b.unread||0)!==(a.unread||0)) return (b.unread||0)-(a.unread||0);
    return String(b.lastAt||'').localeCompare(String(a.lastAt||''));
  });
  renderConversations();
 }catch(e){ console.log('enrich', e); }
}
let __msgChannel=null;
function ensureMessagesRealtime(){
 if(!supabase||!state.user||__msgChannel) return;
 try{
  __msgChannel=supabase.channel('messages-inbox')
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'}, payload=>{
     const m=payload.new; if(!m) return;
     const me=state.user.id;
     if(m.sender_id!==me && m.recipient_id!==me) return;
     if(m.sender_id!==me){
       const viewing=activeConversation?.userId===m.sender_id && !document.hidden;
       if(!viewing){
         const muted=JSON.parse(localStorage.getItem('sekai_muted_chats')||'{}');
         if(!muted[m.sender_id]){
           const hide=localStorage.getItem('sekai_hide_notif_preview')==='1';
           notifyNative('message', 'Nuevo mensaje', hide?'Tienes un mensaje nuevo':(m.body||''), m.sender_id);
         }
       } else {
         renderMessage(m);
         markMessagesRead(m.sender_id);
       }
       enrichConversations();
     } else if(activeConversation?.userId===m.recipient_id){
       // already rendered on send usually
     }
   })
   .subscribe();
 }catch(e){ console.log('realtime', e); }
}
function toggleMuteChat(userId){
 if(!userId)return;
 showModal(`<div class="msg-actions">
  <button type="button" data-mute="1">Silenciar 1 hora</button>
  <button type="button" data-mute="8">Silenciar 8 horas</button>
  <button type="button" data-mute="always">Silenciar siempre</button>
  <button type="button" data-mute="off">Quitar silencio</button>
  <button type="button" data-mute="x">Cerrar</button>
 </div>`);
 $$('[data-mute]').forEach(b=>b.onclick=()=>{
  const muted=JSON.parse(localStorage.getItem('sekai_muted_chats')||'{}');
  const v=b.dataset.mute;
  if(v==='x'){ $('#modal').hidden=true; return; }
  if(v==='off'){ delete muted[userId]; toast('Chat con sonido'); }
  else if(v==='always'){ muted[userId]={ until:0 }; toast('Silenciado'); }
  else {
    const h=+v; muted[userId]={ until: Date.now()+h*3600*1000 };
    toast('Silenciado '+h+' h');
  }
  localStorage.setItem('sekai_muted_chats', JSON.stringify(muted));
  $('#modal').hidden=true; enrichConversations();
 });
}
function isChatMuted(userId){
 const muted=JSON.parse(localStorage.getItem('sekai_muted_chats')||'{}');
 const m=muted[userId]; if(!m) return false;
 if(m.until===0) return true;
 if(m.until && Date.now()>m.until){ delete muted[userId]; localStorage.setItem('sekai_muted_chats',JSON.stringify(muted)); return false; }
 return true;
}

async function markMessagesRead(fromUserId){
 if(!supabase||!state.user||!fromUserId)return;
 try{
  await supabase.from('messages').update({read_at:new Date().toISOString()})
   .eq('sender_id',fromUserId).eq('recipient_id',state.user.id).is('read_at',null);
 }catch(e){}
}
let chatReplyTo=null;

function renderConversations(){
 const q=($('#messageFilter')?.value||'').toLowerCase();
 const filterMode=$('#chatListFilter')?.value||'all';
 let list=state.conversations||[];
 if(q) list=list.filter(x=>x.name.toLowerCase().includes(q));
 if(filterMode==='unread') list=list.filter(x=>(x.unread||0)>0);
 if(filterMode==='muted') list=list.filter(x=>x.muted);
 const muted=JSON.parse(localStorage.getItem('sekai_muted_chats')||'{}');
 $('#conversationList').innerHTML=list.map(x=>{
  const isMuted=!!muted[x.userId||x.id];
  const preview=x.lastMessage?esc(String(x.lastMessage).slice(0,48)):(x.status||'');
  const badge=x.unread?`<span class="unread-badge">${x.unread>99?'99+':x.unread}</span>`:'';
  const muteIcon=isMuted?'🔇 ':'';
  return `<button class="conversation" data-id="${esc(x.id)}">
    <span class="mini-avatar">${x.avatar?`<img src="${esc(x.avatar)}" alt="">`:esc((x.name||'?')[0]||'C')}</span>
    <span class="conv-meta"><b>${muteIcon}${esc(x.name)}</b><small class="conv-preview">${preview}</small></span>
    ${badge}
  </button>`;
 }).join('')||'<div class="empty-state">No hay conversaciones todavía.</div>';
 $$('.conversation').forEach(b=>b.onclick=()=>openConversation(b.dataset.id));
}
async function openConversation(id){
 const conv=state.conversations.find(x=>x.id===id); if(!conv)return;
 activeConversation=conv; chatReplyTo=null;
 $('.messages-wrap')?.classList.add('chat-open');
 $('#chatTitle').textContent=conv.name;
 $('#chatStatus').textContent=conv.muted?'Silenciado':(conv.status||'');
 $$('.conversation').forEach(b=>b.classList.toggle('active',b.dataset.id===id));
 const body=$('#chatBody'); if(body) body.innerHTML='';
 // header actions
 let bar=$('#chatHeaderActions');
 if(!bar){
  const titleEl=$('#chatTitle')?.parentElement;
  if(titleEl){
    bar=document.createElement('div'); bar.id='chatHeaderActions'; bar.className='chat-header-actions';
    titleEl.appendChild(bar);
  }
 }
 if(bar){
  bar.innerHTML=conv.userId?`
    <button type="button" class="icon-btn" id="chatSearchBtn" title="Buscar">🔍</button>
    <button type="button" class="icon-btn" id="chatMuteBtn" title="Silenciar">🔇</button>
    <button type="button" class="icon-btn" id="chatToneBtn2" title="Tono">🔔</button>
  `:'';
  $('#chatSearchBtn')?.addEventListener('click',searchInChat);
  $('#chatMuteBtn')?.addEventListener('click',()=>toggleMuteChat(conv.userId));
  $('#chatToneBtn2')?.addEventListener('click',()=>openChatTonePicker(conv.userId));
 }
 if(conv.userId){
  const {data}=await supabase.from('messages').select('*')
    .or(`and(sender_id.eq.${state.user.id},recipient_id.eq.${conv.userId}),and(sender_id.eq.${conv.userId},recipient_id.eq.${state.user.id})`)
    .order('created_at').limit(80);
  let lastDay='';
  (data||[]).forEach(m=>{
    const day=(m.created_at||'').slice(0,10);
    if(day && day!==lastDay){
      lastDay=day;
      const sep=document.createElement('div'); sep.className='day-sep';
      sep.textContent=day===new Date().toISOString().slice(0,10)?'Hoy':day;
      body.appendChild(sep);
    }
    renderMessage(m,false);
  });
  if(body) body.scrollTop=body.scrollHeight;
  markMessagesRead(conv.userId);
  conv.unread=0; renderConversations();
  setTimeout(()=>{
    const form=$('#chatForm');
    if(form && !document.getElementById('chatImageInput')){
      const lab=document.createElement('label');
      lab.className='chat-attach';
      lab.innerHTML='📎<input type="file" id="chatImageInput" accept="image/*" hidden>';
      form.insertBefore(lab, form.firstChild);
      $('#chatImageInput').onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(f) sendChatImage(f); e.target.value=''; };
    }
    const inp=$('#chatInput');
    if(inp && !inp.dataset.typingBound){
      inp.dataset.typingBound='1';
      inp.addEventListener('input',()=>sendTypingSignal());
    }
  }, 40);

 } else {
  body.innerHTML='<div class="welcome-chat"><span class="big-mark">✦</span><h2>Chromi</h2><p>Escribe abajo o elige una sugerencia.</p></div>';
 }
}
function renderMessage(m, doNotify=true){
 const bodyEl=$('#chatBody'); if(!bodyEl||!m) return;
 const mine=m.sender_id===state.user?.id;
 const row=document.createElement('div');
 row.className='bubble '+(mine?'user':'bot');
 row.dataset.mid=m.id||'';
 let html='';
 if(m.reply_to_body) html+=`<div class="reply-quote">${esc(String(m.reply_to_body).slice(0,80))}</div>`;
 if(m.media_url) html+=`<img class="bubble-img" src="${esc(m.media_url)}" alt="">`;
 else if(/^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i.test(m.body||'')) html+=`<img class="bubble-img" src="${esc((m.body||'').replace('[imagen] ',''))}" alt="">`;
 else html+=`<div class="bubble-text">${esc(m.body||'')}</div>`;
 const time=(m.created_at||'').slice(11,16);
 const status=mine?(m.read_at?'✓✓':(m.id?'✓':'…')):'';
 html+=`<div class="bubble-meta"><span>${esc(time)}</span>${mine?`<span class="msg-status">${status}</span>`:''}</div>`;
 row.innerHTML=html;
 row.addEventListener('contextmenu',e=>{ e.preventDefault(); openMsgActions(m, mine); });
 let pressTimer;
 row.addEventListener('touchstart',()=>{ pressTimer=setTimeout(()=>openMsgActions(m,mine),450); },{passive:true});
 row.addEventListener('touchend',()=>clearTimeout(pressTimer));
 bodyEl.appendChild(row);
 bodyEl.scrollTop=bodyEl.scrollHeight;
 if(doNotify && m.sender_id && state.user && m.sender_id!==state.user.id){
  const viewing=activeConversation?.userId===m.sender_id && !document.hidden;
  if(!viewing){
    const muted=JSON.parse(localStorage.getItem('sekai_muted_chats')||'{}');
    if(!muted[m.sender_id]){
      const hide=localStorage.getItem('sekai_hide_notif_preview')==='1';
      notifyNative('message','Nuevo mensaje', hide?'Tienes un mensaje nuevo':(m.body||''), m.sender_id);
    }
  }
 }
}
function openMsgActions(m, mine){
 showModal(`<div class="msg-actions">
  <button type="button" data-ma="copy">Copiar</button>
  <button type="button" data-ma="reply">Responder</button>
  ${mine?`<button type="button" data-ma="delete" class="danger">Eliminar</button>`:''}
  <button type="button" data-ma="close">Cerrar</button>
 </div>`);
 $$('[data-ma]').forEach(b=>b.onclick=async()=>{
  const a=b.dataset.ma;
  if(a==='copy'){ try{ await navigator.clipboard.writeText(m.body||''); toast('Copiado'); }catch{toast('No se pudo copiar','error')} }
  if(a==='reply'){ chatReplyTo=m; const inp=$('#chatInput'); if(inp){ inp.placeholder='Respondiendo…'; inp.focus(); } toast('Responder a mensaje'); }
  if(a==='delete' && mine && m.id){
   const sb=requireSupabase();
   const {error}=await sb.from('messages').delete().eq('id',m.id).eq('sender_id',state.user.id);
   if(error) toast(error.message,'error'); else { document.querySelector(`[data-mid="${m.id}"]`)?.remove(); toast('Eliminado'); }
  }
  $('#modal').hidden=true;
 });
}
async function sendSocialMessage(text){
 if(!activeConversation?.userId) return false;
 const sb=requireSupabase(); if(!sb||!state.user) return true;
 const rid=activeConversation.userId;
 const {data:target}=await sb.from('profiles').select('message_privacy,paused').eq('id',rid).maybeSingle();
 if(target?.paused){toast('Esta cuenta no recibe mensajes.','error');return true;}
 if(target?.message_privacy==='nobody'){toast('Este usuario no acepta mensajes.','error');return true;}
 if(target?.message_privacy==='friends'){
  const {data:fr}=await sb.from('friendships').select('id').or(`and(requester_id.eq.${state.user.id},addressee_id.eq.${rid}),and(requester_id.eq.${rid},addressee_id.eq.${state.user.id})`).eq('status','accepted').maybeSingle();
  if(!fr){toast('Solo amigos pueden enviarle mensajes.','error');return true;}
 }
 const payload={ sender_id:state.user.id, recipient_id:rid, body:text };
 if(chatReplyTo){ payload.reply_to=chatReplyTo.id; payload.reply_to_body=chatReplyTo.body; }
 const {data,error}=await sb.from('messages').insert(payload).select().single();
 if(error){
  // fallback without reply columns
  if(String(error.message||'').includes('reply')){
    const r2=await sb.from('messages').insert({sender_id:state.user.id,recipient_id:rid,body:text}).select().single();
    if(r2.error){toast(r2.error.message,'error');return true;}
    renderMessage(r2.data); chatReplyTo=null; return true;
  }
  toast(error.message,'error');return true;
 }
 renderMessage(data,false); chatReplyTo=null;
 const inp=$('#chatInput'); if(inp) inp.placeholder='Mensaje…';
 enrichConversations();
 return true;
}


let typingTimer=null;
function sendTypingSignal(){
 if(!activeConversation?.userId||!supabase||!state.user) return;
 try{
  supabase.channel('typing-'+activeConversation.userId).send({
    type:'broadcast', event:'typing', payload:{ from:state.user.id, to:activeConversation.userId }
  });
 }catch(e){}
}
function showTypingUI(show){
 let el=$('#typingIndicator');
 if(!el){
  const body=$('#chatBody'); if(!body) return;
  el=document.createElement('div'); el.id='typingIndicator'; el.className='typing-indicator'; el.textContent='escribiendo…';
  body.parentElement?.appendChild(el);
 }
 el.hidden=!show;
}
async function sendChatImage(file){
 if(!file||!activeConversation?.userId||!supabase||!state.user) return;
 const rid=activeConversation.userId;
 toast('Subiendo imagen…');
 try{
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
  const path=state.user.id+'/chat/'+Date.now()+'.'+ext;
  const up=await supabase.storage.from('sekai-media').upload(path,file,{upsert:true,contentType:file.type});
  if(up.error) throw up.error;
  const url=supabase.storage.from('sekai-media').getPublicUrl(path).data.publicUrl;
  const {data,error}=await supabase.from('messages').insert({
    sender_id:state.user.id, recipient_id:rid, body:'[imagen]', media_url:url
  }).select().single();
  if(error){
    const r2=await supabase.from('messages').insert({sender_id:state.user.id,recipient_id:rid,body:'[imagen] '+url}).select().single();
    if(r2.error) throw r2.error;
    renderMessage(r2.data,false);
  } else renderMessage(data,false);
  enrichConversations();
 }catch(e){ toast(e.message||'Error al subir','error'); }
}
function searchInChat(){
 const q=prompt('Buscar en este chat');
 if(!q) return;
 const ql=q.toLowerCase();
 $$('#chatBody .bubble').forEach(b=>{
  const t=b.textContent.toLowerCase();
  b.style.outline = t.includes(ql) ? '2px solid var(--purple,#8d6de0)' : '';
 });
 toast('Resultados resaltados');
}

async function openSocial(initialTab='friends'){showModal(`<span class="eyebrow">SEKAI SOCIAL</span><h2>Conecta con personas</h2><div class="social-tabs"><button data-social="friends">Amigos</button><button data-social="requests">Solicitudes</button><button data-social="search">Buscar</button><button data-social="library">Biblioteca</button><button data-social="settings">Ajustes</button></div><div id="socialContent"></div>`);$$('[data-social]').forEach(b=>b.onclick=()=>renderSocial(b.dataset.social));renderSocial(initialTab);}
async function renderSocial(tab){const c=$('#socialContent');if(!c)return;if(tab==='friends'){const friends=await loadFriends();c.innerHTML=`<div class="social-search"><input id="friendSearch" placeholder="Buscar usuario..."><button id="doFriendSearch" class="primary">Buscar</button></div><div id="friendResults"></div><h3>Mis amigos</h3>${friends.map(f=>`<div class="friend-row"><span class="mini-avatar">${f.avatar_url?`<img src="${esc(f.avatar_url)}">`:esc((f.display_name||'U')[0])}</span><div><b>${esc(f.display_name||f.username)}</b><small>@${esc(f.username)}</small></div><button class="secondary" data-chat="${f.id}">Mensaje</button></div>`).join('')||'<p class="muted">Todavía no tienes amigos.</p>'}`;$('#doFriendSearch').onclick=async()=>{const q=$('#friendSearch').value.trim();if(!q)return;const {data}=await supabase.from('profiles').select('id,username,display_name,avatar_url,visibility').ilike('username',`%${q}%`).neq('id',state.user.id).limit(10);$('#friendResults').innerHTML=(data||[]).map(f=>`<div class="friend-row"><span class="mini-avatar">${f.avatar_url?`<img src="${esc(f.avatar_url)}">`:esc((f.display_name||'U')[0])}</span><div><b>${esc(f.display_name||f.username)}</b><small>@${esc(f.username)}</small></div><button class="primary" data-add="${f.id}">Agregar</button></div>`).join('')||'<p class="muted">No encontramos usuarios.</p>';$$('[data-add]').forEach(b=>b.onclick=()=>sendFriendRequest(b.dataset.add));};$$('[data-chat]').forEach(b=>{b.onclick=async()=>{setRoute('messages');await loadConversations();openConversation(b.dataset.chat)}})}
if(tab==='requests'){const {data}=await supabase.from('friendships').select('id,requester_id,profiles!friendships_requester_id_fkey(username,display_name)').eq('addressee_id',state.user.id).eq('status','pending');c.innerHTML=(data||[]).map(r=>`<div class="friend-row"><div><b>${esc(r.profiles?.display_name||r.profiles?.username)}</b><small>@${esc(r.profiles?.username||'')}</small></div><button class="primary" data-accept="${r.id}">Aceptar</button></div>`).join('')||'<p class="muted">No tienes solicitudes pendientes.</p>';$$('[data-accept]').forEach(b=>b.onclick=async()=>{await supabase.from('friendships').update({status:'accepted'}).eq('id',b.dataset.accept);toast('Solicitud aceptada.');renderSocial('requests');loadConversations();});}
if(tab==='library'){const items=JSON.parse(localStorage.getItem('chromi_library')||'[]');c.innerHTML=`<h3>Mi biblioteca</h3><p class="muted">Guarda resultados desde Search para tenerlos aquí.</p>${items.map((x,i)=>`<div class="library-row"><img src="${esc(x.image||'')}"><div><b>${esc(x.title)}</b><small>${esc(x.type||'Contenido')}</small></div><button class="secondary" data-del-lib="${i}">×</button></div>`).join('')||'<p class="muted">Tu biblioteca está vacía.</p>'}`;$$('[data-del-lib]').forEach(b=>b.onclick=()=>{items.splice(+b.dataset.delLib,1);localStorage.setItem('chromi_library',JSON.stringify(items));renderSocial('library')});}
if(tab==='settings'){const p=state.profile||{};c.innerHTML=`<h3>Personalización</h3><p class="muted">Estos ajustes controlan el aspecto y las animaciones de tu Sekai.</p><div class="custom-grid"><label>Tema<input id="customTheme" type="color" value="${esc(p.theme_color||'#7068e8')}"></label><label>Acento<input id="customAccent" type="color" value="${esc(p.accent_color||'#a29cf5')}"></label><label>Animaciones<select id="customMotion"><option value="full" ${p.animation_level==='full'?'selected':''}>Completas</option><option value="reduced" ${p.animation_level==='reduced'?'selected':''}>Reducidas</option><option value="off" ${p.animation_level==='off'?'selected':''}>Desactivadas</option></select></label><label>Glass<select id="customGlass"><option value="0.72">Suave</option><option value="0.86" selected>Medio</option><option value="0.95">Intenso</option></select></label><label>Fondo<select id="customBg"><option value="soft">Suave</option><option value="plain">Limpio</option><option value="night">Noche</option></select></label><label>Navegación<select id="customNav"><option value="normal">Normal</option><option value="compact">Compacta</option></select></label></div><button id="saveCustomization" class="primary wide">Guardar personalización</button><div class="settings-row"><span>Notificaciones del navegador</span><button id="notifyBtn" class="secondary">Activar</button></div><h3>Seguridad</h3><button id="resetSession" class="secondary wide">Cerrar sesión en este dispositivo</button><button id="deleteAccount" class="danger wide">Eliminar cuenta</button>`;$('#saveCustomization').onclick=async()=>{const sb=requireSupabase();if(!sb||!state.user)return;const payload={theme_color:$('#customTheme').value,accent_color:$('#customAccent').value,animation_level:$('#customMotion').value,glass_intensity:+$('#customGlass').value,background_mode:$('#customBg').value,navigation_style:$('#customNav').value};const {data,error}=await sb.from('profiles').update(payload).eq('id',state.user.id).select().single();if(error)return toast(error.message,'error');state.profile=data;localStorage.setItem('sekai_customization',JSON.stringify(payload));applyCustomization(data);toast('Personalización guardada. ✨')};$('#notifyBtn').onclick=async()=>{if('Notification' in window){const p=await Notification.requestPermission();toast(p==='granted'?'Notificaciones activadas.':'Permiso no concedido.','ok')}};$('#resetSession').onclick=async()=>{await supabase.auth.signOut();location.reload()};$('#deleteAccount').onclick=()=>toast('Por seguridad, la eliminación definitiva requiere una función backend protegida.','error');}}
async function sendFriendRequest(id){
  const sb=requireSupabase(); if(!sb||!state.user)return;
  const {data:target}=await sb.from('profiles').select('friend_privacy,paused').eq('id',id).maybeSingle();
  if(target?.paused) return toast('Esta cuenta no acepta solicitudes.','error');
  if(target?.friend_privacy==='nobody') return toast('Este usuario no acepta solicitudes.','error');
  const {error}=await sb.from('friendships').insert({requester_id:state.user.id,addressee_id:id,status:'pending'});
  if(error)return toast(error.code==='23505'?'Ya existe una solicitud o amistad.':error.message,'error');
  toast('Solicitud enviada.');
}
function saveToLibrary(item){const items=JSON.parse(localStorage.getItem('chromi_library')||'[]');if(!items.some(x=>x.id===item.id&&x.type===item.type)){items.unshift(item);localStorage.setItem('chromi_library',JSON.stringify(items));toast('Guardado en tu biblioteca.')}else toast('Ya está en tu biblioteca.');}
renderConversations();$('#messageFilter').oninput=renderConversations;$('#chatBack').onclick=()=>{const w=$('.messages-wrap');if(w)w.classList.remove('chat-open');};$('#newChat').onclick=()=>state.user?openSocial():openOnboarding('landing');$('#chatInfo').onclick=()=>toast('Chat privado protegido por RLS.');$('#chatToneBtn')?.addEventListener('click',()=>{const id=activeConversation?.userId; if(id) openChatTonePicker(id);});
$('#chatForm').onsubmit=async e=>{e.preventDefault();const input=$('#chatInput'),text=input.value.trim();if(!text)return;if(activeConversation?.userId){await sendSocialMessage(text);input.value='';return;}const row=document.createElement('div');row.className='bubble user';row.textContent=text;$('#chatBody').appendChild(row);input.value='';$('#chatBody').scrollTop=$('#chatBody').scrollHeight;try{const r=await fetch(apiUrl('/api/chat'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:text,usuario:state.profile?.display_name||'Usuario'})});const d=await r.json();const bot=document.createElement('div');bot.className='bubble bot';bot.textContent=d.respuesta||'No pude responder ahora.';$('#chatBody').appendChild(bot);$('#chatBody').scrollTop=$('#chatBody').scrollHeight}catch{toast('Chromi no pudo responder desde el backend.','error')} };
window.addEventListener('hashchange',()=>{const r=location.hash.slice(1);if(['home','sekaifeed','search','messages','profile'].includes(r))setRoute(r,false)});
(async()=>{setRoute(location.hash.slice(1)||'home',false);await initSupabase();if(supabaseReady)await initAuth();if(state.user){applyCustomization(state.profile||{});loadSekaiFeed();loadHomeFeed();}if(!localStorage.getItem('chromi_onboarding_seen')&&!state.user)setTimeout(()=>openOnboarding('intro1'),200);})();

/* —— UI v2 integrada (FAB, chips, VPN, orb) —— */
function goMessagesWithPrompt(prompt){
  location.hash='messages';
  try{window.dispatchEvent(new HashChangeEvent('hashchange'))}catch(e){setRoute('messages')}
  setTimeout(()=>{
    const input=$('#chatInput'),form=$('#chatForm');
    if(!input||!form)return;
    input.value=prompt;input.focus();
    try{form.requestSubmit()}catch(e){form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))}
  },280);
}
function initUiV2(){
  const fab=$('#chromiFab');
  if(fab)fab.onclick=()=>{location.hash='messages';try{window.dispatchEvent(new HashChangeEvent('hashchange'))}catch(e){setRoute('messages')};setTimeout(()=>$('#chatInput')?.focus(),300)};
  $$('[data-chromi-prompt]').forEach(btn=>{
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const p=btn.getAttribute('data-chromi-prompt');if(p)goMessagesWithPrompt(p)});
  });
  const sw=$('#vpnSwitch'),label=$('#vpnStatusLabel');
  const setVpnUi=(on,text)=>{if(sw)sw.classList.toggle('on',!!on);if(label)label.textContent=text};
  window.__sekaiVpnState=function(state){
    if(state==='connecting')setVpnUi(true,'Conectando…');
    else if(state==='disconnected')setVpnUi(false,'Desconectada');
    else if(state==='permission_denied')setVpnUi(false,'Permiso denegado');
    else setVpnUi(!!state,String(state||''));
  };
  if(sw)sw.onclick=()=>{
    const on=!sw.classList.contains('on');
    if(window.AndroidBridge&&typeof AndroidBridge.connectVpn==='function'){
      if(on){setVpnUi(true,'Solicitando permiso…');try{AndroidBridge.connectVpn('')}catch(e){setVpnUi(false,'Error')}}
      else{try{AndroidBridge.disconnectVpn()}catch(e){}setVpnUi(false,'Desconectada')}
    }else{
      setVpnUi(on,on?'Simulación web (VPN en APK)':'Desconectada');
    }
  };
  const orb=$('.chromi-orb'),hero=$('#chromiHero');
  if(orb&&hero){
    hero.addEventListener('pointermove',e=>{
      const r=hero.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-0.5,y=(e.clientY-r.top)/r.height-0.5;
      orb.style.transform=`rotateY(${x*24}deg) rotateX(${-y*14}deg) translateY(${y*-4}px)`;
    });
    hero.addEventListener('pointerleave',()=>{orb.style.transform=''});
  }
}

/* Android notifications + tonos por chat */
function isNativeAndroid(){ return !!(window.AndroidBridge && AndroidBridge.showNotification); }
function notifyNative(channel, title, body, chatId){
  try {
    if (isNativeAndroid()) AndroidBridge.showNotification(channel||'default', title||'Sekai', body||'', chatId||'');
  } catch(e){}
}
function getChatTone(chatId){
  try {
    if (isNativeAndroid() && AndroidBridge.getChatNotificationTone) return AndroidBridge.getChatNotificationTone(chatId);
  } catch(e){}
  try { const m=JSON.parse(localStorage.getItem('sekai_chat_tones')||'{}'); return m[chatId]||'default'; } catch(e){ return 'default'; }
}
function setChatTone(chatId, tone){
  try {
    if (isNativeAndroid() && AndroidBridge.setChatNotificationTone) AndroidBridge.setChatNotificationTone(chatId, tone);
  } catch(e){}
  try {
    const m=JSON.parse(localStorage.getItem('sekai_chat_tones')||'{}');
    m[chatId]=tone; localStorage.setItem('sekai_chat_tones', JSON.stringify(m));
  } catch(e){}
  toast('Tono del chat: '+tone);
}
function openChatTonePicker(chatId){
  if(!chatId) return;
  const cur=getChatTone(chatId);
  showModal(`<div class="settings-shell"><span class="eyebrow">CHAT</span><h2>Tono de notificación</h2>
    <p class="muted">Solo este chat. En Android se usa un canal nativo.</p>
    <div class="tone-list">
      ${['default','soft','ringtone','alarm','silent'].map(t=>`
        <button type="button" class="tone-opt ${t===cur?'active':''}" data-tone="${t}">${t}</button>`).join('')}
    </div>
    <button class="secondary wide" id="toneClose">Cerrar</button></div>`);
  $$('[data-tone]').forEach(b=>b.onclick=()=>{ setChatTone(chatId, b.dataset.tone); openChatTonePicker(chatId); });
  $('#toneClose')?.addEventListener('click',()=>{$('#modal').hidden=true});
}
window.__sekaiOpenChat = function(chatId){
  // Hook para deep link desde notificación
  try { if (typeof openConversation==='function') openConversation(chatId); } catch(e){}
};


/* ===== Sekai Dev / Owner menu =====
   Team: casi todo control (sin ban permanente ni espiar)
   Owner: todo excepto espiar. Incluye warnings y ban.
   Abrir: 7 toques en el logo ✦
*/
(function initSekaiDevMenu(){
  const info = { flavor:'global', isDev:false, isOwner:false, showDevMenu:false, versionName:'1.0.0' };
  try {
    if (window.AndroidBridge && AndroidBridge.getAppInfo) {
      Object.assign(info, JSON.parse(AndroidBridge.getAppInfo()));
    }
    // NUNCA activar en web/global. Solo APK team/owner con SHOW_DEV_MENU=true
  } catch(e){}
  window.__SEKAI_APP_INFO = info;
  if (!info.showDevMenu) return;

  window.__sekaiLogs = window.__sekaiLogs || [];
  const _log = console.log.bind(console);
  console.log = function(){
    try {
      window.__sekaiLogs.push([new Date().toISOString(), ...arguments].map(String).join(' '));
      if (window.__sekaiLogs.length > 200) window.__sekaiLogs.shift();
    } catch(e){}
    _log(...arguments);
  };

  // Botón visible solo en APK team/owner (interfaz distinta)
  document.body.classList.add(info.isOwner ? 'flavor-owner' : 'flavor-team');
  document.documentElement.setAttribute('data-flavor', info.flavor || 'team');
  if (!document.getElementById('staffFab')) {
    const fab = document.createElement('button');
    fab.id = 'staffFab';
    fab.type = 'button';
    fab.className = 'staff-fab' + (info.isOwner ? ' owner' : ' team');
    fab.innerHTML = info.isOwner ? '◆' : '◇';
    fab.title = info.isOwner ? 'Owner panel' : 'Team panel';
    fab.setAttribute('aria-label', 'Staff panel');
    document.body.appendChild(fab);
    fab.addEventListener('click', openStaffMenu);
  }

  function staffBadge(){
    return info.isOwner ? '<span class="staff-badge owner">OWNER</span>' : '<span class="staff-badge team">TEAM</span>';
  }

  function openStaffMenu(){
    const isOwner = !!info.isOwner;
    const common = [
      { id:'logs', label:'📋 Logs recientes' },
      { id:'status', label:'📡 Estado sesión + Supabase' },
      { id:'cache', label:'🗑 Limpiar caché local' },
      { id:'reset_ob', label:'🔁 Reset onboarding' },
      { id:'announce', label:'📢 Anunciar (notificación)' },
      { id:'mod_post', label:'🛡 Moderación: ocultar/borrar post' },
      { id:'mod_story', label:'◌ Moderación: borrar story' },
      { id:'flags', label:'🚩 Feature flags' },
      { id:'stats', label:'📊 Contadores rápidos' },
      { id:'warn', label:'⚠️ Warning a usuario' },
    ];
    const ownerOnly = [
      { id:'ban', label:'🚫 Banear usuario' },
      { id:'unban', label:'✅ Desbanear usuario' },
      { id:'delete_user', label:'💀 Eliminar cuenta (hard)' },
      { id:'pin', label:'📌 Destacar post global' },
      { id:'badge', label:'🏅 Otorgar badge' },
    ];
    const items = isOwner ? common.concat(ownerOnly) : common;
    const html = `<div class="staff-sheet">
      <header class="staff-head">${staffBadge()}<b>Staff menu</b>
        <small>${esc(info.flavor)} · v${esc(info.versionName||'?')}</small>
        <button type="button" id="staffClose">✕</button>
      </header>
      <div class="staff-list">${items.map(i => `<button type="button" data-staff="${i.id}">${i.label}</button>`).join('')}</div>
      <p class="staff-note">Sin espiar / impersonar. ${isOwner ? 'Owner: control total.' : 'Team: casi todo, sin ban permanente.'}</p>
    </div>`;
    showModal(html);
    const modal = $('#modal');
    if (modal) modal.classList.add('staff-modal');
    $('#staffClose')?.addEventListener('click', closeStaff);
    $$('[data-staff]').forEach(b => b.onclick = () => runStaff(b.dataset.staff, isOwner));
  }

  function closeStaff(){
    const modal = $('#modal');
    if (modal) { modal.classList.remove('staff-modal'); modal.hidden = true; }
  }

  async function runStaff(id, isOwner){
    const sb = requireSupabase();
    if (id === 'logs') {
      const logs = (window.__sekaiLogs || []).slice(-60).join('\n') || '(sin logs)';
      showModal(`<div class="staff-sheet"><header class="staff-head"><b>Logs</b><button type="button" id="staffClose">✕</button></header>
        <pre class="staff-log">${esc(logs)}</pre>
        <button class="primary wide" id="copyLogs">Copiar</button></div>`);
      $('#staffClose')?.addEventListener('click', closeStaff);
      $('#copyLogs')?.addEventListener('click', () => { navigator.clipboard?.writeText(logs); toast('Logs copiados'); });
      return;
    }
    if (id === 'status') {
      let supabaseOk = '—';
      try {
        if (sb) {
          const { error } = await sb.from('profiles').select('id').limit(1);
          supabaseOk = error ? ('Error: ' + error.message) : 'OK ✓';
        } else supabaseOk = 'No configurado';
      } catch (e) { supabaseOk = String(e.message || e); }
      const body = `User: ${state.user?.id || 'none'}
Email: ${state.user?.email || '—'}
Profile: ${state.profile?.username || '—'} (${state.profile?.chromi_id || '—'})
Flavor: ${info.flavor}
Supabase: ${supabaseOk}`;
      showModal(`<div class="staff-sheet"><header class="staff-head"><b>Estado</b><button type="button" id="staffClose">✕</button></header>
        <pre class="staff-log">${esc(body)}</pre></div>`);
      $('#staffClose')?.addEventListener('click', closeStaff);
      return;
    }
    if (id === 'cache') {
      localStorage.clear(); sessionStorage.clear();
      toast('Caché limpiada'); closeStaff();
      return;
    }
    if (id === 'reset_ob') {
      localStorage.setItem('chromi_onboarding_pending', '1');
      state.onboardDraft = null;
      toast('Onboarding reseteado. Recarga.');
      return;
    }
    if (id === 'announce') {
      const title = prompt('Título del anuncio');
      if (!title) return;
      const body = prompt('Cuerpo') || '';
      if (!sb || !state.user) return toast('Sesión requerida', 'error');
      try {
        // Notificación para el staff actual (prueba). Owner puede ampliar a broadcast después.
        const { error } = await sb.from('notifications').insert({
          user_id: state.user.id,
          kind: 'announce',
          title,
          body,
          read: false
        });
        if (error) throw error;
        toast('Anuncio creado (notificación)');
      } catch (e) { toast('Error anuncio: ' + e.message, 'error'); }
      return;
    }
    if (id === 'mod_post') {
      const postId = prompt('ID del post a moderar');
      if (!postId) return;
      const action = prompt('Escribe hide o delete', 'hide');
      if (!sb) return;
      try {
        if (action === 'delete') {
          const { error } = await sb.from('posts').delete().eq('id', postId);
          if (error) throw error;
          toast('Post eliminado');
        } else {
          const { error } = await sb.from('posts').update({ visibility: 'friends' }).eq('id', postId);
          if (error) throw error;
          toast('Post ocultado (visibility=friends)');
        }
        loadSekaiFeed?.(activeFeed); loadHomeFeed?.();
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
    if (id === 'mod_story') {
      const storyId = prompt('ID de la story');
      if (!storyId || !sb) return;
      try {
        const { error } = await sb.from('stories').delete().eq('id', storyId);
        if (error) throw error;
        toast('Story eliminada');
        loadStories?.();
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
    if (id === 'flags') {
      showModal(`<div class="staff-sheet"><header class="staff-head"><b>Feature flags</b><button type="button" id="staffClose">✕</button></header>
        <p class="muted">Próximamente: tabla app_config. Por ahora flags locales de prueba.</p>
        <label class="staff-flag"><input type="checkbox" id="flagStories" checked> Stories</label>
        <label class="staff-flag"><input type="checkbox" id="flagShorts" checked> Shorts</label>
        <label class="staff-flag"><input type="checkbox" id="flagVpn" checked> VPN</label>
        <label class="staff-flag"><input type="checkbox" id="flagMaint"> Modo mantenimiento</label>
        <button class="primary wide" id="saveFlags">Guardar local</button></div>`);
      $('#staffClose')?.addEventListener('click', closeStaff);
      try {
        const f = JSON.parse(localStorage.getItem('sekai_flags') || '{}');
        if (f.stories === false) $('#flagStories').checked = false;
        if (f.shorts === false) $('#flagShorts').checked = false;
        if (f.vpn === false) $('#flagVpn').checked = false;
        if (f.maintenance) $('#flagMaint').checked = true;
      } catch(e){}
      $('#saveFlags')?.addEventListener('click', () => {
        const f = {
          stories: $('#flagStories').checked,
          shorts: $('#flagShorts').checked,
          vpn: $('#flagVpn').checked,
          maintenance: $('#flagMaint').checked
        };
        localStorage.setItem('sekai_flags', JSON.stringify(f));
        toast('Flags guardadas (local)');
        closeStaff();
      });
      return;
    }
    if (id === 'stats') {
      if (!sb) return toast('Sin Supabase', 'error');
      try {
        const [p, s, u] = await Promise.all([
          sb.from('posts').select('id', { count: 'exact', head: true }),
          sb.from('stories').select('id', { count: 'exact', head: true }),
          sb.from('profiles').select('id', { count: 'exact', head: true })
        ]);
        const msg = `Profiles: ${u.count ?? '—'}
Posts: ${p.count ?? '—'}
Stories: ${s.count ?? '—'}`;
        showModal(`<div class="staff-sheet"><header class="staff-head"><b>Contadores</b><button type="button" id="staffClose">✕</button></header>
          <pre class="staff-log">${esc(msg)}</pre></div>`);
        $('#staffClose')?.addEventListener('click', closeStaff);
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
    if (id === 'warn') {
      const username = prompt('Username a advertir (sin @)');
      if (!username || !sb) return;
      const reason = prompt('Motivo del warning') || 'Advertencia del staff';
      try {
        const { data: prof, error: e1 } = await sb.from('profiles').select('id,username').eq('username', username).maybeSingle();
        if (e1) throw e1;
        if (!prof) return toast('Usuario no encontrado', 'error');
        const { error } = await sb.from('notifications').insert({
          user_id: prof.id,
          kind: 'warning',
          title: '⚠️ Advertencia',
          body: reason,
          read: false
        });
        if (error) throw error;
        // Opcional: tabla warnings si existe
        try {
          await sb.from('user_warnings').insert({
            user_id: prof.id,
            reason,
            issued_by: state.user?.id
          });
        } catch (_) {}
        toast('Warning enviado a @' + username);
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
    if (!isOwner) {
      toast('Solo Owner', 'error');
      return;
    }
    if (id === 'ban' || id === 'unban') {
      const username = prompt('Username');
      if (!username || !sb) return;
      const reason = id === 'ban' ? (prompt('Motivo del ban') || 'Ban') : '';
      if (id === 'ban' && !confirm('¿Banear a @' + username + '?')) return;
      try {
        const { data: prof, error: e1 } = await sb.from('profiles').select('id,username').eq('username', username).maybeSingle();
        if (e1) throw e1;
        if (!prof) return toast('No encontrado', 'error');
        const banned = id === 'ban';
        // profiles.banned o tabla staff_actions — usamos update flexible
        const { error } = await sb.from('profiles').update({
          visibility: banned ? 'private' : 'public'
        }).eq('id', prof.id);
        if (error) throw error;
        try {
          await sb.from('user_bans').upsert({
            user_id: prof.id,
            banned,
            reason: reason || null,
            by: state.user?.id,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        } catch (_) {}
        if (banned) {
          await sb.from('notifications').insert({
            user_id: prof.id,
            kind: 'ban',
            title: 'Cuenta restringida',
            body: reason,
            read: false
          });
        }
        toast(banned ? ('Baneado @' + username) : ('Desbaneado @' + username));
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
    if (id === 'delete_user') {
      const username = prompt('Username a ELIMINAR (hard)');
      if (!username || !sb) return;
      if (prompt('Escribe ELIMINAR para confirmar') !== 'ELIMINAR') return toast('Cancelado');
      try {
        const { data: prof, error: e1 } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
        if (e1) throw e1;
        if (!prof) return toast('No encontrado', 'error');
        const { error } = await sb.from('profiles').delete().eq('id', prof.id);
        if (error) throw error;
        toast('Perfil eliminado (auth.users puede quedar; bórralo en dashboard si hace falta)');
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
    if (id === 'pin') {
      const postId = prompt('ID del post a destacar');
      if (!postId || !sb) return;
      try {
        const { error } = await sb.from('posts').update({
          editor_data: { pinned: true }
        }).eq('id', postId);
        if (error) throw error;
        toast('Marcado pinned en editor_data');
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
    if (id === 'badge') {
      const username = prompt('Username a otorgar badge');
      if (!username || !sb) return;
      const kind = prompt('Badge: verified | developer | celebrity | owner | special', 'verified');
      const allowed = ['verified','developer','celebrity','owner','special'];
      if (!allowed.includes(kind)) return toast('Badge inválido', 'error');
      try {
        const { data: prof, error: e1 } = await sb.from('profiles').select('id,username,badges').eq('username', username).maybeSingle();
        if (e1) throw e1;
        if (!prof) return toast('Usuario no encontrado', 'error');
        const cur = Array.isArray(prof.badges) ? prof.badges.slice() : [];
        if (!cur.includes(kind)) cur.push(kind);
        const { error } = await sb.from('profiles').update({ badges: cur }).eq('id', prof.id);
        if (error) throw error;
        toast('Badge ' + kind + ' otorgado a @' + username);
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
  }
})();

const _boot=document.readyState;
if(_boot==='loading')document.addEventListener('DOMContentLoaded',initUiV2);else initUiV2();

})();
