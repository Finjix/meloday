import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  addCompanionMemory,
  companionMemoriesForResponses,
  deleteCompanionMemory,
  loadCompanionMemories,
  setCompanionMemoryUsage,
} from "./memories.ts";

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

test("new memories remain local by default", () => {
  const [memory] = addCompanionMemory("我最近在准备考试");
  assert.equal(memory?.text, "我最近在准备考试");
  assert.equal(memory?.useInResponses, false);
  assert.deepEqual(companionMemoriesForResponses(), []);
});

test("memory usage requires an explicit toggle", () => {
  const [memory] = addCompanionMemory("我不喜欢太吵的音乐");
  assert.ok(memory);

  setCompanionMemoryUsage(memory.id, true);
  assert.equal(loadCompanionMemories()[0]?.useInResponses, true);
  assert.deepEqual(companionMemoriesForResponses(), ["我不喜欢太吵的音乐"]);

  deleteCompanionMemory(memory.id);
  assert.equal(loadCompanionMemories().length, 0);
  assert.deepEqual(companionMemoriesForResponses(), []);
});
