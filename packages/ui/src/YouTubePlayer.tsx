"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";
import type { PlayerAdapterRef } from "@tingle/types";
import { cn } from "./lib/cn";

// =============================================================================
// YouTube IFrame Player API types (subset)
// =============================================================================

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, config: YTPlayerConfig) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YTPlayerConfig {
  videoId: string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
    origin?: string;
  };
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number }) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

// =============================================================================
// Public ref API — satisfies PlayerAdapterRef from @tingle/types
// =============================================================================

export interface YouTubePlayerRef extends PlayerAdapterRef {}

// =============================================================================
// Props
// =============================================================================

export interface YouTubePlayerProps {
  videoId: string;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
  onError?: (errorCode: number) => void;
  autoplay?: boolean;
  className?: string;
}

// =============================================================================
// Script loader — loads the YT IFrame API once per page
// =============================================================================

let apiLoaded = false;
const apiReadyCallbacks: Array<() => void> = [];

function loadYouTubeApi(onReady: () => void): void {
  if (typeof window === "undefined") return;

  if (apiLoaded && window.YT?.Player) {
    onReady();
    return;
  }

  apiReadyCallbacks.push(onReady);

  if (document.getElementById("youtube-iframe-api")) return;

  const prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    apiLoaded = true;
    prevReady?.();
    for (const cb of apiReadyCallbacks.splice(0)) cb();
  };

  const script = document.createElement("script");
  script.id = "youtube-iframe-api";
  script.src = "https://www.youtube.com/iframe_api";
  script.async = true;
  document.head.appendChild(script);
}

// =============================================================================
// Component
// =============================================================================

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, onReady, onStateChange, onError, autoplay = false, className },
    ref
  ) {
    const uid = useId();
    const containerId = `yt-player-${uid.replace(/:/g, "")}`;
    const playerRef = useRef<YTPlayer | null>(null);
    const onReadyRef = useRef(onReady);
    const onStateChangeRef = useRef(onStateChange);
    const onErrorRef = useRef(onError);

    // Keep callback refs up to date without re-running the effect
    useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
    useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    useImperativeHandle(ref, (): YouTubePlayerRef => ({
      getCurrentTimeMs: () => Promise.resolve((playerRef.current?.getCurrentTime() ?? 0) * 1000),
      getDurationMs: () => Promise.resolve((playerRef.current?.getDuration() ?? 0) * 1000),
      pause: () => playerRef.current?.pauseVideo(),
      play: () => playerRef.current?.playVideo(),
      seekToMs: (ms: number) => playerRef.current?.seekTo(ms / 1000, true),
    }));

    useEffect(() => {
      let destroyed = false;

      loadYouTubeApi(() => {
        if (destroyed) return;

        playerRef.current = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: () => onReadyRef.current?.(),
            onStateChange: (e) => onStateChangeRef.current?.(e.data),
            onError: (e) => onErrorRef.current?.(e.data),
          },
        });
      });

      return () => {
        destroyed = true;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-black", className)}>
        <div id={containerId} className="h-full w-full" />
      </div>
    );
  }
);
