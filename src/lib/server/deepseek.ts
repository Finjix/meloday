import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateObject, jsonSchema, type Schema } from "ai";
import { agentDebugLog } from "@/lib/server/debug-log";
import type {
  AgentTurnResult,
  ApiKeys,
  CardPayload,
  ChatMessage,
  CollectedSignals,
  CoverMeta,
} from "@/lib/types";

export const deepseekModelId = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

export class ServiceConfigError extends Error {
  status = 400;
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDeepSeekApiKey(apiKeys?: ApiKeys) {
  const key = process.env.DEEPSEEK_API_KEY || apiKeys?.deepseekApiKey;
  if (!key?.trim()) {
    throw new ServiceConfigError("缺少 DeepSeek API Key。请配置 DEEPSEEK_API_KEY，或在“我的”页填写。");
  }
  return key.trim();
}

function getDeepSeekModel(apiKeys?: ApiKeys) {
  return createDeepSeek({ apiKey: getDeepSeekApiKey(apiKeys) })(deepseekModelId);
}

function conversationText(messages: ChatMessage[]) {
  return messages
    .map((message) => `${message.role === "user" ? "用户" : "Meloday"}：${message.content}`)
    .join("\n");
}

function userText(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n");
}

function lastUserText(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

function requestsImmediateGeneration(text: string) {
  return /立即生成|马上生成|直接生成|现在生成|开始生成|开始创作|直接创作|不用问|别问了|不要再问|生成一首|创作一首|做一首|来一首/.test(
    text.replace(/\s+/g, ""),
  );
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : Boolean(value);
}

function normalizeCollected(value: Partial<CollectedSignals> | undefined): CollectedSignals {
  return {
    event: normalizeBoolean(value?.event),
    emotion: normalizeBoolean(value?.emotion),
    need: normalizeBoolean(value?.need),
  };
}

const fallbackPalette = {
  from: "#d9e7e2",
  via: "#f7f4ef",
  to: "#a9bfd7",
  accent: "#477c8b",
};

function normalizeHexColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizeCoverMeta(value: Partial<CoverMeta> | undefined, title: string): CoverMeta {
  return {
    query:
      typeof value?.query === "string" && value.query.trim()
        ? value.query.trim().slice(0, 180)
        : `${title}, quiet mobile diary cover`,
    source: "deepseek-generated",
    description:
      typeof value?.description === "string" && value.description.trim()
        ? value.description.trim().slice(0, 260)
        : `为《${title}》生成的安静音乐日记封面。`,
    palette: {
      from: normalizeHexColor(value?.palette?.from, fallbackPalette.from),
      via: normalizeHexColor(value?.palette?.via, fallbackPalette.via),
      to: normalizeHexColor(value?.palette?.to, fallbackPalette.to),
      accent: normalizeHexColor(value?.palette?.accent, fallbackPalette.accent),
    },
  };
}

function requiredText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

const agentTurnSchema = jsonSchema<AgentTurnResult>({
  type: "object",
  additionalProperties: false,
  required: ["action", "message", "collected"],
  properties: {
    action: { type: "string", enum: ["question", "generate"] },
    message: { type: "string" },
    collected: {
      type: "object",
      additionalProperties: false,
      required: ["event", "emotion", "need"],
      properties: {
        event: { type: "boolean" },
        emotion: { type: "boolean" },
        need: { type: "boolean" },
      },
    },
  },
});

type CardContent = {
  title: string;
  summary: string;
  fullDiary: string;
  coverMeta: CoverMeta;
  musicPrompt: string;
};

const cardContentSchema = jsonSchema<CardContent>({
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "fullDiary", "coverMeta", "musicPrompt"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    fullDiary: { type: "string" },
    musicPrompt: { type: "string" },
    coverMeta: {
      type: "object",
      additionalProperties: false,
      required: ["query", "source", "description", "palette"],
      properties: {
        query: { type: "string" },
        source: { type: "string", enum: ["deepseek-generated"] },
        description: { type: "string" },
        palette: {
          type: "object",
          additionalProperties: false,
          required: ["from", "via", "to", "accent"],
          properties: {
            from: { type: "string" },
            via: { type: "string" },
            to: { type: "string" },
            accent: { type: "string" },
          },
        },
      },
    },
  },
});

async function generateStructuredObject<T>({
  apiKeys,
  label,
  system,
  prompt,
  schema,
}: {
  apiKeys?: ApiKeys;
  label: string;
  system: string;
  prompt: string;
  schema: Schema<T>;
}) {
  const startedAt = Date.now();
  agentDebugLog(`DeepSeek ${label} input`, {
    model: deepseekModelId,
    system,
    prompt,
    providerOptions: {
      deepseek: {
        thinking: { type: "disabled" },
      },
    }
  });
  const result = await generateObject({
    model: getDeepSeekModel(apiKeys),
    schema,
    system,
    prompt,
    temperature: 0.5,
    maxRetries: 1,
    providerOptions: {
      deepseek: {
        thinking: { type: "disabled" },
      },
    },
  });
  agentDebugLog(`DeepSeek ${label} output`, {
    durationMs: Date.now() - startedAt,
    object: result.object,
  });
  return result.object;
}

export async function generateAgentTurn(messages: ChatMessage[], apiKeys?: ApiKeys) {
  const object = await generateStructuredObject<AgentTurnResult>({
    apiKeys,
    label: "agent-turn",
    schema: agentTurnSchema,
    system:
      "你是 Meloday，一个温柔、克制、会逐步倾听的中文音乐日记陪伴 agent。你必须只输出 JSON。判断用户是否已经说明了事件(event)、情绪(emotion)、以及希望音乐/日记提供的心理功能(need)。如果信息不足，action 用 question 并提出一个简短问题；如果三者基本齐全，action 用 generate，并用一句话说明你将开始创作。重要：如果用户明确要求立即生成、直接生成、现在创作，或直接提出“生成/创作一首某种音乐”，即使没有具体事件，也必须尊重用户意图，action 用 generate，不要追问事件。",
    prompt: `对话如下：\n${conversationText(messages)}\n\n请输出 {"action":"question"|"generate","message":"...","collected":{"event":boolean,"emotion":boolean,"need":boolean}}。message 使用中文，语气自然，不要超过 80 字。若用户要求立即生成，message 直接确认开始创作。`,
  });
  const shouldGenerateNow = requestsImmediateGeneration(lastUserText(messages));

  return {
    action: shouldGenerateNow || object.action === "generate" ? "generate" : "question",
    message: shouldGenerateNow
      ? requiredText(object.message, "好，我现在就为你生成一首欢快的纯器乐音乐。", 140)
      : requiredText(object.message, "你愿意再多和我说一点今天最留在心里的画面吗？", 140),
    collected: normalizeCollected(object.collected),
  } satisfies AgentTurnResult;
}

function normalizeCardContent(object: CardContent, fallbackText: string): CardContent {
  const title = requiredText(object.title, "今天的回声", 28);
  return {
    title,
    summary: requiredText(object.summary, "今天的某个瞬间，在心里留下了柔软的回声。", 90),
    fullDiary: requiredText(
      object.fullDiary,
      `今天我想记下这些片段：${fallbackText || "有些感受还在心里慢慢成形"}。`,
      1400,
    ),
    coverMeta: normalizeCoverMeta(object.coverMeta, title),
    musicPrompt: requiredText(
      object.musicPrompt,
      `Instrumental diary music named "${title}". Warm, intimate, reflective, no vocals, no lyrics, soft piano and light pads.`,
      1000,
    ),
  };
}

export async function generateCardContent(messages: ChatMessage[], apiKeys?: ApiKeys) {
  const text = userText(messages);
  const object = await generateStructuredObject<CardContent>({
    apiKeys,
    label: "generate-card-content",
    schema: cardContentSchema,
    system:
      "你是 Meloday 的内容生成器。根据用户倾诉或直接音乐需求生成一张中文音乐日记卡片，并为 MiniMax 音乐生成写英文器乐 prompt。必须只输出 JSON。日记要真诚、具体、不过度夸张；如果用户没有提供具体事件，只给出“立即生成一首欢快的音乐”这类需求，就围绕该音乐氛围生成简短卡片，不要编造具体人生事件。音乐必须是纯器乐，不要人声、不要歌词。",
    prompt: `用户输入：\n${text}\n\n请生成 JSON：title(中文歌名, 2-10字), summary(中文一句话), fullDiary(中文完整日记, 1-4段；没有具体事件时写成今日音乐愿望), coverMeta(query, source 固定 deepseek-generated, description, palette 四个 #RRGGBB 颜色), musicPrompt(英文, 明确 Instrumental, no vocals, no lyrics, mood, instruments, tempo)。`,
  });

  return normalizeCardContent(object, text);
}

export async function regenerateCardContent(
  current: CardPayload,
  feedback: string,
  apiKeys?: ApiKeys,
) {
  const normalizedFeedback = feedback.trim();
  const musicOnly = /只改音乐|只让音乐|保留日记|不改日记|文字不变|内容不变/.test(
    normalizedFeedback,
  );
  const object = await generateStructuredObject<CardContent>({
    apiKeys,
    label: "regenerate-card-content",
    schema: cardContentSchema,
    system:
      "你是 Meloday 的再生成编辑器。根据用户反馈改写音乐日记卡片，并为 MiniMax 音乐生成写英文器乐 prompt。必须只输出 JSON。音乐必须是纯器乐，不要人声、不要歌词。如果用户要求只改音乐，应保持标题、摘要、日记和封面语义不变，只调整 musicPrompt。",
    prompt: `当前卡片：\n${JSON.stringify({
      title: current.title,
      summary: current.summary,
      fullDiary: current.fullDiary,
      coverMeta: current.coverMeta,
      musicPrompt: current.musicPrompt,
    })}\n\n用户反馈：${normalizedFeedback}\n\n请输出完整的新卡片 JSON。`,
  });

  const next = normalizeCardContent(object, current.fullDiary);

  if (!musicOnly) {
    return next;
  }

  return {
    ...next,
    title: current.title,
    summary: current.summary,
    fullDiary: current.fullDiary,
    coverMeta: current.coverMeta,
  };
}

export function assembleCardPayload(
  content: CardContent,
  audio: { hex: string; mimeType: string },
  previous?: Pick<CardPayload, "createdAt" | "date">,
): CardPayload {
  const now = new Date().toISOString();
  return {
    id: makeId("card"),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    date: previous?.date ?? todayInShanghai(),
    title: content.title,
    summary: content.summary,
    fullDiary: content.fullDiary,
    coverMeta: content.coverMeta,
    musicPrompt: content.musicPrompt,
    audioHex: audio.hex,
    audioMimeType: audio.mimeType,
    coverSeed: `${content.title}|${content.coverMeta.description}|${now}`,
  };
}
