# VPN integrada en Sekai (cero configuración para el usuario)

El usuario final **no instala nada extra**, **no escribe usuario ni contraseña** y **no importa perfiles**.

Solo pulsa **Conectar VPN** → Android muestra el diálogo del sistema → acepta o rechaza.

Tú (el dueño de la app) eres quien actualiza los perfiles y las credenciales al compilar.

---

## Qué ve el usuario

1. Botón “Conectar VPN” (o el que pongas en la UI).
2. Diálogo nativo de Android: “¿Permitir a Sekai configurar una conexión VPN?”.
3. Si acepta → se intenta el túnel.
4. Si rechaza → no pasa nada.

Nada más. Sin OpenVPN for Android, sin formularios, sin archivos.

---

## Qué haces tú (desarrollador)

### 1. Credenciales (VPNBook las cambia cada pocos días)

Edita **antes de compilar**:

```text
public/vpn/credentials.txt
```

```text
username=vpnbook
password=LA_CLAVE_ACTUAL_DE_VPNBOOK
```

Opcional en runtime (solo para ti, no expongas esto en la UI):

```js
AndroidBridge.setVpnCredentials("vpnbook", "nueva_clave");
```

### 2. Perfiles

Los `.ovpn` ya están en `public/vpn/`. Gradle los copia a `assets/www/vpn/` al compilar.

Perfil por defecto si no pasas nombre: `vpnbook-us16-udp53.ovpn`.

### 3. API desde la web (WebView)

```js
// Conectar (el usuario solo verá el diálogo del sistema)
AndroidBridge.connectVpn("");  // perfil por defecto
// o
AndroidBridge.connectVpn("vpnbook-uk68-udp53.ovpn");

AndroidBridge.disconnectVpn();

AndroidBridge.listVpnProfiles(); // si quieres mostrar lista de servidores

// Estado
window.__sekaiVpnState = function (state) {
  // "connecting" | "disconnected" | "permission_denied"
};
```

---

## Estado técnico actual

| Parte | Estado |
|-------|--------|
| Diálogo de permiso del sistema | ✅ Listo |
| Usuario no escribe nada | ✅ Listo |
| Perfiles y credenciales embebidos | ✅ Listo |
| `SekaiVpnService` + notificación | ✅ Listo |
| Bridge JS | ✅ Listo |
| **Motor OpenVPN real (handshake, cifrado)** | ⚠️ Pendiente |

Android solo crea la interfaz TUN. Para que el tráfico salga cifrado por el servidor VPNBook hace falta el **motor OpenVPN nativo** (ics-openvpn / OpenVPN3).

Sin ese motor, el servicio arranca y muestra notificación, pero **no hay túnel OpenVPN completo**.

### Cómo completar el motor (siguiente paso real)

1. Integrar [ics-openvpn](https://github.com/schwabe/ics-openvpn) como módulo (licencia **GPL** → suele obligar a publicar el código de tu app), **o**
2. Usar OpenVPN3 library (revisar licencia), **o**
3. Un proveedor VPN con SDK comercial.

Cuando el motor esté enlazado, en `SekaiVpnService.connect()` se conecta el proceso OpenVPN con el `.ovpn` + user/pass, se rellenan IP/rutas/DNS en el `Builder` y se llama a `establish()`.

---

## Archivos clave

```text
public/vpn/
  ├── credentials.txt      ← tú lo editas
  ├── *.ovpn
  └── README.md

android/.../vpn/
  ├── SekaiVpnService.java
  ├── VpnManager.java
  ├── VpnCredentials.java
  └── VpnProfileHelper.java
```

---

## Resumen

- **Usuario**: solo acepta o rechaza el permiso del sistema. Cero configuración.
- **Tú**: actualizas `credentials.txt` (y opcionalmente los `.ovpn`) y recompilas.
- **Pendiente para VPN 100 % funcional**: integrar el motor OpenVPN nativo dentro del APK.


---

## Completar el túnel OpenVPN

La guía detallada del motor nativo está en:

**[OPENVPN_ENGINE.md](OPENVPN_ENGINE.md)**

Ahí se explica cómo añadir `libovpnexec.so`, licencias (GPL) y el flujo NEED-OK → TUN.
