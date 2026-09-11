try {
    require('dotenv').config();
} catch (e) {
    // Permite que el servidor inicie en entornos de CI/CD o producción sin la librería dotenv
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const QRCode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public Supabase configuration. The anon key is intended for browser use; never expose a service-role key.
app.get('/api/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
        // Compatibilidad con builds antiguas. Preferir SUPABASE_PUBLISHABLE_KEY.
        supabaseAnonKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
        hoshiUrl: process.env.HOSHI_URL || 'https://backendv3-188.onrender.com',
        browserEngine: process.env.BROWSER_ENGINE || 'hoshi'
    });
});

let sock;
let currentQR = "";

async function initWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { qr } = update;
        if (qr) {
            currentQR = await QRCode.toDataURL(qr);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}
initWhatsApp();

// Endpoint para solicitar QR
app.get('/api/request-qr', (req, res) => {
    if (!currentQR) return res.status(404).json({ error: "QR no disponible aun, intenta en unos segundos." });
    res.json({ qr: currentQR });
});

// Endpoint para solicitar código de 8 dígitos
app.post('/api/request-code', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: "Número requerido" });

    try {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!sock) return res.status(500).json({ error: "Socket no inicializado" });

        const code = await sock.requestPairingCode(cleanNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
        res.json({ code: formattedCode });
    } catch (e) {
        res.status(500).json({ error: "Error al generar código de vinculación" });
    }
});



// Búsqueda multimedia pública. Chromi usa MangaDex para manga y Jikan/MAL para anime/personajes.
const fetchJson = async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 15000);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'ChromiSearch/1.0 (Sekai; +public read-only)',
                ...(options.headers || {})
            }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const err = new Error(data?.errors?.[0]?.detail || data?.message || `HTTP ${response.status}`);
            err.status = response.status;
            throw err;
        }
        return data;
    } finally {
        clearTimeout(timer);
    }
};

const textFromLocalized = value => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.es || value.en || Object.values(value)[0] || '';
};

app.get('/api/search/manga', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20);
    if (!q) return res.json({ source: 'mangadex', data: [] });

    try {
        const params = new URLSearchParams();
        params.set('title', q);
        params.set('limit', String(limit));
        params.set('offset', String(Math.max(Number(req.query.offset) || 0, 0)));
        params.append('includes[]', 'cover_art');
        params.append('includes[]', 'author');
        params.append('includes[]', 'artist');
        params.append('contentRating[]', 'safe');
        params.append('contentRating[]', 'suggestive');
        params.set('order[relevance]', 'desc');

        const payload = await fetchJson(`https://api.mangadex.org/manga?${params.toString()}`);
        const data = (payload.data || []).map(item => {
            const attrs = item.attributes || {};
            const cover = item.relationships?.find(r => r.type === 'cover_art');
            const author = item.relationships?.find(r => r.type === 'author');
            const artist = item.relationships?.find(r => r.type === 'artist');
            const fileName = cover?.attributes?.fileName;
            return {
                id: item.id,
                type: 'manga',
                source: 'MangaDex',
                title: textFromLocalized(attrs.title),
                altTitles: (attrs.altTitles || []).slice(0, 4).map(textFromLocalized).filter(Boolean),
                description: textFromLocalized(attrs.description),
                status: attrs.status || '',
                year: attrs.year || null,
                contentRating: attrs.contentRating || 'safe',
                author: author?.attributes?.name || '',
                artist: artist?.attributes?.name || '',
                cover: fileName ? `https://uploads.mangadex.org/covers/${item.id}/${encodeURIComponent(fileName)}.512.jpg` : '',
                url: `https://mangadex.org/title/${item.id}`
            };
        });
        res.json({ source: 'mangadex', total: payload.total || data.length, data });
    } catch (error) {
        console.error('MangaDex search:', error.message);
        res.status(error.status === 429 ? 429 : 502).json({ error: 'MangaDex no está disponible en este momento.', source: 'mangadex' });
    }
});

