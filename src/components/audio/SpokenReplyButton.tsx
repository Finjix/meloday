"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CompanionPreferences } from "@/lib/types";

type SpokenReplyButtonProps = {
  text: string;
  soundStyle?: CompanionPreferences["soundStyle"];
  compact?: boolean;
};

const speechEventName = "meloday:speech-start";

export function SpokenReplyButton({
  text,
  soundStyle = "warm",
  compact = false,
}: SpokenReplyButtonProps) {
  const id = useId();
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    function handleOtherSpeech(event: Event) {
      const speechEvent = event as CustomEvent<{ id?: string }>;
      if (speechEvent.detail?.id !== id) setIsPlaying(false);
    }

    window.addEventListener(speechEventName, handleOtherSpeech);
    return () => {
      window.removeEventListener(speechEventName, handleOtherSpeech);
      if (
        utteranceRef.current &&
        "speechSynthesis" in window &&
        window.speechSynthesis.speaking
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, [id]);

  function togglePlayback() {
    if (
      !text.trim() ||
      !("speechSynthesis" in window && "SpeechSynthesisUtterance" in window)
    ) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent(speechEventName, { detail: { id } }));

    const utterance = new SpeechSynthesisUtterance(text.trim());
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) => voice.lang.toLowerCase() === "zh-cn") ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) ??
      null;
    utterance.lang = "zh-CN";
    utterance.rate = soundStyle === "clear" ? 0.98 : soundStyle === "deep" ? 0.82 : 0.9;
    utterance.pitch = soundStyle === "clear" ? 1.04 : soundStyle === "deep" ? 0.88 : 0.96;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    utteranceRef.current = utterance;
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  if (!text.trim()) return null;

  return (
    <button
      type="button"
      onClick={togglePlayback}
      className={"spoken-reply" + (compact ? " spoken-reply--compact" : "")}
      aria-label={isPlaying ? "停止播放这段回应" : "播放这段回应"}
      aria-pressed={isPlaying}
    >
      {isPlaying ? <Square size={14} fill="currentColor" /> : <Volume2 size={16} />}
      <span>{isPlaying ? "停止" : "听这段回应"}</span>
    </button>
  );
}
