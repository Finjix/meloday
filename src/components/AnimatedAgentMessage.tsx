"use client";

import { useEffect, useState } from "react";

const CHARACTER_INTERVAL_MS = 70;
const PART_PAUSE_MS = 2000;
const completedMessageIds = new Set<string>();

export function AnimatedAgentMessage({ content, messageId }: { content: string; messageId: string }) {
  const parts = content.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const finalPartIndex = Math.max(parts.length - 1, 0);
  const alreadyCompleted = completedMessageIds.has(messageId);
  const [partIndex, setPartIndex] = useState(alreadyCompleted ? finalPartIndex : 0);
  const [visibleCount, setVisibleCount] = useState(() => alreadyCompleted ? Array.from(parts[finalPartIndex] ?? "").length : 0);
  const activePart = parts[partIndex] ?? "";
  const characters = Array.from(activePart);

  useEffect(() => {
    if (visibleCount < characters.length) {
      const timer = window.setTimeout(() => setVisibleCount((current) => current + 1), CHARACTER_INTERVAL_MS);
      return () => window.clearTimeout(timer);
    }
    if (partIndex < parts.length - 1) {
      const timer = window.setTimeout(() => {
        setVisibleCount(0);
        setPartIndex((current) => current + 1);
      }, PART_PAUSE_MS);
      return () => window.clearTimeout(timer);
    }
    completedMessageIds.add(messageId);
  }, [characters.length, messageId, partIndex, parts.length, visibleCount]);

  return <div className="agent-message"><p>{characters.slice(0, visibleCount).join("")}</p></div>;
}
