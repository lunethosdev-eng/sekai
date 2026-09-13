try {
    require('dotenv').config();
} catch (e) {
    // Permite que el servidor inicie en entornos de CI/CD o producción sin la librería dotenv
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const net = require('net');
const QRCode = require('qrcode');
const { createSearchEngine } = require('./lib/sekai-search');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const searchEngine = createSearchEngine({
    indexPath: process.env.SEARCH_INDEX_PATH || path.join(__dirname, 'data', 'search-index.json'),
    seeds: String(process.env.SEARCH_SEEDS || '').split(',').map(s => s.trim()).filter(Boolean),
    maxPages: Number(process.env.SEARCH_CRAWL_MAX_PAGES || 200),
    userAgent: process.env.SEARCH_USER_AGENT || 'SekaiBot/1.0 (+search crawler)'
});

// Public Supabase configuration. The anon key is intended for browser use; never expose a service-role key.
app.get('/api/config', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
        // Compatibilidad con builds antiguas. Preferir SUPABASE_PUBLISHABLE_KEY.
        supabaseAnonKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
        hoshiUrl: process.env.HOSHI_URL || 'https://backendv3-188.onrender.com',
        browserEngine: process.env.BROWSER_ENGINE || 'local',
        searchEngine: 'sekai-index',
        network: {
            proxy: true,
            privateDns: true,
            vpn: 'manual-ovpn'
        }
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

// Crawler opcional. Se activa por entorno para no gastar recursos inesperadamente.
if (String(process.env.SEARCH_CRAWL_ON_START || '').toLowerCase() === 'true') {
    setTimeout(() => searchEngine.crawl({ maxPages: Number(process.env.SEARCH_CRAWL_MAX_PAGES) || 200 }).catch(err => console.error('Initial search crawl:', err)), 5000);
}
const crawlIntervalMinutes = Number(process.env.SEARCH_CRAWL_INTERVAL_MINUTES || 0);
if (crawlIntervalMinutes > 0) {
    setInterval(() => {
        if (!searchEngine.isCrawling()) searchEngine.crawl({ maxPages: Number(process.env.SEARCH_CRAWL_MAX_PAGES) || 200 }).catch(err => console.error('Scheduled search crawl:', err));
    }, crawlIntervalMinutes * 60 * 1000);
}

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
        const pages = files.map((file, i) => {
            const remote = `${base}/${quality}/${hash}/${file}`;
            return {
                index: i + 1,
                url: `/api/manga/page?u=${encodeURIComponent(remote)}`
            };
        });
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

    const mapJikan = (payload) => {
        const qLower = q.toLowerCase();
        const mapped = (payload.data || []).map(item => {
            const titles = Array.isArray(item.titles) ? item.titles : [];
            const defaultTitle = item.title || titles.find(t => t.type === 'Default')?.title || '';
            const englishTitle = item.title_english || titles.find(t => t.type === 'English')?.title || '';
            const japaneseTitle = item.title_japanese || titles.find(t => t.type === 'Japanese')?.title || '';
            return {
                id: String(item.mal_id || item.id || ''),
                type: 'anime',
                source: 'Jikan',
                title: defaultTitle,
                titleEnglish: englishTitle,
                titleJapanese: japaneseTitle,
                description: (item.synopsis || '').slice(0, 400),
                synopsis: item.synopsis || '',
                cover: item.images?.jpg?.image_url || item.images?.jpg?.large_image_url || '',
                score: item.score || null,
                episodes: item.episodes || null,
                status: item.status || '',
                year: item.year || item.aired?.prop?.from?.year || null,
                url: item.url || `https://myanimelist.net/anime/${item.mal_id}`,
                badge: 'ANIME'
            };
        });
        // Prefer titles that start with the query
        mapped.sort((a, b) => {
            const as = a.title.toLowerCase().startsWith(qLower) ? 0 : 1;
            const bs = b.title.toLowerCase().startsWith(qLower) ? 0 : 1;
            return as - bs;
        });
        return mapped.slice(0, limit);
    };

    const mapKitsu = (payload) => {
        return (payload.data || []).slice(0, limit).map(item => {
            const a = item.attributes || {};
            const poster = a.posterImage || {};
            return {
                id: String(item.id),
                type: 'anime',
                source: 'Kitsu',
                title: a.canonicalTitle || a.titles?.en || a.titles?.en_jp || 'Anime',
                titleEnglish: a.titles?.en || '',
                titleJapanese: a.titles?.ja_jp || '',
                description: (a.synopsis || a.description || '').slice(0, 400),
                synopsis: a.synopsis || '',
                cover: poster.medium || poster.small || poster.original || '',
                score: a.averageRating ? Math.round(Number(a.averageRating) / 10 * 10) / 10 : null,
                episodes: a.episodeCount || null,
                status: a.status || '',
                year: a.startDate ? Number(String(a.startDate).slice(0, 4)) : null,
                url: a.slug ? `https://kitsu.io/anime/${a.slug}` : `https://kitsu.io/anime/${item.id}`,
                badge: 'ANIME'
            };
        });
    };

    // 1) Try Jikan
    try {
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
        const payload = await fetchJson(`https://api.jikan.moe/v4/anime?${params.toString()}`, { timeout: 12000 });
        const data = mapJikan(payload);
        if (data.length) {
            return res.json({ source: 'jikan', total: payload.pagination?.items?.total || data.length, data });
        }
    } catch (error) {
        console.error('Jikan anime search:', error.message);
    }

    // 2) Fallback Kitsu
    try {
        const params = new URLSearchParams();
        params.set('filter[text]', q);
        params.set('page[limit]', String(limit));
        const payload = await fetchJson(`https://kitsu.io/api/edge/anime?${params.toString()}`, { timeout: 12000 });
        const data = mapKitsu(payload);
        return res.json({ source: 'kitsu', total: data.length, data });
    } catch (error) {
        console.error('Kitsu anime search:', error.message);
        return res.status(502).json({ error: 'La búsqueda de anime no está disponible en este momento.', source: 'jikan+kitsu' });
    }
});

