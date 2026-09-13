# Sekai Music Server

Servidor chico para tus canciones (sin GitHub).

## Uso

```bash
cd music-server
npm install
npm start
# http://localhost:8787
```

1. Copia `.mp3` a la carpeta `music/`
2. Nombra así: `Artist - Title.mp3` (mejor para lyrics)
3. Abre `POST /api/rescan` o reinicia
4. Catálogo: `http://localhost:8787/catalog.json`

## Subir por API

```bash
curl -F "file=@tema.mp3" http://localhost:8787/api/upload
```

## Lyrics

```text
GET /api/lyrics?artist=Laufey&title=From%20the%20Start
```

Usa LRCLIB (gratis) y si falla lyrics.ovh.

## En Sekai (runtime-config.js)

```js
window.PRISM_REPO = 'http://localhost:8787';
// o tu IP/LAN / túnel
```
