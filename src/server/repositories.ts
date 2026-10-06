import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { expiresAtIso } from "./config";
import { HttpError } from "./errors";
import { DEFAULT_AGENT_STATE, type AgentState, type ChatMessage, type DiaryDraft, type DiaryEntry, type DiaryRevision, type DiaryRegeneration, type GenerationJob, type GenerationStage, type GenerationStatus, type MusicDirection, type SessionStatus, type User, type CommunityItem, type SharedDiaryEntry, type DiaryCheckinStatus } from "@/lib/types";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  agent_name: string;
  avatar_asset_id: string | null;
  diary_limit: number;
  created_at: string;
};

type ActiveSessionRow = {
  id: string;
  user_id: string;
  status: SessionStatus;
  state_json: string;
  stable_text: string;
  recent_text: string;
  user_turn_count: number;
  turns_since_organization: number;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  photo_asset_id: string | null;
};

type GenerationRow = {
  id: string;
  session_id: string;
  user_id: string;
  parent_generation_id: string | null;
  status: GenerationStatus;
  stage: GenerationStage;
  feedback: string | null;
  title: string;
  summary: string;
  body: string;
  music_direction_json: string;
  audio_asset_id: string | null;
  cover_asset_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type DiaryRow = GenerationRow & {
  entry_id: string;
  generation_id: string;
  published_at: string | null;
  photo_asset_id: string | null;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getCheckinDate(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}


export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    agentName: row.agent_name,
    avatarAssetId: row.avatar_asset_id,
    diaryLimit: row.diary_limit,
    createdAt: row.created_at,
  };
}

