package com.sfxi.chromi;

import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.ui.PlayerView;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;

public class CustomPlayerActivity extends AppCompatActivity {

    private PlayerView playerView;
    private ExoPlayer player;
    private final OkHttpClient client = new OkHttpClient();

    private final String SUPABASE_URL = "https://supabase.co";
    private final String SUPABASE_ANON_KEY = "tu-clave-anon-de-supabase";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_custom_player);

        playerView = findViewById(R.id.player_view);
        String contentId = getIntent().getStringExtra("CONTENT_ID");
        String contentType = getIntent().getStringExtra("CONTENT_TYPE");

        // Buscamos el stream en Supabase dependiendo de si es Película o capítulo de Serie/Anime
        cargarStreamDesdeSupabase(contentId, contentType);
    }

    private void cargarStreamDesdeSupabase(String id, String tipo) {
        String urlQuery;
        if (tipo.equals("movie")) {
            urlQuery = SUPABASE_URL + "/rest/v1/content_streams?content_id=eq." + id + "&select=video_url";
        } else {
            // Si es un episodio de anime/serie, se busca por su ID de episodio
            urlQuery = SUPABASE_URL + "/rest/v1/content_streams?episode_id=eq." + id + "&select=video_url";
        }

        Request request = new Request.Builder()
                .url(urlQuery)
                .addHeader("apikey", SUPABASE_ANON_KEY)
                .addHeader("Authorization", "Bearer " + SUPABASE_ANON_KEY)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    try {
                        JSONArray streams = new JSONArray(response.body().string());
                        if (streams.length() > 0) {
                            JSONObject primerStream = streams.getJSONObject(0);
                            String urlVideoSucia = primerStream.getString("video_url");

                            // LE MANDAMOS LA URL A TU PROXY ACTUAL DE RENDER PARA REPRODUCIR SIN ANUNCIOS
                            // (Usa el formato exacto de URL que reciba tu proxy en Render actualmente)
                            String urlTuProxyRender = "https://onrender.com" + urlVideoSucia;
                            
                            runOnUiThread(() -> inicializarExoPlayerNativo(urlTuProxyRender));
                        }
                    } catch (Exception e) { e.printStackTrace(); }
                }
            }

            @Override
            public void onFailure(Call call, IOException e) {}
        });
    }

    private void inicializarExoPlayerNativo(String streamUrl) {
        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);

        // Cargamos la URL procesada por tu proxy directamente en tu Custom Player
        MediaItem mediaItem = MediaItem.fromUri(Uri.parse(streamUrl));
        player.setMediaItem(mediaItem);
        player.prepare();
        player.setPlayWhenReady(true);
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) {
            player.release();
            player = null;
        }
    }
}
