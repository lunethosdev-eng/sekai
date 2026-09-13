'use strict';

const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const { URL } = require('url');

function cleanText(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ').trim();
}
function tag(html, name, attr) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${attr}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
    return re.exec(html)?.[1] || '';
}
function abs(value, base) {
    try { return new URL(value, base).href; } catch { return ''; }
}
function tokens(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9áéíóúüñ_-]+/i).filter(x => x.length > 1).slice(0, 1000);
}

function createSearchEngine(opts = {}) {
    const indexPath = opts.indexPath;
    const userAgent = opts.userAgent || 'SekaiBot/1.0';
    const defaultSeeds = [
        'https://www.wikipedia.org/',
        'https://www.mozilla.org/',
        'https://www.gnu.org/',
        'https://developer.mozilla.org/',
        'https://github.com/'
    ];
    let index = { version: 1, pages: {} };
    let crawlState = { running: false, visited: 0, queued: 0, added: 0, errors: 0, startedAt: null, finishedAt: null };
    let saveTimer;

    function load() {
        try { if (fs.existsSync(indexPath)) index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); }
        catch { index = { version: 1, pages: {} }; }
        if (!index.pages) index.pages = {};
    }
    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try { fs.mkdirSync(path.dirname(indexPath), { recursive: true }); fs.writeFileSync(indexPath, JSON.stringify(index)); }
            catch (e) { console.error('Search index save:', e.message); }
        }, 250);
    }
    load();

    async function allowedByRobots(url) {
        try {
            const u = new URL(url);
            const r = await fetch(`${u.origin}/robots.txt`, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(5000) });
            if (!r.ok) return true;
            const txt = await r.text();
            let applies = false, blocked = false;
            for (const raw of txt.split(/\r?\n/)) {
                const line = raw.split('#')[0].trim();
                const [k, ...rest] = line.split(':');
                const key = String(k || '').trim().toLowerCase();
                const value = rest.join(':').trim();
                if (key === 'user-agent') applies = value === '*' || userAgent.toLowerCase().includes(value.toLowerCase());
                if (applies && key === 'disallow' && value) {
                    const p = new URL(value, u.origin).pathname;
                    if (u.pathname.startsWith(p)) blocked = true;
                }
            }
            return !blocked;
        } catch { return true; }
    }

    async function fetchPage(url) {
        const r = await fetch(url, {
            redirect: 'follow',
            headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
            signal: AbortSignal.timeout(12000)
        });
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || !/text\/(html|xml)|application\/xhtml\+xml/i.test(ct)) return null;
        const html = await r.text();
        if (html.length > 8 * 1024 * 1024) return null;
        return { html, finalUrl: r.url || url };
    }

    function parse(url, html) {
        const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').replace(/<[^>]+>/g, '').trim();
        const description = tag(html, 'description', 'description') || tag(html, 'og:description', 'og:description') || '';
        const ogImage = tag(html, 'og:image', 'og:image');
        const ogVideo = tag(html, 'og:video', 'og:video') || tag(html, 'twitter:player:stream', 'twitter:player:stream');
        const text = cleanText(html).slice(0, 120000);
        const images = [];
        const videos = [];
        const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
        const videoRe = /<(?:video|source)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
        let m;
        while ((m = imgRe.exec(html)) && images.length < 12) { const u = abs(m[1], url); if (u && /^https?:/i.test(u)) images.push(u); }
        while ((m = videoRe.exec(html)) && videos.length < 8) { const u = abs(m[1], url); if (u && /^https?:/i.test(u)) videos.push(u); }
        if (ogImage) images.unshift(abs(ogImage, url));
        if (ogVideo) videos.unshift(abs(ogVideo, url));
        const links = [];
        const linkRe = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
        while ((m = linkRe.exec(html)) && links.length < 150) {
            const u = abs(m[1], url);
            if (u && /^https?:/i.test(u)) links.push(u.split('#')[0]);
        }
        const lower = `${title} ${description} ${text}`.toLowerCase();
        let type = /<article\b/i.test(html) || /datePublished|article:published_time|news/i.test(html) ? 'news' : 'web';
        if (videos.length || /video|youtube|vimeo/i.test(lower)) type = 'video';
        if (images.length && !videos.length && /image|gallery|photo/i.test(lower)) type = 'image';
        return { url, title: title || url, description: description || text.slice(0, 300), text, image: images[0] || '', images, video: videos[0] || '', videos, type, links, crawledAt: new Date().toISOString() };
    }

    function scorePage(page, qTokens) {
        const titleTokens = tokens(page.title);
        const bodyTokens = tokens(`${page.description} ${page.text}`);
        let score = 0;
        for (const q of qTokens) {
            const tc = titleTokens.filter(x => x === q).length;
            const bc = bodyTokens.filter(x => x === q).length;
            score += tc * 8 + Math.min(bc, 20) * 0.35;
            if (page.url.toLowerCase().includes(q)) score += 2;
        }
        if (page.type === 'news') score += 0.1;
        return score;
    }

    function search(q, { type = 'all', limit = 30 } = {}) {
        const qt = tokens(q);
        const rows = Object.values(index.pages).map(p => ({ p, score: scorePage(p, qt) })).filter(x => x.score > 0);
        const filtered = type === 'all' || type === 'web' ? rows : rows.filter(x => x.p.type === type || (type === 'image' && x.p.images?.length) || (type === 'video' && x.p.videos?.length));
        filtered.sort((a, b) => b.score - a.score);
        const results = filtered.slice(0, limit).map(({ p, score }) => ({
            type: p.type || 'web', source: 'Sekai Index', badge: (p.type || 'web').toUpperCase(), title: p.title, description: p.description, url: p.url,
            host: (() => { try { return new URL(p.url).hostname.replace(/^www\./, ''); } catch { return ''; } })(), cover: p.image || '', video: p.video || '', images: p.images || [], score: Number(score.toFixed(3))
        }));
        let knowledge = null;
        if (results[0] && results[0].description) knowledge = { type: 'knowledge', source: 'Sekai Index', title: results[0].title, description: results[0].description, extract: results[0].description, cover: results[0].cover, url: results[0].url };
        return { results, knowledge };
    }

    async function crawl({ maxPages = opts.maxPages || 200, seeds } = {}) {
        if (crawlState.running) return;
        crawlState = { running: true, visited: 0, queued: 0, added: 0, errors: 0, startedAt: new Date().toISOString(), finishedAt: null };
        const queue = [...new Set((seeds && seeds.length ? seeds : (opts.seeds?.length ? opts.seeds : defaultSeeds)).filter(Boolean))];
        const seen = new Set();
        crawlState.queued = queue.length;
        while (queue.length && crawlState.visited < maxPages) {
            const url = queue.shift(); crawlState.queued = queue.length;
            if (seen.has(url)) continue; seen.add(url); crawlState.visited++;
            try {
                const u = new URL(url);
                if (!/^https?:$/.test(u.protocol)) continue;
                if (!(await allowedByRobots(url))) continue;
                const page = await fetchPage(url); if (!page) continue;
                const parsed = parse(page.finalUrl, page.html);
                index.pages[parsed.url] = parsed; crawlState.added++; save();
                for (const link of parsed.links) if (!seen.has(link) && queue.length < maxPages * 4) queue.push(link);
            } catch { crawlState.errors++; }
        }
        crawlState.running = false; crawlState.queued = queue.length; crawlState.finishedAt = new Date().toISOString(); save();
    }

    return {
        search, crawl, isCrawling: () => crawlState.running,
        crawlStatus: () => ({ ...crawlState }),
        stats: () => ({ pages: Object.keys(index.pages).length, images: Object.values(index.pages).reduce((n,p) => n + (p.images?.length || 0), 0), videos: Object.values(index.pages).reduce((n,p) => n + (p.videos?.length || 0), 0), indexPath })
    };
}

module.exports = { createSearchEngine };
