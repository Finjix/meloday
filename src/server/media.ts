import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config, ensureRuntimeDirs } from "./config";
import { canReadMedia, createMediaAsset, deleteOrphanedMedia, getMediaAsset } from "./repositories";
import { HttpError } from "./errors";

type MediaKind = "audio" | "cover" | "avatar";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const mimeExtensions: Record<MediaKind, Record<string, string>> = {
  audio: { "audio/mpeg": "mp3", "audio/wav": "wav" },
  cover: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
  avatar: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
};

function isMatchingSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "audio/wav") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE";
  return buffer.length >= 3 && (buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
}

function safeExtension(kind: MediaKind, mimeType: string, extension: string): string {
  const normalized = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized || normalized.length > 8) throw new HttpError(400, "INVALID_MEDIA_EXTENSION", "媒体格式不受支持。");
  const expected = mimeExtensions[kind][mimeType];
  if (!expected || normalized !== expected) throw new HttpError(400, "INVALID_MEDIA_FORMAT", "媒体格式不受支持。");
  return expected;
}

function absoluteStoragePath(relativePath: string): string {
  const root = path.resolve(config.mediaDir);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe media path");
  return target;
}

export async function writeMedia(kind: MediaKind, ownerUserId: string, buffer: Buffer, mimeType: string, extension: string): Promise<string> {
  ensureRuntimeDirs();
  if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) throw new HttpError(413, "MEDIA_TOO_LARGE", "生成的媒体文件过大。");
  const safeMimeType = mimeType.toLowerCase();
  const safeFileExtension = safeExtension(kind, safeMimeType, extension);
  if (!isMatchingSignature(buffer, safeMimeType)) throw new HttpError(400, "INVALID_MEDIA_CONTENT", "媒体内容与格式不匹配。");
  const relativePath = path.join(/*turbopackIgnore: true*/ kind, ownerUserId, `${randomUUID()}.${safeFileExtension}`);
  const target = absoluteStoragePath(relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer, { flag: "wx" });
  try {
    return createMediaAsset({ ownerUserId, kind, storagePath: relativePath, mimeType: safeMimeType, byteSize: buffer.length });
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

export async function readMediaForUser(assetId: string, userId: string | null): Promise<{ buffer: Buffer; mimeType: string; byteSize: number }> {
  const asset = getMediaAsset(assetId);
  if (!asset || !mimeExtensions[asset.kind][asset.mimeType] || !canReadMedia(assetId, userId)) {
    throw new HttpError(404, "MEDIA_NOT_FOUND", "媒体不存在或不可访问。");
  }
  try {
    const buffer = await readFile(absoluteStoragePath(asset.storagePath));
    if (!isMatchingSignature(buffer, asset.mimeType)) throw new HttpError(404, "MEDIA_NOT_FOUND", "媒体不存在或不可访问。");
    return { buffer, mimeType: asset.mimeType, byteSize: asset.byteSize };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(404, "MEDIA_NOT_FOUND", "媒体不存在或不可访问。");
  }
}

export async function removeOrphanedMedia(): Promise<number> {
  const rows = deleteOrphanedMedia();
  await Promise.all(rows.map((row) => unlink(absoluteStoragePath(row.storagePath)).catch(() => undefined)));
  return rows.length;
}

export function mediaUrl(assetId: string | null): string | null {
  return assetId ? `/media/${encodeURIComponent(assetId)}` : null;
}
