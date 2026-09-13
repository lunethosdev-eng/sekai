package com.sfxi.chromi.vpn;

import android.content.Context;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Lista y lee los perfiles .ovpn que están en assets/www/vpn/
 */
public final class VpnProfileHelper {
    private static final String TAG = "SekaiVpnProfile";
    private static final String VPN_DIR = "www/vpn";

    private VpnProfileHelper() {}

    public static List<String> listProfiles(Context ctx) {
        List<String> out = new ArrayList<>();
        try {
            String[] files = ctx.getAssets().list(VPN_DIR);
            if (files == null) return out;
            for (String f : files) {
                if (f != null && f.toLowerCase().endsWith(".ovpn")) {
                    out.add(f);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error listando perfiles", e);
        }
        return out;
    }

    /** Devuelve el contenido completo del .ovpn o null */
    public static String readProfile(Context ctx, String fileName) {
        if (fileName == null || fileName.contains("..") || fileName.contains("/")) {
            return null;
        }
        try {
            InputStream is = ctx.getAssets().open(VPN_DIR + "/" + fileName);
            BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append('\n');
            }
            br.close();
            return sb.toString();
        } catch (Exception e) {
            Log.e(TAG, "No se pudo leer perfil: " + fileName, e);
            return null;
        }
    }

    /** Nombre corto amigable a partir del archivo, ej: vpnbook-us16-udp53.ovpn → us16 */
    public static String shortName(String fileName) {
        if (fileName == null) return "";
        String n = fileName.toLowerCase().replace(".ovpn", "");
        n = n.replace("vpnbook-", "");
        return n;
    }
}
