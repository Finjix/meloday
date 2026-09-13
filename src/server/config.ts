import path from "node:path";
import { mkdirSync } from "node:fs";

const configuredProviderMode = process.env.MELODAY_PROVIDER_MODE;
const providerMode: "fake" | "real" = configuredProviderMode === "fake" || (!configuredProviderMode && process.env.NODE_ENV !== "production") ? "fake" : "real";

export const config = {
  databasePath: path.resolve(/*turbopackIgnore: true*/ process.env.MELODAY_DATABASE_PATH ?? "./data/meloday.sqlite"),
  mediaDir: path.resolve(/*turbopackIgnore: true*/ process.env.MELODAY_MEDIA_DIR ?? "./data/media"),
  providerMode,
  tokenHubApiKey: process.env.TOKENHUB_API_KEY ?? "",
  tokenHubBaseUrl: (process.env.TOKENHUB_BASE_URL ?? "https://tokenhub.tencentmaas.com/v1").replace(/\/$/, ""),
  textModel: process.env.TOKENHUB_TEXT_MODEL ?? "deepseek/deepseek-flash",
  musicModel: process.env.TOKENHUB_MUSIC_MODEL ?? "minimax-music-v3.0",
  imageModel: process.env.TOKENHUB_IMAGE_MODEL ?? "seedream-image-v5.0-lite",
  sessionTtlHours: Number(process.env.MELODAY_SESSION_TTL_HOURS ?? 24),
  generationTimeoutMs: Number(process.env.MELODAY_GENERATION_TIMEOUT_MS ?? 180000),
  adminToken: process.env.MELODAY_ADMIN_TOKEN ?? "",
};

export function ensureRuntimeDirs(): void {
  mkdirSync(path.dirname(config.databasePath), { recursive: true });
  mkdirSync(config.mediaDir, { recursive: true });
}

export function assertProviderConfiguration(): void {
  if (config.providerMode === "real" && !config.tokenHubApiKey) {
    throw new Error("TOKENHUB_API_KEY is required when MELODAY_PROVIDER_MODE=real");
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function expiresAtIso(hours = config.sessionTtlHours): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
