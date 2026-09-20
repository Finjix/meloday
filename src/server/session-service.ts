import { HttpError } from "./errors";
import { expiresAtIso } from "./config";
import { createActiveSession, deleteActiveSession, getActiveSession, getSessionMessages, addSessionMessage, markExpiredSessions, setActiveSessionStatus, touchActiveSession } from "./repositories";
import { DEFAULT_AGENT_STATE, EMPTY_DIARY_DRAFT, draftText, mergeAgentState, type AgentState, type DiaryDraft, type MusicDirection, type SessionSnapshot } from "@/lib/types";
import { generateAgentTurn } from "./providers";

export function newSession(userId: string): SessionSnapshot {
  markExpiredSessions();
  const id = createActiveSession({ userId, expiresAt: expiresAtIso() });
  return getSessionSnapshot(id, userId)!;
}

export type QuickMusicPreset = "relax" | "move";

type QuickMusicDetails = {
  userMessage: string;
  agentMessage: string;
  diaryText: string;
  emotion: string;
  musicDirection: MusicDirection;
};

const quickMusicPresets: Record<QuickMusicPreset, QuickMusicDetails> = {
  relax: {
    userMessage: "我想放松一下，听一段音乐。",
    agentMessage: "好，先放慢一点呼吸。我正在为你生成一段舒缓的旋律。",
    diaryText: "想给自己留一点安静的时间，在舒缓的旋律里慢慢放松下来。",
    emotion: "放松",
    musicDirection: { mood: "宁静、放松、治愈", tempo: "慢速", style: "舒缓的氛围音乐", instruments: ["轻柔钢琴", "环境音", "温暖弦乐"] },
  },
  move: {
    userMessage: "我想动起来，听一段欢快的音乐。",
    agentMessage: "好呀！我正在为你生成一段轻快、有活力的旋律。",
    diaryText: "想让身体和心情都跟着节奏轻快起来，给此刻一点明亮的能量。",
    emotion: "欢快",
    musicDirection: { mood: "欢快、明亮、充满活力", tempo: "中快速", style: "轻快的流行电子音乐", instruments: ["律动鼓点", "明亮吉他", "合成器"] },
  },
};

export function newQuickMusicSession(userId: string, preset: QuickMusicPreset): SessionSnapshot {
  const session = newSession(userId);
  const details = quickMusicPresets[preset];
  const draft: DiaryDraft = { ...EMPTY_DIARY_DRAFT, recentText: details.diaryText, userTurnCount: 1 };
  const state: AgentState = { ...DEFAULT_AGENT_STATE, emotion: details.emotion, responseNeed: "鼓励", musicDirection: details.musicDirection, completeness: 1 };
  addSessionMessage(session.id, "user", details.userMessage);
  addSessionMessage(session.id, "agent", details.agentMessage);
  touchActiveSession(session.id, { state, draft, expiresAt: expiresAtIso() });
  return getSessionSnapshot(session.id, userId)!;
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

function explicitlyRequestsGeneration(content: string): boolean {
  const text = content.trim();
  return /^(开始生成(?:吧)?|就这些了?|帮我生成音乐|生成音乐|可以生成了?|可以开始了?|开始吧|做成音乐)[。！!，,]?$/i.test(text) || /(?:重新|再)生成|(?:换成|换个|改成|改为).*(?:音乐|旋律|曲子|风格|节奏|配器)|(?:音乐|旋律|曲子).*(?:换成|改成|改为)/i.test(text);
}

export async function receiveMessage(id: string, userId: string, userName: string, content: string): Promise<{ snapshot: SessionSnapshot; shouldGenerate: boolean; generationReason: string | null }> {
  const before = assertActive(id, userId);
  addSessionMessage(id, "user", content);
  const withUser = getSessionSnapshot(id, userId)!;
  const reply = await generateAgentTurn({ userName, userMessage: content, state: before.state, draft: before.draft, recentMessages: withUser.messages.slice(-12) });
  const state = mergeAgentState(before.state, reply.statePatch);
  const draft: DiaryDraft = {
    ...before.draft,
    userTurnCount: before.draft.userTurnCount + 1,
    turnsSinceOrganization: 0,
    recentText: [before.draft.recentText, content.trim()].filter(Boolean).join("\n"),
  };

  const replyText = reply.replyParts.join("\n");
  addSessionMessage(id, "agent", replyText);
  touchActiveSession(id, { state, draft, expiresAt: expiresAtIso() });
  const userRequestedGeneration = explicitlyRequestsGeneration(content);
  const hasMinimumUserTurns = draft.userTurnCount >= 8;
  const shouldGenerate = userRequestedGeneration || (hasMinimumUserTurns && (reply.shouldGenerate || state.completeness >= 0.8));
  return { snapshot: getSessionSnapshot(id, userId)!, shouldGenerate, generationReason: userRequestedGeneration ? "用户主动要求生成" : reply.generationReason ?? (shouldGenerate ? "日记信息已经收集完成" : null) };
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
