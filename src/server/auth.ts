import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { HttpError } from "./errors";
import { createAuthSession, deleteAuthSession, getUserByAuthTokenHash } from "./repositories";
import type { User } from "@/lib/types";

export const SESSION_COOKIE = "meloday_session";
const PASSWORD_PREFIX = "scrypt-v1";
const AUTH_SESSION_DAYS = 30;

function derivePassword(password: string, salt: string, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, length, { N: 16384, r: 8, p: 1 }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await derivePassword(password, salt, 64);
  return `${PASSWORD_PREFIX}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, salt, hash] = stored.split("$");
  if (prefix !== PASSWORD_PREFIX || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await derivePassword(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionCookie(userId: string): string {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + AUTH_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  createAuthSession({ userId, tokenHash: hashToken(token), expiresAt });
  return token;
}

export function clearSessionCookie(request: Request): void {
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  if (token) deleteAuthSession(hashToken(token));
}

export function getRequestUser(request: Request): User | null {
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  return token ? getUserByAuthTokenHash(hashToken(token)) : null;
}

export function requireRequestUser(request: Request): User {
  const user = getRequestUser(request);
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "请先登录。");
  return user;
}

export function setSessionCookie(response: Response, token: string): void {
  if (!("cookies" in response)) return;
  const cookieStore = (response as Response & { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }).cookies;
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookieOnResponse(response: Response): void {
  if (!("cookies" in response)) return;
  const cookieStore = (response as Response & { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }).cookies;
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin) throw new HttpError(403, "BAD_ORIGIN", "请求来源不受信任。");
}

export function validateUsername(username: string, maxLength = 24): string {
  const normalized = username.trim();
  const length = Array.from(normalized).length;
  const range = `2-${maxLength}`;
  if (length < 2 || length > maxLength || !/^[\p{L}\p{N}_-]+$/u.test(normalized)) {
    throw new HttpError(400, "INVALID_USERNAME", `用户名需为 ${range} 位字母、数字、下划线或短横线。`);
  }
  return normalized;
}

export function validatePassword(password: string): string {
  if (password.length < 8 || password.length > 128) throw new HttpError(400, "INVALID_PASSWORD", "密码需为 8-128 位。");
  return password;
}
