# Cómo completar el túnel OpenVPN en Sekai

## Qué ya hace la app

| Pieza | Estado |
|-------|--------|
| Diálogo de permiso del sistema | ✅ |
| Usuario no escribe nada | ✅ |
| Lee `.ovpn` + `credentials.txt` | ✅ |
| `SekaiVpnService` + notificación | ✅ |
| `OpenVpnEngine` (prepara config, busca binario, logs) | ✅ |
| **Binario OpenVPN nativo dentro del APK** | ✅ Integrado en jniLibs (libovpnexec.so, etc.) |
| Parseo completo NEED-OK → `Builder.establish()` | Parcial (listo para completar) |

Los `.so` ya están en `android/app/src/main/jniLibs/`. Compila el APK (GitHub Actions o Android Studio) e instálalo.

---

## Por qué hace falta un binario nativo

OpenVPN no es un protocolo trivial (TLS, certificados, ciphers, `auth-user-pass`, push de rutas).  
Implementarlo en Java puro no es viable. Todas las apps serias usan:

- el código C de OpenVPN 2.x compilado para Android, **o**
- la librería **OpenVPN 3** (C++).

Android solo te da la interfaz TUN (`VpnService.Builder`). El resto lo habla el motor.

---

## Camino recomendado (práctico)

### Opción 1 — Usar ics-openvpn como base (la más usada)

Repo: https://github.com/schwabe/ics-openvpn

**Licencia: GPLv2.**  
Si embeds partes de `de.blinkt.openvpn` tu app se considera obra derivada y **debes publicar el código fuente** (salvo que negocies otra licencia con el autor).

Pasos típicos que hace la comunidad:

1. Clonar ics-openvpn y compilar (NDK + las instrucciones de `doc/README.txt`).
2. Extraer los `.so` generados (`libovpnexec.so`, `libopenvpn.so`, etc.) para cada ABI:
   - `arm64-v8a`
   - `armeabi-v7a`
   - `x86_64` (emulador)
3. Copiarlos a tu proyecto:

```text
android/app/src/main/jniLibs/
  ├── arm64-v8a/libovpnexec.so
  ├── armeabi-v7a/libovpnexec.so
  └── x86_64/libovpnexec.so
```

4. En `AndroidManifest.xml` / `build.gradle`:

```xml
<application android:extractNativeLibs="true" ...>
```

5. En Android 10+ el ejecutable debe estar en `nativeLibraryDir` (ya lo busca `OpenVpnEngine`).

6. Completar el parseo de la management interface (NEED-OK IFCONFIG, rutas, DNS) en `OpenVpnEngine.handleLine()` y llamar a `callback.onNeedTun(...)`.

El autor oficial **no** ofrece ics-openvpn como librería para apps cerradas. Léete `doc/README.txt` y `doc/LICENSE.txt` antes de usarlo.

### Opción 2 — OpenVPN 3 (C++ library)

Repo: https://github.com/OpenVPN/openvpn3

Más moderna, API en C++ (`client/ovpncli.hpp`).  
Requiere NDK, bindings JNI y más trabajo de integración.  
Revisa la licencia del proyecto antes de distribuir.

### Opción 3 — SDK comercial

Proveedores de VPN (o white-label) ofrecen SDK con OpenVPN ya empaquetado y licencia comercial.  
Más caro, menos lío legal y de build.

---

## Qué hace `OpenVpnEngine` en este proyecto

1. Escribe `files/openvpn/sekai.conf` (contenido del `.ovpn` + management).
2. Escribe `files/openvpn/auth.txt` (usuario + contraseña, una por línea).
3. Busca el binario en este orden:
   - `nativeLibraryDir/libovpnexec.so`
   - `nativeLibraryDir/libopenvpn.so`
   - `filesDir/openvpn/openvpn`
4. Si lo encuentra → lo ejecuta con `--config` y `--auth-user-pass`.
5. Lee stdout y busca señales tipo `Initialization Sequence Completed` o `NEED-OK`.
6. Cuando haya IP/rutas → `SekaiVpnService.onNeedTun()` crea el TUN con `Builder.establish()`.

---

## Credenciales (tú las cambias)

```text
public/vpn/credentials.txt
```

```text
username=vpnbook
password=CLAVE_ACTUAL_DE_VPNBOOK
```

VPNBook publica claves nuevas en su web cada pocos días.  
Sin una clave válida el servicio se niega a arrancar (mensaje claro en la notificación).

---

## API para el usuario (cero configuración)

```js
AndroidBridge.connectVpn("");                    // perfil por defecto
AndroidBridge.connectVpn("vpnbook-uk68-udp53.ovpn");
AndroidBridge.disconnectVpn();
```

El único diálogo que ve el usuario es el del **sistema Android**.

---

## Checklist para tener túnel real

1. [ ] Poner la clave actual en `credentials.txt`
2. [ ] Compilar/obtener `libovpnexec.so` (o equivalente) para tus ABIs
3. [ ] Colocarlos en `jniLibs/<abi>/`
4. [ ] `android:extractNativeLibs="true"`
5. [ ] Completar parseo NEED-OK en `OpenVpnEngine` (si tu binario lo usa)
6. [ ] Probar en dispositivo real (emulador a veces falla con VPN)
7. [ ] Revisar licencia (GPL vs comercial)

---

## Resumen honesto

- **Estructura de la app (permiso, perfiles, credenciales, servicio, engine)**: lista.
- **Túnel cifrado real**: depende de que añadas el motor nativo OpenVPN.
- No existe un “parche de 10 líneas” que active OpenVPN sin binarios.

Cuando tengas los `.so`, el motor de este proyecto ya intentará arrancarlos y conectar.  
Si quieres, en el siguiente mensaje podemos afinar el parseo de NEED-OK o el `build.gradle` para `jniLibs`.
