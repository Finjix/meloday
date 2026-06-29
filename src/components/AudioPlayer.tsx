"use client";

import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";

type AudioPlayerProps = {
  src?: string;
  label?: string;
};

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function AudioPlayer({ src, label = "今日器乐" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="rounded-[8px] border border-[#dfe6df] bg-white/82 p-3 shadow-sm">
      <audio
        key={src}
        ref={audioRef}
        src={src}
        preload="auto"
        onLoadedMetadata={(event) => {
          setCurrentTime(0);
          setDuration(event.currentTarget.duration);
          setIsPlaying(false);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!src}
          aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
          title={isPlaying ? "暂停音乐" : "播放音乐"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#263d3a] text-white transition hover:bg-[#1b2d2b] disabled:cursor-not-allowed disabled:bg-[#aeb8b2]"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-xs text-[#68736f]">
            <span className="truncate font-medium text-[#263d3a]">{label}</span>
            <span className="shrink-0 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dfe6df]">
            <div
              className="h-full rounded-full bg-[#d47d6a] transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
