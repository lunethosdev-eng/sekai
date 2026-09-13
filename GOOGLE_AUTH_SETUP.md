# Arreglar Google Sign-In (`redirect_uri_mismatch`)

El error **Error 400: redirect_uri_mismatch** significa que la URI de redirección que envía Chromi **no está registrada** en Google Cloud ni en Supabase.

## 1. Supabase

1. Entra a tu proyecto → **Authentication** → **URL Configuration**
2. En **Redirect URLs** añade:
   - La URL de tu web, por ejemplo: `https://tu-dominio.com`
   - Y para el APK: `chromi://auth-callback`
3. En **Site URL** pon la URL principal de la web.

## 2. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs y servicios → **Credenciales**
2. Abre el cliente OAuth **tipo Web** (el que usa Supabase)
3. En **URIs de redirección autorizados** añade **exactamente** la callback de Supabase:

```
https://<TU-PROJECT-REF>.supabase.co/auth/v1/callback
```

Ejemplo real:
```
https://gnduhwtbnmthliiitiaj.supabase.co/auth/v1/callback
```

4. Guarda.

## 3. Proveedor Google en Supabase

Authentication → Providers → **Google**:
- Activa Google
- Pega **Client ID** y **Client Secret** del cliente Web de Google Cloud

## 4. Android (APK)

En el `AndroidManifest` ya está el scheme `chromi://auth-callback`.

En Supabase Redirect URLs debe existir:
```
chromi://auth-callback
```

Y en el código, `googleSignIn` usa `window.CHROMI_AUTH_REDIRECT` o `location.origin`. En nativo el bridge abre el flujo externo.

## Resumen rápido

| Lugar | Qué poner |
|-------|-----------|
| Google Cloud → Redirect URIs | `https://TU_REF.supabase.co/auth/v1/callback` |
| Supabase → Redirect URLs | tu web + `chromi://auth-callback` |
| runtime-config / env | `CHROMI_API_BASE` = URL pública del backend |

Sin el callback de Supabase en Google Cloud, **siempre** verás `redirect_uri_mismatch`.
