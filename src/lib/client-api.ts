import type {
  AgentStreamLine,
  AgentStreamMeta,
  ApiKeys,
  CardPayload,
  ChatMessage,
  GeneratedCard,
} from "@/lib/types";
import { createCoverBlob } from "@/lib/media";

const apiSettingsStorageKey = "meloday.api-settings.v1";

function readApiKeys(): ApiKeys | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(apiSettingsStorageKey) || "{}");
    return {
      deepseekApiKey:
        typeof parsed.deepseekApiKey === "string" ? parsed.deepseekApiKey.trim() : undefined,
      minimaxApiKey:
        typeof parsed.minimaxApiKey === "string" ? parsed.minimaxApiKey.trim() : undefined,
    };
  } catch {
    return undefined;
  }
}

function hexToBlob(hex: string, mimeType: string) {
  const normalized = hex.trim();
  if (normalized.length % 2 !== 0) {
    throw new Error("Audio data is not valid hex.");
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    const value = Number.parseInt(normalized.slice(index, index + 2), 16);
    if (Number.isNaN(value)) {
      throw new Error("Audio data is not valid hex.");
    }
    bytes[index / 2] = value;
  }

  return new Blob([bytes], { type: mimeType || "audio/mpeg" });
}

async function materializeCard(payload: CardPayload): Promise<GeneratedCard> {
  const [audioBlob, coverBlob] = await Promise.all([
    Promise.resolve(hexToBlob(payload.audioHex, payload.audioMimeType)),
    createCoverBlob(payload.coverMeta, payload.title, payload.coverSeed),
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

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function requestAgentTurn(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
) {
  const response = await fetch("/api/agent-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, apiKeys: readApiKeys() }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Agent response failed."));
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
    body: JSON.stringify({ messages, apiKeys: readApiKeys() }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Card generation failed."));
  }

  return materializeCard((await response.json()) as CardPayload);
}

export async function requestCardRegeneration(card: CardPayload, feedback: string) {
  const response = await fetch("/api/regenerate-diary-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card, feedback, apiKeys: readApiKeys() }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Regeneration failed."));
  }

  return materializeCard((await response.json()) as CardPayload);
}