// Capítulos de un manga (MangaDex)
app.get('/api/manga/:id/chapters', async (req, res) => {
    const id = String(req.params.id || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const lang = String(req.query.lang || 'es,en').split(',').map(s => s.trim()).filter(Boolean);
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    try {
        const params = new URLSearchParams();
        params.set('manga', id);
        params.set('limit', String(limit));
        params.set('offset', String(offset));
        params.set('order[chapter]', 'asc');
        params.set('translatedLanguage[]', lang[0] || 'es');
        lang.slice(1).forEach(l => params.append('translatedLanguage[]', l));
        params.append('includes[]', 'scanlation_group');
        params.append('contentRating[]', 'safe');
        params.append('contentRating[]', 'suggestive');
        params.append('contentRating[]', 'erotica');

        const payload = await fetchJson(`https://api.mangadex.org/chapter?${params.toString()}`, { timeout: 15000 });
        const data = (payload.data || []).map(ch => {
            const a = ch.attributes || {};
            const group = (ch.relationships || []).find(r => r.type === 'scanlation_group');
            return {
                id: ch.id,
                chapter: a.chapter || '',
                title: a.title || '',
                pages: a.pages || 0,
                lang: a.translatedLanguage || '',
                publishAt: a.publishAt || a.readableAt || '',
                group: group?.attributes?.name || ''
            };
        });
        res.json({ source: 'mangadex', total: payload.total || data.length, limit, offset, data });
    } catch (error) {
        console.error('MangaDex chapters:', error.message);
        res.status(error.status === 429 ? 429 : 502).json({ error: 'No se pudieron cargar los capítulos.', source: 'mangadex' });
    }
});

// Páginas de un capítulo (at-home)
app.get('/api/manga/chapter/:chapterId/pages', async (req, res) => {
    const chapterId = String(req.params.chapterId || '').trim();
    if (!chapterId) return res.status(400).json({ error: 'Capítulo requerido' });
    try {
        const atHome = await fetchJson(`https://api.mangadex.org/at-home/server/${chapterId}`, { timeout: 15000 });
        const base = atHome.baseUrl;
        const ch = atHome.chapter || {};
        const hash = ch.hash;
        const files = ch.dataSaver || ch.data || [];
        const quality = ch.dataSaver ? 'data-saver' : 'data';
        if (!base || !hash || !files.length) {
            return res.status(502).json({ error: 'Este capítulo no tiene páginas disponibles.' });
        }
        const pages = files.map((file, i) => ({
            index: i + 1,
            url: `${base}/${quality}/${hash}/${file}`
        }));
        res.json({ source: 'mangadex', chapterId, total: pages.length, pages });
    } catch (error) {
        console.error('MangaDex pages:', error.message);
        res.status(error.status === 429 ? 429 : 502).json({ error: 'No se pudieron cargar las páginas del capítulo.', source: 'mangadex' });
    }
});


app.get('/api/search/anime', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20);
    if (!q) return res.json({ source: 'jikan', data: [] });

    try {
        // Consultas cortas (ej. "tate") ordenamos por popularidad para que
        // aparezcan primero los animes conocidos aunque el nombre no sea completo.
        const isShort = q.length <= 5;
        const params = new URLSearchParams({
            q,
            limit: String(Math.min(limit + 8, 25)),
            page: '1',
            sfw: 'true'
        });
        if (isShort) {
            params.set('order_by', 'popularity');
            params.set('sort', 'asc');
        }

        const payload = await fetchJson(`https://api.jikan.moe/v4/anime?${params.toString()}`);
        const qLower = q.toLowerCase();

        const mapped = (payload.data || []).map(item => {
            const titles = Array.isArray(item.titles) ? item.titles : [];
            const defaultTitle = item.title || titles.find(t => t.type === 'Default')?.title || '';
            const englishTitle = item.title_english || titles.find(t => t.type === 'English')?.title || '';
            const japaneseTitle = item.title_japanese || titles.find(t => t.type === 'Japanese')?.title || '';
            const synonyms = titles
                .filter(t => t.type === 'Synonym' || t.type === 'English')
                .map(t => t.title)
                .filter(Boolean);

            const allCandidates = [defaultTitle, englishTitle, japaneseTitle, ...synonyms].filter(Boolean);
            const startsWithMatch = allCandidates.find(t => t.toLowerCase().startsWith(qLower));
            const includesMatch = allCandidates.find(t => t.toLowerCase().includes(qLower));
            const displayTitle = startsWithMatch || includesMatch || englishTitle || defaultTitle;

            let relevance = 0;
            const titleL = (defaultTitle || '').toLowerCase();
            const engL = (englishTitle || '').toLowerCase();
            if (titleL === qLower || engL === qLower) relevance = 100;
            else if (titleL.startsWith(qLower) || engL.startsWith(qLower)) relevance = 80;
            else if (titleL.includes(qLower) || engL.includes(qLower)) relevance = 60;
            else if (allCandidates.some(t => t.toLowerCase().includes(qLower))) relevance = 40;
            else relevance = 10;

            if (item.score) relevance += Math.min(item.score, 10);
            if (item.members) relevance += Math.min(Math.log10(item.members + 1), 5);

            return {
                id: item.mal_id,
                type: 'anime',
                source: 'Jikan / MyAnimeList',
                title: displayTitle,
                titleEnglish: englishTitle || null,
                titleJapanese: japaneseTitle || null,
                altTitles: synonyms.slice(0, 4),
                synopsis: item.synopsis || '',
                year: item.year || item.aired?.from?.slice(0, 4) || null,
                score: item.score ?? null,
                episodes: item.episodes ?? null,
                status: item.status || '',
                typeName: item.type || '',
                cover: item.images?.webp?.image_url || item.images?.jpg?.image_url || '',
                url: item.url || `https://myanimelist.net/anime/${item.mal_id}`,
                _relevance: relevance
            };
        });

        mapped.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));
        const data = mapped.slice(0, limit).map(({ _relevance, ...rest }) => rest);

        res.json({ source: 'jikan', total: payload.pagination?.items?.total || data.length, data });
    } catch (error) {
        console.error('Jikan anime search:', error.message);
        res.status(error.status === 429 ? 429 : 502).json({ error: 'La búsqueda de anime no está disponible en este momento.', source: 'jikan' });
    }
});

