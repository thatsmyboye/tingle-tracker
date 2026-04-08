import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { PlayerAdapterRef } from "@tingle/types";

// =============================================================================
// YouTubePlayerView — mobile (WebView bridge)
// Loads a custom HTML page that embeds the YouTube IFrame API.
// Communicates via postMessage with request-ID correlation for async reads.
// =============================================================================

export interface YouTubePlayerViewRef extends PlayerAdapterRef {}

interface YouTubePlayerViewProps {
  videoId: string;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
}

// ---- postMessage protocol ---------------------------------------------------
// App → WebView: { type, requestId?, ms? }
// WebView → App: { type, requestId?, value? }

type PendingRequest = {
  resolve: (value: number) => void;
  reject: (reason: Error) => void;
};

let requestCounter = 0;

// ---- HTML template ----------------------------------------------------------

function buildHtml(videoId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#000; overflow:hidden; }
    #player { width:100%; height:100%; }
  </style>
</head>
<body>
<div id="player"></div>
<script>
  var player;
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
      videoId: '${videoId}',
      width: '100%',
      height: '100%',
      playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        },
        onStateChange: function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stateChange', data: e.data }));
        }
      }
    });
  }

  function handleMessage(raw) {
    try {
      var msg = JSON.parse(raw.data);
      if (msg.type === 'getCurrentTime') {
        var t = player ? player.getCurrentTime() : 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'currentTime', requestId: msg.requestId, value: t * 1000 }));
      } else if (msg.type === 'getDuration') {
        var d = player ? player.getDuration() : 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'duration', requestId: msg.requestId, value: d * 1000 }));
      } else if (msg.type === 'pause') {
        if (player) player.pauseVideo();
      } else if (msg.type === 'play') {
        if (player) player.playVideo();
      } else if (msg.type === 'seekTo') {
        if (player) player.seekTo(msg.ms / 1000, true);
      }
    } catch(e) {}
  }

  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);
</script>
</body>
</html>`;
}

// =============================================================================
// Component
// =============================================================================

export const YouTubePlayerView = forwardRef<
  YouTubePlayerViewRef,
  YouTubePlayerViewProps
>(function YouTubePlayerView({ videoId, onReady, onStateChange }, ref) {
  const webViewRef = useRef<WebView>(null);
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());

  function postToWebView(msg: object) {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }

  function requestValue(type: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const requestId = `${type}_${++requestCounter}`;
      const timeout = setTimeout(() => {
        pendingRequests.current.delete(requestId);
        reject(new Error(`Timeout waiting for ${type}`));
      }, 2000);

      pendingRequests.current.set(requestId, {
        resolve: (v) => { clearTimeout(timeout); resolve(v); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });

      postToWebView({ type, requestId });
    });
  }

  useImperativeHandle(ref, (): YouTubePlayerViewRef => ({
    getCurrentTimeMs: () => requestValue("getCurrentTime"),
    getDurationMs: () => requestValue("getDuration"),
    pause: () => postToWebView({ type: "pause" }),
    play: () => postToWebView({ type: "play" }),
    seekToMs: (ms: number) => postToWebView({ type: "seekTo", ms }),
  }));

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type: string;
        requestId?: string;
        data?: number;
        value?: number;
      };

      if (msg.type === "ready") {
        onReady?.();
      } else if (msg.type === "stateChange") {
        onStateChange?.(msg.data ?? -1);
      } else if (
        (msg.type === "currentTime" || msg.type === "duration") &&
        msg.requestId
      ) {
        const pending = pendingRequests.current.get(msg.requestId);
        if (pending) {
          pendingRequests.current.delete(msg.requestId);
          pending.resolve(msg.value ?? 0);
        }
      }
    } catch {
      // malformed message — ignore
    }
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: buildHtml(videoId) }}
        style={styles.webview}
        onMessage={handleMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        originWhitelist={["*"]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { aspectRatio: 16 / 9, width: "100%", backgroundColor: "#000" },
  webview: { flex: 1 },
});
