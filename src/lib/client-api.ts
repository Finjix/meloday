import type {
  AgentStreamLine,
  AgentStreamMeta,
  CardPayload,
  ChatMessage,
  GeneratedCard,
} from "@/lib/types";
import { createMockAudioBlob, createMockCoverBlob } from "@/lib/media";

async function materializeCard(payload: CardPayload): Promise<GeneratedCard> {
  const [audioBlob, coverBlob] = await Promise.all([
    Promise.resolve(createMockAudioBlob(payload.audioSeed)),
    createMockCoverBlob(payload.coverMeta, payload.title, payload.coverSeed),
  ]);

  return {
    ...payload,
    audioBlob,
    coverBlob,
    audioUrl: URL.createObjectURL(audioBlob),
    coverUrl: URL.createObjectURL(coverBlob),
  };
}

function parseStreamLine(line: string): AgentStreamLine | undefined {
  if (!line.trim()) return undefined;
  return JSON.parse(line) as AgentStreamLine;
}

export async function requestAgentTurn(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
) {
  const response = await fetch("/api/agent-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error("Agent response failed.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming is not available.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let meta: AgentStreamMeta | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const event = parseStreamLine(line);
      if (event?.type === "meta") {
        meta = { action: event.action, collected: event.collected };
      }
      if (event?.type === "delta") {
        onDelta(event.text);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (buffer.trim()) {
    const event = parseStreamLine(buffer);
    if (event?.type === "delta") onDelta(event.text);
  }

  if (!meta) {
    throw new Error("Agent stream did not include metadata.");
  }

  return meta;
}

export async function requestCardGeneration(messages: ChatMessage[]) {
  const response = await fetch("/api/generate-diary-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error("Card generation failed.");
  }

  return materializeCard((await response.json()) as CardPayload);
}

export async function requestCardRegeneration(card: CardPayload, feedback: string) {
  const response = await fetch("/api/regenerate-diary-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card, feedback }),
  });

  if (!response.ok) {
    throw new Error("Regeneration failed.");
  }

  return materializeCard((await response.json()) as CardPayload);
}
