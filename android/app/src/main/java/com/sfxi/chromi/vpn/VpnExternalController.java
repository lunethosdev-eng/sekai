package com.sfxi.chromi.vpn;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Log;
import android.widget.Toast;

/**
 * Opción A1 — Controlar la app "OpenVPN for Android" (de.blinkt.openvpn)
 * desde Sekai mediante Intents públicos.
 *
 * El usuario debe tener instalada OpenVPN for Android.
 * Los perfiles .ovpn se pueden importar una vez en esa app (o se pueden
 * copiar desde assets). Luego Sekai solo envía Connect / Disconnect.
 *
 * Documentación oficial de control externo:
 * https://github.com/schwabe/ics-openvpn#controlling-from-external-apps
 */
public final class VpnExternalController {
    private static final String TAG = "SekaiVpnExt";

    public static final String OPENVPN_PACKAGE = "de.blinkt.openvpn";

    // Activities públicas de control
    public static final String ACTION_CONNECT = "android.intent.action.MAIN";
    public static final String CLASS_CONNECT = "de.blinkt.openvpn.api.ConnectVPN";
    public static final String CLASS_DISCONNECT = "de.blinkt.openvpn.api.DisconnectVPN";
    public static final String EXTRA_PROFILE = "de.blinkt.openvpn.api.profileName";

    private VpnExternalController() {}

    public static boolean isOpenVpnInstalled(Context ctx) {
        try {
            ctx.getPackageManager().getPackageInfo(OPENVPN_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    /**
     * Conecta un perfil que ya existe en OpenVPN for Android.
     * @param profileName nombre exacto del perfil tal como aparece en esa app
     */
    public static void connect(Context ctx, String profileName) {
        if (!isOpenVpnInstalled(ctx)) {
            promptInstall(ctx);
            return;
        }
        if (profileName == null || profileName.trim().isEmpty()) {
            Toast.makeText(ctx, "Nombre de perfil VPN vacío", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            Intent i = new Intent(ACTION_CONNECT);
            i.setClassName(OPENVPN_PACKAGE, CLASS_CONNECT);
            i.putExtra(EXTRA_PROFILE, profileName.trim());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            Log.i(TAG, "Solicitada conexión al perfil: " + profileName);
        } catch (ActivityNotFoundException e) {
            Log.e(TAG, "No se pudo lanzar ConnectVPN", e);
            Toast.makeText(ctx, "OpenVPN for Android no responde. ¿Está actualizada?", Toast.LENGTH_LONG).show();
        }
    }

    public static void disconnect(Context ctx) {
        if (!isOpenVpnInstalled(ctx)) {
            promptInstall(ctx);
            return;
        }
        try {
            Intent i = new Intent(ACTION_CONNECT);
            i.setClassName(OPENVPN_PACKAGE, CLASS_DISCONNECT);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            Log.i(TAG, "Solicitada desconexión VPN");
        } catch (ActivityNotFoundException e) {
            Log.e(TAG, "No se pudo lanzar DisconnectVPN", e);
            Toast.makeText(ctx, "No se pudo desconectar", Toast.LENGTH_SHORT).show();
        }
    }

    public static void promptInstall(Context ctx) {
        Toast.makeText(ctx,
                "Instala «OpenVPN for Android» para usar la VPN (opción A1)",
                Toast.LENGTH_LONG).show();
        try {
            Intent market = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + OPENVPN_PACKAGE));
            market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(market);
        } catch (Exception e) {
            Intent web = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=" + OPENVPN_PACKAGE));
            web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(web);
        }
    }

    /**
     * Abre OpenVPN for Android para que el usuario importe manualmente
     * los .ovpn (la primera vez).
     */
    public static void openOpenVpnApp(Context ctx) {
        if (!isOpenVpnInstalled(ctx)) {
            promptInstall(ctx);
            return;
        }
        try {
            Intent i = ctx.getPackageManager().getLaunchIntentForPackage(OPENVPN_PACKAGE);
            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            }
        } catch (Exception e) {
            Log.e(TAG, "No se pudo abrir OpenVPN for Android", e);
        }
    }
}
