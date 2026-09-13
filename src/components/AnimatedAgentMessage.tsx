"use client";

import { useEffect, useState } from "react";

const CHARACTER_INTERVAL_MS = 70;

export function AnimatedAgentMessage({ content }: { content: string }) {
  const characters = Array.from(content);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!characters.length) return;
    const timer = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= characters.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, CHARACTER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  // characters is derived from the immutable message content for this mounted message.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const visibleContent = characters.slice(0, visibleCount).join("");
  const parts = visibleContent.split(/\n+/).filter(Boolean);
  return <div className="agent-message">{parts.map((part, index) => <p key={`${part}-${index}`}>{part}</p>)}</div>;
}
