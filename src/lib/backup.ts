import {
  getMediaBlob,
  mergeDiaryEntries,
  putMediaBlob,
} from "@/lib/storage";
import {
  normalizeCompanionPreferences,
  saveCompanionPreferences,
} from "@/lib/preferences";
import {
  loadCompanionMemories,
  saveCompanionMemories,
} from "@/lib/memories";
import type {
  CompanionMemory,
  CompanionPreferences,
  DiaryEntry,
} from "@/lib/types";

type EncodedBlob = {
  type: string;
  base64: string;
};

type ArchivedEntry = {
  entry: DiaryEntry;
  audio?: EncodedBlob;
  cover?: EncodedBlob;
};

type MelodayArchive = {
  format: "meloday-archive";
  version: 2;
  exportedAt: string;
  preferences: CompanionPreferences;
  memories: CompanionMemory[];
  entries: ArchivedEntry[];
};

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取声音文件失败。"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(encoded: EncodedBlob) {
  const binary = window.atob(encoded.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: encoded.type || "application/octet-stream" });
}

function isDiaryEntry(value: unknown): value is DiaryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<DiaryEntry>;
  return Boolean(
    typeof entry.id === "string" &&
      typeof entry.createdAt === "string" &&
      typeof entry.updatedAt === "string" &&
      typeof entry.date === "string" &&
      typeof entry.title === "string" &&
      typeof entry.summary === "string" &&
      typeof entry.fullDiary === "string" &&
      typeof entry.audioBlobId === "string" &&
      typeof entry.coverBlobId === "string" &&
      entry.coverMeta &&
      typeof entry.coverMeta === "object",
  );
}

function isEncodedBlob(value: unknown): value is EncodedBlob {
  if (!value || typeof value !== "object") return false;
  const encoded = value as Partial<EncodedBlob>;
  return (
    typeof encoded.type === "string" &&
    typeof encoded.base64 === "string" &&
    encoded.base64.length <= 80_000_000
  );
}

export async function createMelodayArchive(
  entries: DiaryEntry[],
  preferences: CompanionPreferences,
) {
  const archivedEntries = await Promise.all(
    entries.map(async (entry): Promise<ArchivedEntry> => {
      const [audioBlob, coverBlob] = await Promise.all([
        getMediaBlob(entry.audioBlobId),
        getMediaBlob(entry.coverBlobId),
      ]);

      return {
        entry,
        audio: audioBlob
          ? { type: audioBlob.type, base64: await blobToBase64(audioBlob) }
          : undefined,
        cover: coverBlob
          ? { type: coverBlob.type, base64: await blobToBase64(coverBlob) }
          : undefined,
      };
    }),
  );

  const archive: MelodayArchive = {
    format: "meloday-archive",
    version: 2,
    exportedAt: new Date().toISOString(),
    preferences: normalizeCompanionPreferences(preferences),
    memories: loadCompanionMemories(),
    entries: archivedEntries,
  };

  return new Blob([JSON.stringify(archive)], {
    type: "application/json;charset=utf-8",
  });
}

export async function restoreMelodayArchive(file: File) {
  if (file.size > 100 * 1024 * 1024) {
    throw new Error("备份文件过大，无法在浏览器中安全恢复。");
  }

  const parsed = JSON.parse(await file.text()) as Partial<MelodayArchive>;
  if (parsed.format !== "meloday-archive" || parsed.version !== 2) {
    throw new Error("这不是可识别的 Meloday 完整备份。");
  }

  const archivedEntries = Array.isArray(parsed.entries)
    ? parsed.entries.slice(0, 500)
    : [];
  const restoredEntries: DiaryEntry[] = [];

  for (const archived of archivedEntries) {
    if (!archived || typeof archived !== "object" || !isDiaryEntry(archived.entry)) {
      continue;
    }

    if (isEncodedBlob(archived.audio)) {
      await putMediaBlob(archived.entry.audioBlobId, base64ToBlob(archived.audio));
    }
    if (isEncodedBlob(archived.cover)) {
      await putMediaBlob(archived.entry.coverBlobId, base64ToBlob(archived.cover));
    }
    restoredEntries.push(archived.entry);
  }

  mergeDiaryEntries(restoredEntries);

  const preferences = normalizeCompanionPreferences(parsed.preferences);
  saveCompanionPreferences(preferences);

  const memories = Array.isArray(parsed.memories)
    ? parsed.memories.map((memory) => ({ ...memory, useInResponses: false }))
    : [];
  saveCompanionMemories(memories);

  return {
    restoredCount: restoredEntries.length,
    preferences,
  };
}
