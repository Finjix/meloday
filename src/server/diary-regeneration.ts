import { HttpError } from "./errors";
import { enforceRateLimit } from "./rate-limit";
import { createDiaryRegeneration, getDiaryEntry, getDiaryRegeneration, replaceDiaryAsset, setDiaryRegenerationAsset, setDiaryRegenerationStatus } from "./repositories";
import { generateCover, generateMusic } from "./providers";
import { removeOrphanedMedia, writeMedia } from "./media";

export function beginDiaryRegeneration(entryId: string, userId: string, kind: "music" | "cover", feedback: string) {
  if (feedback.length > 500) throw new HttpError(400, "FEEDBACK_TOO_LONG", "补充要求不能超过 500 字。");
  enforceRateLimit("generation", userId, { limit: 6, windowMs: 60 * 60 * 1000 });
  const job = createDiaryRegeneration(entryId, userId, kind, feedback);
  void runDiaryRegeneration(job.id, entryId, userId, kind, feedback);
  return job;
}

async function runDiaryRegeneration(jobId: string, entryId: string, userId: string, kind: "music" | "cover", feedback: string): Promise<void> {
  setDiaryRegenerationStatus(jobId, "running");
  try {
    const entry = getDiaryEntry(entryId, userId);
    if (!entry) throw new HttpError(404, "DIARY_NOT_FOUND", "这一页已被删除。");
    const direction = feedback ? { ...entry.musicDirection, mood: `${entry.musicDirection.mood}；补充要求：${feedback}` } : entry.musicDirection;
    const generated = kind === "music" ? await generateMusic(direction) : await generateCover({
      title: entry.title, summary: feedback ? `${entry.summary}。补充要求：${feedback}` : entry.summary,
      body: entry.body, direction: entry.musicDirection,
    });
    const assetId = await writeMedia(kind === "music" ? "audio" : "cover", userId, generated.buffer, generated.mimeType, generated.extension);
    setDiaryRegenerationAsset(jobId, assetId);
    replaceDiaryAsset(entryId, userId, kind, assetId, entry.updatedAt);
    setDiaryRegenerationStatus(jobId, "succeeded");
  } catch (error) {
    setDiaryRegenerationStatus(jobId, "failed", error instanceof Error ? error.message : "生成失败，请稍后再试。");
    await removeOrphanedMedia().catch(() => undefined);
  }
}

export function readDiaryRegeneration(id: string, userId: string) {
  const job = getDiaryRegeneration(id, userId);
  if (!job) throw new HttpError(404, "REGENERATION_NOT_FOUND", "生成任务不存在。");
  return job;
}
