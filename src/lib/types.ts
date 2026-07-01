export type ChatRole = "agent" | "user";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type CollectedSignals = {
  event: boolean;
  emotion: boolean;
  need: boolean;
};

export type AgentTurnResult = {
  action: "question" | "generate";
  message: string;
  collected: CollectedSignals;
};

export type CoverMeta = {
  query: string;
  source: "deepseek-generated";
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
};

export type AgentStreamMeta = {
  action: AgentTurnResult["action"];
  collected: CollectedSignals;
};

export type AgentStreamLine =
  | ({ type: "meta" } & AgentStreamMeta)
  | { type: "delta"; text: string }
  | { type: "done" };

export type ApiKeys = {
  deepseekApiKey?: string;
  minimaxApiKey?: string;
};
