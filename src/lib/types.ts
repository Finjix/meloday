export type ChatRole = "agent" | "user";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};
export type MomentWeather = {
  summary: string;
  temperature: number;
  updatedAt: string;
};

export type MomentContext = {
  localDate: string;
  localTime: string;
  timeOfDay: "深夜" | "上午" | "中午" | "下午" | "晚上";
  timeZone: string;
  weather?: MomentWeather;
};


export type CollectedSignals = {
  event: boolean;
  emotion: boolean;
  need: boolean;
  musicDirection: boolean;
  details: boolean;
};

export type AgentTurnResult = {
  action: "question" | "generate";
  segments: string[];
  collected: CollectedSignals;
  readyToGenerate: boolean;
  replyCount: number;
};

export type CoverMeta = {
  query: string;
  source: "minimax-generated";
  description: string;
  palette: {
    from: string;
    via: string;
    to: string;
    accent: string;
  };
};

export type CardPayload = {
  id: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  title: string;
  summary: string;
  fullDiary: string;
  coverMeta: CoverMeta;
  musicPrompt: string;
  audioHex: string;
  audioMimeType: string;
  coverSeed: string;
};

export type GeneratedCard = CardPayload & {
  audioBlob: Blob;
  coverBlob: Blob;
  audioUrl: string;
  coverUrl: string;
};

export type DiarySource = {
  kind: "conversation" | "written";
  title?: string;
  content: string;
  mood?: string;
  reply?: string;
};

export type DiaryEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  title: string;
  summary: string;
  fullDiary: string;
  audioBlobId: string;
  coverBlobId: string;
  coverMeta: CoverMeta;
  source?: DiarySource;
  generationStatus?: "ready" | "audio-pending";
  favorite?: boolean;
};

export type AgentStreamMeta = {
  action: AgentTurnResult["action"];
  collected: CollectedSignals;
  readyToGenerate: boolean;
  replyCount: number;
};

export type AgentStreamLine =
  | ({ type: "meta" } & AgentStreamMeta)
  | { type: "delta"; text: string }
  | { type: "done" };

export type ApiKeys = {
  minimaxApiKey?: string;
};

export type CompanionPreferences = {
  nickname: string;
  replyStyle: "gentle" | "concise" | "direct";
  soundStyle: "warm" | "clear" | "deep";
  autoPlayEntry: boolean;
};

export type CompanionMemory = {
  id: string;
  text: string;
  useInResponses: boolean;
  createdAt: string;
};