app.get('/api/search/characters', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
    if (!q) return res.json({ source: 'jikan', data: [] });
    try {
        const params = new URLSearchParams({
            q,
            limit: String(limit),
            page: '1',
            order_by: 'favorites',
            sort: 'desc'
        });
        const payload = await fetchJson(`https://api.jikan.moe/v4/characters?${params.toString()}`);
        const qLower = q.toLowerCase();
        const mapped = (payload.data || []).map(item => {
            const name = item.name || '';
            const nameL = name.toLowerCase();
            let relevance = 10;
            if (nameL === qLower) relevance = 100;
            else if (nameL.startsWith(qLower)) relevance = 80;
            else if (nameL.includes(qLower)) relevance = 60;
            if (item.favorites) relevance += Math.min(Math.log10(item.favorites + 1) * 4, 15);
            return {
                id: item.mal_id,
                type: 'character',
                source: 'Jikan / MyAnimeList',
                title: name,
                description: item.about || '',
                cover: item.images?.webp?.image_url || item.images?.jpg?.image_url || '',
                url: item.url || `https://myanimelist.net/character/${item.mal_id}`,
                _relevance: relevance
            };
        });
        mapped.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));
        const data = mapped.map(({ _relevance, ...rest }) => rest);
        res.json({ source: 'jikan', total: payload.pagination?.items?.total || data.length, data });
    } catch (error) {
        console.error('Jikan character search:', error.message);
        res.status(error.status === 429 ? 429 : 502).json({ error: 'La búsqueda de personajes no está disponible en este momento.', source: 'jikan' });
    }
});

