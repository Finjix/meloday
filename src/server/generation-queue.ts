import { config } from "./config";
import { HttpError } from "./errors";

const pending: Array<() => Promise<void>> = [];
let running = 0;

export function assertGenerationQueueCapacity(): void {
  if (running + pending.length >= config.generationMaxConcurrent + config.generationQueueLimit) {
    throw new HttpError(503, "GENERATION_QUEUE_FULL", "当前生成任务较多，请稍后再试。");
  }
}

export function enqueueGenerationTask(task: () => Promise<void>): void {
  pending.push(task);
  drain();
}

function drain(): void {
  while (running < config.generationMaxConcurrent && pending.length) {
    const task = pending.shift()!;
    running += 1;
    void Promise.resolve().then(task).catch((error) => {
      console.error("[meloday] generation task failed", error instanceof Error ? error.message : "unknown error");
    }).finally(() => {
      running -= 1;
      drain();
    });
  }
}
