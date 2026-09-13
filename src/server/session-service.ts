import { HttpError } from "./errors";
import { expiresAtIso } from "./config";
import { createActiveSession, deleteActiveSession, getActiveSession, getSessionMessages, addSessionMessage, markExpiredSessions, setActiveSessionStatus, touchActiveSession } from "./repositories";
import { draftText, mergeAgentState, type AgentState, type DiaryDraft, type SessionSnapshot } from "@/lib/types";
import { generateAgentTurn, organizeRecentDiary } from "./providers";

export function newSession(userId: string): SessionSnapshot {
  markExpiredSessions();
  const id = createActiveSession({ userId, expiresAt: expiresAtIso() });
  return getSessionSnapshot(id, userId)!;
}

export function getSessionSnapshot(id: string, userId: string): SessionSnapshot | null {
  markExpiredSessions();
  const session = getActiveSession(id, userId);
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    expiresAt: session.expiresAt,
    state: session.state,
    draft: session.draft,
    messages: getSessionMessages(id),
  };
}

function assertActive(id: string, userId: string): SessionSnapshot {
  const snapshot = getSessionSnapshot(id, userId);
  if (!snapshot) throw new HttpError(404, "SESSION_NOT_FOUND", "这段临时日记已经结束了。");
  if (snapshot.status !== "active") throw new HttpError(409, "SESSION_NOT_ACTIVE", "当前日记不在可继续编辑状态。");
  return snapshot;
}

function shouldOrganize(draft: DiaryDraft, content: string): boolean {
  return draft.turnsSinceOrganization >= 3 || content.length >= 600;
}

function recentUserMessages(snapshot: SessionSnapshot, count: number) {
  return snapshot.messages.filter((message) => message.role === "user").slice(-Math.max(count, 1));
}

export async function receiveMessage(id: string, userId: string, userName: string, content: string): Promise<{ snapshot: SessionSnapshot; shouldGenerate: boolean; generationReason: string | null }> {
  const before = assertActive(id, userId);
  addSessionMessage(id, "user", content);
  const withUser = getSessionSnapshot(id, userId)!;
  const reply = await generateAgentTurn({ userName, userMessage: content, state: before.state, draft: before.draft, recentMessages: withUser.messages.slice(-12) });
  const state = mergeAgentState(before.state, reply.statePatch);
  let draft: DiaryDraft = {
    ...before.draft,
    userTurnCount: before.draft.userTurnCount + 1,
    turnsSinceOrganization: before.draft.turnsSinceOrganization + 1,
    recentText: [before.draft.recentText, content.trim()].filter(Boolean).join("\n"),
  };

  if (shouldOrganize(draft, content)) {
    const stableText = [before.draft.stableText, before.draft.recentText].filter(Boolean).join("\n\n").trim();
    const organized = await organizeRecentDiary({ stableText, recentMessages: recentUserMessages(withUser, draft.turnsSinceOrganization) });
    draft = { ...draft, stableText, recentText: organized, turnsSinceOrganization: 0 };
  }

  const replyText = reply.replyParts.join("\n");
  addSessionMessage(id, "agent", replyText);
  touchActiveSession(id, { state, draft, expiresAt: expiresAtIso() });
  return { snapshot: getSessionSnapshot(id, userId)!, shouldGenerate: reply.shouldGenerate, generationReason: reply.generationReason };
}

export function endSession(id: string, userId: string): void {
  const snapshot = getSessionSnapshot(id, userId);
  if (!snapshot) throw new HttpError(404, "SESSION_NOT_FOUND", "这段临时日记已经结束了。");
  setActiveSessionStatus(id, "abandoned");
  deleteActiveSession(id);
}

export function markSessionGenerating(id: string, userId: string): SessionSnapshot {
  assertActive(id, userId);
  setActiveSessionStatus(id, "generating");
  return getSessionSnapshot(id, userId)!;
}

export function markSessionActive(id: string, userId: string): void {
  const snapshot = getSessionSnapshot(id, userId);
  if (snapshot) touchActiveSession(id, { state: snapshot.state, draft: snapshot.draft, status: "active", expiresAt: expiresAtIso() });
}

export function sessionBody(id: string, userId: string): { text: string; state: AgentState } {
  const snapshot = assertActive(id, userId);
  return { text: draftText(snapshot.draft), state: snapshot.state };
}
