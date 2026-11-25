package ro.autocare.tracking;

import android.content.Context;
import android.media.*;
import android.os.*;
import android.speech.tts.*;
import java.util.Locale;

final class NavigationVoice {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AudioManager audio;
    private final AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
    private final AudioManager.OnAudioFocusChangeListener listener = change -> {
        if (change < 0) main.post(this::stop);
    };
    private final AudioFocusRequest focus;
    private final TextToSpeech engine;
    private boolean ready, closed;
    private String playing;
    private int sequence;

    NavigationVoice(Context context, boolean english) {
        audio = context.getSystemService(AudioManager.class);
        focus = Build.VERSION.SDK_INT >= 26 ? new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(attributes).setOnAudioFocusChangeListener(listener).build() : null;
        engine = new TextToSpeech(context, status -> main.post(() -> initialize(status, english)));
    }

    private void initialize(int status, boolean english) {
        if (closed || status != TextToSpeech.SUCCESS) return;
        Locale language = Locale.forLanguageTag(english ? "en-GB" : "ro-RO");
        if (engine.setLanguage(language) < 0) return;
        java.util.Set<Voice> voices = engine.getVoices();
        if (voices != null) voices.stream().filter(v -> !v.isNetworkConnectionRequired()
            && language.getLanguage().equals(v.getLocale().getLanguage()))
            .max(java.util.Comparator.comparingInt(Voice::getQuality)).ifPresent(engine::setVoice);
        engine.setAudioAttributes(attributes);
        engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { main.post(() -> release(id)); }
            @Override public void onError(String id) { main.post(() -> release(id)); }
        });
        ready = true;
    }

    boolean speak(String text) {
        if (!ready || closed) return false;
        stop();
        int granted = focus != null ? audio.requestAudioFocus(focus)
            : audio.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        if (granted != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) return false;
        playing = Integer.toString(++sequence);
        if (engine.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), playing) == TextToSpeech.SUCCESS) return true;
        release(playing);
        return false;
    }

    private void release(String id) {
        if (id == null || !id.equals(playing)) return;
        playing = null;
        if (focus != null) audio.abandonAudioFocusRequest(focus);
        else audio.abandonAudioFocus(listener);
    }

    void stop() {
        if (playing == null) return;
        engine.stop();
        release(playing);
    }

    void close() {
        stop();
        closed = true;
        engine.shutdown();
    }
}