export function getUserById(id: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUserByUsername(username: string): (User & { passwordHash: string }) | null {
  const row = getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as (UserRow & { password_hash: string }) | undefined;
  return row ? { ...mapUser(row), passwordHash: row.password_hash } : null;
}

export function createUser(input: { username: string; displayName: string; passwordHash: string }): User {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  getDb().prepare(
    "INSERT INTO users (id, username, display_name, agent_name, diary_limit, created_at, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, input.username, input.displayName, input.username, 30, createdAt, input.passwordHash);
  return getUserById(id)!;
}

export function updateUserProfile(userId: string, input: { displayName?: string; agentName?: string; avatarAssetId?: string | null }): User {
  const current = getUserById(userId);
  if (!current) throw new Error("User not found");
  const next = {
    displayName: input.displayName ?? current.displayName,
    agentName: input.agentName ?? current.agentName,
    avatarAssetId: input.avatarAssetId === undefined ? current.avatarAssetId : input.avatarAssetId,
  };
  getDb().prepare("UPDATE users SET display_name = ?, agent_name = ?, avatar_asset_id = ? WHERE id = ?").run(next.displayName, next.agentName, next.avatarAssetId, userId);
  return getUserById(userId)!;
}

export function grantCapacity(userId: string, amount: number, reason: string): User {
  const db = getDb();
  const grant = db.transaction(() => {
    db.prepare("INSERT INTO capacity_grants (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), userId, amount, reason, new Date().toISOString());
    db.prepare("UPDATE users SET diary_limit = diary_limit + ? WHERE id = ?").run(amount, userId);
  });
  grant();
  return getUserById(userId)!;
}

export function countUserDiaries(userId: string): number {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM diary_entries WHERE user_id = ?").get(userId) as { count: number };
  return Number(row.count);
}

export function getCapacity(userId: string): { used: number; limit: number } {
  const user = getUserById(userId);
  return { used: countUserDiaries(userId), limit: user?.diaryLimit ?? 30 }; 
}

export function getDiaryCheckinStatus(userId: string): DiaryCheckinStatus {
  const rows = getDb().prepare("SELECT checkin_date FROM diary_checkins WHERE user_id = ? ORDER BY checkin_date DESC").all(userId) as Array<{ checkin_date: string }>;
  const today = getCheckinDate();
  const totalDays = rows.length;
  const rewardReady = totalDays > 0 && totalDays % 7 === 0;
  return { checkedToday: rows.some((row) => row.checkin_date === today), totalDays, progress: totalDays % 7, rewardReady };
}

export function createAuthSession(input: { userId: string; tokenHash: string; expiresAt: string }): void {
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)").run(randomUUID(), input.userId, input.tokenHash, input.expiresAt, now, now);
}

export function getUserByAuthTokenHash(tokenHash: string): User | null {
  const row = getDb().prepare(
    "SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  ).get(tokenHash, new Date().toISOString()) as UserRow | undefined;
  if (!row) return null;
  getDb().prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?").run(new Date().toISOString(), tokenHash);
  return mapUser(row);
}

export function deleteAuthSession(tokenHash: string): void {
  getDb().prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteExpiredAuthSessions(): number {
  return getDb().prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(new Date().toISOString()).changes;
}

export function createActiveSession(input: { userId: string; expiresAt: string }): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb().prepare(
    "INSERT INTO active_sessions (id, user_id, status, state_json, created_at, last_activity_at, expires_at) VALUES (?, ?, 'active', ?, ?, ?, ?)",
  ).run(id, input.userId, JSON.stringify(DEFAULT_AGENT_STATE), now, now, input.expiresAt);
  return id;
}

export function mapSession(row: ActiveSessionRow): { id: string; userId: string; status: SessionStatus; state: AgentState; draft: DiaryDraft; createdAt: string; lastActivityAt: string; expiresAt: string; photoAssetId: string | null } {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    state: parseJson(row.state_json, DEFAULT_AGENT_STATE),
    draft: {
      stableText: row.stable_text,
      recentText: row.recent_text,
      userTurnCount: row.user_turn_count,
      turnsSinceOrganization: row.turns_since_organization,
    },
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at,
    photoAssetId: row.photo_asset_id,
  };
}

export function getActiveSession(id: string, userId: string): ReturnType<typeof mapSession> | null {
  const row = getDb().prepare("SELECT * FROM active_sessions WHERE id = ? AND user_id = ?").get(id, userId) as ActiveSessionRow | undefined;
  return row ? mapSession(row) : null;
}

export function getLatestActiveSession(userId: string): ReturnType<typeof mapSession> | null {
  const row = getDb().prepare("SELECT * FROM active_sessions WHERE user_id = ? AND status IN ('active', 'generating') ORDER BY last_activity_at DESC LIMIT 1").get(userId) as ActiveSessionRow | undefined;
  return row ? mapSession(row) : null;
}

export function touchActiveSession(id: string, input: { state: AgentState; draft: DiaryDraft; status?: SessionStatus; expiresAt: string }): void {
  const now = new Date().toISOString();
  getDb().prepare(
    "UPDATE active_sessions SET state_json = ?, stable_text = ?, recent_text = ?, user_turn_count = ?, turns_since_organization = ?, status = COALESCE(?, status), last_activity_at = ?, expires_at = ? WHERE id = ?",
  ).run(JSON.stringify(input.state), input.draft.stableText, input.draft.recentText, input.draft.userTurnCount, input.draft.turnsSinceOrganization, input.status ?? null, now, input.expiresAt, id);
}

export function setSessionPhoto(id: string, userId: string, assetId: string | null): boolean {
  return getDb().prepare("UPDATE active_sessions SET photo_asset_id = ?, last_activity_at = ? WHERE id = ? AND user_id = ? AND status = 'active'").run(assetId, new Date().toISOString(), id, userId).changes > 0;
}

export function setDiaryPhoto(id: string, userId: string, assetId: string | null): DiaryEntry {
  const db = getDb();
  db.transaction(() => {
    const entry = getDiaryEntry(id, userId);
    if (!entry) throw new HttpError(404, "DIARY_NOT_FOUND", "找不到这一页。");
    if (entry.photoAssetId === assetId) return;
    snapshotDiaryRevision(entry, "edit");
    db.prepare("UPDATE diary_entries SET photo_asset_id = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(assetId, new Date().toISOString(), id, userId);
  })();
  return getDiaryEntry(id, userId)!;
}

export function addSessionMessage(sessionId: string, role: "user" | "agent", content: string): ChatMessage {
  const message = { id: randomUUID(), role, content, createdAt: new Date().toISOString() } as ChatMessage;
  getDb().prepare("INSERT INTO session_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)").run(message.id, sessionId, role, content, message.createdAt);
  return message;
}

export function deleteSessionMessage(id: string): void {
  getDb().prepare("DELETE FROM session_messages WHERE id = ?").run(id);
}

export function getSessionMessages(sessionId: string): ChatMessage[] {
  const rows = getDb().prepare("SELECT id, role, content, created_at FROM session_messages WHERE session_id = ? ORDER BY created_at, id").all(sessionId) as Array<{ id: string; role: "user" | "agent"; content: string; created_at: string }>;
  return rows.map((row) => ({ id: row.id, role: row.role, content: row.content, createdAt: row.created_at }));
}

export function deleteActiveSession(id: string): void {
  getDb().prepare("DELETE FROM active_sessions WHERE id = ?").run(id);
}

export function claimActiveSessionForGeneration(id: string, userId: string): boolean {
  return getDb().prepare("UPDATE active_sessions SET status = 'generating', last_activity_at = ?, expires_at = ? WHERE id = ? AND user_id = ? AND status = 'active'").run(new Date().toISOString(), expiresAtIso(), id, userId).changes === 1;
}

export function setActiveSessionStatus(id: string, status: SessionStatus): void {
  getDb().prepare("UPDATE active_sessions SET status = ?, last_activity_at = ?, expires_at = ? WHERE id = ?").run(status, new Date().toISOString(), expiresAtIso(), id);
}

export function markExpiredSessions(): number {
  return getDb().prepare("UPDATE active_sessions SET status = 'expired' WHERE expires_at <= ? AND status IN ('active', 'generating')").run(new Date().toISOString()).changes;
}

export function deleteOldTransientSessions(): number {
  return getDb().prepare(`
    DELETE FROM active_sessions
    WHERE status IN ('expired', 'abandoned', 'completed')
      AND expires_at <= ?
      AND NOT EXISTS (
        SELECT 1
        FROM generation_jobs g
        JOIN diary_entries d ON d.generation_id = g.id
        WHERE g.session_id = active_sessions.id
      )
  `).run(new Date().toISOString()).changes;
}

export function createGenerationJob(input: { sessionId: string; userId: string; parentGenerationId?: string | null; feedback?: string | null; musicDirection: MusicDirection }): GenerationJob {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb().prepare(
    "INSERT INTO generation_jobs (id, session_id, user_id, parent_generation_id, status, stage, feedback, music_direction_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', 'finalizing', ?, ?, ?, ?)",
  ).run(id, input.sessionId, input.userId, input.parentGenerationId ?? null, input.feedback ?? null, JSON.stringify(input.musicDirection), now, now);
  return getGenerationJob(id, input.userId)!;
}

export function mapGeneration(row: GenerationRow): GenerationJob {
  return {
    id: row.id,
    sessionId: row.session_id,
    parentGenerationId: row.parent_generation_id,
    status: row.status,
    stage: row.stage,
    feedback: row.feedback,
    title: row.title,
    summary: row.summary,
    body: row.body,
    musicDirection: parseJson(row.music_direction_json, DEFAULT_AGENT_STATE.musicDirection),
    audioAssetId: row.audio_asset_id,
    coverAssetId: row.cover_asset_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getGenerationJob(id: string, userId: string): GenerationJob | null {
  const row = getDb().prepare("SELECT * FROM generation_jobs WHERE id = ? AND user_id = ?").get(id, userId) as GenerationRow | undefined;
  return row ? mapGeneration(row) : null;
}

export function getGenerationRow(id: string): GenerationRow | null {
  return (getDb().prepare("SELECT * FROM generation_jobs WHERE id = ?").get(id) as GenerationRow | undefined) ?? null;
}

export function getLatestGenerationForSession(sessionId: string, userId: string): GenerationJob | null {
  const row = getDb().prepare("SELECT * FROM generation_jobs WHERE session_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1").get(sessionId, userId) as GenerationRow | undefined;
  return row ? mapGeneration(row) : null;
}

export function setGenerationRunning(id: string): void {
  getDb().prepare("UPDATE generation_jobs SET status = 'running', updated_at = ? WHERE id = ? AND status = 'queued'").run(new Date().toISOString(), id);
}

export function updateGenerationStage(id: string, stage: GenerationStage): void {
  getDb().prepare("UPDATE generation_jobs SET stage = ?, updated_at = ? WHERE id = ?").run(stage, new Date().toISOString(), id);
}

export function updateGenerationContent(id: string, input: { title: string; summary: string; body: string; musicDirection: MusicDirection }): void {
  getDb().prepare("UPDATE generation_jobs SET title = ?, summary = ?, body = ?, music_direction_json = ?, updated_at = ? WHERE id = ?").run(input.title, input.summary, input.body, JSON.stringify(input.musicDirection), new Date().toISOString(), id);
}

export function setGenerationAsset(id: string, kind: "audio" | "cover", assetId: string): void {
  const column = kind === "audio" ? "audio_asset_id" : "cover_asset_id";
  getDb().prepare(`UPDATE generation_jobs SET ${column} = ?, updated_at = ? WHERE id = ?`).run(assetId, new Date().toISOString(), id);
}

export function completeGeneration(id: string): void {
  getDb().prepare("UPDATE generation_jobs SET status = 'succeeded', stage = 'complete', error_message = NULL, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export function failGeneration(id: string, message: string): void {
  getDb().prepare("UPDATE generation_jobs SET status = 'failed', audio_asset_id = NULL, cover_asset_id = NULL, error_message = ?, updated_at = ? WHERE id = ?").run(message.slice(0, 500), new Date().toISOString(), id);
}

export function markRunningJobsFailed(): number {
  const db = getDb();
  const now = new Date().toISOString();
  const markFailed = db.transaction(() => {
    const changes = db.prepare("UPDATE generation_jobs SET status = 'failed', audio_asset_id = NULL, cover_asset_id = NULL, error_message = '服务重启后任务已结束，请重新生成。', updated_at = ? WHERE status IN ('queued', 'running')").run(now).changes;
    db.prepare("UPDATE active_sessions SET status = 'active', last_activity_at = ?, expires_at = ? WHERE status = 'generating'").run(now, expiresAtIso());
    return changes;
  });
  return markFailed();
}

export function createMediaAsset(input: { ownerUserId: string; kind: "audio" | "cover" | "avatar"; storagePath: string; mimeType: string; byteSize: number }): string {
  const id = randomUUID();
  getDb().prepare("INSERT INTO media_assets (id, owner_user_id, kind, storage_path, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, input.ownerUserId, input.kind, input.storagePath, input.mimeType, input.byteSize, new Date().toISOString());
  return id;
}

export function getMediaAsset(id: string): { id: string; ownerUserId: string; kind: "audio" | "cover" | "avatar"; storagePath: string; mimeType: string; byteSize: number } | null {
  const row = getDb().prepare("SELECT id, owner_user_id, kind, storage_path, mime_type, byte_size FROM media_assets WHERE id = ?").get(id) as { id: string; owner_user_id: string; kind: "audio" | "cover" | "avatar"; storage_path: string; mime_type: string; byte_size: number } | undefined;
  return row ? { id: row.id, ownerUserId: row.owner_user_id, kind: row.kind, storagePath: row.storage_path, mimeType: row.mime_type, byteSize: row.byte_size } : null;
}

export function canReadMedia(id: string, userId: string | null): boolean {
  const row = getDb().prepare(`
    SELECT 1 AS allowed FROM media_assets m
    WHERE m.id = ? AND (
      m.owner_user_id = ?
      OR EXISTS (
        SELECT 1
        FROM diary_entries d
        JOIN community_posts p ON p.entry_id = d.id
        JOIN users u ON u.id = p.user_id
        WHERE d.audio_asset_id = m.id OR d.cover_asset_id = m.id OR u.avatar_asset_id = m.id
      )
    ) LIMIT 1
  `).get(id, userId ?? "") as { allowed: number } | undefined;
  return Boolean(row?.allowed);
}

export function getDiaryEntries(userId: string): DiaryEntry[] {
  const rows = getDb().prepare(`
    SELECT d.id AS entry_id, d.generation_id, d.title, d.summary, d.body, d.music_direction_json,
      d.audio_asset_id, d.cover_asset_id, d.photo_asset_id, d.created_at, d.updated_at, p.published_at,
      g.session_id, g.user_id, g.parent_generation_id, g.status, g.stage, g.feedback, g.error_message,
      g.created_at AS generation_created_at, g.updated_at AS generation_updated_at
    FROM diary_entries d
    LEFT JOIN community_posts p ON p.entry_id = d.id
    JOIN generation_jobs g ON g.id = d.generation_id
    WHERE d.user_id = ? ORDER BY d.created_at DESC
  `).all(userId) as DiaryRow[];
  return rows.map((row) => ({
    id: row.entry_id,
    generationId: row.generation_id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    musicDirection: parseJson(row.music_direction_json, DEFAULT_AGENT_STATE.musicDirection),
    audioAssetId: row.audio_asset_id,
    coverAssetId: row.cover_asset_id,
    photoAssetId: row.photo_asset_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }));
}

export function getDiaryEntry(id: string, userId: string): DiaryEntry | null {
  const row = getDb().prepare(`
    SELECT d.id AS entry_id, d.generation_id, d.title, d.summary, d.body, d.music_direction_json,
      d.audio_asset_id, d.cover_asset_id, d.photo_asset_id, d.created_at, d.updated_at, p.published_at,
      g.session_id, g.user_id, g.parent_generation_id, g.status, g.stage, g.feedback, g.error_message,
      g.created_at AS generation_created_at, g.updated_at AS generation_updated_at
    FROM diary_entries d LEFT JOIN community_posts p ON p.entry_id = d.id
    JOIN generation_jobs g ON g.id = d.generation_id
    WHERE d.id = ? AND d.user_id = ?
  `).get(id, userId) as DiaryRow | undefined;
  if (!row) return null;
  return {
    id: row.entry_id,
    generationId: row.generation_id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    musicDirection: parseJson(row.music_direction_json, DEFAULT_AGENT_STATE.musicDirection),
    audioAssetId: row.audio_asset_id,
    coverAssetId: row.cover_asset_id,
    photoAssetId: row.photo_asset_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export function getDiaryEntryByGeneration(generationId: string, userId: string): DiaryEntry | null {
  const row = getDb().prepare("SELECT id FROM diary_entries WHERE generation_id = ? AND user_id = ?").get(generationId, userId) as { id: string } | undefined;
  return row ? getDiaryEntry(row.id, userId) : null;
}

export function saveDiaryEntry(input: { userId: string; generationId: string; title: string; summary: string; body: string; musicDirection: MusicDirection; audioAssetId: string | null; coverAssetId: string | null }): DiaryEntry {
  const db = getDb();
  let entryId: string | null = null;
  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM diary_entries WHERE generation_id = ? AND user_id = ?").get(input.generationId, input.userId) as { id: string } | undefined;
    if (existing) {
      entryId = existing.id;
      return;
    }
    const generation = db.prepare("SELECT session_id FROM generation_jobs WHERE id = ? AND user_id = ?").get(input.generationId, input.userId) as { session_id: string } | undefined;
    if (!generation) throw new Error("Generation job not found");
    const capacity = db.prepare("SELECT diary_limit FROM users WHERE id = ?").get(input.userId) as { diary_limit: number } | undefined;
    const used = db.prepare("SELECT COUNT(*) AS count FROM diary_entries WHERE user_id = ?").get(input.userId) as { count: number };
    if (!capacity || Number(used.count) >= capacity.diary_limit) throw new HttpError(409, "CAPACITY_REACHED", `日记容量已用满（${capacity?.diary_limit ?? 30} 篇）。请在“我的”页面购买扩容。`);
    entryId = randomUUID();
    const sessionPhoto = db.prepare("SELECT photo_asset_id FROM active_sessions WHERE id = ? AND user_id = ?").get(generation.session_id, input.userId) as { photo_asset_id: string | null };
    db.prepare("INSERT INTO diary_entries (id, user_id, generation_id, title, summary, body, music_direction_json, audio_asset_id, cover_asset_id, photo_asset_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(entryId, input.userId, input.generationId, input.title, input.summary, input.body, JSON.stringify(input.musicDirection), input.audioAssetId, input.coverAssetId, sessionPhoto.photo_asset_id, now, now);
    const checkinDate = getCheckinDate();
    const checkin = db.prepare("INSERT INTO diary_checkins (user_id, checkin_date, entry_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, checkin_date) DO NOTHING").run(input.userId, checkinDate, entryId, now);
    if (checkin.changes && getDiaryCheckinStatus(input.userId).rewardReady) {
      db.prepare("INSERT INTO capacity_grants (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), input.userId, 1, `diary-checkin:${checkinDate}`, now);
      db.prepare("UPDATE users SET diary_limit = diary_limit + 1 WHERE id = ?").run(input.userId);
    }
    db.prepare("UPDATE active_sessions SET status = 'completed', state_json = ?, stable_text = '', recent_text = '', user_turn_count = 0, turns_since_organization = 0, photo_asset_id = NULL, expires_at = ? WHERE id = ? AND user_id = ?").run(JSON.stringify(DEFAULT_AGENT_STATE), now, generation.session_id, input.userId);
    db.prepare("DELETE FROM session_messages WHERE session_id = ?").run(generation.session_id);
  });
  transaction();
  return getDiaryEntry(entryId!, input.userId)!;
}

export function deleteDiaryEntry(id: string, userId: string): { audioAssetId: string | null; coverAssetId: string | null } | null {
  const entry = getDiaryEntry(id, userId);
  if (!entry) return null;
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM diary_entries WHERE id = ? AND user_id = ?").run(id, userId);
    db.prepare("UPDATE generation_jobs SET audio_asset_id = NULL, cover_asset_id = NULL WHERE id = ? AND user_id = ?").run(entry.generationId, userId);
  });
  transaction();
  return { audioAssetId: entry.audioAssetId, coverAssetId: entry.coverAssetId };
}

export function publishDiaryEntry(id: string, userId: string): DiaryEntry | null {
  const entry = getDiaryEntry(id, userId);
  if (!entry) return null;
  getDb().prepare("INSERT INTO community_posts (entry_id, user_id, published_at) VALUES (?, ?, ?) ON CONFLICT(entry_id) DO UPDATE SET published_at = excluded.published_at").run(id, userId, new Date().toISOString());
  return getDiaryEntry(id, userId);
}

export function unpublishDiaryEntry(id: string, userId: string): DiaryEntry | null {
  const entry = getDiaryEntry(id, userId);
  if (!entry) return null;
  getDb().prepare("DELETE FROM community_posts WHERE entry_id = ? AND user_id = ?").run(id, userId);
  return getDiaryEntry(id, userId);
}

export function listCommunityItems(limit = 30, offset = 0): CommunityItem[] {
  const rows = getDb().prepare(`
    SELECT d.id AS entry_id, d.title, d.summary, d.audio_asset_id, d.cover_asset_id,
      u.display_name AS author_name, u.avatar_asset_id AS author_avatar_asset_id, p.published_at
    FROM community_posts p JOIN diary_entries d ON d.id = p.entry_id JOIN users u ON u.id = p.user_id
    ORDER BY p.published_at DESC LIMIT ? OFFSET ?
  `).all(Math.min(limit, 50), Math.max(offset, 0)) as Array<{ entry_id: string; title: string; summary: string; audio_asset_id: string | null; cover_asset_id: string | null; author_name: string; author_avatar_asset_id: string | null; published_at: string }>;
  return rows.map((row) => ({ entryId: row.entry_id, title: row.title, summary: row.summary, audioAssetId: row.audio_asset_id, coverAssetId: row.cover_asset_id, authorName: row.author_name, authorAvatarAssetId: row.author_avatar_asset_id, publishedAt: row.published_at }));
}

export function getSharedDiaryEntry(id: string): SharedDiaryEntry | null {
  const row = getDb().prepare(`
    SELECT d.id AS entry_id, d.title, d.summary, d.body, d.audio_asset_id, d.cover_asset_id, d.created_at,
      u.display_name AS author_name, u.avatar_asset_id AS author_avatar_asset_id, p.published_at
    FROM community_posts p JOIN diary_entries d ON d.id = p.entry_id JOIN users u ON u.id = p.user_id
    WHERE d.id = ?
  `).get(id) as { entry_id: string; title: string; summary: string; body: string; audio_asset_id: string | null; cover_asset_id: string | null; created_at: string; author_name: string; author_avatar_asset_id: string | null; published_at: string } | undefined;
  if (!row) return null;
  return { id: row.entry_id, title: row.title, summary: row.summary, body: row.body, audioAssetId: row.audio_asset_id, coverAssetId: row.cover_asset_id, createdAt: row.created_at, authorName: row.author_name, authorAvatarAssetId: row.author_avatar_asset_id, publishedAt: row.published_at };
}

export function deleteOrphanedMedia(): Array<{ id: string; storagePath: string }> {
  const rows = getDb().prepare(`
    SELECT m.id, m.storage_path AS storagePath FROM media_assets m
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_asset_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM generation_jobs g WHERE g.audio_asset_id = m.id OR g.cover_asset_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM active_sessions s WHERE s.photo_asset_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM diary_entries d WHERE d.audio_asset_id = m.id OR d.cover_asset_id = m.id OR d.photo_asset_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM diary_revisions r WHERE r.audio_asset_id = m.id OR r.cover_asset_id = m.id OR r.photo_asset_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM diary_regeneration_jobs j WHERE j.asset_id = m.id)
  `).all() as Array<{ id: string; storagePath: string }>;
  if (rows.length) getDb().prepare(`DELETE FROM media_assets WHERE id IN (${rows.map(() => "?").join(",")})`).run(...rows.map((row) => row.id));
  return rows;
}

export function resetSchemaForTests(): void {
  const db = getDb();
  db.exec("DELETE FROM diary_regeneration_jobs; DELETE FROM diary_revisions; DELETE FROM community_posts; DELETE FROM diary_entries; DELETE FROM generation_jobs; DELETE FROM session_messages; DELETE FROM active_sessions; DELETE FROM auth_sessions; DELETE FROM media_assets; DELETE FROM capacity_grants; DELETE FROM users;");
}

function snapshotDiaryRevision(entry: DiaryEntry, reason: DiaryRevision["reason"]): void {
  getDb().prepare(`INSERT INTO diary_revisions
    (id, entry_id, title, summary, body, music_direction_json, audio_asset_id, cover_asset_id, photo_asset_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), entry.id, entry.title, entry.summary, entry.body,
    JSON.stringify(entry.musicDirection), entry.audioAssetId, entry.coverAssetId, entry.photoAssetId, reason, new Date().toISOString());
}

export function getDiaryRevisions(entryId: string, userId: string): DiaryRevision[] {
  if (!getDiaryEntry(entryId, userId)) throw new HttpError(404, "DIARY_NOT_FOUND", "找不到这一页。");
  const rows = getDb().prepare("SELECT * FROM diary_revisions WHERE entry_id = ? ORDER BY created_at DESC, rowid DESC").all(entryId) as Array<{
    id: string; entry_id: string; title: string; summary: string; body: string; music_direction_json: string;
    audio_asset_id: string | null; cover_asset_id: string | null; photo_asset_id: string | null;
    reason: DiaryRevision["reason"]; created_at: string;
  }>;
  return rows.map((row) => ({ id: row.id, entryId: row.entry_id, title: row.title, summary: row.summary,
    body: row.body, musicDirection: parseJson(row.music_direction_json, DEFAULT_AGENT_STATE.musicDirection),
    audioAssetId: row.audio_asset_id, coverAssetId: row.cover_asset_id, photoAssetId: row.photo_asset_id,
    reason: row.reason, createdAt: row.created_at }));
}

export function editDiaryEntry(id: string, userId: string, input: { title: string; summary: string; body: string }): DiaryEntry {
  const db = getDb();
  db.transaction(() => {
    const entry = getDiaryEntry(id, userId);
    if (!entry) throw new HttpError(404, "DIARY_NOT_FOUND", "找不到这一页。");
    if (entry.title === input.title && entry.summary === input.summary && entry.body === input.body) return;
    snapshotDiaryRevision(entry, "edit");
    db.prepare("UPDATE diary_entries SET title = ?, summary = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(input.title, input.summary, input.body, new Date().toISOString(), id, userId);
  })();
  return getDiaryEntry(id, userId)!;
}

export function restoreDiaryRevision(id: string, userId: string, revisionId: string): DiaryEntry {
  const db = getDb();
  db.transaction(() => {
    const entry = getDiaryEntry(id, userId);
    if (!entry) throw new HttpError(404, "DIARY_NOT_FOUND", "找不到这一页。");
    const revision = db.prepare("SELECT * FROM diary_revisions WHERE id = ? AND entry_id = ?").get(revisionId, id) as {
      title: string; summary: string; body: string; music_direction_json: string; audio_asset_id: string | null;
      cover_asset_id: string | null; photo_asset_id: string | null;
    } | undefined;
    if (!revision) throw new HttpError(404, "REVISION_NOT_FOUND", "找不到这个版本。");
    snapshotDiaryRevision(entry, "restore");
    db.prepare(`UPDATE diary_entries SET title = ?, summary = ?, body = ?, music_direction_json = ?,
      audio_asset_id = ?, cover_asset_id = ?, photo_asset_id = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
      .run(revision.title, revision.summary, revision.body, revision.music_direction_json, revision.audio_asset_id,
        revision.cover_asset_id, revision.photo_asset_id, new Date().toISOString(), id, userId);
  })();
  return getDiaryEntry(id, userId)!;
}

export function replaceDiaryAsset(id: string, userId: string, kind: "music" | "cover", assetId: string, expectedUpdatedAt: string): DiaryEntry {
  const db = getDb();
  db.transaction(() => {
    const entry = getDiaryEntry(id, userId);
    if (!entry) throw new HttpError(404, "DIARY_NOT_FOUND", "找不到这一页。");
    if (entry.updatedAt !== expectedUpdatedAt) throw new HttpError(409, "DIARY_CHANGED", "这一页刚刚更新过，请重新生成。");
    snapshotDiaryRevision(entry, kind);
    const column = kind === "music" ? "audio_asset_id" : "cover_asset_id";
    db.prepare(`UPDATE diary_entries SET ${column} = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
      .run(assetId, new Date().toISOString(), id, userId);
  })();
  return getDiaryEntry(id, userId)!;
}

export function createDiaryRegeneration(entryId: string, userId: string, kind: "music" | "cover", feedback: string): DiaryRegeneration {
  const entry = getDiaryEntry(entryId, userId);
  if (!entry) throw new HttpError(404, "DIARY_NOT_FOUND", "找不到这一页。");
  const active = getDb().prepare("SELECT 1 FROM diary_regeneration_jobs WHERE entry_id = ? AND status IN ('queued', 'running')").get(entryId);
  if (active) throw new HttpError(409, "REGENERATION_IN_PROGRESS", "这一页还有生成任务正在进行。");
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO diary_regeneration_jobs (id, entry_id, user_id, kind, status, feedback, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)")
    .run(id, entryId, userId, kind, feedback, now, now);
  return getDiaryRegeneration(id, userId)!;
}

export function getDiaryRegeneration(id: string, userId: string): DiaryRegeneration | null {
  const row = getDb().prepare("SELECT * FROM diary_regeneration_jobs WHERE id = ? AND user_id = ?").get(id, userId) as {
    id: string; entry_id: string; kind: "music" | "cover"; status: GenerationStatus;
    error_message: string | null; created_at: string; updated_at: string;
  } | undefined;
  return row ? { id: row.id, entryId: row.entry_id, kind: row.kind, status: row.status,
    errorMessage: row.error_message, createdAt: row.created_at, updatedAt: row.updated_at } : null;
}

export function getLatestDiaryRegeneration(entryId: string, userId: string): DiaryRegeneration | null {
  if (!getDiaryEntry(entryId, userId)) throw new HttpError(404, "DIARY_NOT_FOUND", "找不到这一页。");
  const row = getDb().prepare("SELECT id FROM diary_regeneration_jobs WHERE entry_id = ? AND user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
    .get(entryId, userId) as { id: string } | undefined;
  return row ? getDiaryRegeneration(row.id, userId) : null;
}

export function setDiaryRegenerationStatus(id: string, status: GenerationStatus, errorMessage: string | null = null): void {
  getDb().prepare("UPDATE diary_regeneration_jobs SET status = ?, asset_id = CASE WHEN ? = 'failed' THEN NULL ELSE asset_id END, error_message = ?, updated_at = ? WHERE id = ?")
    .run(status, status, errorMessage, new Date().toISOString(), id);
}

export function setDiaryRegenerationAsset(id: string, assetId: string): void {
  getDb().prepare("UPDATE diary_regeneration_jobs SET asset_id = ?, updated_at = ? WHERE id = ?")
    .run(assetId, new Date().toISOString(), id);
}
