package com.sfxi.chromi.vpn;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.util.Log;

import java.util.List;

/**
 * VPN integrada en Sekai (opción A2).
 *
 * - El usuario final NO introduce usuario/contraseña ni instala otra app.
 * - Solo pulsa Conectar → Android muestra el diálogo del sistema → acepta o rechaza.
 * - Perfiles .ovpn y credenciales van embebidos (tú los actualizas al compilar).
 */
public final class VpnManager {
    private static final String TAG = "SekaiVpnManager";
    public static final int REQUEST_VPN_PERMISSION = 9910;

    private static String pendingProfile;

    private VpnManager() {}

    /**
     * Pide conexión. Puede necesitar startActivityForResult con VpnService.prepare().
     * @return true si ya se lanzó el servicio; false si hay que esperar el permiso del sistema
     */
    public static boolean connect(Activity activity, String profileFileName) {
        if (profileFileName == null || profileFileName.trim().isEmpty()) {
            profileFileName = "vpnbook-us16-udp53.ovpn";
        }
        pendingProfile = profileFileName.trim();

        Intent prepare = VpnService.prepare(activity);
        if (prepare != null) {
            activity.startActivityForResult(prepare, REQUEST_VPN_PERMISSION);
            return false;
        }
        startService(activity, pendingProfile);
        return true;
    }

    public static void onPermissionResult(Activity activity, int resultCode) {
        if (resultCode == Activity.RESULT_OK) {
            startService(activity, pendingProfile != null ? pendingProfile : "vpnbook-us16-udp53.ovpn");
        } else {
            Log.i(TAG, "Usuario rechazó el permiso VPN del sistema");
        }
    }

    public static void disconnect(Context ctx) {
        Intent i = new Intent(ctx, SekaiVpnService.class);
        i.setAction(SekaiVpnService.ACTION_DISCONNECT);
        ctx.startService(i);
    }

    private static void startService(Context ctx, String profile) {
        Intent i = new Intent(ctx, SekaiVpnService.class);
        i.setAction(SekaiVpnService.ACTION_CONNECT);
        i.putExtra(SekaiVpnService.EXTRA_PROFILE, profile);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
        Log.i(TAG, "SekaiVpnService arrancado con perfil " + profile);
    }

    public static List<String> listProfiles(Context ctx) {
        return VpnProfileHelper.listProfiles(ctx);
    }
}
