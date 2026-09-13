package com.sfxi.chromi.vpn;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import com.sfxi.chromi.MainActivity;

/**
 * VpnService de Sekai.
 * El usuario solo acepta/rechaza el permiso del sistema.
 * Credenciales y perfiles van embebidos (tú los actualizas).
 *
 * El túnel real lo gestiona OpenVpnEngine + binario nativo OpenVPN.
 */
public class SekaiVpnService extends VpnService implements OpenVpnEngine.Callback {
    private static final String TAG = "SekaiVpnService";
    public static final String ACTION_CONNECT = "com.sfxi.chromi.vpn.CONNECT";
    public static final String ACTION_DISCONNECT = "com.sfxi.chromi.vpn.DISCONNECT";
    public static final String EXTRA_PROFILE = "profile";
    private static final String CHANNEL_ID = "sekai_vpn_channel";
    private static final int NOTIF_ID = 42;

    private ParcelFileDescriptor vpnInterface;
    private OpenVpnEngine engine;
    private String currentProfile;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_DISCONNECT.equals(action)) {
            stopVpn("Desconectado por el usuario");
            return START_NOT_STICKY;
        }

        if (ACTION_CONNECT.equals(action)) {
            currentProfile = intent.getStringExtra(EXTRA_PROFILE);
            if (currentProfile == null || currentProfile.isEmpty()) {
                currentProfile = "vpnbook-us16-udp53.ovpn";
            }
            startForeground(NOTIF_ID, buildNotification("Conectando VPN…"));
            startVpn(currentProfile);
        }

        return START_STICKY;
    }

    private void startVpn(String profileFile) {
        try {
            String ovpn = VpnProfileHelper.readProfile(this, profileFile);
            if (ovpn == null) {
                updateNotification("Error: perfil no encontrado");
                onError("Perfil no encontrado: " + profileFile);
                return;
            }

            String user = VpnCredentials.getUsername(this);
            String pass = VpnCredentials.getPassword(this);
            if (pass == null || pass.isEmpty() || "CAMBIAR_ESTA_CLAVE".equals(pass)) {
                updateNotification("Falta la clave VPN (credentials.txt)");
                onError("Edita public/vpn/credentials.txt con la clave actual de VPNBook y recompila");
                return;
            }

            if (engine != null) {
                engine.stop();
            }
            engine = new OpenVpnEngine(this, this, this);
            engine.start(ovpn, user, pass);

        } catch (Exception e) {
            Log.e(TAG, "Error al iniciar VPN", e);
            updateNotification("Error: " + e.getMessage());
            onError(e.getMessage());
        }
    }

    private void stopVpn(String reason) {
        if (engine != null) {
            engine.stop();
            engine = null;
        }
        closeInterface();
        updateNotification(reason != null ? reason : "Desconectado");
        stopForeground(true);
        stopSelf();
        Log.i(TAG, "VPN detenida: " + reason);
    }

    private void closeInterface() {
        try {
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (Exception e) {
            Log.w(TAG, "Error cerrando TUN", e);
        }
    }

    // ─── Callbacks del motor OpenVPN ─────────────────────────

    @Override
    public void onLog(String line) {
        Log.d(TAG, line);
    }

    @Override
    public void onNeedTun(String localIp, int prefix, int mtu, String[] routes, String[] dns) {
        try {
            closeInterface();
            Builder builder = new Builder();
            builder.setSession("Sekai VPN");
            builder.setMtu(mtu > 0 ? mtu : 1500);
            if (localIp != null && !localIp.isEmpty()) {
                builder.addAddress(localIp, prefix > 0 ? prefix : 32);
            }
            if (routes != null) {
                for (String r : routes) {
                    // formato esperado: "0.0.0.0/0" o "10.0.0.0/8"
                    String[] p = r.split("/");
                    if (p.length == 2) {
                        builder.addRoute(p[0], Integer.parseInt(p[1]));
                    }
                }
            } else {
                builder.addRoute("0.0.0.0", 0);
            }
            if (dns != null) {
                for (String d : dns) builder.addDnsServer(d);
            }

            Intent configure = new Intent(this, MainActivity.class);
            PendingIntent pi = PendingIntent.getActivity(
                    this, 0, configure,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.setConfigureIntent(pi);

            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                onError("Builder.establish() devolvió null (¿permiso revocado?)");
                return;
            }
            updateNotification("VPN conectada");
            Log.i(TAG, "Interfaz TUN establecida: " + localIp + "/" + prefix);
        } catch (Exception e) {
            Log.e(TAG, "Error creando TUN", e);
            onError(e.getMessage());
        }
    }

    @Override
    public void onConnected() {
        updateNotification("VPN conectada");
        Log.i(TAG, "OpenVPN: Initialization Sequence Completed");
    }

    @Override
    public void onDisconnected(String reason) {
        closeInterface();
        updateNotification(reason != null ? reason : "Desconectado");
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onError(String message) {
        Log.e(TAG, "VPN error: " + message);
        updateNotification("Error VPN: " + message);
        // No paramos el servicio inmediatamente para que el usuario vea el mensaje
    }

    @Override
    public void onDestroy() {
        if (engine != null) {
            engine.stop();
            engine = null;
        }
        closeInterface();
        super.onDestroy();
    }

    @Override
    public void onRevoke() {
        stopVpn("Permiso VPN revocado por el sistema");
        super.onRevoke();
    }

    private Notification buildNotification(String text) {
        createChannel();
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return b.setContentTitle("Sekai VPN")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(text));
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Sekai VPN", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Estado de la conexión VPN de Sekai");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }
}
