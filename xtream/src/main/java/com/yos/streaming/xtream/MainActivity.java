package com.yos.streaming.xtream;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.GZIPInputStream;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

public class MainActivity extends Activity {
    private static final String KEY_ALIAS = "yos_xtream_credentials_v1";
    private static final String PREFS = "yos_xtream_secure_store";
    private static final Set<String> ACTIONS = new HashSet<>(Arrays.asList(
        "", "get_live_categories", "get_live_streams", "get_vod_categories",
        "get_vod_streams", "get_series_categories", "get_series", "get_series_info"
    ));
    private final ExecutorService requests = Executors.newFixedThreadPool(3);
    private WebView webView;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout root;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        webView.addJavascriptInterface(new NativeBridge(), "YOSXtream");
        webView.setWebViewClient(new WebViewClient() {
            @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, android.webkit.WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) { callback.onCustomViewHidden(); return; }
                customView = view;
                customViewCallback = callback;
                webView.setVisibility(View.GONE);
                root.addView(customView, new FrameLayout.LayoutParams(-1, -1));
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }
            @Override public void onHideCustomView() { hideCustomView(); }
        });
        if (state != null) webView.restoreState(state);
        else webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
    }

    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN && webView != null &&
            (event.getKeyCode() == KeyEvent.KEYCODE_CHANNEL_UP || event.getKeyCode() == KeyEvent.KEYCODE_CHANNEL_DOWN)) {
            String key = event.getKeyCode() == KeyEvent.KEYCODE_CHANNEL_UP ? "ChannelUp" : "ChannelDown";
            webView.evaluateJavascript("document.dispatchEvent(new KeyboardEvent('keydown',{key:'" + key + "',bubbles:true,cancelable:true}))", null);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override public void onBackPressed() {
        if (customView != null) { hideCustomView(); return; }
        if (webView == null) { finish(); return; }
        webView.evaluateJavascript("window.yosHandleBack?window.yosHandleBack():false", result -> {
            if (!"true".equals(result)) {
                if (webView != null && webView.canGoBack()) webView.goBack();
                else finish();
            }
        });
    }

    private void hideCustomView() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        webView.setVisibility(View.VISIBLE);
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        if (webView != null) webView.saveState(out);
        super.onSaveInstanceState(out);
    }

    @Override protected void onDestroy() {
        requests.shutdownNow();
        if (webView != null) { webView.removeJavascriptInterface("YOSXtream"); webView.destroy(); webView = null; }
        super.onDestroy();
    }

    private final class NativeBridge {
        @JavascriptInterface public boolean isTelevision() {
            return getPackageManager().hasSystemFeature("android.software.leanback");
        }

        @JavascriptInterface public String getSavedCredentials() {
            JSONObject result = new JSONObject();
            try {
                String encrypted = getSharedPreferences(PREFS, MODE_PRIVATE).getString("credentials", null);
                if (encrypted == null) return result.put("saved", false).toString();
                byte[] packed = Base64.decode(encrypted, Base64.NO_WRAP);
                int ivLength = packed[0] & 0xff;
                if (ivLength < 12 || packed.length <= ivLength + 1) throw new Exception("Almacenamiento inválido");
                byte[] iv = Arrays.copyOfRange(packed, 1, ivLength + 1);
                byte[] cipherText = Arrays.copyOfRange(packed, ivLength + 1, packed.length);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(128, iv));
                JSONObject credentials = new JSONObject(new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8));
                result.put("saved", true).put("server", credentials.optString("server"))
                    .put("username", credentials.optString("username")).put("password", credentials.optString("password"));
            } catch (Exception e) {
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove("credentials").apply();
                try { result.put("saved", false); } catch (Exception ignored) { }
            }
            return result.toString();
        }

        @JavascriptInterface public String saveCredentials(String server, String username, String password, boolean remember) {
            JSONObject result = new JSONObject();
            try {
                if (!remember) {
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove("credentials").apply();
                    return result.put("ok", true).toString();
                }
                JSONObject data = new JSONObject().put("server", server).put("username", username).put("password", password);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, secretKey());
                byte[] iv = cipher.getIV();
                byte[] encrypted = cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8));
                byte[] packed = new byte[1 + iv.length + encrypted.length];
                packed[0] = (byte) iv.length;
                System.arraycopy(iv, 0, packed, 1, iv.length);
                System.arraycopy(encrypted, 0, packed, 1 + iv.length, encrypted.length);
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("credentials", Base64.encodeToString(packed, Base64.NO_WRAP)).apply();
                result.put("ok", true);
            } catch (Exception e) {
                try { result.put("ok", false).put("error", "No se pudieron guardar las credenciales de forma segura."); }
                catch (Exception ignored) { return "{\"ok\":false}"; }
            }
            return result.toString();
        }

        @JavascriptInterface public void clearSavedCredentials() {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().remove("credentials").apply();
        }

        @JavascriptInterface public void requestApi(String requestId, String server, String username, String password,
                                                    String action, String categoryId, String itemId) {
            requests.execute(() -> {
                String response;
                try { response = requestXtream(server, username, password, action, categoryId, itemId); }
                catch (Exception e) {
                    JSONObject error = new JSONObject();
                    try { error.put("_error", safeError(e)); } catch (Exception ignored) { }
                    response = error.toString();
                }
                String finalResponse = response;
                runOnUiThread(() -> {
                    if (webView != null) webView.evaluateJavascript("window.yosXtreamResponse&&window.yosXtreamResponse(" +
                        JSONObject.quote(requestId) + "," + JSONObject.quote(finalResponse) + ")", null);
                });
            });
        }

        @JavascriptInterface public void playNative(String url, String title, String queueJson, int index) {
            if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) return;
            runOnUiThread(() -> {
                Intent intent = new Intent(MainActivity.this, PlayerActivity.class);
                intent.putExtra(PlayerActivity.EXTRA_URL, url);
                intent.putExtra(PlayerActivity.EXTRA_TITLE, title == null ? "YOS XTREAM" : title);
                intent.putExtra(PlayerActivity.EXTRA_QUEUE, queueJson);
                intent.putExtra(PlayerActivity.EXTRA_INDEX, index);
                startActivity(intent);
            });
        }
    }

    private String requestXtream(String server, String username, String password, String action,
                                 String categoryId, String itemId) throws Exception {
        if (!ACTIONS.contains(action)) throw new Exception("Acción API no permitida.");
        Uri base = Uri.parse(server == null ? "" : server.trim());
        String scheme = base.getScheme();
        if (!("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) ||
            base.getHost() == null || base.getUserInfo() != null || base.getQuery() != null || base.getFragment() != null)
            throw new Exception("Escribe el servidor como http://dominio:puerto o https://dominio:puerto.");
        String path = base.getEncodedPath() == null ? "" : base.getEncodedPath().replaceAll("/+$", "");
        Uri.Builder builder = base.buildUpon().encodedPath(path + "/player_api.php")
            .appendQueryParameter("username", username).appendQueryParameter("password", password);
        if (action != null && !action.isEmpty()) builder.appendQueryParameter("action", action);
        if (categoryId != null && !categoryId.isEmpty()) builder.appendQueryParameter("category_id", categoryId);
        if ("get_series_info".equals(action) && itemId != null && !itemId.isEmpty()) builder.appendQueryParameter("series_id", itemId);
        URL url = new URL(builder.build().toString());
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(25000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Accept", "application/json, */*");
        connection.setRequestProperty("Accept-Encoding", "gzip");
        connection.setRequestProperty("User-Agent", "YOS-Xtream-Android/1.0");
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new Exception("El servidor respondió HTTP " + status + ".");
            InputStream responseStream = connection.getInputStream();
            if ("gzip".equalsIgnoreCase(connection.getContentEncoding())) responseStream = new GZIPInputStream(responseStream);
            try (InputStream input = responseStream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int read;
                while ((read = input.read(buffer)) != -1) {
                    if (out.size() + read > 20 * 1024 * 1024) throw new Exception("La respuesta supera el límite de 20 MB.");
                    out.write(buffer, 0, read);
                }
                String text = new String(out.toByteArray(), StandardCharsets.UTF_8).trim();
                if (text.isEmpty()) throw new Exception("El servidor devolvió una respuesta vacía.");
                if (!(text.startsWith("{") || text.startsWith("["))) throw new Exception("El servidor no devolvió datos JSON de Xtream.");
                return text;
            }
        } finally { connection.disconnect(); }
    }

    private SecretKey secretKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }

    private String safeError(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isEmpty()) return "No se pudo conectar con el servidor.";
        return message.replaceAll("(?i)(username|password)=[^&\\s]+", "$1=••••");
    }
}