// Búsqueda web: DuckDuckGo HTML (motor principal) + Wikipedia/GitHub de apoyo.
app.get('/api/search/web', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ source: 'chromi-ddg', query: q, data: [], knowledge: null, questions: [] });

    const results = [];
    let knowledge = null;

    const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    // 1) DuckDuckGo HTML results
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const r = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
            }
        });
        clearTimeout(timer);
        const html = await r.text();
        if (!/anomaly-modal|challenge-form/i.test(html)) {
            const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
            const snipRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)/gi;
            const links = [];
            let m;
            while ((m = linkRe.exec(html)) !== null) links.push({ href: m[1], title: strip(m[2]) });
            const snips = [];
            while ((m = snipRe.exec(html)) !== null) snips.push(strip(m[1]));

            links.forEach((L, i) => {
                let url = L.href;
                try {
                    if (url.includes('uddg=')) {
                        const u = new URL(url, 'https://duckduckgo.com');
                        url = decodeURIComponent(u.searchParams.get('uddg') || url);
                    }
                } catch (_) {}
                if (!/^https?:\/\//i.test(url)) return;
                let host = '';
                try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (_) {}
                results.push({
                    type: 'web',
                    source: 'DuckDuckGo',
                    badge: 'WEB',
                    title: L.title || host || url,
                    description: snips[i] || '',
                    url,
                    host
                });
            });
        }
    } catch (e) {
        console.error('DDG HTML:', e.message);
    }

    // 2) Wikipedia knowledge (optional)
    try {
        for (const lang of ['es', 'en']) {
            const open = await fetchJson(
                `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=3&namespace=0&format=json`,
                { timeout: 6000 }
            );
            const titles = open?.[1] || [];
            if (!titles.length) continue;
            const title = titles[0];
            try {
                const sum = await fetchJson(
                    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
                    { timeout: 6000 }
                );
                if (sum?.extract) {
                    knowledge = {
                        type: 'knowledge',
                        source: `Wikipedia (${lang})`,
                        title: sum.title || title,
                        description: sum.description || '',
                        extract: sum.extract,
                        cover: sum.thumbnail?.source || '',
                        url: sum.content_urls?.desktop?.page || open[3]?.[0] || ''
                    };
                    break;
                }
            } catch (_) {}
        }
    } catch (e) {
        console.error('wiki:', e.message);
    }

    // 3) GitHub top repos (light)
    try {
        const gh = await fetchJson(
            `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=3&sort=stars`,
            { timeout: 7000, headers: { accept: 'application/vnd.github+json' } }
        );
        (gh?.items || []).forEach((repo) => {
            results.push({
                type: 'github',
                source: 'GitHub',
                badge: 'CODE',
                title: repo.full_name,
                description: repo.description || 'Repositorio en GitHub',
                url: repo.html_url,
                host: 'github.com',
                stars: repo.stargazers_count
            });
        });
    } catch (e) {
        console.error('gh:', e.message);
    }

    const questions = [
        `¿Qué es ${q}?`,
        `${q} tutorial`,
        `${q} documentación`,
        `Alternativas a ${q}`
    ].map((t) => ({ title: t, query: t }));

    res.json({
        source: 'chromi-ddg',
        query: q,
        engine: 'duckduckgo',
        knowledge,
        questions,
        data: results
    });
});


