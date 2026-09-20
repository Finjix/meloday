import { HttpError } from "./errors";

type Bucket = { count: number; resetAt: number };
type Limit = { limit: number; windowMs: number };

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  if (buckets.size < 1_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function enforceRateLimit(scope: string, subject: string, { limit, windowMs }: Limit): void {
  const now = Date.now();
  prune(now);
  const key = `${scope}:${subject}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new HttpError(429, "RATE_LIMITED", "操作过于频繁，请稍后再试。");
  }
  current.count += 1;
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
