import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateObject, jsonSchema, type Schema } from "ai";
import deepseekPrompts from "@/lib/server/deepseek-prompts.json";
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

const initialAgentGreeting = "你好呀，有什么想和我说的！";
const minimumAgentRepliesBeforeAutoGenerate = 16;

function countCompletedAgentReplies(messages: ChatMessage[]) {
  return messages.filter((message) => {
    if (message.role !== "agent") return false;
    const content = message.content.trim();
    return content && content !== initialAgentGreeting;
  }).length;
}

function requestsImmediateGeneration(text: string) {
  const normalized = text.replace(/\s+/g, "");
  if (
    /不要生成|先别生成|不想生成|还别生成|别生成|暂时不生成|不要创作|先别创作|不想创作|还别创作/.test(
      normalized,
    )
  ) {
    return false;
  }

  return /立即生成|马上生成|直接生成|现在生成|开始生成|开始创作|直接创作|不用问|别问了|不要再问|可以生成|够了|就这样|开始吧|生成吧|创作吧|做吧|来吧|生成一首|创作一首|做一首|来一首/.test(
    normalized,
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
    musicDirection: normalizeBoolean(value?.musicDirection),
    details: normalizeBoolean(value?.details),
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

type AgentTurnDraft = Omit<AgentTurnResult, "replyCount">;

const agentTurnSchema = jsonSchema<AgentTurnDraft>({
  type: "object",
  additionalProperties: false,
  required: ["action", "segments", "collected", "readyToGenerate"],
  properties: {
    action: { type: "string", enum: ["question", "generate"] },
    segments: {
      type: "array",
      items: { type: "string" },
    },
    readyToGenerate: { type: "boolean" },
    collected: {
      type: "object",
      additionalProperties: false,
      required: ["event", "emotion", "need", "musicDirection", "details"],
      properties: {
        event: { type: "boolean" },
        emotion: { type: "boolean" },
        need: { type: "boolean" },
        musicDirection: { type: "boolean" },
        details: { type: "boolean" },
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

function normalizeSegments(value: unknown, fallback: string[], maxLength = 420) {
  const segments = Array.isArray(value) ? value : [];
  const normalized = segments
    .map((segment) => (typeof segment === "string" ? segment.trim() : ""))
    .filter(Boolean)
    .join("")
    .slice(0, maxLength);

  return normalized ? [normalized] : fallback;
}

function collectedLooksReady(collected: CollectedSignals) {
  return collected.event && collected.emotion && collected.need && collected.musicDirection;
}

export async function generateAgentTurn(messages: ChatMessage[], apiKeys?: ApiKeys) {
  const previousAgentReplyCount = countCompletedAgentReplies(messages);
  const shouldGenerateNow = requestsImmediateGeneration(lastUserText(messages));
  const agentTurnPrompt = deepseekPrompts.agentTurn;
  const object = await generateStructuredObject<AgentTurnDraft>({
    apiKeys,
    label: "agent-turn",
    schema: agentTurnSchema,
    system: agentTurnPrompt.systemRules.join(" "),
    prompt: [
      `已完成的模型 agent 回复数（不含初始问候）：${previousAgentReplyCount}。`,
      `自动生成至少需要 ${minimumAgentRepliesBeforeAutoGenerate} 次模型 agent 回复；用户明确要求生成时可提前生成，这个判断由系统代码处理，你不需要猜。`,
      `对话如下：\n${conversationText(messages)}`,
      agentTurnPrompt.schemaInstruction,
      agentTurnPrompt.collectedInstruction,
      agentTurnPrompt.outputRules,
    ].join("\n\n"),
  });
  const collected = normalizeCollected(object.collected);
  const readyToGenerate = normalizeBoolean(object.readyToGenerate) || collectedLooksReady(collected);
  const canAutoGenerate =
    previousAgentReplyCount >= minimumAgentRepliesBeforeAutoGenerate && readyToGenerate;
  const action = shouldGenerateNow || canAutoGenerate ? "generate" : "question";
  const replyCount = previousAgentReplyCount + 1;
  const forcedQuestionFallback = [
    agentTurnPrompt.forcedQuestionFallback,
  ];
  const questionFallback = [
    agentTurnPrompt.questionFallback,
  ];
  const generateFallback = shouldGenerateNow
    ? [agentTurnPrompt.generateNowFallback]
    : [agentTurnPrompt.autoGenerateFallback];
  const rawSegments =
    action === "generate"
      ? shouldGenerateNow || object.action !== "generate"
        ? generateFallback
        : object.segments
      : object.action === "generate"
        ? forcedQuestionFallback
        : object.segments;
  const normalizedSegments = normalizeSegments(
    rawSegments,
    action === "generate" ? generateFallback : questionFallback,
  );

  return {
    action,
    segments: normalizedSegments,
    collected,
    readyToGenerate,
    replyCount,
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
    system: deepseekPrompts.cardContent.system,
    prompt: `完整对话：\n${conversationText(messages)}\n\n用户原始素材：\n${text}\n\n${deepseekPrompts.cardContent.outputInstruction}`,
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
    system: deepseekPrompts.regenerateCardContent.system,
    prompt: `当前卡片：\n${JSON.stringify({
      title: current.title,
      summary: current.summary,
      fullDiary: current.fullDiary,
      coverMeta: current.coverMeta,
      musicPrompt: current.musicPrompt,
    })}\n\n用户反馈：${normalizedFeedback}\n\n${deepseekPrompts.regenerateCardContent.outputInstruction}`,
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
