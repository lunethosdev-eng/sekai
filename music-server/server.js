/**
 * Sekai Music Server — suelta .mp3 en /music y reinicia (o usa /api/rescan)
 * Opcional: sube por POST /api/upload
 * Lyrics: LRCLIB (gratis) + lyrics.ovh fallback
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const MUSIC_DIR = path.join(ROOT, 'music');
const COVERS_DIR = path.join(ROOT, 'covers');
const CATALOG_FILE = path.join(ROOT, 'catalog.json');

for (const d of [MUSIC_DIR, COVERS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/music', express.static(MUSIC_DIR));
app.use('/covers', express.static(COVERS_DIR));

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function parseFilename(name) {
  // "Artist - Title.mp3" or "Title.mp3"
  const base = name.replace(/\.(mp3|m4a|wav|ogg|flac)$/i, '');
  const parts = base.split(' - ');
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: 'Unknown', title: base };
}

function scanCatalog() {
  const files = fs.readdirSync(MUSIC_DIR).filter((f) =>
    /\.(mp3|m4a|wav|ogg|flac)$/i.test(f)
  );
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  const byFile = Object.fromEntries(existing.map((t) => [t.fileName || path.basename(t.file || ''), t]));

  const catalog = files.map((fileName, i) => {
    const prev = byFile[fileName] || {};
    const parsed = parseFilename(fileName);
    const id = prev.id || i + 1;
    return {
      id,
      title: prev.title || parsed.title,
      artist: prev.artist || parsed.artist,
      fileName,
      file: `/music/${encodeURIComponent(fileName)}`,
      cover: prev.cover || null,
      duration: prev.duration || null,
    };
  });

  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
  return catalog;
}

let catalog = scanCatalog();

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html><html><body style="font-family:system-ui;padding:24px;background:#111;color:#eee">
  <h1>Sekai Music Server</h1>
  <p>Tracks: <b>${catalog.length}</b></p>
  <ul>
    <li><a href="/catalog.json" style="color:#a78bfa">/catalog.json</a></li>
    <li><a href="/api/catalog" style="color:#a78bfa">/api/catalog</a></li>
    <li>POST /api/upload (multipart field: file)</li>
    <li>POST /api/rescan</li>
    <li>GET /api/lyrics?artist=...&title=...</li>
  </ul>
  <p>Suelta MP3 en la carpeta <code>music/</code> y llama <code>/api/rescan</code>.</p>
  </body></html>`);
});

app.get('/catalog.json', (_req, res) => {
  res.json(catalog);
});

app.get('/api/catalog', (_req, res) => {
  res.json({ source: 'sekai-music-server', total: catalog.length, data: catalog });
});

app.post('/api/rescan', (_req, res) => {
  catalog = scanCatalog();
  res.json({ ok: true, total: catalog.length });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MUSIC_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]+/gi, '_');
      cb(null, safe);
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Falta file' });
  catalog = scanCatalog();
  const track = catalog.find((t) => t.fileName === req.file.filename);
  res.json({ ok: true, track, total: catalog.length });
});

/** Lyrics: LRCLIB (gratis) → lyrics.ovh */
app.get('/api/lyrics', async (req, res) => {
  const artist = String(req.query.artist || '').trim();
  const title = String(req.query.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title requerido' });

  try {
    // 1) LRCLIB search
    const q = encodeURIComponent(`${artist} ${title}`.trim());
    const r1 = await fetch(`https://lrclib.net/api/search?q=${q}`, {
      headers: { 'User-Agent': 'SekaiMusicServer/1.0' },
    });
    if (r1.ok) {
      const arr = await r1.json();
      const best =
        (Array.isArray(arr) &&
          arr.find(
            (x) =>
              x.syncedLyrics ||
              x.plainLyrics
          )) ||
        (Array.isArray(arr) && arr[0]);
      if (best && (best.plainLyrics || best.syncedLyrics)) {
        return res.json({
          source: 'lrclib',
          artist: best.artistName || artist,
          title: best.trackName || title,
          lyrics: best.plainLyrics || '',
          synced: best.syncedLyrics || null,
        });
      }
    }

    // 2) lyrics.ovh
    if (artist && title) {
      const r2 = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
      );
      if (r2.ok) {
        const data = await r2.json();
        if (data.lyrics) {
          return res.json({
            source: 'lyrics.ovh',
            artist,
            title,
            lyrics: String(data.lyrics).trim(),
            synced: null,
          });
        }
      }
    }

    res.status(404).json({ error: 'No se encontraron lyrics', artist, title });
  } catch (e) {
    console.error('lyrics', e.message);
    res.status(502).json({ error: 'Error al buscar lyrics' });
  }
});

app.listen(PORT, () => {
  console.log(`Sekai Music Server http://localhost:${PORT}`);
  console.log(`Tracks: ${catalog.length} · carpeta: ${MUSIC_DIR}`);
});
