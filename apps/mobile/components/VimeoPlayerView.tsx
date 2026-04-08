import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { PlayerAdapterRef } from "@tingle/types";

// =============================================================================
// VimeoPlayerView — mobile (WebView bridge)
// Loads the Vimeo Player SDK inside a WebView.
// Uses the same postMessage / request-ID protocol as YouTubePlayerView.
// Vimeo's SDK is fully async so getCurrentTime returns a Promise internally.
// =============================================================================

export interface VimeoPlayerViewRef extends PlayerAdapterRef {}

interface VimeoPlayerViewProps {
  videoId: string;
  onReady?: () => void;
  onStateChange?: (playing: boolean) => void;
}

type PendingRequest = {
  resolve: (value: number) => void;
  reject: (reason: Error) => void;
};

let requestCounter = 0;

function buildHtml(videoId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#000; overflow:hidden; }
    iframe { width:100% !important; height:100% !important; border:none; }
  </style>
</head>
<body>
<div id="player"></div>
<script src="https://player.vimeo.com/api/player.js"></script>
<script>
  var player = new Vimeo.Player('player', {
    id: ${videoId},
    responsive: true,
    byline: false,
    title: false,
    portrait: false,
    dnt: true
  });

  player.ready().then(function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  });

  player.on('play', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stateChange', playing: true }));
  });
  player.on('pause', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stateChange', playing: false }));
  });
  player.on('ended', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stateChange', playing: false }));
  });

  function handleMessage(raw) {
    try {
      var msg = JSON.parse(raw.data);
      if (msg.type === 'getCurrentTime') {
        player.getCurrentTime().then(function(seconds) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'currentTime', requestId: msg.requestId, value: seconds * 1000 }));
        });
      } else if (msg.type === 'getDuration') {
        player.getDuration().then(function(seconds) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'duration', requestId: msg.requestId, value: seconds * 1000 }));
        });
      } else if (msg.type === 'pause') {
        player.pause();
      } else if (msg.type === 'play') {
        player.play();
      } else if (msg.type === 'seekTo') {
        player.setCurrentTime(msg.ms / 1000);
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

export const VimeoPlayerView = forwardRef<
  VimeoPlayerViewRef,
  VimeoPlayerViewProps
>(function VimeoPlayerView({ videoId, onReady, onStateChange }, ref) {
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

  useImperativeHandle(ref, (): VimeoPlayerViewRef => ({
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
        playing?: boolean;
        value?: number;
      };

      if (msg.type === "ready") {
        onReady?.();
      } else if (msg.type === "stateChange") {
        onStateChange?.(msg.playing ?? false);
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