// SEKAI Browser: proxy HTTP(S) para navegación web pública.
// Seguridad: bloquea localhost, redes privadas/link-local y esquemas no HTTP(S).
const PRIVATE_RANGES = [
    [/^10\./, 'IPv4 privado'], [/^127\./, 'loopback'], [/^169\.254\./, 'link-local'],
    [/^192\.168\./, 'IPv4 privado'], [/^172\.(1[6-9]|2\d|3[0-1])\./, 'IPv4 privado'],
    [/^0\./, 'IPv4 no enrutable']
];
function isBlockedIp(ip){
    if (net.isIPv4(ip)) return PRIVATE_RANGES.some(([re]) => re.test(ip));
    if (net.isIPv6(ip)) return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:') || ip === '::';
    return true;
}
async function assertPublicHost(hostname){
    const h=String(hostname||'').toLowerCase().replace(/^\[|\]$/g,'');
    if (!h || h==='localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('Destino no permitido');
    if (net.isIP(h)) { if(isBlockedIp(h)) throw new Error('Destino no permitido'); return; }
    const records=await dns.lookup(h,{all:true});
    if(!records.length || records.some(r=>isBlockedIp(r.address))) throw new Error('Destino no permitido');
}
async function fetchProxied(target, hops=0){
    if(hops>5) throw new Error('Demasiadas redirecciones');
    const u=new URL(target);
    if(!['http:','https:'].includes(u.protocol)) throw new Error('Solo se permiten URLs HTTP y HTTPS');
    await assertPublicHost(u.hostname);
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15000);
    try{
        const r=await fetch(u,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'SekaiBrowser/1.0 (+public web proxy)','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,text/css,application/javascript,image/avif,image/webp,image/*,video/*,audio/*,*/*;q=0.7'}});
        if(r.status>=300&&r.status<400){
            const loc=r.headers.get('location');
            if(!loc) return r;
            return fetchProxied(new URL(loc,u).href,hops+1);
        }
        return r;
    } finally { clearTimeout(timer); }
}
function proxyUrl(u){ return `/api/browser?url=${encodeURIComponent(u)}`; }
function rewriteHtml(html, baseUrl){
    const rewrite=(value)=>{
        const v=String(value||'').trim();
        if(!v || /^(?:#|data:|javascript:|mailto:|tel:|blob:)/i.test(v)) return value;
        try{return proxyUrl(new URL(v,baseUrl).href)}catch{return value}
    };
    html=html.replace(/(<(?:a|link|area|base|form)\b[^>]*?\b(?:href|action)\s*=\s*["'])([^"']+)(["'])/gi,(_,a,v,c)=>a+rewrite(v)+c);
    html=html.replace(/(<(?:img|script|iframe|source|video|audio|track|input)\b[^>]*?\b(?:src|poster)\s*=\s*["'])([^"']+)(["'])/gi,(_,a,v,c)=>a+rewrite(v)+c);
    html=html.replace(/\b(srcset)\s*=\s*(["'])([^"']+)(\2)/gi,(_,attr,q,val,end)=>attr+'='+q+val.split(',').map(x=>{const parts=x.trim().split(/\s+/);parts[0]=rewrite(parts[0]);return parts.join(' ')}).join(', ')+end);
    html=html.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi,(_,q,v)=>{const r=rewrite(v);return `url(${q}${r}${q})`;});
    html=html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,'');
    html=html.replace(/<head([^>]*)>/i,`<head$1><meta name="referrer" content="no-referrer"><script>window.__SEKAI_PROXY_BASE=${JSON.stringify(baseUrl)};</script>`);
    return html;
}
app.get('/api/browser', async (req,res)=>{
    const raw=String(req.query.url||'').trim();
    if(!raw) return res.status(400).send('URL requerida');
    try{
        const target=new URL(raw);
        const r=await fetchProxied(target.href);
        const ct=r.headers.get('content-type')||'application/octet-stream';
        const buf=Buffer.from(await r.arrayBuffer());
        if(buf.length>15*1024*1024) return res.status(413).send('El recurso supera el límite del navegador Sekai.');
        res.status(r.status);
        res.set('Cache-Control','private, max-age=120');
        if(/^text\/html|application\/xhtml\+xml/i.test(ct)){
            const charset=/charset=([^;]+)/i.exec(ct)?.[1]||'utf-8';
            let html=buf.toString(charset.toLowerCase().replace(/[^\w-]/g,'')||'utf8');
            html=rewriteHtml(html,target.href);
            res.type('html').send(html);
        } else {
            res.set('Content-Type',ct);
            res.send(buf);
        }
    }catch(e){
        console.error('Sekai Browser:',e.message);
        res.status(502).send(`<html><body style="font-family:system-ui;padding:40px"><h2>No se pudo abrir este sitio</h2><p>${String(e.message).replace(/[<>&]/g,'')}</p><p>Sekai Browser solo puede acceder a destinos HTTP/HTTPS públicos.</p></body></html>`);
    }
});

// Proxy IA
app.post('/api/chat', async (req, res) => {
    const { prompt, usuario } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt requerido" });

    const sistema = "Tu nombre es Chromi. Eres una chica Gen Z divertida, atenta y leal. Respondes de forma cercana y directa.";
    const inputTexto = `${usuario || 'Usuario'}: ${prompt}`;

    try {
        if (process.env.GEMINI_API_KEY) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: sistema }] },
                    contents: [{ parts: [{ text: inputTexto }] }]
                })
            });
            const d = await r.json();
            const respuesta = d?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (respuesta) return res.json({ respuesta });
        }

        const consulta = `${sistema}\n\n${inputTexto}`;
        const rPoll = await fetch(`https://text.pollinations.ai/${encodeURIComponent(consulta)}`);
        const textoPoll = await rPoll.text();

        if (textoPoll && textoPoll.trim().length > 0) {
            return res.json({ respuesta: textoPoll });
        }

        res.json({ respuesta: "…… ando lentita bb, intenta de nuevo en un sec 🖤" });
    } catch (e) {
        res.status(500).json({ error: "Error interno en el servidor" });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
});

