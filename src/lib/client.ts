import type { GenerationJob, SessionSnapshot } from "./types";

export class ApiClientError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

const HOME_STATE_KEY = "meloday:home-state";
const HOME_INPUT_KEY = "meloday:home-input";
const HOME_RETURN_KEY = "meloday:home-return";

export function cacheHomeState(session: SessionSnapshot | null, job: GenerationJob | null): void {
  if (typeof window === "undefined") return;
  if (!session) {
    window.sessionStorage.removeItem(HOME_STATE_KEY);
    window.sessionStorage.removeItem(HOME_INPUT_KEY);
    return;
  }
  window.sessionStorage.setItem(HOME_STATE_KEY, JSON.stringify({ session, job }));
}

export function cacheHomeInput(input: string): void {
  if (typeof window === "undefined") return;
  if (!input) {
    window.sessionStorage.removeItem(HOME_INPUT_KEY);
    return;
  }
  window.sessionStorage.setItem(HOME_INPUT_KEY, input);
}

export function rememberHomeReturn(): void {
  if (typeof window !== "undefined") window.sessionStorage.setItem(HOME_RETURN_KEY, "1");
}

export function restoreHomeState(): { session: SessionSnapshot; job: GenerationJob | null; input: string } | null {
  if (typeof window === "undefined" || window.sessionStorage.getItem(HOME_RETURN_KEY) !== "1") return null;
  window.sessionStorage.removeItem(HOME_RETURN_KEY);
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(HOME_STATE_KEY) ?? "null") as { session?: SessionSnapshot; job?: GenerationJob | null } | null;
    return saved?.session ? { session: saved.session, job: saved.job ?? null, input: window.sessionStorage.getItem(HOME_INPUT_KEY) ?? "" } : null;
  } catch {
    window.sessionStorage.removeItem(HOME_STATE_KEY);
    return null;
  }
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (!response.ok) throw new ApiClientError(payload?.error?.code ?? "REQUEST_FAILED", payload?.error?.message ?? "请求失败，请稍后再试。", response.status);
  return payload?.data as T;
}

export function mediaUrl(id: string | null): string | null {
  return id ? `/media/${encodeURIComponent(id)}` : null;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date(value));
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
