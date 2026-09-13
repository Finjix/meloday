import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config, ensureRuntimeDirs } from "./config";
import { canReadMedia, createMediaAsset, deleteOrphanedMedia, getMediaAsset } from "./repositories";
import { HttpError } from "./errors";

type MediaKind = "audio" | "cover" | "avatar";

function safeExtension(extension: string): string {
  const normalized = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized || normalized.length > 8) throw new HttpError(400, "INVALID_MEDIA_EXTENSION", "媒体格式不受支持。");
  return normalized;
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
  if (!buffer.length || buffer.length > 25 * 1024 * 1024) throw new HttpError(413, "MEDIA_TOO_LARGE", "生成的媒体文件过大。");
  const relativePath = path.join(kind, ownerUserId, `${Date.now()}-${createHash("sha256").update(buffer).digest("hex").slice(0, 16)}.${safeExtension(extension)}`);
  const target = absoluteStoragePath(relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer, { flag: "wx" });
  try {
    return createMediaAsset({ ownerUserId, kind, storagePath: relativePath, mimeType, byteSize: buffer.length });
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
}

export async function readMediaForUser(assetId: string, userId: string | null): Promise<{ buffer: Buffer; mimeType: string; byteSize: number }> {
  const asset = getMediaAsset(assetId);
  if (!asset || !canReadMedia(assetId, userId)) throw new HttpError(404, "MEDIA_NOT_FOUND", "媒体不存在或不可访问。");
  const buffer = await readFile(absoluteStoragePath(asset.storagePath));
  return { buffer, mimeType: asset.mimeType, byteSize: asset.byteSize };
}

export async function removeOrphanedMedia(): Promise<number> {
  const rows = deleteOrphanedMedia();
  await Promise.all(rows.map((row) => unlink(absoluteStoragePath(row.storagePath)).catch(() => undefined)));
  return rows.length;
}

export function mediaUrl(assetId: string | null): string | null {
  return assetId ? `/media/${encodeURIComponent(assetId)}` : null;
}
