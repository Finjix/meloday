"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const totalSeconds = Math.floor(value);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 1;
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const syncProgress = () => {
      setCurrentTime(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const markPlaying = () => setPlaying(true);
    const markPaused = () => setPlaying(false);
    const resetAfterEnded = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener("loadedmetadata", syncProgress);
    audio.addEventListener("durationchange", syncProgress);
    audio.addEventListener("timeupdate", syncProgress);
    audio.addEventListener("play", markPlaying);
    audio.addEventListener("pause", markPaused);
    audio.addEventListener("ended", resetAfterEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", syncProgress);
      audio.removeEventListener("durationchange", syncProgress);
      audio.removeEventListener("timeupdate", syncProgress);
      audio.removeEventListener("play", markPlaying);
      audio.removeEventListener("pause", markPaused);
      audio.removeEventListener("ended", resetAfterEnded);
    };
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.volume = 1;
      try { await audio.play(); } catch { setPlaying(false); }
    } else {
      audio.pause();
    }
  };

  const seekToTime = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const boundedTime = Math.min(duration, Math.max(0, nextTime));
    audio.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  };

  const seekToPosition = (clientX: number, bounds: DOMRect) => {
    if (!duration || !bounds.width || !Number.isFinite(clientX) || clientX < bounds.left || clientX > bounds.right) return;
    seekToTime((clientX - bounds.left) / bounds.width * duration);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekToPosition(event.clientX, event.currentTarget.getBoundingClientRect());
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) seekToPosition(event.clientX, event.currentTarget.getBoundingClientRect());
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleProgressClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX >= bounds.left && event.clientX <= bounds.right) seekToPosition(event.clientX, bounds);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!duration) return;
    const displayedTime = Number(event.currentTarget.getAttribute("aria-valuenow"));
    const baseTime = Number.isFinite(displayedTime) ? displayedTime : currentTime;
    if (event.key === "ArrowLeft") seekToTime(baseTime - 5);
    else if (event.key === "ArrowRight") seekToTime(baseTime + 5);
    else if (event.key === "Home") seekToTime(0);
    else if (event.key === "End") seekToTime(duration);
    else return;
    event.preventDefault();
  };

  const progressPercent = duration ? Math.min(100, Math.max(0, currentTime / duration * 100)) : 0;

  return <div className="custom-audio-player">
    <audio ref={audioRef} className="custom-audio-source" preload="metadata" src={src} />
    <button type="button" className="custom-audio-play" onClick={() => void togglePlay()} aria-label={playing ? "暂停播放" : "开始播放"}>{playing ? "❚❚" : "▶"}</button>
    <span className="custom-audio-time" aria-live="off">{formatTime(currentTime)} / {formatTime(duration)}</span>
    <div className="custom-audio-progress-wrap" role="slider" tabIndex={duration ? 0 : -1} aria-label="调整播放进度" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(currentTime)} aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onClick={handleProgressClick} onKeyDown={handleKeyDown}>
      <div className="custom-audio-track" aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></div>
      <span className="custom-audio-progress-thumb" style={{ left: `${progressPercent}%` }} aria-hidden="true" />
    </div>
  </div>;
}
