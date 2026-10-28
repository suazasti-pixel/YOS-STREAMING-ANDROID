package com.yos.streaming;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

import org.json.JSONArray;
import org.json.JSONObject;

public final class PlayerActivity extends Activity {
    public static final String EXTRA_URL = "stream_url";
    public static final String EXTRA_TITLE = "stream_title";
    public static final String EXTRA_QUEUE = "stream_queue";
    public static final String EXTRA_INDEX = "stream_index";
    public static final String RESULT_URL = "result_url";
    public static final String RESULT_TITLE = "result_title";

    private ExoPlayer player;
    private PlayerView playerView;
    private TextView errorText;
    private Button retryButton;
    private JSONArray queue;
    private int startIndex;
    private String selectedUrl;
    private String selectedTitle;

    @Override
    protected void onCreate(@Nullable Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        );
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff000000);
        playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING);
        root.addView(playerView, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(16), dp(10), dp(16), dp(10));
        top.setBackgroundColor(0x99000000);
        Button back = new Button(this);
        back.setText("‹  VOLVER");
        back.setOnClickListener(view -> finish());
        TextView title = new TextView(this);
        title.setTextColor(0xffffffff);
        title.setTextSize(18);
        title.setMaxLines(1);
        title.setText(getIntent().getStringExtra(EXTRA_TITLE));
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, -2, 1);
        titleParams.leftMargin = dp(14);
        top.addView(back);
        top.addView(title, titleParams);
        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(-1, -2, Gravity.TOP);
        root.addView(top, topParams);

        LinearLayout errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(20), dp(16), dp(20), dp(16));
        errorPanel.setBackgroundColor(0xdd101820);
        errorText = new TextView(this);
        errorText.setTextColor(0xffffffff);
        errorText.setTextSize(16);
        errorText.setGravity(Gravity.CENTER);
        errorText.setText("No se pudo abrir este canal. Revisa el enlace o vuelve a intentarlo.");
        retryButton = new Button(this);
        retryButton.setText("REINTENTAR");
        retryButton.setOnClickListener(view -> retry());
        errorPanel.addView(errorText);
        errorPanel.addView(retryButton);
        errorPanel.setVisibility(View.GONE);
        FrameLayout.LayoutParams errorParams = new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER);
        root.addView(errorPanel, errorParams);
        setContentView(root);

        queue = parseQueue(getIntent().getStringExtra(EXTRA_QUEUE));
        startIndex = getIntent().getIntExtra(EXTRA_INDEX, 0);
        selectedUrl = getIntent().getStringExtra(EXTRA_URL);
        selectedTitle = getIntent().getStringExtra(EXTRA_TITLE);
        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY) errorPanel.setVisibility(View.GONE);
            }

            @Override public void onMediaItemTransition(@Nullable MediaItem item, int reason) {
                if (item == null) return;
                selectedUrl = item.localConfiguration == null ? selectedUrl : item.localConfiguration.uri.toString();
                selectedTitle = item.mediaMetadata.title == null ? selectedTitle : item.mediaMetadata.title.toString();
                title.setText(selectedTitle);
            }

            @Override public void onPlayerError(PlaybackException error) {
                errorPanel.setVisibility(View.VISIBLE);
                errorText.setText("No se pudo reproducir este canal. Revisa el enlace o vuelve a intentarlo.");
                retryButton.requestFocus();
            }
        });
        loadQueue();
    }

    private JSONArray parseQueue(String raw) {
        try { return new JSONArray(raw); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    private void loadQueue() {
        if (queue.length() == 0) {
            queue.put(new JSONObject());
            try { queue.put(0, new JSONObject().put("url", selectedUrl).put("name", selectedTitle)); }
            catch (Exception ignored) { }
            startIndex = 0;
        }
        for (int i = 0; i < queue.length(); i++) {
            JSONObject item = queue.optJSONObject(i);
            if (item == null) continue;
            String url = item.optString("url", "");
            if (!(url.startsWith("http://") || url.startsWith("https://"))) continue;
            String name = item.optString("name", "YOS STREAMING");
            MediaItem.Builder media = new MediaItem.Builder()
                .setUri(Uri.parse(url))
                .setMediaMetadata(new MediaMetadata.Builder().setTitle(name).build());
            String lower = url.toLowerCase();
            if (lower.contains("output=m3u8") || lower.matches(".*\\.m3u8([?#].*)?$")) media.setMimeType(MimeTypes.APPLICATION_M3U8);
            else if (lower.matches(".*\\.mpd([?#].*)?$")) media.setMimeType(MimeTypes.APPLICATION_MPD);
            player.addMediaItem(media.build());
        }
        if (player.getMediaItemCount() == 0) {
            errorPanelFallback("El enlace del canal no es válido.");
            return;
        }
        player.seekTo(Math.max(0, Math.min(startIndex, player.getMediaItemCount() - 1)), 0);
        player.prepare();
        player.play();
    }

    private void errorPanelFallback(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        finish();
    }

    private void retry() {
        if (player == null) return;
        player.prepare();
        player.play();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (player != null) {
            if (keyCode == KeyEvent.KEYCODE_CHANNEL_UP || keyCode == KeyEvent.KEYCODE_PAGE_UP || keyCode == KeyEvent.KEYCODE_MEDIA_PREVIOUS) {
                if (player.hasPreviousMediaItem()) player.seekToPreviousMediaItem();
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_CHANNEL_DOWN || keyCode == KeyEvent.KEYCODE_PAGE_DOWN || keyCode == KeyEvent.KEYCODE_MEDIA_NEXT) {
                if (player.hasNextMediaItem()) player.seekToNextMediaItem();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() { finish(); }

    @Override
    protected void onDestroy() {
        if (playerView != null) playerView.setPlayer(null);
        if (player != null) { player.release(); player = null; }
        super.onDestroy();
    }

    @Override
    public void finish() {
        if (selectedUrl != null) {
            setResult(RESULT_OK, getIntent().putExtra(RESULT_URL, selectedUrl).putExtra(RESULT_TITLE, selectedTitle));
        }
        super.finish();
    }
}
