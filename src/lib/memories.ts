import type { CompanionMemory } from "@/lib/types";

const memoryStorageKey = "meloday.companion-memories.v1";
const memoryLimit = 24;

function normalizeMemory(value: unknown): CompanionMemory | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Partial<CompanionMemory>;
  const text = typeof input.text === "string" ? input.text.trim().slice(0, 100) : "";
  if (!text) return undefined;

  return {
    id:
      typeof input.id === "string" && input.id
        ? input.id
        : "memory_" + Date.now() + "_" + Math.random().toString(36).slice(2),
    text,
    useInResponses: input.useInResponses === true,
    createdAt:
      typeof input.createdAt === "string" && input.createdAt
        ? input.createdAt
        : new Date().toISOString(),
  };
}

export function loadCompanionMemories() {
  if (typeof window === "undefined") return [] as CompanionMemory[];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(memoryStorageKey) || "[]");
    return Array.isArray(parsed)
      ? parsed.map(normalizeMemory).filter((item): item is CompanionMemory => Boolean(item)).slice(0, memoryLimit)
      : [];
  } catch {
    return [];
  }
}

export function saveCompanionMemories(memories: CompanionMemory[]) {
  if (typeof window === "undefined") return;
  const normalized = memories
    .map(normalizeMemory)
    .filter((item): item is CompanionMemory => Boolean(item))
    .slice(0, memoryLimit);
  window.localStorage.setItem(memoryStorageKey, JSON.stringify(normalized));
}

export function addCompanionMemory(text: string) {
  const normalizedText = text.trim().slice(0, 100);
  if (!normalizedText) return loadCompanionMemories();

  const current = loadCompanionMemories();
  if (current.some((memory) => memory.text === normalizedText)) return current;

  const next: CompanionMemory[] = [
    {
      id: "memory_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      text: normalizedText,
      useInResponses: false,
      createdAt: new Date().toISOString(),
    },
    ...current,
  ].slice(0, memoryLimit);
  saveCompanionMemories(next);
  return next;
}

export function companionMemoriesForResponses() {
  return loadCompanionMemories()
    .filter((memory) => memory.useInResponses)
    .slice(0, 12)
    .map((memory) => memory.text);
}


export function setCompanionMemoryUsage(id: string, useInResponses: boolean) {
  const next = loadCompanionMemories().map((memory) =>
    memory.id === id ? { ...memory, useInResponses } : memory,
  );
  saveCompanionMemories(next);
  return next;
}
export function deleteCompanionMemory(id: string) {
  const next = loadCompanionMemories().filter((memory) => memory.id !== id);
  saveCompanionMemories(next);
  return next;
}
