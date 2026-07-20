import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  hasConversationHistory,
  loadConversation,
  saveConversation,
} from "./conversation.ts";

const values = new Map<string, string>();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    },
  },
});

beforeEach(() => values.clear());

test("conversation survives a save and load cycle", () => {
  const messages = [
    {
      id: "agent_1",
      role: "agent" as const,
      content: "我在听。",
      createdAt: "2026-07-16T00:00:00.000Z",
    },
    {
      id: "user_1",
      role: "user" as const,
      content: "今天有点累。",
      createdAt: "2026-07-16T00:00:01.000Z",
    },
  ];

  saveConversation(messages);
  assert.deepEqual(loadConversation(), messages);
  assert.equal(hasConversationHistory(loadConversation()), true);
});

test("invalid messages are ignored and history is capped", () => {
  const messages = Array.from({ length: 90 }, (_, index) => ({
    id: "user_" + index,
    role: "user" as const,
    content: "片段 " + index,
    createdAt: new Date(index * 1000).toISOString(),
  }));

  saveConversation(messages);
  const restored = loadConversation();
  assert.equal(restored.length, 80);
  assert.equal(restored[0]?.id, "user_10");
});
