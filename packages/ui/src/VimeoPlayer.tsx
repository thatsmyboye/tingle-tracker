"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import VimeoPlayerSDK from "@vimeo/player";
import type { PlayerAdapterRef } from "@tingle/types";
import { cn } from "./lib/cn";

// =============================================================================
// Public ref API — satisfies PlayerAdapterRef from @tingle/types
// Vimeo's SDK returns Promises, so all position/duration reads are async.
// =============================================================================

export interface VimeoPlayerRef extends PlayerAdapterRef {}

// =============================================================================
// Props
// =============================================================================

export interface VimeoPlayerProps {
  /** Vimeo numeric or string video ID (e.g. "123456789") */
  videoId: string;
  onReady?: () => void;
  onStateChange?: (playing: boolean) => void;
  onError?: (message: string) => void;
  autoplay?: boolean;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export const VimeoPlayer = forwardRef<VimeoPlayerRef, VimeoPlayerProps>(
  function VimeoPlayer(
    { videoId, onReady, onStateChange, onError, autoplay = false, className },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<VimeoPlayerSDK | null>(null);
    const onReadyRef = useRef(onReady);
    const onStateChangeRef = useRef(onStateChange);
    const onErrorRef = useRef(onError);

    useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
    useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    useImperativeHandle(ref, (): VimeoPlayerRef => ({
      getCurrentTimeMs: async () => {
        if (!playerRef.current) return 0;
        const seconds = await playerRef.current.getCurrentTime();
        return seconds * 1000;
      },
      getDurationMs: async () => {
        if (!playerRef.current) return 0;
        const seconds = await playerRef.current.getDuration();
        return seconds * 1000;
      },
      pause: () => { playerRef.current?.pause(); },
      play: () => { playerRef.current?.play(); },
      seekToMs: (ms: number) => { playerRef.current?.setCurrentTime(ms / 1000); },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const player = new VimeoPlayerSDK(containerRef.current, {
        id: videoId,
        responsive: true,
        autoplay,
        byline: false,
        title: false,
        portrait: false,
        dnt: true,
      });

      playerRef.current = player;

      player.ready().then(() => {
        onReadyRef.current?.();
      });

      player.on("play", () => onStateChangeRef.current?.(true));
      player.on("pause", () => onStateChangeRef.current?.(false));
      player.on("ended", () => onStateChangeRef.current?.(false));
      player.on("error", (e) => onErrorRef.current?.(e.message));

      return () => {
        player.destroy();
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-black", className)}>
        <div ref={containerRef} className="h-full w-full" />
      </div>
    );
  }
);
