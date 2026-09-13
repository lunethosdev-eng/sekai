package com.sfxi.chromi.vpn;

import android.content.Context;
import android.net.VpnService;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Motor OpenVPN usando los .so de jniLibs (libovpnexec.so + libopenvpn.so / libovpn3.so).
 *
 * Flujo:
 *  1. Escribe config + auth en filesDir/openvpn/
 *  2. Ejecuta libovpnexec.so con --config y --auth-user-pass
 *  3. Lee stdout (logs / NEED-OK / Initialization Sequence Completed)
 *  4. Cuando hay IFCONFIG, notifica al servicio para Builder.establish()
 */
public class OpenVpnEngine {
    private static final String TAG = "SekaiOpenVpnEngine";

    public interface Callback {
        void onLog(String line);
        void onNeedTun(String localIp, int prefix, int mtu, String[] routes, String[] dns);
        void onConnected();
        void onDisconnected(String reason);
        void onError(String message);
    }

    private final Context context;
    private final VpnService vpnService;
    private final Callback callback;
    private Process process;
    private volatile boolean running;

    // Datos parseados del push de OpenVPN
    private String pendingLocalIp;
    private int pendingPrefix = 32;
    private int pendingMtu = 1500;
    private final List<String> pendingRoutes = new ArrayList<>();
    private final List<String> pendingDns = new ArrayList<>();

    public OpenVpnEngine(Context context, VpnService vpnService, Callback callback) {
        this.context = context.getApplicationContext();
        this.vpnService = vpnService;
        this.callback = callback;
    }

    public void start(String profileContent, String username, String password) {
        if (running) {
            callback.onLog("Motor ya en ejecución");
            return;
        }
        running = true;
        pendingLocalIp = null;
        pendingRoutes.clear();
        pendingDns.clear();

        new Thread(() -> {
            try {
                File dir = new File(context.getFilesDir(), "openvpn");
                if (!dir.exists() && !dir.mkdirs()) {
                    callback.onError("No se pudo crear directorio openvpn");
                    running = false;
                    return;
                }

                // Limpiar management residual
                File mgmt = new File(dir, "mgmt");
                if (mgmt.exists()) //noinspection ResultOfMethodCallIgnored
                    mgmt.delete();

                File conf = new File(dir, "sekai.conf");
                try (FileOutputStream fos = new FileOutputStream(conf)) {
                    StringBuilder cfg = new StringBuilder();
                    // Quitar directivas que chocan con Android VpnService
                    for (String line : profileContent.split("\n")) {
                        String t = line.trim().toLowerCase();
                        if (t.startsWith("dev ") || t.equals("dev tun") || t.equals("dev tun0")) continue;
                        if (t.startsWith("dev-type")) continue;
                        // script-security / up / down no aplican igual en Android
                        if (t.startsWith("up ") || t.startsWith("down ")) continue;
                        cfg.append(line).append('\n');
                    }
                    // Interfaz TUN la abre Android; OpenVPN usa management
                    cfg.append("\ndev tun\n");
                    cfg.append("management ").append(dir.getAbsolutePath()).append("/mgmt unix\n");
                    cfg.append("management-client-user nobody\n");
                    cfg.append("management-hold\n");
                    cfg.append("management-query-passwords\n");
                    // No intentar ifconfig del sistema
                    cfg.append("ifconfig-noexec\n");
                    cfg.append("route-noexec\n");
                    fos.write(cfg.toString().getBytes(StandardCharsets.UTF_8));
                }

                File auth = new File(dir, "auth.txt");
                try (FileOutputStream fos = new FileOutputStream(auth)) {
                    fos.write((username + "\n" + password + "\n").getBytes(StandardCharsets.UTF_8));
                }
                //noinspection ResultOfMethodCallIgnored
                auth.setReadable(true, true);

                String binary = findOpenVpnBinary();
                if (binary == null) {
                    callback.onError("Motor OpenVPN no instalado (falta libovpnexec.so en jniLibs)");
                    running = false;
                    return;
                }

                String nativeDir = context.getApplicationInfo().nativeLibraryDir;
                callback.onLog("Binario: " + binary);
                callback.onLog("nativeLibraryDir: " + nativeDir);

                List<String> cmd = new ArrayList<>();
                cmd.add(binary);
                cmd.add("--config");
                cmd.add(conf.getAbsolutePath());
                cmd.add("--auth-user-pass");
                cmd.add(auth.getAbsolutePath());
                cmd.add("--verb");
                cmd.add("4");
                // Algunos builds de minivpn esperan esto
                cmd.add("--parsable");

                ProcessBuilder pb = new ProcessBuilder(cmd);
                pb.directory(dir);
                pb.redirectErrorStream(true);
                Map<String, String> env = pb.environment();
                // Para que libovpnexec encuentre libopenvpn.so / libovpn3.so
                String ld = env.get("LD_LIBRARY_PATH");
                if (ld == null || ld.isEmpty()) {
                    env.put("LD_LIBRARY_PATH", nativeDir);
                } else {
                    env.put("LD_LIBRARY_PATH", nativeDir + ":" + ld);
                }

                process = pb.start();
                callback.onLog("Proceso OpenVPN arrancado, pid=" + process.hashCode());

                try (InputStream is = process.getInputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    StringBuilder lineBuf = new StringBuilder();
                    while (running && (n = is.read(buf)) != -1) {
                        for (int i = 0; i < n; i++) {
                            char c = (char) (buf[i] & 0xff);
                            if (c == '\n' || c == '\r') {
                                if (lineBuf.length() > 0) {
                                    handleLine(lineBuf.toString());
                                    lineBuf.setLength(0);
                                }
                            } else {
                                lineBuf.append(c);
                            }
                        }
                    }
                    if (lineBuf.length() > 0) handleLine(lineBuf.toString());
                }

                int code = process.waitFor();
                callback.onDisconnected("Proceso terminó con código " + code);
            } catch (Exception e) {
                Log.e(TAG, "Error en motor OpenVPN", e);
                callback.onError(e.getMessage() != null ? e.getMessage() : "Error desconocido");
            } finally {
                running = false;
                process = null;
            }
        }, "SekaiOpenVpn").start();
    }

