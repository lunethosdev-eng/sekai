package com.sfxi.chromi.vpn;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * Gestiona usuario/contraseña de los perfiles OpenVPN.
 * El propietario de Sekai puede actualizarlos de dos formas:
 *  1) Editando assets/www/vpn/credentials.txt y recompilando
 *  2) Desde código / SharedPreferences (setCredentials)
 */
public final class VpnCredentials {
    private static final String TAG = "SekaiVpnCreds";
    private static final String PREFS = "sekai_vpn_creds";
    private static final String KEY_USER = "username";
    private static final String KEY_PASS = "password";

    private VpnCredentials() {}

    public static void setCredentials(Context ctx, String user, String pass) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit()
                .putString(KEY_USER, user == null ? "" : user.trim())
                .putString(KEY_PASS, pass == null ? "" : pass)
                .apply();
    }

    public static String getUsername(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String u = sp.getString(KEY_USER, null);
        if (u != null && !u.isEmpty()) return u;
        return readFromAssets(ctx, true);
    }

    public static String getPassword(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String p = sp.getString(KEY_PASS, null);
        if (p != null && !p.isEmpty()) return p;
        return readFromAssets(ctx, false);
    }

    private static String readFromAssets(Context ctx, boolean wantUser) {
        try {
            // Tras syncWebAssets los .ovpn y credentials quedan en assets/www/vpn/
            InputStream is = ctx.getAssets().open("www/vpn/credentials.txt");
            BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            String line;
            String user = "vpnbook";
            String pass = "";
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                if (line.toLowerCase().startsWith("username=")) {
                    user = line.substring(9).trim();
                } else if (line.toLowerCase().startsWith("password=")) {
                    pass = line.substring(9).trim();
                }
            }
            br.close();
            return wantUser ? user : pass;
        } catch (Exception e) {
            Log.w(TAG, "No se pudo leer credentials.txt de assets", e);
            return wantUser ? "vpnbook" : "";
        }
    }
}
