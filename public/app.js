(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={route:'home',searchType:'all',history:[],historyIndex:-1,controller:null,user:null,profile:null,guest:false,conversations:[]};
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
function setRoute(route,push=true){state.route=route; $$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${route}`)); $$('.nav-btn,[data-route]').forEach(b=>{if(b.classList.contains('nav-btn'))b.classList.toggle('active',b.dataset.route===route)});$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.route===route));document.body.classList.toggle('route-search',route==='search');document.body.classList.toggle('route-messages',route==='messages');if(route!=='search')document.body.classList.remove('search-browsing');if(push)history.replaceState(null,'',`#${route}`);}
$$('[data-route]').forEach(b=>b.addEventListener('click',()=>setRoute(b.dataset.route)));
$('#profileHome2')?.addEventListener('click',()=>state.user?openSocial():openOnboarding('landing'));
$('#homeLibrary')?.addEventListener('click',()=>{if(typeof openSocial==='function'){openSocial();setTimeout(()=>renderSocial&&renderSocial('library'),50)}else toast('Abre tu perfil para ver la biblioteca')});
$$('.discover-card[data-route]').forEach(c=>c.addEventListener('click',()=>setRoute(c.dataset.route)));
$('#topAccount').addEventListener('click',()=>state.user?openProfile():openOnboarding('landing'));
$('#profileHome').addEventListener('click',()=>state.user?openProfile():openOnboarding('landing'));
$('#modalClose').addEventListener('click',()=>$('#modal').hidden=true);['onboarding','modal'].forEach(id=>$('#'+id).addEventListener('click',e=>{if(e.target.id===id)e.currentTarget.hidden=true}));
function openOnboarding(step='landing'){const o=$('#onboarding');o.hidden=false;renderOnboarding(step)}
function renderOnboarding(step){
 const c=$('#onboardContent');
 const o=$('#onboarding');
 const order=['intro1','intro2','intro3','landing','choose','login','signup','profile','welcome'];
 const stepIdx=Math.max(0, order.indexOf(step));
 const dots=$$('.progress-dot');
 // 3 progress dots map to intro / auth / profile
 const phase= step.startsWith('intro')||step==='landing' ? 0 : (step==='profile'||step==='welcome' ? 2 : 1);
 dots.forEach((d,i)=>d.classList.toggle('active', i<=phase));

 if(step==='intro1')c.innerHTML=`
  <div class="ob-slide">
   <div class="ob-visual ob-visual-search">⌕</div>
   <span class="eyebrow">PASO 1 · EXPLORAR</span>
   <h1>Busca lo que amas.</h1>
   <p>Anime, manga, personajes y la web. Escribe un nombre corto como <b>tate</b> y Chromi entiende el resto.</p>
   <button class="primary wide" data-onboard="intro2">Siguiente</button>
   <button class="text-link" data-onboard="landing">Saltar intro</button>
  </div>`;
 else if(step==='intro2')c.innerHTML=`
  <div class="ob-slide">
   <div class="ob-visual ob-visual-social">◉</div>
   <span class="eyebrow">PASO 2 · CONECTAR</span>
   <h1>Tu Sekai, tus gente.</h1>
   <p>Publica artes y videos, habla con Chromi y con tus amigos. Un feed social hecho para fans.</p>
   <div class="ob-nav-row">
    <button class="secondary" data-onboard="intro1">Atrás</button>
    <button class="primary" data-onboard="intro3">Siguiente</button>
   </div>
   <button class="text-link" data-onboard="landing">Saltar intro</button>
  </div>`;
 else if(step==='intro3')c.innerHTML=`
  <div class="ob-slide">
   <div class="ob-visual ob-visual-id">C</div>
   <span class="eyebrow">PASO 3 · IDENTIDAD</span>
   <h1>Un perfil a tu medida.</h1>
   <p>Banner, colores, estado, enlaces y un ID único. Tu rincón en el Sekai, como tú quieras.</p>
   <div class="ob-nav-row">
    <button class="secondary" data-onboard="intro2">Atrás</button>
    <button class="primary" data-onboard="landing">Empezar</button>
   </div>
  </div>`;
 else if(step==='landing')c.innerHTML=`
  <div class="onboard-hero">
   <span class="onboard-mark">C</span>
   <span class="eyebrow">NAKAMA SEKAI</span>
   <h1>Tu Sekai empieza aquí.</h1>
   <p>Chromi reúne búsqueda, feed social, chat con IA y un perfil 100% personalizable.</p>
  </div>
  <div class="feature-list compact">
   <div><span class="feature-icon">⌕</span><b>Explora</b><small>Anime, manga, personajes y web.</small></div>
   <div><span class="feature-icon">◉</span><b>Publica</b><small>Arts, videos y posts en el feed.</small></div>
   <div><span class="feature-icon">C</span><b>Tu perfil</b><small>Banner, colores, links e ID único.</small></div>
  </div>
  <button class="primary wide" data-onboard="choose">Crear mi cuenta</button>
  <button class="oauth" id="googleLanding"><span>G</span> Continuar con Google</button>
  <button class="text-link" data-onboard="login">Ya tengo una cuenta · Iniciar sesión</button>
  <button class="guest-link" data-onboard="guest">Continuar como Guest</button>`;
 else if(step==='choose')c.innerHTML=`
  <button class="back-onboard" data-onboard="landing">‹</button>
  <span class="eyebrow">ENTRAR AL SEKAI</span>
  <h2>Elige cómo quieres entrar.</h2>
  <p class="muted">Google es lo más rápido. También puedes usar correo y contraseña.</p>
  <button class="oauth" id="googleBtn"><span>G</span> Continuar con Google</button>
  <button class="primary wide" data-onboard="signup">Continuar con correo</button>
  <button class="guest-link" data-onboard="guest">Continuar como Guest</button>
  <button class="text-link" data-onboard="login">Ya tengo una cuenta</button>`;
 else if(step==='login')c.innerHTML=`
  <button class="back-onboard" data-onboard="choose">‹</button>
  <span class="eyebrow">INICIAR SESIÓN</span>
  <h2>Vuelve a tu Sekai.</h2>
  <p class="muted">Recupera tu perfil, amigos y conversaciones.</p>
  <form id="loginForm" class="form">
   <label>Correo<input id="loginEmail" type="email" required autocomplete="email" placeholder="tu@email.com"></label>
   <label>Contraseña<input id="loginPassword" type="password" required autocomplete="current-password" placeholder="••••••••"></label>
   <button class="primary wide">Iniciar sesión</button>
  </form>
  <button class="oauth" id="googleLogin"><span>G</span> Continuar con Google</button>
  <button class="text-link" data-onboard="signup">Crear una cuenta</button>`;
 else if(step==='signup')c.innerHTML=`
  <button class="back-onboard" data-onboard="choose">‹</button>
  <span class="eyebrow">CREAR CUENTA</span>
  <h2>Tu acceso al Sekai.</h2>
  <p class="muted">Correo y contraseña. Luego personalizamos tu perfil.</p>
  <form id="signupForm" class="form">
   <label>Correo electrónico<input id="signupEmail" type="email" required autocomplete="email" placeholder="tu@email.com"></label>
   <label>Contraseña<input id="signupPassword" type="password" minlength="8" required autocomplete="new-password" placeholder="Mínimo 8 caracteres"><small>Mínimo 8 caracteres.</small></label>
   <button class="primary wide">Crear cuenta</button>
  </form>
  <button class="text-link" data-onboard="choose">Volver</button>`;
 else if(step==='profile')c.innerHTML=`
  <span class="eyebrow">PASO FINAL</span>
  <h2>Haz que tu perfil sea tuyo.</h2>
  <p class="muted">Podrás cambiar banner, colores y enlaces después.</p>
  <form id="profileForm" class="form">
   <label>Apodo<input id="profileNick" maxlength="32" required placeholder="Ej. Alex"></label>
   <label>Nombre de usuario<input id="profileUsername" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required placeholder="alex_2003"><small>3–24 caracteres: letras, números y _.</small></label>
   <div class="visibility"><span>Visibilidad del perfil</span>
    <label><input type="radio" name="visibility" value="public" checked> Público</label>
    <label><input type="radio" name="visibility" value="private"> Privado</label>
   </div>
   <label>Estado / tagline<input id="profileStatus" maxlength="48" placeholder="ej. Best dad joke?"></label>
   <label>Foto de perfil<input id="profileAvatar" type="file" accept="image/*"></label>
   <label>Bio<textarea id="profileBio" maxlength="160" placeholder="Cuéntale algo al Sekai sobre ti..."></textarea></label>
   <button class="primary wide">Crear mi perfil</button>
  </form>`;
 else if(step==='welcome')c.innerHTML=`
  <div class="welcome-final">
   <div class="welcome-orb">C</div>
   <span class="eyebrow">NAKAMA SEKAI</span>
   <h1>Bienvenido, ${esc(state.profile?.display_name||'amigo')}.</h1>
   <p>Tu identidad está lista. ID único: <strong>${esc(state.profile?.chromi_id||'')}</strong></p>
   <div class="welcome-checks">
    <span>✓ Perfil creado</span>
    <span>✓ Identidad lista</span>
    <span>✓ Sekai preparado</span>
   </div>
   <button class="primary wide" id="enterSekai">Entrar al Sekai</button>
  </div>`;

 $$('[data-onboard]').forEach(b=>b.addEventListener('click',()=>{
   const s=b.dataset.onboard;
   if(s==='guest') return guestSignIn();
   renderOnboarding(s);
 }));
 $('#googleBtn')?.addEventListener('click',googleSignIn);
 $('#googleLanding')?.addEventListener('click',googleSignIn);
 $('#googleLogin')?.addEventListener('click',googleSignIn);
 $('#loginForm')?.addEventListener('submit',login);
 $('#signupForm')?.addEventListener('submit',signup);
 $('#profileForm')?.addEventListener('submit',finishProfile);
 $('#enterSekai')?.addEventListener('click',()=>{
   $('#onboarding').hidden=true;
   localStorage.setItem('chromi_onboarding_seen','1');
   setRoute('home');
 });
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
async function openProfile(){const p=state.profile||{};const theme=p.theme_color||'#7068e8';const accent=p.accent_color||'#a29cf5';const banner=p.banner_url||'';const status=p.status_text||'';const links=Array.isArray(p.links)?p.links:(typeof p.links==='string'?(()=>{try{return JSON.parse(p.links)}catch{return[]}})():[]);
showModal(`<div class="profile-sheet">
 <div class="profile-banner" style="background:${banner?`center/cover url('${esc(banner)}')`: `linear-gradient(135deg,${esc(theme)},${esc(accent)})`}"></div>
 <div class="profile-sheet-body">
  <div class="profile-avatar-xl" style="border-color:${esc(accent)}">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:esc((p.display_name||'U')[0])}</div>
  <div class="profile-head">
   <h2>${esc(p.display_name||'Usuario')}</h2>
   <p class="profile-handle">@${esc(p.username||'guest')}</p>
   ${status?`<span class="profile-status-pill">${esc(status)}</span>`:''}
  </div>
  <p class="profile-bio">${esc(p.bio||'Sin bio todavía. Edita tu perfil para personalizarlo.')}</p>
  <div class="id-box"><small>ID ÚNICO</small><b>${esc(p.chromi_id||state.user?.id||'')}</b></div>
  ${links.length?`<div class="profile-links">${links.map(l=>`<a class="profile-link-chip" href="${esc(l.url||'#')}" target="_blank" rel="noopener">${esc(l.label||l.url||'Link')}</a>`).join('')}</div>`:''}
  <div class="profile-actions">
   <button id="editProfile" class="primary wide">Personalizar perfil</button>
   <button id="social" class="secondary wide">Amigos · Biblioteca · Ajustes</button>
   <button id="logout" class="text-link wide">Cerrar sesión</button>
  </div>
  <span class="privacy">Perfil ${p.visibility==='private'?'privado':'público'}</span>
 </div>
</div>`);
$('#social').onclick=()=>openSocial();
$('#editProfile').onclick=()=>openEditProfile();
$('#logout').onclick=async()=>{await supabase.auth.signOut();$('#modal').hidden=true;toast('Sesión cerrada.')}}
async function openEditProfile(){
 const p=state.profile||{};
 const links=Array.isArray(p.links)?p.links:(typeof p.links==='string'?(()=>{try{return JSON.parse(p.links)}catch{return[]}})():[]);
 const linkRows=(links.length?links:[{label:'',url:''}]).map((l,i)=>`<div class="link-row"><input data-i="${i}" data-k="label" placeholder="Etiqueta (Discord, Carrd…)" value="${esc(l.label||'')}"><input data-i="${i}" data-k="url" placeholder="https://..." value="${esc(l.url||'')}"></div>`).join('');
 showModal(`<span class="eyebrow">PERSONALIZAR</span><h2>Tu perfil, a tu manera</h2>
 <p class="muted">Banner, colores, estado y enlaces. Todo se guarda en tu cuenta.</p>
 <form id="editProfileForm" class="form profile-edit-form">
  <label>Apodo<input id="epNick" maxlength="32" value="${esc(p.display_name||'')}" required></label>
  <label>Usuario<input id="epUser" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" value="${esc(p.username||'')}" required></label>
  <label>Bio<textarea id="epBio" maxlength="160">${esc(p.bio||'')}</textarea></label>
  <label>Estado / tagline<input id="epStatus" maxlength="48" placeholder="ej. Best dad joke?" value="${esc(p.status_text||'')}"></label>
  <div class="color-row">
   <label>Color tema<input id="epTheme" type="color" value="${esc(p.theme_color||'#7068e8')}"></label>
   <label>Acento<input id="epAccent" type="color" value="${esc(p.accent_color||'#a29cf5')}"></label>
  </div>
  <label>URL del banner<input id="epBanner" type="url" placeholder="https://...imagen.jpg" value="${esc(p.banner_url||'')}"></label>
  <label>URL del avatar<input id="epAvatar" type="url" placeholder="https://...avatar.png" value="${esc(p.avatar_url||'')}"></label>
  <div class="visibility"><span>Visibilidad</span>
   <label><input type="radio" name="epVis" value="public" ${p.visibility!=='private'?'checked':''}> Público</label>
   <label><input type="radio" name="epVis" value="private" ${p.visibility==='private'?'checked':''}> Privado</label>
  </div>
  <div class="links-edit"><span class="eyebrow">ENLACES</span>${linkRows}<button type="button" id="addLink" class="text-link">＋ Añadir enlace</button></div>
  <button class="primary wide">Guardar perfil</button>
 </form>`);
 let linkCount=Math.max(links.length,1);
 $('#addLink').onclick=()=>{
  const box=$('.links-edit');
  const row=document.createElement('div');row.className='link-row';
  row.innerHTML=`<input data-i="${linkCount}" data-k="label" placeholder="Etiqueta"><input data-i="${linkCount}" data-k="url" placeholder="https://...">`;
  box.insertBefore(row,$('#addLink'));linkCount++;
 };
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
   banner_url:$('#epBanner').value.trim()||null,
   avatar_url:$('#epAvatar').value.trim()||null,
   visibility:document.querySelector('input[name=epVis]:checked')?.value||'public',
   links:newLinks
  };
  const {data,error}=await sb.from('profiles').update(payload).eq('id',state.user.id).select().single();
  if(error){toast(error.message,'error');return}
  state.profile=data;toast('Perfil actualizado ✨');openProfile();
 }
}
function showModal(html){$('#modalContent').innerHTML=html;$('#modal').hidden=false}
async function initAuth(){const sb=requireSupabase();if(!sb)return;const {data}=await sb.auth.getSession();await applySession(data.session);if(state.user)loadConversations();sb.auth.onAuthStateChange(async(_event,session)=>{setTimeout(()=>{applySession(session);if(session)loadConversations();},0)});}
async function applySession(session){state.user=session?.user||null;if(!state.user){state.profile=null;$('#topName').textContent='Guest';if(!localStorage.getItem('chromi_onboarding_seen'))openOnboarding('landing');return}state.guest=!!state.user.is_anonymous;const {data:profile}=await supabase.from('profiles').select('*').eq('id',state.user.id).maybeSingle();state.profile=profile;if(!state.guest && !profile){setTimeout(()=>openOnboarding('profile'),150)}else if(!state.guest && profile && String(profile.username||'').startsWith('guest_')){setTimeout(()=>openOnboarding('profile'),150)}else if(state.guest&&!profile){const {data:p}=await supabase.from('profiles').insert({id:state.user.id,display_name:'Guest',username:'guest_'+state.user.id.slice(0,8)}).select().single();state.profile=p;setTimeout(()=>renderOnboarding('welcome'),100)}if(state.profile){$('#topName').textContent=state.profile.display_name||state.profile.username||'Guest';
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
function showSearchWelcome(){document.body.classList.remove('search-browsing');$('#searchView').innerHTML='<span class="big-mark">C</span><h1>Search</h1><p>Escribe lo que buscas. Web, anime, manga y usuarios en una sola lista.</p>';$('#searchView').hidden=false;$('#searchResults').innerHTML='';const wf=$('#webBrowserFrame');if(wf)wf.hidden=true}
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
function hoshiEmbedUrl(target){return HOSHI_URL+'/?go='+encodeURIComponent(target)+'&embed=1';}async function api(type,q){const endpoint=type==='manga'?'/api/search/manga':type==='anime'?'/api/search/anime':'/api/search/characters';const r=await fetch(`${apiUrl(endpoint)}?q=${encodeURIComponent(q)}&limit=12`);const d=await r.json();if(!r.ok)throw Error(d.error||'Fuente no disponible');return d.data||[]}
function resultCard(x){const meta=[x.year,x.score?'★ '+x.score:'',x.episodes?x.episodes+' eps':'',x.status,x.language,x.stars!=null?'★ '+x.stars:'',x.source].filter(Boolean).join(' · ');const badge=x.badge||x.type||'';const host=(()=>{try{return x.url?new URL(x.url).hostname.replace(/^www\./,''):''}catch{return ''}})();const alt=[x.titleEnglish,x.titleJapanese].filter(t=>t&&t!==x.title).slice(0,2).join(' · ');return `<button class="result-card ${x.type==='web'||x.type==='github'?'result-web':''}" data-json='${esc(JSON.stringify(x))}'><div class="cover">${x.cover?`<img src="${esc(x.cover)}" alt="" loading="lazy">`:esc((badge||'C')[0].toUpperCase())}</div><div class="result-body"><span class="result-type">${esc(badge)}</span>${host?`<span class="result-host">${esc(host)}</span>`:''}<strong>${esc(x.title)}</strong>${alt?`<small class="result-alt">${esc(alt)}</small>`:''}<small>${esc(meta)}</small><p>${esc((x.description||x.synopsis||x.extract||'').slice(0,180))}</p></div></button>`}
async function runSearch(q,add=true){
 q=q.trim();if(!q)return;
 document.body.classList.remove('search-browsing');
 const wf=$('#webBrowserFrame');if(wf)wf.hidden=true;
 if(add){state.history=state.history.slice(0,state.historyIndex+1);state.history.push(q);state.historyIndex=state.history.length-1}
 if(state.controller)state.controller.abort();state.controller=new AbortController();const signal=state.controller.signal;
 state.searchType='all';
 const type='all';
 if(apiBaseMissing()){
  $('#searchView').hidden=true;
  $('#searchResults').innerHTML=`<div class="empty-state search-error"><h2>Backend no configurado</h2><p>La app no tiene <code>CHROMI_API_BASE</code>. Sin la URL pública del servidor, la búsqueda de anime/manga/web no puede funcionar.</p><p class="muted">Configura la variable de entorno o <code>runtime-config.js</code> con la URL HTTPS de tu backend (ej. https://tu-app.onrender.com).</p></div>`;
  return;
 }
 $('#searchView').innerHTML='<span class="big-mark pulse">C</span><h1>Buscando…</h1>';$('#searchView').hidden=false;$('#searchResults').innerHTML='';

 const wantWeb=type==='all'||type==='web';
 const wantAnime=type==='all'||['anime','manga','character'].includes(type);
 const wantUsers=type==='all'||type==='users';
 const jobs=[];

 if(wantWeb){
  jobs.push(fetch(`${apiUrl('/api/search/web')}?q=${encodeURIComponent(q)}`,{signal})
   .then(async r=>{if(!r.ok)throw new Error('web');return {web:await r.json()}})
   .catch(()=>({web:{data:[],knowledge:null,questions:[]}})));
 }
 if(wantAnime){
  const types=type==='all'?['anime','manga','character']:[type];
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
  html+=`<div class="serp-group-label">Web · DuckDuckGo</div>`;
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
 const hasAny=(web.data&&web.data.length)||media.length||users.length||web.knowledge;
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
 $$('.related-q').forEach(b=>b.onclick=()=>{$('#searchInput').value=b.dataset.q;runSearch(b.dataset.q,true)});
}


async function openMangaReader(manga){
 showModal(`<span class="eyebrow">MANGA</span><h2>${esc(manga.title)}</h2>
  ${manga.cover?`<img class="modal-cover" src="${esc(manga.cover)}" alt="">`:''}
  <p class="muted">${esc((manga.description||'').slice(0,220))}</p>
  <div id="chapterList" class="chapter-list"><div class="muted">Cargando capítulos…</div></div>
  <div id="readerBox" class="reader-box" hidden>
   <div class="reader-bar">
    <button type="button" id="readerPrev" class="secondary">‹ Cap</button>
    <span id="readerLabel">Capítulo</span>
    <button type="button" id="readerNext" class="secondary">Cap ›</button>
   </div>
   <div id="readerPages" class="reader-pages"></div>
  </div>`);

 let chapters=[];
 let currentIdx=-1;
 try{
  const r=await fetch(`${apiUrl('/api/manga/'+manga.id+'/chapters')}?limit=80&lang=es,en`);
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||'Error');
  chapters=d.data||[];
 }catch(e){
  $('#chapterList').innerHTML=`<p class="muted">No se pudieron cargar capítulos. ${esc(e.message||'')}</p>`;
  return;
 }
 if(!chapters.length){
  $('#chapterList').innerHTML='<p class="muted">No hay capítulos en español/inglés por ahora.</p>';
  return;
 }
 $('#chapterList').innerHTML=chapters.map((ch,i)=>{
  const label=[ch.chapter?`Cap. ${ch.chapter}`:'Capítulo', ch.title, ch.lang?`(${ch.lang})`:''].filter(Boolean).join(' · ');
  return `<button type="button" class="chapter-item" data-i="${i}">${esc(label)}<small>${esc(ch.group||'')}</small></button>`;
 }).join('');

 async function loadChapter(i){
  if(i<0||i>=chapters.length)return;
  currentIdx=i;
  const ch=chapters[i];
  const label=[ch.chapter?`Cap. ${ch.chapter}`:'Capítulo', ch.title].filter(Boolean).join(' · ');
  $('#readerLabel').textContent=label;
  $('#readerBox').hidden=false;
  $('#readerPages').innerHTML='<div class="muted" style="padding:20px;text-align:center">Cargando páginas…</div>';
  $('#chapterList').querySelectorAll('.chapter-item').forEach((b,j)=>b.classList.toggle('active',j===i));
  try{
   const r=await fetch(apiUrl('/api/manga/chapter/'+ch.id+'/pages'));
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Error');
   const pages=d.pages||[];
   if(!pages.length){$('#readerPages').innerHTML='<div class="muted">Sin páginas.</div>';return}
   $('#readerPages').innerHTML=pages.map(p=>`<img src="${esc(p.url)}" alt="Página ${p.index}" loading="lazy" referrerpolicy="no-referrer">`).join('');
   $('#readerPages').scrollTop=0;
  }catch(e){
   $('#readerPages').innerHTML=`<div class="muted">No se pudo abrir este capítulo. ${esc(e.message||'')}</div>`;
  }
 }
 $$('.chapter-item').forEach(b=>b.onclick=()=>loadChapter(+b.dataset.i));
 $('#readerPrev').onclick=()=>loadChapter(currentIdx-1);
 $('#readerNext').onclick=()=>loadChapter(currentIdx+1);
}


// SEKAI: social publishing feed
let activeFeed='all';
const MEDIA_BUCKET='sekai-media';
function postTypeLabel(t){return ({image:'Post',art:'Art',short:'Short',video:'Video'})[t]||'Post'}
function mediaAccept(t){return t==='image'||t==='art'?'image/*':'video/*'}
function showCreatePost(){
 if(!state.user){openOnboarding('landing');return}
 showModal(`<span class="eyebrow">SEKAI STUDIO</span><h2>Crear publicación</h2><p class="muted">Comparte una imagen, un art, un Short vertical o un video largo.</p>
 <div class="post-type-grid"><button class="post-type active" data-ptype="image"><b>▧</b><span>Post</span><small>Imagen</small></button><button class="post-type" data-ptype="art"><b>✦</b><span>Art</span><small>Ilustración</small></button><button class="post-type" data-ptype="short"><b>▶</b><span>Short</span><small>Vertical · hasta 3 min</small></button><button class="post-type" data-ptype="video"><b>▣</b><span>Video</span><small>Formato largo</small></button></div>
 <form id="postForm" class="form"><input type="hidden" id="postType" value="image"><label>Archivo<input id="postFile" type="file" accept="image/*" required></label><label>Título<input id="postTitle" maxlength="120" placeholder="Dale un título a tu publicación"></label><label>Descripción<textarea id="postCaption" maxlength="2000" placeholder="¿Qué quieres compartir?"></textarea></label><div class="post-options"><label>Visibilidad<select id="postVisibility"><option value="public">Público</option><option value="friends">Amigos</option></select></label></div><button class="primary wide" id="publishBtn">Publicar en Sekai</button></form>`);
 $$('[data-ptype]').forEach(b=>b.onclick=()=>{ $$('[data-ptype]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=b.dataset.ptype;$('#postType').value=t;$('#postFile').accept=mediaAccept(t);$('#postFile').value='';$('#postFile').onchange=validatePostFile; });
 $('#postFile').onchange=validatePostFile;
 $('#postForm').onsubmit=publishPost;
}
function validatePostFile(){const f=$('#postFile')?.files?.[0],t=$('#postType')?.value;if(!f)return;const max=t==='short'?250*1024*1024:t==='video'?1024*1024*1024:30*1024*1024;if(f.size>max){toast(`Ese archivo supera el límite de ${t==='video'?'1 GB':t==='short'?'250 MB':'30 MB'}.`,'error');$('#postFile').value='';return}if((t==='short'||t==='video')&&!f.type.startsWith('video/')){toast('Selecciona un archivo de video.','error');$('#postFile').value='';return}if((t==='image'||t==='art')&&!f.type.startsWith('image/')){toast('Selecciona una imagen.','error');$('#postFile').value='';}}
async function publishPost(e){
 e.preventDefault();const sb=requireSupabase();if(!sb||!state.user)return;const btn=$('#publishBtn'),file=$('#postFile')?.files?.[0],type=$('#postType').value;if(!file)return toast('Selecciona un archivo.','error');
 if(type==='short'&&file.type.startsWith('video/')){const probe=document.createElement('video');probe.preload='metadata';probe.onloadedmetadata=()=>{URL.revokeObjectURL(probe.src);if(probe.duration>180){toast('Un Short puede durar hasta 3 minutos.','error');$('#postFile').value='';}};probe.src=URL.createObjectURL(file);}
 btn.disabled=true;btn.textContent='Subiendo…';
 try{const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${state.user.id}/${crypto.randomUUID()}.${ext}`;const up=await sb.storage.from(MEDIA_BUCKET).upload(path,file,{upsert:false,contentType:file.type,cacheControl:'31536000'});if(up.error)throw up.error;const url=sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  let thumb=null,duration=null;if(type==='short'||type==='video'){const v=document.createElement('video');v.preload='metadata';v.src=URL.createObjectURL(file);await new Promise(r=>{v.onloadedmetadata=()=>{duration=Number.isFinite(v.duration)?Math.round(v.duration):null;r()};v.onerror=()=>r()});URL.revokeObjectURL(v.src)}
  const {error}=await sb.from('posts').insert({user_id:state.user.id,type,media_url:url,title:$('#postTitle').value.trim(),caption:$('#postCaption').value.trim(),visibility:$('#postVisibility').value,duration_seconds:duration});if(error){await sb.storage.from(MEDIA_BUCKET).remove([path]);throw error}
  $('#modal').hidden=true;toast('Publicado en Sekai. ✨');await loadSekaiFeed(activeFeed);
 }catch(err){toast('No pude publicar: '+(err.message||'Error desconocido'),'error')}finally{btn.disabled=false;btn.textContent='Publicar en Sekai'}
}
async function loadSekaiFeed(filter='all'){
 const box=$('#sekaiFeed');if(!box)return;box.innerHTML='<div class="empty-state">Cargando publicaciones…</div>';const sb=requireSupabase();if(!sb){box.innerHTML='<div class="empty-state">Inicia sesión para explorar Sekai.</div>';return}
 let q=sb.from('posts').select('id,user_id,type,media_url,thumbnail_url,title,caption,visibility,duration_seconds,created_at,profiles(username,display_name,avatar_url)').order('created_at',{ascending:false}).limit(40);if(filter!=='all')q=q.eq('type',filter);const {data,error}=await q;if(error){box.innerHTML=`<div class="empty-state">No se pudo cargar Sekai.<br><small>${esc(error.message)}</small></div>`;return}box.innerHTML=(data||[]).map(renderPost).join('')||'<div class="empty-state">Todavía no hay publicaciones aquí. Sé la primera persona en compartir algo. ✨</div>';
}
function renderPost(p){
 const name=p.profiles?.display_name||p.profiles?.username||'Usuario';
 const uname=p.profiles?.username||'usuario';
 const avatar=p.profiles?.avatar_url?`<img src="${esc(p.profiles.avatar_url)}" alt="">`:esc(name[0]||'U');
 const isVid=p.type==='video'||p.type==='short';
 const media=isVid
  ?`<div class="post-media-wrap video"><video class="post-media" src="${esc(p.media_url)}" controls playsinline preload="metadata" ${p.thumbnail_url?`poster="${esc(p.thumbnail_url)}"`:''}></video><span class="post-type-badge">${esc(postTypeLabel(p.type))}</span></div>`
  :`<div class="post-media-wrap"><img class="post-media image" src="${esc(p.media_url)}" alt="${esc(p.title||'Arte')}" loading="lazy"><span class="post-type-badge">${esc(postTypeLabel(p.type))}</span></div>`;
 const when=p.created_at?new Date(p.created_at).toLocaleDateString('es',{day:'numeric',month:'short'}):'';
 return `<article class="sekai-post">
  <header class="post-author">
   <span class="mini-avatar">${avatar}</span>
   <div class="post-author-meta"><b>${esc(name)}</b><small>@${esc(uname)}${when?' · '+when:''}</small></div>
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
   ${p.caption?`<p class="post-caption">${esc(p.caption)}</p>`:''}
  </div>
 </article>`
}
$$('[data-feed]').forEach(b=>b.onclick=()=>{$$('[data-feed]').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeFeed=b.dataset.feed;loadSekaiFeed(activeFeed)});
$('#createPostBtn')?.addEventListener('click',showCreatePost);

// Messages demo + Chromi
let activeConversation=null;
async function loadFriends(){
 if(!supabase||!state.user)return [];
 const {data,error}=await supabase.from('friendships').select('id,requester_id,addressee_id,status,profiles!friendships_requester_id_fkey(id,username,display_name,avatar_url),addressee:profiles!friendships_addressee_id_fkey(id,username,display_name,avatar_url)').or(`requester_id.eq.${state.user.id},addressee_id.eq.${state.user.id}`).eq('status','accepted');
 if(error)return [];
 return (data||[]).map(x=>x.requester_id===state.user.id?x.addressee:x.profiles).filter(Boolean);
}
async function loadConversations(){
 const friends=await loadFriends(); state.conversations=[{id:'chromi',name:'Chromi',status:'Asistente · En línea',userId:null},...friends.map(f=>({id:f.id,name:f.display_name||f.username,status:'Amigo · En línea',userId:f.id,avatar:f.avatar_url}))];renderConversations();}
function renderConversations(){const q=($('#messageFilter')?.value||'').toLowerCase();$('#conversationList').innerHTML=state.conversations.filter(x=>x.name.toLowerCase().includes(q)).map(x=>`<button class="conversation" data-id="${esc(x.id)}"><span class="mini-avatar">${x.avatar?`<img src="${esc(x.avatar)}">`:esc(x.name[0]||'C')}</span><span><b>${esc(x.name)}</b><small>${esc(x.status)}</small></span></button>`).join('')||'<div class="empty-state">No hay conversaciones todavía.</div>';$$('.conversation').forEach(b=>b.onclick=()=>openConversation(b.dataset.id));}
async function openConversation(id){const c=state.conversations.find(x=>x.id===id);if(!c)return;activeConversation=c;$('.messages-wrap').classList.add('chat-open');$('#chatTitle').textContent=c.name;$('#chatStatus').textContent=c.status;$$('.conversation').forEach(b=>b.classList.toggle('active',b.dataset.id===id));$('#chatBody').innerHTML='';if(c.userId){const {data}=await supabase.from('messages').select('*').or(`and(sender_id.eq.${state.user.id},recipient_id.eq.${c.userId}),and(sender_id.eq.${c.userId},recipient_id.eq.${state.user.id})`).order('created_at');(data||[]).forEach(renderMessage);}else $('#chatBody').innerHTML='<div class="welcome-chat"><span class="big-mark">C</span><h2>Habla con Chromi</h2><p>Tu asistente dentro del Sekai.</p></div>';}
function renderMessage(m){const row=document.createElement('div');row.className='bubble '+(m.sender_id===state.user?.id?'user':'bot');row.textContent=m.body;$('#chatBody').appendChild(row);$('#chatBody').scrollTop=$('#chatBody').scrollHeight;}
async function sendSocialMessage(text){if(!activeConversation?.userId)return false;const {data,error}=await supabase.from('messages').insert({sender_id:state.user.id,recipient_id:activeConversation.userId,body:text}).select().single();if(error){toast(error.message,'error');return true;}renderMessage(data);return true;}
async function openSocial(){showModal(`<span class="eyebrow">SEKAI SOCIAL</span><h2>Conecta con personas</h2><div class="social-tabs"><button data-social="friends">Amigos</button><button data-social="requests">Solicitudes</button><button data-social="search">Buscar</button><button data-social="library">Biblioteca</button><button data-social="settings">Ajustes</button></div><div id="socialContent"></div>`);$$('[data-social]').forEach(b=>b.onclick=()=>renderSocial(b.dataset.social));renderSocial('friends');}
async function renderSocial(tab){const c=$('#socialContent');if(!c)return;if(tab==='friends'){const friends=await loadFriends();c.innerHTML=`<div class="social-search"><input id="friendSearch" placeholder="Buscar usuario..."><button id="doFriendSearch" class="primary">Buscar</button></div><div id="friendResults"></div><h3>Mis amigos</h3>${friends.map(f=>`<div class="friend-row"><span class="mini-avatar">${f.avatar_url?`<img src="${esc(f.avatar_url)}">`:esc((f.display_name||'U')[0])}</span><div><b>${esc(f.display_name||f.username)}</b><small>@${esc(f.username)}</small></div><button class="secondary" data-chat="${f.id}">Mensaje</button></div>`).join('')||'<p class="muted">Todavía no tienes amigos.</p>'}`;$('#doFriendSearch').onclick=async()=>{const q=$('#friendSearch').value.trim();if(!q)return;const {data}=await supabase.from('profiles').select('id,username,display_name,avatar_url,visibility').ilike('username',`%${q}%`).neq('id',state.user.id).limit(10);$('#friendResults').innerHTML=(data||[]).map(f=>`<div class="friend-row"><span class="mini-avatar">${f.avatar_url?`<img src="${esc(f.avatar_url)}">`:esc((f.display_name||'U')[0])}</span><div><b>${esc(f.display_name||f.username)}</b><small>@${esc(f.username)}</small></div><button class="primary" data-add="${f.id}">Agregar</button></div>`).join('')||'<p class="muted">No encontramos usuarios.</p>';$$('[data-add]').forEach(b=>b.onclick=()=>sendFriendRequest(b.dataset.add));};$$('[data-chat]').forEach(b=>{b.onclick=async()=>{$('#modal').hidden=true;setRoute('messages');await loadConversations();openConversation(b.dataset.chat)}})}
if(tab==='requests'){const {data}=await supabase.from('friendships').select('id,requester_id,profiles!friendships_requester_id_fkey(username,display_name)').eq('addressee_id',state.user.id).eq('status','pending');c.innerHTML=(data||[]).map(r=>`<div class="friend-row"><div><b>${esc(r.profiles?.display_name||r.profiles?.username)}</b><small>@${esc(r.profiles?.username||'')}</small></div><button class="primary" data-accept="${r.id}">Aceptar</button></div>`).join('')||'<p class="muted">No tienes solicitudes pendientes.</p>';$$('[data-accept]').forEach(b=>b.onclick=async()=>{await supabase.from('friendships').update({status:'accepted'}).eq('id',b.dataset.accept);toast('Solicitud aceptada.');renderSocial('requests');loadConversations();});}
if(tab==='library'){const items=JSON.parse(localStorage.getItem('chromi_library')||'[]');c.innerHTML=`<h3>Mi biblioteca</h3><p class="muted">Guarda resultados desde Search para tenerlos aquí.</p>${items.map((x,i)=>`<div class="library-row"><img src="${esc(x.image||'')}"><div><b>${esc(x.title)}</b><small>${esc(x.type||'Contenido')}</small></div><button class="secondary" data-del-lib="${i}">×</button></div>`).join('')||'<p class="muted">Tu biblioteca está vacía.</p>'}`;$$('[data-del-lib]').forEach(b=>b.onclick=()=>{items.splice(+b.dataset.delLib,1);localStorage.setItem('chromi_library',JSON.stringify(items));renderSocial('library')});}
if(tab==='settings'){c.innerHTML=`<h3>Personalización</h3><div class="settings-row"><span>Tema oscuro</span><input id="darkToggle" type="checkbox" ${document.documentElement.classList.contains('dark')?'checked':''}></div><div class="settings-row"><span>Notificaciones del navegador</span><button id="notifyBtn" class="secondary">Activar</button></div><h3>Seguridad</h3><button id="resetSession" class="secondary wide">Cerrar sesión en este dispositivo</button><button id="deleteAccount" class="danger wide">Eliminar cuenta</button>`;$('#darkToggle').onchange=e=>{document.documentElement.classList.toggle('dark',e.target.checked);localStorage.setItem('chromi_theme',e.target.checked?'dark':'light')};$('#notifyBtn').onclick=async()=>{if('Notification' in window){const p=await Notification.requestPermission();toast(p==='granted'?'Notificaciones activadas.':'Permiso no concedido.','ok')}};$('#resetSession').onclick=async()=>{await supabase.auth.signOut();location.reload()};$('#deleteAccount').onclick=()=>toast('Por seguridad, la eliminación definitiva requiere una función backend protegida.','error');}}
async function sendFriendRequest(id){const {error}=await supabase.from('friendships').insert({requester_id:state.user.id,addressee_id:id,status:'pending'});if(error)return toast(error.code==='23505'?'Ya existe una solicitud o amistad.':error.message,'error');toast('Solicitud enviada.');}
function saveToLibrary(item){const items=JSON.parse(localStorage.getItem('chromi_library')||'[]');if(!items.some(x=>x.id===item.id&&x.type===item.type)){items.unshift(item);localStorage.setItem('chromi_library',JSON.stringify(items));toast('Guardado en tu biblioteca.')}else toast('Ya está en tu biblioteca.');}
renderConversations();$('#messageFilter').oninput=renderConversations;$('#chatBack').onclick=()=>$('.messages-wrap').classList.remove('chat-open');$('#newChat').onclick=()=>state.user?openSocial():openOnboarding('landing');$('#chatInfo').onclick=()=>toast('Chat privado protegido por RLS.');$('#chatForm').onsubmit=async e=>{e.preventDefault();const input=$('#chatInput'),text=input.value.trim();if(!text)return;if(activeConversation?.userId){await sendSocialMessage(text);input.value='';return;}const row=document.createElement('div');row.className='bubble user';row.textContent=text;$('#chatBody').appendChild(row);input.value='';$('#chatBody').scrollTop=$('#chatBody').scrollHeight;try{const r=await fetch(apiUrl('/api/chat'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:text,usuario:state.profile?.display_name||'Usuario'})});const d=await r.json();const bot=document.createElement('div');bot.className='bubble bot';bot.textContent=d.respuesta||'No pude responder ahora.';$('#chatBody').appendChild(bot);$('#chatBody').scrollTop=$('#chatBody').scrollHeight}catch{toast('Chromi no pudo responder desde el backend.','error')} };
window.addEventListener('hashchange',()=>{const r=location.hash.slice(1);if(['home','sekaifeed','search','messages'].includes(r))setRoute(r,false)});
(async()=>{setRoute(location.hash.slice(1)||'home',false);await initSupabase();if(supabaseReady)await initAuth();if(state.user)loadSekaiFeed();if(!localStorage.getItem('chromi_onboarding_seen')&&!state.user)setTimeout(()=>openOnboarding('intro1'),200);})();
})();
