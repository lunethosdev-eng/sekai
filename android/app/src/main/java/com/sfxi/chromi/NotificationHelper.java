package com.sfxi.chromi;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.HashMap;
import java.util.Map;

/**
 * Notificaciones locales de Sekai.
 * Tonos por chat: canal Android por conversación (API 26+ requiere canal para el sonido).
 */
public final class NotificationHelper {
    public static final String CH_DEFAULT = "sekai_default";
    public static final String CH_MESSAGES = "sekai_messages";
    public static final String CH_SOCIAL = "sekai_social";

    private static final Map<String, Uri> TONE_URIS = new HashMap<>();

    private NotificationHelper() {}

    public static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;

        createChannel(nm, CH_DEFAULT, "Sekai", "Avisos generales",
                NotificationManager.IMPORTANCE_DEFAULT, defaultTone());
        createChannel(nm, CH_MESSAGES, "Mensajes", "Mensajes y chats",
                NotificationManager.IMPORTANCE_HIGH, defaultTone());
        createChannel(nm, CH_SOCIAL, "Social", "Likes, amigos y menciones",
                NotificationManager.IMPORTANCE_DEFAULT, softTone());
    }

    private static void createChannel(NotificationManager nm, String id, String name, String desc,
                                      int importance, Uri sound) {
        NotificationChannel ch = new NotificationChannel(id, name, importance);
        ch.setDescription(desc);
        ch.enableVibration(true);
        if (sound != null) {
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            ch.setSound(sound, aa);
        } else {
            ch.setSound(null, null);
        }
        nm.createNotificationChannel(ch);
    }

    /** Crea o actualiza canal de un chat concreto con tono elegido. */
    public static String ensureChatChannel(Context ctx, String chatId, String toneKey) {
        String channelId = "sekai_chat_" + sanitize(chatId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) {
                // Borrar y recrear si cambió el tono (API no permite editar sonido fácilmente)
                NotificationChannel existing = nm.getNotificationChannel(channelId);
                Uri tone = toneFromKey(toneKey);
                if (existing == null) {
                    createChannel(nm, channelId, "Chat " + chatId, "Tono personalizado del chat",
                            NotificationManager.IMPORTANCE_HIGH, tone);
                }
            }
        }
        return channelId;
    }

    public static void setChatTone(Context ctx, String chatId, String toneKey) {
        String channelId = "sekai_chat_" + sanitize(chatId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) {
                try { nm.deleteNotificationChannel(channelId); } catch (Exception ignored) {}
                createChannel(nm, channelId, "Chat", "Tono del chat",
                        NotificationManager.IMPORTANCE_HIGH, toneFromKey(toneKey));
            }
        }
        ctx.getSharedPreferences("sekai_tones", Context.MODE_PRIVATE)
                .edit().putString("chat_" + sanitize(chatId), toneKey).apply();
    }

    public static String getChatTone(Context ctx, String chatId) {
        return ctx.getSharedPreferences("sekai_tones", Context.MODE_PRIVATE)
                .getString("chat_" + sanitize(chatId), "default");
    }

    public static void notify(Context ctx, String channelKey, String title, String body,
                              String chatId, int notifId) {
        ensureChannels(ctx);
        String channel = CH_DEFAULT;
        if ("message".equals(channelKey) || "messages".equals(channelKey)) {
            if (chatId != null && !chatId.isEmpty()) {
                String tone = getChatTone(ctx, chatId);
                channel = ensureChatChannel(ctx, chatId, tone);
            } else {
                channel = CH_MESSAGES;
            }
        } else if ("social".equals(channelKey)) {
            channel = CH_SOCIAL;
        }

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (chatId != null) open.putExtra("open_chat", chatId);
        PendingIntent pi = PendingIntent.getActivity(
                ctx, notifId, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channel)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title != null ? title : "Sekai")
                .setContentText(body != null ? body : "")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pi);

        try {
            NotificationManagerCompat.from(ctx).notify(notifId, b.build());
        } catch (SecurityException se) {
            // permiso denegado en Android 13+
        }
    }

    private static Uri defaultTone() {
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    }

    private static Uri softTone() {
        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    }

    private static Uri toneFromKey(String key) {
        if (key == null) key = "default";
        switch (key) {
            case "silent":
                return null;
            case "alarm":
                return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            case "ringtone":
                return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            case "soft":
            case "default":
            default:
                return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
    }

    private static String sanitize(String id) {
        if (id == null) return "unknown";
        return id.replaceAll("[^a-zA-Z0-9_\\-]", "_");
    }
}
