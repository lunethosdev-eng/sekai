# Sekai

**Sekai** es la app. Un espacio social y de exploración para fans de anime, manga y la web.

Aquí buscas series, lees manga, navegas, hablas con **Chromi** (la IA del Sekai), creas tu perfil, agregas amigos, mandas mensajes y publicas en el feed.

> App: **Sekai** · Asistente: **Chromi** · Android package: `com.sfxi.chromi`

---

## Qué haces en Sekai

| Función | Qué es |
|--------|--------|
| **Buscar** | Anime (MyAnimeList/Jikan), manga (MangaDex), personajes, web y usuarios |
| **Nombres cortos** | Escribe `tate` y te sale *Tate no Yūsha no Nariagari* sin el nombre completo |
| **Sekai Browser** | Navegador integrado (proxy / motor Hoshi) |
| **Chromi** | Chat con la asistente del Sekai (Gemini y otros proveedores) |
| **Cuenta** | Email, Google o Guest (Supabase Auth) |
| **Social** | Perfil, amigos, solicitudes y mensajes privados |
| **Biblioteca** | Guarda lo que te gusta |
| **Publicar** | Posts, arts, Shorts y videos |
| **Android** | APK con WebView + bridge nativo y reproductor |

---

## Estructura

```text
.
├── server.js                 # Backend Express
├── package.json              # Dependencias Node (todas se instalan en CI)
├── package-lock.json
├── public/                   # Frontend web
├── android/                  # APK WebView (Gradle + wrapper)
├── supabase_schema.sql       # Base de datos + RLS
├── SUPABASE_SETUP.md
├── .env                      # Claves locales (no las subas a un repo público)
├── .env.example              # Plantilla sin secretos
└── .github/workflows/
    ├── ci-node.yml           # Instala y verifica todos los módulos Node
    └── android.yml           # Build del APK
```

---

## Arranque local

```bash
cp .env.example .env   # o usa el .env incluido y revisa las claves
npm install
npm start
```

Abre [http://localhost:3000](http://localhost:3000).

### Variables (`.env`)

| Variable | Uso |
|----------|-----|
| `PORT` | Puerto del servidor |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publishable (`sb_publishable_...`) |
| `HOSHI_URL` | Motor de navegador |
| `BROWSER_ENGINE` | `hoshi` o `local` |
| `GEMINI_API_KEY` | Chat de Chromi (y otras: Groq, OpenRouter, Mistral, Cohere) |

> Si el repo es **público**, no subas `.env`. Usa GitHub Secrets / el panel de Render.  
> Si es **privado** y lo necesitas en el clone, el archivo puede ir en el zip de distribución.

---

## Supabase

1. Ejecuta `supabase_schema.sql` en el SQL Editor.
2. Sigue `SUPABASE_SETUP.md`.
3. Desactiva **Confirm email** si quieres registro inmediato.

---

## GitHub Actions

Al hacer push a `main` se corren:

1. **CI – Node** — `npm install` / `npm ci`, comprueba que existan:
   - `express`, `dotenv`, `cors`, `qrcode`
   - `@whiskeysockets/baileys`
   - `@supabase/supabase-js`
   - y que `server.js` + `public/` carguen sin error de sintaxis.
2. **Android APK** — compila el debug APK (y release si configuras el keystore).

### Secrets y variables del repo

**Variables** (Settings → Actions → Variables):

- `CHROMI_API_BASE_URL` — URL HTTPS pública del backend
- `CHROMI_SUPABASE_URL`

**Secrets**:

- `CHROMI_SUPABASE_PUBLISHABLE_KEY`
- (opcional release) `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

---

## Android local

```bash
cd android
./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/`.

---

## Scripts

```bash
npm start    # servidor
npm run check
npm run ci
```

---

**Sekai** · [lunethosdev-eng](https://github.com/lunethosdev-eng)

Busca, conecta y arma tu Sekai.
