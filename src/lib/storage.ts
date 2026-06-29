import { openDB } from "idb";
import type { DiaryEntry, GeneratedCard } from "@/lib/types";

const entriesKey = "meloday.entries.v1";
const dbName = "meloday-media-v1";
const storeName = "blobs";

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Local storage is only available in the browser.");
  }
}

function readEntriesRaw(): DiaryEntry[] {
  assertBrowser();
  const raw = window.localStorage.getItem(entriesKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: DiaryEntry[]) {
  assertBrowser();
  window.localStorage.setItem(entriesKey, JSON.stringify(entries));
}

async function getDb() {
  assertBrowser();
  return openDB(dbName, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    },
  });
}

export function loadDiaryEntries() {
  return readEntriesRaw().sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export async function putMediaBlob(id: string, blob: Blob) {
  const db = await getDb();
  await db.put(storeName, blob, id);
}

export async function getMediaBlob(id: string) {
  const db = await getDb();
  return (await db.get(storeName, id)) as Blob | undefined;
}

export async function deleteMediaBlob(id: string) {
  const db = await getDb();
  await db.delete(storeName, id);
}

export async function saveGeneratedCard(card: GeneratedCard) {
  const audioBlobId = `${card.id}:audio`;
  const coverBlobId = `${card.id}:cover`;
  await putMediaBlob(audioBlobId, card.audioBlob);
  await putMediaBlob(coverBlobId, card.coverBlob);

  const entry: DiaryEntry = {
    id: card.id,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    date: card.date,
    title: card.title,
    summary: card.summary,
    fullDiary: card.fullDiary,
    audioBlobId,
    coverBlobId,
    coverMeta: card.coverMeta,
  };

  const entries = [entry, ...readEntriesRaw().filter((item) => item.id !== entry.id)];
  writeEntries(entries);
  return entry;
}

export async function updateEntryWithGeneratedCard(entry: DiaryEntry, card: GeneratedCard) {
  const audioBlobId = `${entry.id}:audio:${Date.now()}`;
  const coverBlobId = `${entry.id}:cover:${Date.now()}`;
  await putMediaBlob(audioBlobId, card.audioBlob);
  await putMediaBlob(coverBlobId, card.coverBlob);

  const nextEntry: DiaryEntry = {
    ...entry,
    updatedAt: new Date().toISOString(),
    title: card.title,
    summary: card.summary,
    fullDiary: card.fullDiary,
    audioBlobId,
    coverBlobId,
    coverMeta: card.coverMeta,
  };

  const entries = readEntriesRaw().map((item) =>
    item.id === entry.id ? nextEntry : item,
  );
  writeEntries(entries);
  await deleteMediaBlob(entry.audioBlobId);
  await deleteMediaBlob(entry.coverBlobId);
  return nextEntry;
}

export function renameEntry(entryId: string, title: string) {
  const entries = readEntriesRaw().map((entry) =>
    entry.id === entryId
      ? { ...entry, title: title.trim() || entry.title, updatedAt: new Date().toISOString() }
      : entry,
  );
  writeEntries(entries);
}

export async function deleteEntry(entry: DiaryEntry) {
  writeEntries(readEntriesRaw().filter((item) => item.id !== entry.id));
  await deleteMediaBlob(entry.audioBlobId);
  await deleteMediaBlob(entry.coverBlobId);
}
