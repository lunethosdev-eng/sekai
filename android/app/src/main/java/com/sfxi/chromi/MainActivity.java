package com.sfxi.chromi;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.sfxi.chromi.vpn.VpnCredentials;
import com.sfxi.chromi.vpn.VpnManager;

import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView webView;
    private long lastBackPressedMs = 0;
    private static final int REQ_NOTIF = 9911;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/www/index.html");

        NotificationHelper.ensureChannels(this);
        requestNotificationPermissionIfNeeded();
        handleIntent(getIntent());
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        REQ_NOTIF);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        if (intent.getData() != null) {
            String uri = intent.getData().toString();
            if (uri.startsWith("chromi://auth-callback")) {
                webView.evaluateJavascript(
                        "window.__chromiHandleOAuthCallback(" + JSONObject.quote(uri) + ");",
                        null);
            }
        }
        String chat = intent.getStringExtra("open_chat");
        if (chat != null && webView != null) {
            webView.post(() -> webView.evaluateJavascript(
                    "window.__sekaiOpenChat && window.__sekaiOpenChat(" + JSONObject.quote(chat) + ");",
                    null));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == VpnManager.REQUEST_VPN_PERMISSION) {
            VpnManager.onPermissionResult(this, resultCode);
            notifyJsVpnState(resultCode == RESULT_OK ? "connecting" : "permission_denied");
        }
    }

    private void notifyJsVpnState(String state) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.__sekaiVpnState && window.__sekaiVpnState(" + JSONObject.quote(state) + ");",
                null));
    }

    /** Doble toque en atrás para salir; si hay historial web, vuelve atrás. */
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackPressedMs < 2000) {
            finish();
            return;
        }
        lastBackPressedMs = now;
        Toast.makeText(this, "Toca otra vez para salir", Toast.LENGTH_SHORT).show();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void openExternal(String url) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)));
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void openCustomPlayer(String contentId, String contentType) {
            try {
                Intent intent = new Intent(MainActivity.this, CustomPlayerActivity.class);
                intent.putExtra("CONTENT_ID", contentId);
                intent.putExtra("CONTENT_TYPE", contentType);
                startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public String getAppInfo() {
            try {
                JSONObject o = new JSONObject();
                o.put("flavor", BuildConfig.APP_FLAVOR);
                o.put("isDev", BuildConfig.IS_DEV);
                o.put("isOwner", BuildConfig.IS_OWNER);
                o.put("showDevMenu", BuildConfig.SHOW_DEV_MENU);
                o.put("versionName", BuildConfig.VERSION_NAME);
                o.put("versionCode", BuildConfig.VERSION_CODE);
                return o.toString();
            } catch (Exception e) {
                return "{\"flavor\":\"global\",\"isDev\":false,\"isOwner\":false,\"showDevMenu\":false}";
            }
        }

        /** Muestra una notificación nativa. channel: default|message|social */
        @JavascriptInterface
        public void showNotification(String channel, String title, String body, String chatId) {
            int id = (chatId != null ? chatId : title + body).hashCode();
            runOnUiThread(() -> NotificationHelper.notify(
                    MainActivity.this, channel, title, body, chatId, id));
        }

        /** Tono por chat: default | soft | alarm | ringtone | silent */
        @JavascriptInterface
        public void setChatNotificationTone(String chatId, String toneKey) {
            NotificationHelper.setChatTone(MainActivity.this, chatId, toneKey);
        }

        @JavascriptInterface
        public String getChatNotificationTone(String chatId) {
            return NotificationHelper.getChatTone(MainActivity.this, chatId);
        }

        @JavascriptInterface
        public void connectVpn(String profileFile) {
            runOnUiThread(() -> {
                boolean started = VpnManager.connect(MainActivity.this, profileFile);
                if (started) notifyJsVpnState("connecting");
            });
        }

        @JavascriptInterface
        public void disconnectVpn() {
            runOnUiThread(() -> {
                VpnManager.disconnect(MainActivity.this);
                notifyJsVpnState("disconnected");
            });
        }

        @JavascriptInterface
        public void setVpnCredentials(String user, String pass) {
            VpnCredentials.setCredentials(MainActivity.this, user, pass);
        }
    }
}
