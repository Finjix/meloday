import type { ChatMessage } from "@/lib/types";

const conversationStorageKey = "meloday.current-conversation.v1";

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return Boolean(
    typeof message.id === "string" &&
      (message.role === "agent" || message.role === "user") &&
      typeof message.content === "string" &&
      typeof message.createdAt === "string",
  );
}

export function loadConversation() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(conversationStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isChatMessage).slice(-80) : [];
  } catch {
    return [];
  }
}

export function saveConversation(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    conversationStorageKey,
    JSON.stringify(messages.filter(isChatMessage).slice(-80)),
  );
}

export function hasConversationHistory(messages: ChatMessage[]) {
  return messages.some((message) => message.role === "user" && message.content.trim());
}
