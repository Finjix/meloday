import assert from "node:assert/strict";
import test from "node:test";
import {
  loadDiaryEntries,
  savePendingDiary,
  setEntryFavorite,
} from "./storage.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

const localStorage = new MemoryStorage();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage },
});

test.beforeEach(() => {
  localStorage.clear();
});

test("failed audio generation preserves one recoverable diary entry", () => {
  const first = savePendingDiary({
    kind: "written",
    title: "雨停以后",
    content: "今天回家的路上，雨忽然停了。",
    mood: "平静",
  });

  const retried = savePendingDiary(
    {
      kind: "written",
      title: "雨停以后",
      content: "今天回家的路上，雨忽然停了。",
      mood: "平静",
      reply: "我听见了那一小段安静。",
    },
    first.id,
  );

  const entries = loadDiaryEntries();
  assert.equal(entries.length, 1);
  assert.equal(retried.id, first.id);
  assert.equal(entries[0].generationStatus, "audio-pending");
  assert.equal(entries[0].source?.content, "今天回家的路上，雨忽然停了。");
  assert.equal(entries[0].source?.reply, "我听见了那一小段安静。");
});

test("favorite state survives a storage reload", () => {
  const entry = savePendingDiary({
    kind: "written",
    content: "想把这一刻留得久一点。",
  });

  setEntryFavorite(entry.id, true);

  const [stored] = loadDiaryEntries();
  assert.equal(stored.favorite, true);
});
