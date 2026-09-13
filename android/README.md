# Sekai Android

Package / applicationId: `com.sfxi.chromi`  
Label de la app: **Sekai**

Shell WebView sobre `../public`. Gradle copia el frontend a `app/src/main/assets/www` en `preBuild`.

El backend Node **no** va dentro del APK. Define en GitHub la variable `CHROMI_API_BASE_URL` con la URL HTTPS del servidor.

## Build local

```bash
./gradlew assembleDebug
```

## GitHub Actions

Workflow: `.github/workflows/android.yml`

Secrets de firmado (opcional, solo release):

- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

OAuth: applicationId exacto + SHA-1 del keystore. Redirect: `chromi://auth-callback`.


## VPN integrada

Código en `app/src/main/java/com/sfxi/chromi/vpn/`:

- `SekaiVpnService` — VpnService del sistema
- `VpnManager` — permiso + arranque/parada
- `VpnCredentials` / `VpnProfileHelper` — credenciales y .ovpn embebidos

El usuario no configura nada. Solo acepta el diálogo de Android.

```js
AndroidBridge.connectVpn("");  // o nombre de .ovpn
AndroidBridge.disconnectVpn();
```

Ver `../VPN_SETUP.md`.
