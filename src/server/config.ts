import path from "node:path";
import { mkdirSync } from "node:fs";

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

const configuredProviderMode = process.env.MELODAY_PROVIDER_MODE;
const providerMode: "fake" | "real" = configuredProviderMode === "fake" || (!configuredProviderMode && process.env.NODE_ENV !== "production") ? "fake" : "real";
const tokenHubBaseUrl = (process.env.TOKENHUB_BASE_URL ?? "https://tokenhub.tencentmaas.com/v1").replace(/\/$/, "");
const tokenHubHost = new URL(tokenHubBaseUrl).hostname.toLowerCase();
const downloadHosts = new Set([
  tokenHubHost,
  ...(process.env.TOKENHUB_ALLOWED_DOWNLOAD_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
]);

export const config = {
  databasePath: path.resolve(/*turbopackIgnore: true*/ process.env.MELODAY_DATABASE_PATH ?? "./data/meloday.sqlite"),
  mediaDir: path.resolve(/*turbopackIgnore: true*/ process.env.MELODAY_MEDIA_DIR ?? "./data/media"),
  providerMode,
  tokenHubApiKey: process.env.TOKENHUB_API_KEY ?? "",
  tokenHubBaseUrl,
  tokenHubDownloadHosts: downloadHosts,
  textModel: process.env.TOKENHUB_TEXT_MODEL ?? "deepseek/deepseek-flash",
  musicModel: process.env.TOKENHUB_MUSIC_MODEL ?? "minimax-music-v3.0",
  imageModel: process.env.TOKENHUB_IMAGE_MODEL ?? "seedream-image-v5.0-lite",
  sessionTtlHours: boundedInteger("MELODAY_SESSION_TTL_HOURS", 24, 1, 168),
  generationTimeoutMs: boundedInteger("MELODAY_GENERATION_TIMEOUT_MS", 180000, 1_000, 600_000),
  generationMaxConcurrent: boundedInteger("MELODAY_GENERATION_MAX_CONCURRENT", 2, 1, 8),
  generationQueueLimit: boundedInteger("MELODAY_GENERATION_QUEUE_LIMIT", 20, 1, 100),
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
