package com.yos.streaming;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.content.pm.ActivityInfo;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView webView;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout root;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        setContentView(root);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setLoadsImagesAutomatically(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        webView.addJavascriptInterface(new NativeBridge(), "YOSNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                webView.setVisibility(View.GONE);
                root.addView(customView, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                ));
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                root.removeView(customView);
                customView = null;
                webView.setVisibility(View.VISIBLE);
                if (customViewCallback != null) customViewCallback.onCustomViewHidden();
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
        }
    }

    private final class NativeBridge {
        @JavascriptInterface
        public String downloadPlaylist(String rawUrl) {
            JSONObject result = new JSONObject();
            try {
                result.put("ok", true);
                result.put("text", downloadPlaylistText(rawUrl));
            } catch (Exception error) {
                try {
                    String message = error.getMessage();
                    result.put("ok", false);
                    result.put("error", message == null ? "Error de red." : message);
                } catch (Exception ignored) {
                    return "{\"ok\":false,\"error\":\"Error de red.\"}";
                }
            }
            return result.toString();
        }
    }

    private String downloadPlaylistText(String rawUrl) throws Exception {
        if (rawUrl == null || rawUrl.length() > 8192) throw new IOException("La URL no es válida.");
        URL url = new URL(rawUrl);
        for (int redirects = 0; redirects <= 5; redirects++) {
            validatePublicHttpUrl(url);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(20000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/vnd.apple.mpegurl, audio/x-mpegurl, text/plain, */*");
            connection.setRequestProperty("User-Agent", "YOS-Streaming-Android");
            try {
                int code = connection.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String location = connection.getHeaderField("Location");
                    if (location == null || redirects == 5) throw new IOException("El servidor redirigió demasiadas veces.");
                    url = new URL(url, location);
                    continue;
                }
                if (code < 200 || code >= 300) throw new IOException("El servidor respondió HTTP " + code + ".");
                try (InputStream input = new BufferedInputStream(connection.getInputStream());
                     ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        if (output.size() + read > 20 * 1024 * 1024) throw new IOException("La lista supera el límite de 20 MB.");
                        output.write(buffer, 0, read);
                    }
                    Charset charset = StandardCharsets.UTF_8;
                    String contentType = connection.getContentType();
                    if (contentType != null) {
                        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("charset=([^;]+)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(contentType);
                        if (matcher.find()) {
                            try { charset = Charset.forName(matcher.group(1).trim().replace("\"", "")); }
                            catch (Exception ignored) { }
                        }
                    }
                    return new String(output.toByteArray(), charset);
                }
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("No se pudo seguir la redirección del servidor.");
    }

    private void validatePublicHttpUrl(URL url) throws Exception {
        String scheme = url.getProtocol().toLowerCase(Locale.ROOT);
        String host = url.getHost();
        if (!(scheme.equals("http") || scheme.equals("https")) || host == null || host.isEmpty() || url.getUserInfo() != null)
            throw new IOException("Solo se permiten direcciones públicas HTTP o HTTPS.");
        String normalizedHost = host.toLowerCase(Locale.ROOT);
        if (normalizedHost.equals("localhost") || normalizedHost.endsWith(".localhost") || normalizedHost.endsWith(".local") || normalizedHost.endsWith(".internal"))
            throw new IOException("No se permiten direcciones locales o privadas.");
        for (InetAddress address : InetAddress.getAllByName(host)) {
            byte[] bytes = address.getAddress();
            boolean privateIpv4 = bytes.length == 4 && (
                (bytes[0] & 0xff) == 10 || (bytes[0] & 0xff) == 127 ||
                ((bytes[0] & 0xff) == 192 && (bytes[1] & 0xff) == 168) ||
                ((bytes[0] & 0xff) == 172 && (bytes[1] & 0xff) >= 16 && (bytes[1] & 0xff) <= 31) ||
                ((bytes[0] & 0xff) == 169 && (bytes[1] & 0xff) == 254) ||
                ((bytes[0] & 0xff) == 100 && (bytes[1] & 0xc0) == 64));
            boolean privateIpv6 = bytes.length == 16 && ((bytes[0] & 0xfe) == 0xfc);
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() ||
                address.isSiteLocalAddress() || address.isMulticastAddress() || privateIpv4 || privateIpv6)
                throw new IOException("No se permiten direcciones locales o privadas.");
        }
    }

    @Override
    public void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            ((WebChromeClient) webView.getWebChromeClient()).onHideCustomView();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
