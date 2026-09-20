import { draftText, type DiaryEntry, type GenerationJob } from "@/lib/types";
import { createGenerationJob, completeGeneration, failGeneration, getDiaryEntryByGeneration, getGenerationJob, getGenerationRow, getCapacity, saveDiaryEntry, setGenerationAsset, setGenerationRunning, updateGenerationContent, updateGenerationStage } from "./repositories";
import { config } from "./config";
import { HttpError } from "./errors";
import { enforceRateLimit } from "./rate-limit";
import { getSessionSnapshot, markSessionActive, markSessionGenerating } from "./session-service";
import { finalizeDiary, generateCover, generateMusic } from "./providers";
import { removeOrphanedMedia, writeMedia } from "./media";

const queuedJobs = new Set<string>();
const pendingJobIds: string[] = [];
let runningJobCount = 0;

export function getGeneration(id: string, userId: string): GenerationJob {
  const job = getGenerationJob(id, userId);
  if (!job) throw new HttpError(404, "GENERATION_NOT_FOUND", "生成任务不存在。");
  return job;
}

export function beginGeneration(sessionId: string, userId: string, feedback: string | null = null): GenerationJob {
  const session = getSessionSnapshot(sessionId, userId);
  if (!session) throw new HttpError(404, "SESSION_NOT_FOUND", "这段临时日记已经结束了。");
  if (session.status !== "active") throw new HttpError(409, "SESSION_NOT_ACTIVE", "当前日记不在可生成状态。");
  if (!draftText(session.draft).trim()) throw new HttpError(400, "EMPTY_DIARY", "先写下一点今天的故事，再开始生成吧。");
  enforceRateLimit("generation", userId, { limit: 6, windowMs: 60 * 60 * 1000 });
  assertGenerationQueueCapacity();
  markSessionGenerating(sessionId, userId);
  const job = createGenerationJob({ sessionId, userId, feedback, musicDirection: session.state.musicDirection });
  enqueueGeneration(job.id);
  return job;
}

export function beginRegeneration(generationId: string, userId: string, feedback: string): GenerationJob {
  const parent = getGeneration(generationId, userId);
  if (parent.status !== "succeeded") throw new HttpError(409, "GENERATION_NOT_READY", "当前卡片还不能重新生成。");
  const session = getSessionSnapshot(parent.sessionId, userId);
  if (!session) throw new HttpError(404, "SESSION_NOT_FOUND", "临时日记已经结束，无法重新生成。");
  enforceRateLimit("generation", userId, { limit: 6, windowMs: 60 * 60 * 1000 });
  assertGenerationQueueCapacity();
  markSessionGenerating(parent.sessionId, userId);
  const job = createGenerationJob({ sessionId: parent.sessionId, userId, parentGenerationId: parent.id, feedback, musicDirection: parent.musicDirection });
  enqueueGeneration(job.id);
  return job;
}

function assertGenerationQueueCapacity(): void {
  if (queuedJobs.size >= config.generationMaxConcurrent + config.generationQueueLimit) {
    throw new HttpError(503, "GENERATION_QUEUE_FULL", "当前生成任务较多，请稍后再试。");
  }
}

function enqueueGeneration(jobId: string): void {
  if (queuedJobs.has(jobId)) return;
  queuedJobs.add(jobId);
  pendingJobIds.push(jobId);
  drainGenerationQueue();
}

function drainGenerationQueue(): void {
  while (runningJobCount < config.generationMaxConcurrent && pendingJobIds.length) {
    const jobId = pendingJobIds.shift()!;
    if (!queuedJobs.has(jobId)) continue;
    runningJobCount += 1;
    void runGeneration(jobId).finally(() => {
      queuedJobs.delete(jobId);
      runningJobCount -= 1;
      drainGenerationQueue();
    });
  }
}

async function runGeneration(jobId: string): Promise<void> {
  const row = getGenerationRow(jobId);
  if (!row) return;
  setGenerationRunning(jobId);
  const session = getSessionSnapshot(row.session_id, row.user_id);
  if (!session) {
    failGeneration(jobId, "临时日记已经结束。");
    return;
  }
  try {
    updateGenerationStage(jobId, "finalizing");
    const card = await finalizeDiary({ draftText: draftText(session.draft), state: session.state, feedback: row.feedback });
    updateGenerationContent(jobId, card);

    updateGenerationStage(jobId, "music");
    const music = await generateMusic(card.musicDirection);
    const audioAssetId = await writeMedia("audio", row.user_id, music.buffer, music.mimeType, music.extension);
    setGenerationAsset(jobId, "audio", audioAssetId);

    updateGenerationStage(jobId, "cover");
    const cover = await generateCover({ title: card.title, summary: card.summary, body: card.body, direction: card.musicDirection });
    const coverAssetId = await writeMedia("cover", row.user_id, cover.buffer, cover.mimeType, cover.extension);
    setGenerationAsset(jobId, "cover", coverAssetId);

    completeGeneration(jobId);
    markSessionActive(row.session_id, row.user_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败，请稍后重试。";
    failGeneration(jobId, message);
    await removeOrphanedMedia().catch(() => undefined);
    markSessionActive(row.session_id, row.user_id);
  }
}

export function saveGeneration(generationId: string, userId: string): DiaryEntry {
  const job = getGeneration(generationId, userId);
  if (job.status !== "succeeded") throw new HttpError(409, "GENERATION_NOT_READY", "生成完成后才能保存。");
  const existing = getDiaryEntryByGeneration(generationId, userId);
  if (existing) return existing;
  const capacity = getCapacity(userId);
  if (capacity.used >= capacity.limit) throw new HttpError(409, "CAPACITY_REACHED", `日记容量已用满（${capacity.limit} 篇）。扩容入口暂未开放。`);
  return saveDiaryEntry({ userId, generationId, title: job.title, summary: job.summary, body: job.body, musicDirection: job.musicDirection, audioAssetId: job.audioAssetId, coverAssetId: job.coverAssetId });
}
