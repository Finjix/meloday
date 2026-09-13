"use client";

import { useEffect, useState } from "react";

export function AnimatedAgentMessage({ content, cancelAnimation = false }: { content: string; cancelAnimation?: boolean }) {
  const parts = content.split(/\n+/).filter(Boolean);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (cancelAnimation) return;
    setCount(1);
    if (parts.length <= 1) return;
    const timers = parts.slice(1).map((_, index) => window.setTimeout(() => setCount((current) => Math.max(current, index + 2)), 360 * (index + 1)));
    return () => timers.forEach(window.clearTimeout);
  // parts is derived from the immutable message content for this mounted message.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelAnimation, content]);
  return <div className="message-agent">{parts.slice(0, count).map((part, index) => <p key={`${part}-${index}`}>{part}</p>)}</div>;
}
