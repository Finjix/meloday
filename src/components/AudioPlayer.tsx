"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type AudioPlayerProps = {
  src?: string;
  label?: string;
  autoPlay?: boolean;
  persistenceKey?: string;
  artworkUrl?: string;
};

const positionStoragePrefix = "meloday.audio-position.v1:";

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return minutes + ":" + seconds;
}

function readSavedPosition(key?: string) {
  if (!key || typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(positionStoragePrefix + key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function syncMediaPosition(audio: HTMLAudioElement) {
  if (
    typeof navigator === "undefined" ||
    !("mediaSession" in navigator) ||
    !Number.isFinite(audio.duration) ||
    audio.duration <= 0
  ) {
    return;
  }

  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate,
      position: Math.min(audio.currentTime, audio.duration),
    });
  } catch {
    // Media controls are an enhancement; in-page playback remains available.
  }
}

export function AudioPlayer({
  src,
  label = "今日器乐",
  autoPlay = false,
  persistenceKey,
  artworkUrl,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastStoredSecondRef = useRef(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const rememberPosition = useCallback((value: number, force = false) => {
    if (!persistenceKey || typeof window === "undefined") return;
    const second = Math.floor(value);
    if (!force && Math.abs(second - lastStoredSecondRef.current) < 5) return;

    try {
      window.localStorage.setItem(positionStoragePrefix + persistenceKey, String(value));
      lastStoredSecondRef.current = second;
    } catch {
      // Playback remains available when browser storage is unavailable.
    }
  }, [persistenceKey]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio && audio.currentTime > 0 && !audio.ended) {
        rememberPosition(audio.currentTime, true);
      }
    };
  }, [rememberPosition, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src || !autoPlay) return;

    void audio.play().catch(() => setIsPlaying(false));
  }, [autoPlay, src]);

  const activateMediaSession = useCallback((audio: HTMLAudioElement) => {
    if (
      !src ||
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined"
    ) {
      return;
    }

    const mediaSession = navigator.mediaSession;
    mediaSession.metadata = new MediaMetadata({
      title: label,
      artist: "Meloday",
      album: "声音日记",
      artwork: artworkUrl ? [{ src: artworkUrl }] : undefined,
    });

    const moveTo = (value: number) => {
      const limit = Number.isFinite(audio.duration) ? audio.duration : value;
      const next = Math.max(0, Math.min(limit, value));
      audio.currentTime = next;
      setCurrentTime(next);
      rememberPosition(next, true);
      syncMediaPosition(audio);
    };

    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose Media Session without supporting every action.
      }
    };

    setHandler("play", () => void audio.play());
    setHandler("pause", () => audio.pause());
    setHandler("seekbackward", (details) => {
      moveTo(audio.currentTime - (details.seekOffset ?? 15));
    });
    setHandler("seekforward", (details) => {
      moveTo(audio.currentTime + (details.seekOffset ?? 15));
    });
    setHandler("seekto", (details) => {
      if (typeof details.seekTime !== "number") return;
      if (details.fastSeek && "fastSeek" in audio) {
        audio.fastSeek(details.seekTime);
        return;
      }
      moveTo(details.seekTime);
    });
    setHandler("stop", () => {
      audio.pause();
      moveTo(0);
    });
    syncMediaPosition(audio);
  }, [artworkUrl, label, rememberPosition, src]);

  useEffect(() => {
    return () => {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      const mediaSession = navigator.mediaSession;
      const actions: MediaSessionAction[] = [
        "play",
        "pause",
        "seekbackward",
        "seekforward",
        "seekto",
        "stop",
      ];
      actions.forEach((action) => {
        try {
          mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore unsupported actions during cleanup.
        }
      });
      mediaSession.playbackState = "none";
    };
  }, [src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = Math.max(0, Math.min(duration, value));
    audio.currentTime = next;
    setCurrentTime(next);
    rememberPosition(next, true);
  }

  function jumpBy(seconds: number) {
    seekTo(currentTime + seconds);
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="audio-player">
      <audio
        key={src}
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          const saved = readSavedPosition(persistenceKey);
          const nextTime = saved > 0 && saved < nextDuration - 3 ? saved : 0;
          event.currentTarget.currentTime = nextTime;
          setCurrentTime(nextTime);
          setDuration(nextDuration);
          setIsPlaying(false);
          lastStoredSecondRef.current = Math.floor(nextTime);
          syncMediaPosition(event.currentTarget);
        }}
        onTimeUpdate={(event) => {
          const nextTime = event.currentTarget.currentTime;
          setCurrentTime(nextTime);
          rememberPosition(nextTime);
          syncMediaPosition(event.currentTarget);
        }}
        onPlay={(event) => {
          setIsPlaying(true);
          activateMediaSession(event.currentTarget);
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        }}
        onPause={(event) => {
          setIsPlaying(false);
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "paused";
          }
          if (!event.currentTarget.ended) {
            rememberPosition(event.currentTarget.currentTime, true);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "none";
          }
          if (persistenceKey) {
            window.localStorage.removeItem(positionStoragePrefix + persistenceKey);
          }
        }}
      />

      <div className="audio-player__top">
        <span>{label}</span>
        <time>
          {formatTime(currentTime)} / {formatTime(duration)}
        </time>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(event) => seekTo(Number(event.target.value))}
        disabled={!src || !duration}
        aria-label={"调整《" + label + "》的播放进度"}
        className="audio-player__timeline"
        style={{
          background:
            "linear-gradient(90deg, #6f9f90 0%, #6f9f90 " +
            progress +
            "%, rgba(77, 105, 95, .15) " +
            progress +
            "%, rgba(77, 105, 95, .15) 100%)",
        }}
      />

      <div className="audio-player__controls">
        <button
          type="button"
          onClick={() => jumpBy(-15)}
          disabled={!src}
          aria-label="后退十五秒"
          className="audio-player__skip"
        >
          <RotateCcw size={19} />
          <span>15</span>
        </button>
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!src}
          aria-label={isPlaying ? "暂停声音" : "播放声音"}
          className="audio-player__play"
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <button
          type="button"
          onClick={() => jumpBy(15)}
          disabled={!src}
          aria-label="前进十五秒"
          className="audio-player__skip"
        >
          <RotateCw size={19} />
          <span>15</span>
        </button>
      </div>
    </div>
  );
}