    private void handleLine(String line) {
        if (line == null || line.isEmpty()) return;
        callback.onLog(line);

        String lower = line.toLowerCase();

        // NEED-OK IFCONFIG local remoteOrNetmask MTU topology
        // Ejemplo: NEED-OK IFCONFIG 10.8.0.2 255.255.255.0 1500 net30
        if (line.startsWith("NEED-OK IFCONFIG ") || line.contains(">NEED-OK:IFCONFIG:")) {
            parseIfconfig(line);
            return;
        }

        // Algunas builds: PUSH: received remote IP
        if (lower.contains("ifconfig") && lower.contains("10.")) {
            // intentar extraer IP tipo 10.x.x.x
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("(\\d+\\.\\d+\\.\\d+\\.\\d+)").matcher(line);
            if (m.find() && pendingLocalIp == null) {
                pendingLocalIp = m.group(1);
                pendingPrefix = 30;
            }
        }

        if (lower.contains("dns server") || lower.contains("dhcp-option dns")) {
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("(\\d+\\.\\d+\\.\\d+\\.\\d+)").matcher(line);
            while (m.find()) {
                String ip = m.group(1);
                if (!pendingDns.contains(ip)) pendingDns.add(ip);
            }
        }

        if (line.contains("Initialization Sequence Completed")
                || lower.contains("initialization sequence completed")) {
            // Si aún no establecimos TUN, usar valores por defecto razonables
            if (pendingLocalIp == null) {
                pendingLocalIp = "10.8.0.2";
                pendingPrefix = 24;
            }
            if (pendingRoutes.isEmpty()) {
                pendingRoutes.add("0.0.0.0/0");
            }
            if (pendingDns.isEmpty()) {
                pendingDns.add("8.8.8.8");
                pendingDns.add("1.1.1.1");
            }
            callback.onNeedTun(
                    pendingLocalIp,
                    pendingPrefix,
                    pendingMtu,
                    pendingRoutes.toArray(new String[0]),
                    pendingDns.toArray(new String[0])
            );
            callback.onConnected();
        }

        if (lower.contains("auth failed") || lower.contains("auth-failure")) {
            callback.onError("Autenticación fallida (usuario/clave VPNBook incorrectos o caducados)");
        }
        if (lower.contains("cannot resolve") || lower.contains("connection refused")) {
            callback.onError("No se pudo conectar al servidor VPN");
        }
    }

    private void parseIfconfig(String line) {
        // NEED-OK IFCONFIG 10.8.0.2 255.255.255.0 1500 net30
        String[] parts = line.replace(">", " ").replace(":", " ").trim().split("\\s+");
        List<String> nums = new ArrayList<>();
        for (String p : parts) {
            if (p.matches("\\d+\\.\\d+\\.\\d+\\.\\d+") || p.matches("\\d+")) {
                nums.add(p);
            }
        }
        if (nums.size() >= 1) {
            pendingLocalIp = nums.get(0);
        }
        if (nums.size() >= 2 && nums.get(1).contains(".")) {
            // netmask → prefix
            pendingPrefix = netmaskToPrefix(nums.get(1));
        }
        if (nums.size() >= 3) {
            try {
                int mtu = Integer.parseInt(nums.get(nums.size() >= 3 ? 2 : nums.size() - 1));
                if (mtu >= 576 && mtu <= 9000) pendingMtu = mtu;
            } catch (NumberFormatException ignored) {}
        }
        if (pendingRoutes.isEmpty()) pendingRoutes.add("0.0.0.0/0");
        callback.onNeedTun(
                pendingLocalIp != null ? pendingLocalIp : "10.8.0.2",
                pendingPrefix,
                pendingMtu,
                pendingRoutes.toArray(new String[0]),
                pendingDns.isEmpty()
                        ? new String[]{"8.8.8.8", "1.1.1.1"}
                        : pendingDns.toArray(new String[0])
        );
    }

    private static int netmaskToPrefix(String mask) {
        try {
            String[] o = mask.split("\\.");
            int bits = 0;
            for (String s : o) {
                int v = Integer.parseInt(s);
                bits += Integer.bitCount(v);
            }
            return bits > 0 ? bits : 24;
        } catch (Exception e) {
            return 24;
        }
    }

    public void stop() {
        running = false;
        if (process != null) {
            try {
                process.destroy();
            } catch (Exception ignored) {}
            process = null;
        }
    }

    public boolean isRunning() {
        return running;
    }

    public boolean protectSocket(int fd) {
        return vpnService.protect(fd);
    }

    private String findOpenVpnBinary() {
        String nativeDir = context.getApplicationInfo().nativeLibraryDir;
        String[] names = {
                "libovpnexec.so",
                "libopenvpn.so"
        };
        for (String name : names) {
            File f = new File(nativeDir, name);
            if (f.exists()) {
                //noinspection ResultOfMethodCallIgnored
                f.setExecutable(true);
                return f.getAbsolutePath();
            }
        }
        // Fallback filesDir
        File alt = new File(context.getFilesDir(), "openvpn/libovpnexec.so");
        if (alt.exists()) {
            //noinspection ResultOfMethodCallIgnored
            alt.setExecutable(true);
            return alt.getAbsolutePath();
        }
        return null;
    }
}