app.get('/api/search/characters', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20);
    if (!q) return res.json({ source: 'jikan', data: [] });

    try {
        const params = new URLSearchParams({ q, limit: String(limit) });
        const payload = await fetchJson(`https://api.jikan.moe/v4/characters?${params.toString()}`, { timeout: 12000 });
        const data = (payload.data || []).map(item => ({
            id: String(item.mal_id),
            type: 'character',
            source: 'Jikan',
            title: item.name || '',
            titleEnglish: item.name || '',
            titleJapanese: (item.name_kanji || ''),
            description: (item.about || '').slice(0, 300),
            cover: item.images?.jpg?.image_url || '',
            url: item.url || `https://myanimelist.net/character/${item.mal_id}`,
            badge: 'CHAR'
        }));
        return res.json({ source: 'jikan', total: payload.pagination?.items?.total || data.length, data });
    } catch (error) {
        console.error('Jikan character search:', error.message);
        // No tumbar toda la búsqueda: devolver vacío
        return res.json({ source: 'jikan', total: 0, data: [], warning: 'Personajes temporalmente no disponibles' });
    }
});

app.get('/api/search/web', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const type = String(req.query.type || 'all').toLowerCase();
    if (!q) return res.json({ source: 'sekai-index', query: q, data: [], knowledge: null, questions: [] });

    try {
        const out = searchEngine.search(q, { type, limit: 30 });
        const questions = [
            { title: `¿Qué es ${q}?`, query: `qué es ${q}` },
            { title: `${q} wiki`, query: `${q} wiki` },
            { title: `${q} noticias`, query: `${q} noticias` }
        ];
        res.json({
            source: 'sekai-index',
            engine: 'sekai-own-index',
            query: q,
            type,
            indexedPages: searchEngine.stats().pages,
            knowledge: out.knowledge || null,
            questions,
            data: out.results
        });
    } catch (e) {
        console.error('Sekai Search:', e.message);
        res.status(500).json({ source: 'sekai-index', query: q, data: [], error: 'Error en el índice de Sekai' });
    }
});

app.get('/api/search/stats', (req, res) => {
    res.json(searchEngine.stats());
});

app.post('/api/search/crawl', async (req, res) => {
    const expected = String(process.env.SEARCH_ADMIN_TOKEN || '').trim();
    if (!expected || String(req.get('x-search-token') || '') !== expected) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    if (searchEngine.isCrawling()) return res.status(409).json({ error: 'El crawler ya está ejecutándose' });
    const maxPages = Math.min(Math.max(Number(req.body?.maxPages) || 200, 1), 5000);
    const seeds = Array.isArray(req.body?.seeds) ? req.body.seeds : undefined;
    searchEngine.crawl({ maxPages, seeds }).catch(err => console.error('Sekai crawler:', err));
    res.status(202).json({ ok: true, message: 'Crawler iniciado', maxPages });
});

app.get('/api/search/crawl/status', (req, res) => res.json(searchEngine.crawlStatus()));

app.get('/api/dns/resolve', async (req, res) => {
    const name = String(req.query.name || '').trim().toLowerCase();
    const type = String(req.query.type || 'A').toUpperCase();
    if (!/^[a-z0-9.-]{1,253}$/i.test(name) || !/^(A|AAAA|TXT|CNAME)$/i.test(type)) {
        return res.status(400).json({ error: 'Dominio o tipo DNS inválido' });
    }
    try {
        const upstream = process.env.DOH_UPSTREAM || 'https://cloudflare-dns.com/dns-query';
        const r = await fetch(`${upstream}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`, {
            headers: { accept: 'application/dns-json' },
            signal: AbortSignal.timeout(8000)
        });
        const data = await r.json();
        res.set('Cache-Control', 'private, max-age=60');
        res.json({ resolver: 'Sekai Private DNS', upstream: new URL(upstream).hostname, ...data });
    } catch (e) {
        res.status(502).json({ error: 'No se pudo resolver el dominio', detail: e.message });
    }
});

app.get('/api/vpn/profiles', (req, res) => {
    const vpnDir = path.join(__dirname, 'public', 'vpn');
    let profiles = [];
    try {
        profiles = fs.readdirSync(vpnDir).filter(name => /\.ovpn$/i.test(name)).map(name => ({
            name,
            path: `/vpn/${encodeURIComponent(name)}`,
            format: 'ovpn'
        }));
    } catch (_) {}
    res.json({ provider: 'manual', profiles });
});

app.get('/api/network/status', (req, res) => {
    res.json({
        proxy: { enabled: true, endpoint: '/api/browser' },
        privateDns: { enabled: true, endpoint: '/api/dns/resolve', protocol: 'DoH' },
        vpn: { enabled: false, mode: 'manual-ovpn', directory: '/vpn', message: 'Añade tus archivos .ovpn en public/vpn y configúralos en el cliente VPN.' }
    });
});

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

