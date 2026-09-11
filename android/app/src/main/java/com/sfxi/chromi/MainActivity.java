package com.sfxi.chromi;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.content.Intent;

public class MainActivity extends Activity {
    private WebView webView;

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
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        String uri = intent.getData().toString();
        if (uri.startsWith("chromi://auth-callback")) {
            webView.evaluateJavascript("window.__chromiHandleOAuthCallback(" + org.json.JSONObject.quote(uri) + ");", null);
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void openExternal(String url) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)));
            } catch (Exception ignored) {}
        }

        /**
         * Abre el reproductor nativo cuando el buscador detecta anime / película / serie.
         * Llamar desde JS: AndroidBridge.openCustomPlayer(contentId, contentType)
         */
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
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
