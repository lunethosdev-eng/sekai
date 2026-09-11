# Chromi + Supabase

1. Ejecuta `supabase_schema.sql` en Supabase > SQL Editor.
2. En Authentication > Providers activa Email y Google si quieres Google OAuth.
3. En Authentication > Providers > Google configura las credenciales OAuth de Google.
4. En Authentication > Sign In / Providers activa Anonymous Sign-Ins si quieres el modo Guest.
5. Añade el dominio de Chromi a Authentication > URL Configuration > Redirect URLs. Para desarrollo local, por ejemplo `http://localhost:3000`.

Chromi usa el `auth.users.id` como identidad canónica y genera además un `chromi_id` público único con formato `CHR-XXXXXXXXXXXX`.

El perfil guarda apodo, username, bio, avatar y visibilidad pública/privada. Friendships, messages y search_history ya tienen tablas y RLS preparadas.


## FIX v9: Invalid API key

Chromi ya no guarda una clave `anon` JWT antigua dentro de `public/app.js`. Cuando corre con Express, obtiene la configuración desde `/api/config`. Para builds estáticos/Android puede usar `public/runtime-config.js`.

En Supabase Dashboard abre **Settings → API Keys** y usa la **Publishable key** (`sb_publishable_...`) para la app. No uses `sb_secret_...` ni `service_role`. Supabase recomienda la publishable key para navegador y móvil.

Configura en el servidor:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Después reinicia/redeploya el servidor. El error de Google `missing OAuth secret` es independiente: en Supabase → Authentication → Providers → Google deben estar configurados el Client ID y Client Secret del cliente OAuth **Web** de Google Cloud.

### APK / GitHub Actions

Para el workflow Android, configura:

- Repository Variable `CHROMI_SUPABASE_URL` = URL de tu proyecto Supabase.
- Repository Secret `CHROMI_SUPABASE_PUBLISHABLE_KEY` = tu clave `sb_publishable_...`.

La publishable key es apropiada para una app móvil porque es una clave pública de bajo privilegio y las tablas deben quedar protegidas por RLS. Nunca pongas una `sb_secret_...` o `service_role` en el APK.


## Chromi v11
Para registro directo con email/password, en Supabase abre Authentication → Providers → Email y desactiva **Confirm email**. Así `signUp` puede devolver una sesión inmediatamente. La app ya no muestra una pantalla de 'Revisa tu correo'.

v11 agrega amigos, solicitudes, mensajes privados con Supabase, biblioteca, ajustes de tema/notificaciones y búsqueda de usuarios. Ejecuta de nuevo este `supabase_schema.sql` para crear `notifications` y `library_items`.


### Sekai Social v12
Ejecuta también la sección v12 de `supabase_schema.sql`. Crea la tabla `posts`, likes/comentarios y el bucket público `sekai-media` con políticas RLS. Los usuarios suben archivos bajo `USER_ID/...`.
