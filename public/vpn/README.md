# Sekai VPN (integrada)

El usuario de la app **no configura nada**:

- No instala otra aplicación
- No escribe usuario ni contraseña
- No importa archivos

Solo acepta el permiso VPN del sistema cuando pulsa Conectar.

## Para el dueño de Sekai

1. Edita `credentials.txt` con el usuario/clave actuales de VPNBook.
2. Los `.ovpn` de esta carpeta se embeben en el APK al compilar.
3. Desde JS:

```js
AndroidBridge.connectVpn("");           // perfil por defecto
AndroidBridge.connectVpn("vpnbook-us16-udp53.ovpn");
AndroidBridge.disconnectVpn();
```

Ver la guía completa en la raíz del proyecto: `VPN_SETUP.md`.
