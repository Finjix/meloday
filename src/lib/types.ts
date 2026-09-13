export type User = {
  id: string;
  username: string;
  displayName: string;
  agentName: string;
  avatarAssetId: string | null;
  diaryLimit: number;
  createdAt: string;
};

export type SessionStatus = "active" | "generating" | "completed" | "abandoned" | "expired";

export type ResponseNeed = "倾听" | "安慰" | "共鸣" | "鼓励" | "轻松闲聊" | "继续追问";

export type MusicDirection = {
  mood: string;
  tempo: string;
  style: string;
  instruments: string[];
};

export type AgentState = {
  event: string;
  emotion: string;
  emotionChange: string;
  importantDetails: string[];
  responseNeed: ResponseNeed;
  musicDirection: MusicDirection;
  completeness: number;
};

export type AgentStatePatch = Omit<Partial<AgentState>, "musicDirection"> & { musicDirection?: Partial<MusicDirection> };

export type DiaryDraft = {
  stableText: string;
  recentText: string;
  userTurnCount: number;
  turnsSinceOrganization: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
};

export type AgentReply = {
  replyParts: string[];
  statePatch: AgentStatePatch;
  shouldGenerate: boolean;
  generationReason: string | null;
};

export type SessionSnapshot = {
  id: string;
  status: SessionStatus;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  state: AgentState;
  draft: DiaryDraft;
  messages: ChatMessage[];
};

export type GenerationStatus = "queued" | "running" | "succeeded" | "failed";
export type GenerationStage = "finalizing" | "music" | "cover" | "complete";

export type DiaryCard = {
  title: string;
  summary: string;
  body: string;
  musicDirection: MusicDirection;
  audioAssetId: string | null;
  coverAssetId: string | null;
};

export type GenerationJob = DiaryCard & {
  id: string;
  sessionId: string;
  parentGenerationId: string | null;
  status: GenerationStatus;
  stage: GenerationStage;
  feedback: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DiaryEntry = DiaryCard & {
  id: string;
  generationId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type CommunityItem = {
  entryId: string;
  title: string;
  summary: string;
  audioAssetId: string | null;
  coverAssetId: string | null;
  authorName: string;
  authorAvatarAssetId: string | null;
  publishedAt: string;
};

export const DEFAULT_AGENT_STATE: AgentState = {
  event: "",
  emotion: "",
  emotionChange: "",
  importantDetails: [],
  responseNeed: "倾听",
  musicDirection: {
    mood: "温柔、真诚",
    tempo: "中慢速",
    style: "轻盈的氛围音乐",
    instruments: ["钢琴", "木吉他", "柔和弦乐"],
  },
  completeness: 0,
};

export const EMPTY_DIARY_DRAFT: DiaryDraft = {
  stableText: "",
  recentText: "",
  userTurnCount: 0,
  turnsSinceOrganization: 0,
};

export function mergeAgentState(current: AgentState, patch: AgentStatePatch): AgentState {
  return {
    ...current,
    ...patch,
    importantDetails: Array.from(new Set(patch.importantDetails ?? current.importantDetails)).slice(0, 24),
    musicDirection: {
      ...current.musicDirection,
      ...(patch.musicDirection ?? {}),
      instruments: patch.musicDirection?.instruments ?? current.musicDirection.instruments,
    },
    completeness: Math.min(1, Math.max(0, Number(patch.completeness ?? current.completeness))),
  };
}

export function draftText(draft: DiaryDraft): string {
  return [draft.stableText, draft.recentText].filter(Boolean).join("\n\n").trim();
}
