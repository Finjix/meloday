"use client";

import {
  ArrowUp,
  BookOpen,
  Footprints,
  Check,
  CloudSun,
  ChevronLeft,
  Heart,
  LoaderCircle,
  Maximize2,
  Mic,
  Pause,
  PenLine,
  Play,
  Radio,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import Image from "next/image";
import melodayLogo from "@/assets/brand/meloday-logo.png";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpokenReplyButton } from "@/components/audio/SpokenReplyButton";
import { BottomNav } from "@/components/navigation/BottomNav";
import { BackHeader } from "@/components/navigation/BackHeader";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { CoverArt } from "@/components/media/CoverArt";
import { MineView } from "@/features/mine/MineView";
import { MeditationModeView, MovementModeView, RestModeView } from "@/features/wellness/WellnessModes";
import {
  requestAgentTurn,
  requestCardGeneration,
  requestCardRegeneration,
  requestServiceAvailability,
  type ServiceAvailability,
} from "@/lib/api/client";
import { hasConversationHistory, loadConversation, saveConversation } from "@/lib/conversation";
import {
  deleteEntry,
  getMediaBlob,
  loadDiaryEntries,
  renameEntry,
  saveGeneratedCard,
  savePendingDiary,
  setEntryFavorite,
  updateEntryWithGeneratedCard,
} from "@/lib/storage";
import {
  defaultCompanionPreferences,
  loadCompanionPreferences,
  saveCompanionPreferences,
} from "@/lib/preferences";
import { getMomentContext, refreshMomentWeather } from "@/lib/moment-context";
import type {
  ChatMessage,
  CompanionPreferences,
  DiaryEntry,
  DiarySource,
  GeneratedCard,
  MomentContext,
} from "@/lib/types";

type ModeKey = "meditate" | "sleep" | "move";

type DiaryComposeInput = {
  title: string;
  content: string;
  mood: string;
};

type DiaryAudioProgress = {
  status: "replying" | "rendering" | "ready" | "error";
  input: DiaryComposeInput;
  reply?: string;
  entryId?: string;
  title?: string;
  error?: string;
};

type AppView =
  | { name: "home" }
  | { name: "mode"; mode: ModeKey }
  | { name: "diary" }
  | { name: "compose-diary" }
  | { name: "diary-audio" }
  | { name: "today" }
  | { name: "notebook" }
  | { name: "mine"; panel?: "services" }
  | { name: "entry"; id: string; returnTo?: "diary" | "mine" | "home" }
  | { name: "draft-detail" };

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: makeId(role),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function initialMessages() {
  return [
    createMessage(
      "agent",
      "现在的你是什么感觉？说一句就好，我会从这里为你写一段声音。",
    ),
  ];
}

function materializeConversation(
  messages: ChatMessage[],
  fullAgentReplies: Record<string, string>,
) {
  return messages.map((message) =>
    message.role === "agent" && fullAgentReplies[message.id]
      ? { ...message, content: fullAgentReplies[message.id] }
      : message,
  );
}

function buildConversationSource(
  messages: ChatMessage[],
  fullAgentReplies: Record<string, string>,
): DiarySource | undefined {
  const conversation = materializeConversation(messages, fullAgentReplies);
  const content = conversation
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
  if (!content) return undefined;

  const reply = [...conversation]
    .reverse()
    .find((message) => message.role === "agent" && message.content.trim())?.content.trim();
  return { kind: "conversation", content, reply };
}

function formatDebugConversation(
  messages: ChatMessage[],
  fullAgentReplies: Record<string, string> = {},
) {
  return materializeConversation(messages, fullAgentReplies)
    .filter((message) => message.content.trim())
    .map((message) => {
      const role = message.role === "user" ? "用户" : "Meloday";
      return `${role}：${message.content.trim()}`;
    })
    .join("\n\n");
}

function normalizeForRepeatCheck(text: string) {
  return text.replace(/\s+/g, "").replace(/[。！？!?；;，,、…]/g, "");
}

function repeatsRecentAgentReply(
  text: string,
  messages: ChatMessage[],
  fullAgentReplies: Record<string, string>,
) {
  const normalizedText = normalizeForRepeatCheck(text);
  if (!normalizedText) return false;

  return materializeConversation(messages, fullAgentReplies)
    .filter((message) => message.role === "agent")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .slice(-3)
    .some((messageText) => normalizeForRepeatCheck(messageText) === normalizedText);
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea fallback when browser clipboard permission is blocked.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text: string) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += 4) {
    chunks.push(text.slice(index, index + 4));
  }
  return chunks;
}

type DisplayPart = {
  text: string;
  delayBeforeMs: number;
};

function splitLongReplyForDisplay(text: string): DisplayPart[] {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) return [];

  const displayUnits: string[] = [];
  let current = "";
  let commaCount = 0;

  for (const char of normalizedText) {
    current += char;

    if (char === "，") {
      commaCount += 1;
      if (commaCount >= 2) {
        displayUnits.push(current.trim());
        current = "";
        commaCount = 0;
      }
      continue;
    }

    if (/。|！|？|!|\?|；|;|…/.test(char)) {
      displayUnits.push(current.trim());
      current = "";
      commaCount = 0;
      continue;
    }
  }

  if (current.trim()) {
    displayUnits.push(current.trim());
  }

  const isQuestionUnit = (unit: string) => /[？?]\s*$/.test(unit);
  const normalizedSentences = displayUnits.filter(Boolean).reduce<string[]>((units, unit) => {
    const previous = units.at(-1);
    if (previous && isQuestionUnit(previous) && isQuestionUnit(unit)) {
      units[units.length - 1] = `${previous}${unit}`;
      return units;
    }

    units.push(unit);
    return units;
  }, []);

  const lastUnit = normalizedSentences.at(-1) ?? "";
  if (normalizedSentences.length > 1 && isQuestionUnit(lastUnit)) {
    return [
      { text: normalizedSentences.slice(0, -1).join(""), delayBeforeMs: 0 },
      { text: lastUnit, delayBeforeMs: 3000 },
    ].filter((part) => part.text.trim());
  }

  const displayTexts = normalizedSentences.length > 3 ? normalizedSentences : [normalizedText];
  return displayTexts.map((part, index) => ({
    text: part,
    delayBeforeMs: index === 0 ? 0 : 2400,
  }));
}

function disposeGeneratedCard(card?: GeneratedCard | null) {
  if (!card) return;
  URL.revokeObjectURL(card.audioUrl);
  URL.revokeObjectURL(card.coverUrl);
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

function formatWritingDate(date: Date) {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return {
    date: `${date.getMonth() + 1}月${date.getDate()}日`,
    weekday: weekdays[date.getDay()],
  };
}

function useEntryMedia(entry?: DiaryEntry) {
  const [audioUrl, setAudioUrl] = useState<string>();
  const [coverUrl, setCoverUrl] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let nextAudioUrl: string | undefined;
    let nextCoverUrl: string | undefined;

    async function loadMedia() {
      if (!entry) {
        setAudioUrl(undefined);
        setCoverUrl(undefined);
        return;
      }

      const [audioBlob, coverBlob] = await Promise.all([
        getMediaBlob(entry.audioBlobId),
        getMediaBlob(entry.coverBlobId),
      ]);

      if (disposed) return;

      nextAudioUrl = audioBlob ? URL.createObjectURL(audioBlob) : undefined;
      nextCoverUrl = coverBlob ? URL.createObjectURL(coverBlob) : undefined;
      setAudioUrl(nextAudioUrl);
      setCoverUrl(nextCoverUrl);
    }

    loadMedia();

    return () => {
      disposed = true;
      if (nextAudioUrl) URL.revokeObjectURL(nextAudioUrl);
      if (nextCoverUrl) URL.revokeObjectURL(nextCoverUrl);
    };
  }, [entry]);

  return { audioUrl, coverUrl };
}

export default function HomeApp() {
  const [view, setView] = useState<AppView>({ name: "home" });
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages());
  const [conversationReady, setConversationReady] = useState(false);
  const [input, setInput] = useState("");
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [generation, setGeneration] = useState<{
    running: boolean;
    error?: string;
  } | null>(null);
  const [draftVersions, setDraftVersions] = useState<GeneratedCard[]>([]);
  const [draftIndex, setDraftIndex] = useState(0);
  const [isDraftPreviewOpen, setIsDraftPreviewOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [companionPreferences, setCompanionPreferences] =
    useState<CompanionPreferences>(defaultCompanionPreferences);
  const [serviceAvailability, setServiceAvailability] =
    useState<ServiceAvailability | null>(null);
  const [momentContext, setMomentContext] = useState<MomentContext | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState("");
  const [diaryAudioProgress, setDiaryAudioProgress] = useState<DiaryAudioProgress | null>(null);
  const [debugCopyNotice, setDebugCopyNotice] = useState("");
  const debugCopyTimerRef = useRef<number | null>(null);
  const fullAgentRepliesRef = useRef<Record<string, string>>({});

  const currentDraft = draftVersions[draftIndex] ?? null;
  const selectedEntry =
    view.name === "entry" ? entries.find((entry) => entry.id === view.id) : undefined;
  const revisitEntry =
    entries.find((entry) => entry.favorite) ??
    entries.at(-1) ??
    entries[0];

  const refreshEntries = useCallback(() => {
    setEntries(loadDiaryEntries());
  }, []);

  const refreshServiceAvailability = useCallback(async () => {
    setServiceAvailability(await requestServiceAvailability());
  }, []);

  async function handleWeatherRefresh() {
    if (weatherBusy) return;
    setWeatherBusy(true);
    setWeatherNotice("");
    try {
      await refreshMomentWeather();
      setMomentContext(getMomentContext());
    } catch (error) {
      setWeatherNotice(
        error instanceof Error ? error.message : "天气暂时没有更新，可以稍后再试。",
      );
    } finally {
      setWeatherBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshEntries();
      setCompanionPreferences(loadCompanionPreferences());
      void refreshServiceAvailability();
      setMomentContext(getMomentContext());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshEntries, refreshServiceAvailability]);


  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedConversation = loadConversation();
      if (savedConversation.length) setMessages(savedConversation);
      setConversationReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!conversationReady) return;
    const timer = window.setTimeout(() => {
      saveConversation(materializeConversation(messages, fullAgentRepliesRef.current));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [conversationReady, messages]);
  useEffect(() => {
    async function copyDebugConversation() {
      const debugText =
        formatDebugConversation(messages, fullAgentRepliesRef.current) ||
        "暂无对话内容。";
      await copyTextToClipboard(debugText);
      setDebugCopyNotice("已复制调试信息");

      if (debugCopyTimerRef.current) {
        window.clearTimeout(debugCopyTimerRef.current);
      }
      debugCopyTimerRef.current = window.setTimeout(() => {
        setDebugCopyNotice("");
        debugCopyTimerRef.current = null;
      }, 1600);
    }

    function handleDebugKeydown(event: KeyboardEvent) {
      if (event.key !== "5" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
        return;
      }

      event.preventDefault();
      copyDebugConversation().catch(() => {
        setDebugCopyNotice("复制调试信息失败");
      });
    }

    window.addEventListener("keydown", handleDebugKeydown);
    return () => {
      window.removeEventListener("keydown", handleDebugKeydown);
      if (debugCopyTimerRef.current) {
        window.clearTimeout(debugCopyTimerRef.current);
      }
    };
  }, [messages]);

  async function runGeneration(conversation: ChatMessage[]) {
    if (serviceAvailability?.sound === "missing") {
      setView({ name: "today" });
      setGeneration({
        running: false,
        error: "完成声音连接后，这段对话就可以继续变成一段声音。",
      });
      return;
    }

    setGeneration({ running: true });
    setView({ name: "today" });

    try {
      const card = await requestCardGeneration(conversation);
      draftVersions.forEach(disposeGeneratedCard);
      setDraftVersions([card]);
      setDraftIndex(0);
      setIsDraftPreviewOpen(true);
      setGeneration(null);
    } catch (error) {
      console.error(error);
      setGeneration({
        running: false,
        error: "声音暂时没有完成，对话已经留着，可以稍后再试。",
      });
    }
  }

  async function runRegenerationFromMain(card: GeneratedCard, feedback: string) {
    if (serviceAvailability?.sound === "missing") {
      setView({ name: "today" });
      setGeneration({
        running: false,
        error: "完成声音连接后，就可以继续调整这一段声音。",
      });
      return;
    }

    setGeneration({ running: true });
    setIsDraftPreviewOpen(false);
    setView({ name: "today" });

    try {
      const nextCard = await requestCardRegeneration(card, feedback);
      draftVersions.forEach(disposeGeneratedCard);
      setDraftVersions([nextCard]);
      setDraftIndex(0);
      setIsDraftPreviewOpen(true);
      setGeneration(null);
    } catch (error) {
      console.error(error);
      setGeneration({
        running: false,
        error: "这次调整暂时没有完成，原来的声音还在。",
      });
    }
  }

  async function revealAgentReply(messageId: string, text: string) {
    const displayParts = splitLongReplyForDisplay(text);
    fullAgentRepliesRef.current[messageId] = text;

    for (let partIndex = 0; partIndex < displayParts.length; partIndex += 1) {
      const displayPart = displayParts[partIndex];
      if (displayPart.delayBeforeMs > 0) {
        await sleep(displayPart.delayBeforeMs);
      }

      setMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, content: "" } : message)),
      );

      for (const chunk of chunkText(displayPart.text)) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, content: `${message.content}${chunk}` }
              : message,
          ),
        );
        await sleep(32);
      }
    }
  }

  async function requestAgentTurnWithoutVisibleRepeat(
    conversation: ChatMessage[],
    userMessage: ChatMessage,
  ) {
    let attemptConversation = conversation;
    let meta = await requestAgentTurn(attemptConversation);

    for (let retryIndex = 0; retryIndex < 2; retryIndex += 1) {
      if (!repeatsRecentAgentReply(meta.text, messages, fullAgentRepliesRef.current)) {
        return meta;
      }

      attemptConversation = [
        ...attemptConversation,
        createMessage("agent", meta.text),
        createMessage("user", userMessage.content),
      ];
      meta = await requestAgentTurn(attemptConversation);
    }

    return meta;
  }

  async function submitMessage(contentOverride?: string) {
    const content = (contentOverride ?? input).trim();
    if (!content || isAgentBusy || generation?.running) return;
    if (serviceAvailability?.conversation === "missing") {
      setView({ name: "mine", panel: "services" });
      return;
    }

    if (currentDraft) {
      const userMessage = createMessage("user", content);
      const assistantMessage = createMessage("agent", "好，我按你说的再靠近一点。");

      setInput("");
      setMessages((current) => [...current, userMessage, assistantMessage]);
      await runRegenerationFromMain(currentDraft, content);
      return;
    }

    const userMessage = createMessage("user", content);
    const assistantMessage = createMessage("agent", "");
    const conversation = [
      ...materializeConversation(messages, fullAgentRepliesRef.current),
      userMessage,
    ];

    setInput("");
    setMessages([...conversation, assistantMessage]);
    setIsAgentBusy(true);

    try {
      const meta = await requestAgentTurnWithoutVisibleRepeat(conversation, userMessage);
      await revealAgentReply(assistantMessage.id, meta.text);

      setIsAgentBusy(false);

      if (meta.action === "generate") {
        await runGeneration(conversation);
      }
    } catch (error) {
      console.error(error);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                content: "刚才那句话没有顺利传回来。你的内容还在，可以再发一次。",
              }
            : message,
        ),
      );
      setIsAgentBusy(false);
    }
  }

  async function saveCurrentDraft() {
    if (!currentDraft) return;
    setIsSavingDraft(true);

    try {
      const source = buildConversationSource(messages, fullAgentRepliesRef.current);
      const entry = await saveGeneratedCard(currentDraft, source);
      draftVersions.forEach(disposeGeneratedCard);
      setDraftVersions([]);
      setDraftIndex(0);
      setInput("");
      fullAgentRepliesRef.current = {};
      setMessages(initialMessages());
      refreshEntries();
      setView({ name: "entry", id: entry.id });
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function createAudioDiaryFromComposer(
    input: DiaryComposeInput,
    existingEntryId?: string,
    existingReply?: string,
  ) {
    const title = input.title.trim();
    const diaryMessage = [
      "我写了一篇日记，想把它做成一段专属声音日记。",
      "请先自然地回应其中的感受，不需要提问；随后基于这段内容生成声音日记。",
      title ? "日记标题：" + title : "",
      "此刻心情：" + input.mood,
      "日记内容：",
      input.content.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
    const userMessage = createMessage("user", diaryMessage);
    let reply = existingReply?.trim() ?? "";
    let card: GeneratedCard | undefined;

    setDiaryAudioProgress({
      status: reply ? "rendering" : "replying",
      input,
      reply: reply || undefined,
      entryId: existingEntryId,
    });
    setView({ name: "diary-audio" });

    try {
      if (!reply) {
        const response = await requestAgentTurn([userMessage]);
        reply = response.text.trim() || "我已经读到了你的这段心情。";
      }
      setDiaryAudioProgress({
        status: "rendering",
        input,
        reply,
        entryId: existingEntryId,
      });

      card = await requestCardGeneration([
        userMessage,
        createMessage("agent", reply),
      ]);
      const source: DiarySource = {
        kind: "written",
        title: input.title.trim() || undefined,
        content: input.content.trim(),
        mood: input.mood,
        reply,
      };
      const existingEntry = existingEntryId
        ? loadDiaryEntries().find((entry) => entry.id === existingEntryId)
        : undefined;
      const entry = existingEntry
        ? await updateEntryWithGeneratedCard(existingEntry, card)
        : await saveGeneratedCard(card, source);
      disposeGeneratedCard(card);
      card = undefined;
      refreshEntries();
      setDiaryAudioProgress({
        status: "ready",
        input,
        reply,
        entryId: entry.id,
        title: entry.title,
      });
    } catch (error) {
      if (card) disposeGeneratedCard(card);
      const entry = savePendingDiary(
        {
          kind: "written",
          title: input.title.trim() || undefined,
          content: input.content.trim(),
          mood: input.mood,
          reply: reply || undefined,
        },
        existingEntryId,
      );
      refreshEntries();
      setDiaryAudioProgress({
        status: "error",
        input,
        reply: reply || undefined,
        entryId: entry.id,
        title: entry.title,
        error: error instanceof Error ? error.message : "声音日记暂时没有完成。",
      });
    }
  }

  function resetToday() {
    draftVersions.forEach(disposeGeneratedCard);
    setDraftVersions([]);
    setDraftIndex(0);
    setIsDraftPreviewOpen(false);
    setInput("");
    fullAgentRepliesRef.current = {};
    setMessages(initialMessages());
    setGeneration(null);
    setView({ name: "today" });
  }

  function handleRename(entryId: string, title: string) {
    renameEntry(entryId, title);
    refreshEntries();
  }

  function handleFavorite(entryId: string, favorite: boolean) {
    setEntryFavorite(entryId, favorite);
    refreshEntries();
  }

  async function handleDelete(entry: DiaryEntry) {
    if (!window.confirm(`删除《${entry.title}》吗？`)) return;
    await deleteEntry(entry);
    refreshEntries();
    setView({ name: "diary" });
  }

  function handlePreferenceUpdate(next: CompanionPreferences) {
    setCompanionPreferences(next);
    saveCompanionPreferences(next);
  }

  async function handleClearEntries() {
    if (!entries.length) return;
    if (!window.confirm("清除全部日记、封面和声音吗？此操作无法撤销。")) return;

    for (const entry of entries) {
      await deleteEntry(entry);
    }
    refreshEntries();
  }

  return (
    <main className="healing-root app-root">
      <div className="healing-phone app-shell">
        <div className="app-content">
          {view.name === "home" ? (
            <HomeDashboardView
              openRadio={() => setView({ name: "today" })}
              hasConversation={hasConversationHistory(messages)}
              serviceAvailability={serviceAvailability}
              momentContext={momentContext}
              weatherBusy={weatherBusy}
              weatherNotice={weatherNotice}
              refreshWeather={() => void handleWeatherRefresh()}
              openServices={() => setView({ name: "mine", panel: "services" })}
              revisitEntry={revisitEntry}
              openEntry={(id) => setView({ name: "entry", id, returnTo: "home" })}
              openDiaryCompose={() => setView({ name: "compose-diary" })}
              openMode={(mode) => setView({ name: "mode", mode })}
            />
          ) : null}

          {view.name === "mode" && view.mode === "meditate" ? (
            <MeditationModeView goBack={() => setView({ name: "home" })} />
          ) : null}

          {view.name === "mode" && view.mode === "move" ? (
            <MovementModeView goBack={() => setView({ name: "home" })} />
          ) : null}

          {view.name === "mode" && view.mode === "sleep" ? (
            <RestModeView goBack={() => setView({ name: "home" })} />
          ) : null}

          {view.name === "diary" ? (
            <DiaryHubView
              entries={entries}
              startWriting={() => setView({ name: "compose-diary" })}
              openEntry={(id) => {
                setView({ name: "entry", id });
              }}
              renameEntry={handleRename}
              deleteEntry={handleDelete}
              favoriteEntry={handleFavorite}
            />
          ) : null}

          {view.name === "compose-diary" ? (
            <DiaryComposerView
              goBack={() => {
                refreshEntries();
                setView({ name: "diary" });
              }}
              createAudioDiary={createAudioDiaryFromComposer}
            />
          ) : null}

          {view.name === "diary-audio" ? (
            <DiaryAudioProgressView
              progress={diaryAudioProgress}
              goBack={() => setView({ name: "diary" })}
              openEntry={(id) => setView({ name: "entry", id })}
              retry={() => {
                if (diaryAudioProgress) {
                  void createAudioDiaryFromComposer(
                    diaryAudioProgress.input,
                    diaryAudioProgress.entryId,
                    diaryAudioProgress.reply,
                  );
                }
              }}
            />
          ) : null}

          {view.name === "today" ? (
            <TodayView
              messages={messages}
              input={input}
              isAgentBusy={isAgentBusy}
              soundStyle={companionPreferences.soundStyle}
              setInput={setInput}
              submitMessage={submitMessage}
              generation={generation}
              soundNeedsConnection={serviceAvailability?.sound === "missing"}
              openServices={() => {
                setGeneration(null);
                setView({ name: "mine", panel: "services" });
              }}
              retryGeneration={() =>
                runGeneration(materializeConversation(messages, fullAgentRepliesRef.current))
              }
              draft={currentDraft}
              isDraftPreviewOpen={isDraftPreviewOpen}
              openDraftPreview={() => setIsDraftPreviewOpen(true)}
              closeDraftPreview={() => setIsDraftPreviewOpen(false)}
              openDraftDetail={() => {
                setIsDraftPreviewOpen(false);
                setView({ name: "draft-detail" });
              }}
              resetToday={resetToday}
              goHome={() => setView({ name: "home" })}
            />
          ) : null}

          {view.name === "notebook" ? (
            <NotebookView
              entries={entries}
              openEntry={(id) => {
                setView({ name: "entry", id });
              }}
              renameEntry={handleRename}
              deleteEntry={handleDelete}
              startNew={() => setView({ name: "compose-diary" })}
            />
          ) : null}

          {view.name === "entry" ? (
            <EntryDetailView
              entry={selectedEntry}
              goBack={() => {
                if (view.returnTo === "home") {
                  setView({ name: "home" });
                } else {
                  setView(view.returnTo === "mine" ? { name: "mine" } : { name: "diary" });
                }
              }}
              renameEntry={handleRename}
              deleteEntry={handleDelete}
              favoriteEntry={handleFavorite}
              retryAudioDiary={(entry) => {
                if (!entry.source) return;
                void createAudioDiaryFromComposer(
                  {
                    title: entry.source.title ?? entry.title,
                    content: entry.source.content,
                    mood: entry.source.mood ?? "平静",
                  },
                  entry.id,
                  entry.source.reply,
                );
              }}
              autoPlay={companionPreferences.autoPlayEntry}
              soundStyle={companionPreferences.soundStyle}
            />
          ) : null}

          {view.name === "mine" ? (
            <MineView
              entries={entries}
              preferences={companionPreferences}
              updatePreferences={handlePreferenceUpdate}
              openEntry={(id) => setView({ name: "entry", id, returnTo: "mine" })}
              clearEntries={handleClearEntries}
              archiveImported={refreshEntries}
              initialPanel={view.panel}
              serviceAvailability={serviceAvailability}
              servicesChanged={refreshServiceAvailability}
            />
          ) : null}

          {view.name === "draft-detail" ? (
            <DraftDetailView
              draft={currentDraft}
              goBack={() => setView({ name: "today" })}
              saveCurrentDraft={saveCurrentDraft}
              isSavingDraft={isSavingDraft}
            />
          ) : null}
        </div>

        <BottomNav
          active={
            (view.name === "home" ||
              view.name === "mode" ||
              view.name === "today" ||
              view.name === "draft-detail" ||
              (view.name === "entry" && view.returnTo === "home"))
              ? "home"
              : view.name === "mine" ||
                  (view.name === "entry" && view.returnTo === "mine")
                ? "mine"
                : "diary"
          }
          goHome={() => setView({ name: "home" })}
          goDiary={() => {
            refreshEntries();
            setView({ name: "diary" });
          }}
          goMine={() => {
            setView({ name: "mine" });
          }}
        />
        {debugCopyNotice ? <DebugCopyToast message={debugCopyNotice} /> : null}
      </div>
    </main>
  );
}

function AppHeader(props: { right?: React.ReactNode }) {
  void props;
  return null;
}

function HomeDashboardView({
  openRadio,
  hasConversation,
  serviceAvailability,
  momentContext,
  weatherBusy,
  weatherNotice,
  refreshWeather,
  openServices,
  revisitEntry,
  openEntry,
  openDiaryCompose,
  openMode,
}: {
  openRadio: () => void;
  hasConversation: boolean;
  serviceAvailability: ServiceAvailability | null;
  momentContext: MomentContext | null;
  weatherBusy: boolean;
  weatherNotice: string;
  refreshWeather: () => void;
  openServices: () => void;
  revisitEntry?: DiaryEntry;
  openEntry: (id: string) => void;
  openDiaryCompose: () => void;
  openMode: (mode: ModeKey) => void;
}) {
  const conversationNeedsConnection = serviceAvailability?.conversation === "missing";
  const soundNeedsConnection = serviceAvailability?.sound === "missing";
  const connectionNeedsAttention = conversationNeedsConnection || soundNeedsConnection;
  const connectionLabel = serviceAvailability === null
    ? "正在确认"
    : conversationNeedsConnection
      ? "等待连接"
      : soundNeedsConnection
        ? "声音待连接"
        : "在这里";
  const momentDateLabel = momentContext
    ? Number(momentContext.localDate.slice(5, 7)) +
      "月" +
      Number(momentContext.localDate.slice(8, 10)) +
      "日"
    : "今天";
  const weatherLabel = weatherBusy
    ? "正在读取天气"
    : momentContext?.weather
      ? momentDateLabel +
        " · " +
        momentContext.weather.summary +
        " " +
        Math.round(momentContext.weather.temperature) +
        "°"
      : momentDateLabel + " · 加入天气";

  const featureCards = [
    {
      title: "写一段声音日记",
      detail: "让今天留下一点温度。",
      icon: <BookOpen size={22} />,
      className: "mode-card--paper",
      onClick: openDiaryCompose,
    },
    {
      title: "静一会儿",
      detail: "把注意力，慢慢还给呼吸。",
      icon: <Sparkles size={22} />,
      className: "mode-card--mint",
      onClick: () => openMode("meditate"),
    },
    {
      title: "休息一会儿",
      detail: "不用等到晚上，随时松一口气。",
      icon: <Waves size={22} />,
      className: "mode-card--night",
      onClick: () => openMode("sleep"),
    },
    {
      title: "身体唤醒",
      detail: "跟着节奏，做一段轻量活动。",
      icon: <Footprints size={22} />,
      className: "mode-card--blue",
      onClick: () => openMode("move"),
    },
  ];

  return (
    <section className="home-shell">
      <div className="home-header">
        <div>
          <div className="home-brand">
            <Image
              src={melodayLogo}
              alt="Meloday"
              width={1500}
              height={669}
              priority
            />
          </div>
          <button
            type="button"
            onClick={refreshWeather}
            disabled={weatherBusy}
            className="home-weather"
            aria-label={
              momentContext?.weather
                ? "更新此刻天气"
                : "加入此刻天气，需要授权大致位置"
            }
          >
            <CloudSun size={16} aria-hidden="true" />
            <span>{weatherLabel}</span>
          </button>
          {weatherNotice ? (
            <p className="home-weather-notice" role="status">{weatherNotice}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openServices}
          disabled={!connectionNeedsAttention}
          className={"home-status" + (connectionNeedsAttention ? " home-status--attention" : "")}
          aria-label={connectionNeedsAttention ? "打开服务连接" : connectionLabel}
        >
          <span className="home-status__dot" />
          {connectionLabel}
        </button>
      </div>

      <button
        type="button"
        onClick={conversationNeedsConnection ? openServices : openRadio}
        className="premium-hero home-hero"
      >
        <div className="premium-hero__content">
          <div className="premium-hero__status-row">
            <div className="premium-hero__badge">
              <span className="premium-hero__dot" />
              {conversationNeedsConnection ? "开始前" : hasConversation ? "上次聊到这里" : "此刻声场"}
            </div>
          </div>

          <div>
            <p className="premium-hero__eyebrow">
              {conversationNeedsConnection ? "完成一次连接" : hasConversation ? "对话已经为你留着" : "为此刻生成"}
            </p>
            <h2 className="premium-hero__title">
              {conversationNeedsConnection
                ? "准备好回应和声音"
                : hasConversation
                  ? "没说完的话，可以从这里继续"
                  : "说说现在，听见只属于你的声音"}
            </h2>
            <p className="premium-hero__description">
              {conversationNeedsConnection
                ? "完成后，就可以直接说出现在的感觉。"
                : hasConversation
                  ? "不用重新讲一遍，接着刚才的感觉说就好。"
                  : "不用挑曲风。疲惫、烦乱、想放空，直接说就好。"}
            </p>
          </div>

          <div className="premium-hero__footer">
            <span className="premium-hero__label">
              {conversationNeedsConnection ? "去完成连接" : hasConversation ? "继续聊" : "从一句话开始"}
            </span>
            <span className="premium-hero__play">
              <Play size={17} className="icon-leading" fill="currentColor" />
            </span>
          </div>
        </div>
      </button>

      {revisitEntry ? (
        <button
          type="button"
          onClick={() => openEntry(revisitEntry.id)}
          className="home-revisit"
        >
          <span className="home-revisit__copy">
            <small>
              {revisitEntry.favorite ? "收藏的声音" : "再听一次"} · {formatDateLabel(revisitEntry.date)}
            </small>
            <strong>《{revisitEntry.title}》</strong>
            <span>{revisitEntry.summary}</span>
          </span>
          <i aria-hidden="true">
            <Play size={16} fill="currentColor" />
          </i>
        </button>
      ) : null}

      <div className="home-options-heading">
        <div>
          <p className="home-options-heading__eyebrow">也可以先从这里开始</p>
          <h2 className="home-options-heading__title">不想说话时，也有别的方式</h2>
        </div>
        <span className="home-options-heading__aside">随时回来</span>
      </div>

      <div className="home-mode-grid">
        {featureCards.map((card) => {
          const content = (
            <>
              <div className="mode-card__top">
                <span className="mode-card__icon">
                  {card.icon}
                </span>
              </div>
              <div className="mode-card__copy">
                <h3 className="mode-card__title">{card.title}</h3>
                <p className="mode-card__detail">{card.detail}</p>
              </div>
            </>
          );

          return card.onClick ? (
            <button
              key={card.title}
              type="button"
              onClick={card.onClick}
              className={"mode-card home-mode-card " + card.className}
            >
              {content}
            </button>
          ) : (
            <article
              key={card.title}
              className={"mode-card home-mode-card " + card.className}
            >
              {content}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DiaryComposerView({
  goBack,
  createAudioDiary,
}: {
  goBack: () => void;
  createAudioDiary: (input: DiaryComposeInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("平静");
  const [showRequired, setShowRequired] = useState(false);
  const writingDate = formatWritingDate(new Date());
  const writingTime = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  const moods = ["平静", "开心", "疲惫", "想念", "复杂"];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content.trim()) {
      setShowRequired(true);
      return;
    }

    await createAudioDiary({ title, content, mood });
  }

  return (
    <>
      <BackHeader goBack={goBack} title="写声音日记" />
      <section className="diary-compose-page">
        <div className="diary-compose-editor">
          <header className="diary-compose-page__header">
            <div className="diary-compose-heading">
              <div>
                <p className="diary-compose-page__date">
                  {writingDate.weekday} · {writingDate.date}
                </p>
                <h1>给此刻，一段回声</h1>
              </div>
              <div className="diary-compose-orb" aria-hidden="true">
                <i />
                <i />
              </div>
            </div>
            <p>有些事，写下就好。</p>
            <div className="diary-compose-soundline" aria-label={"此刻 · " + writingTime}>
              <div aria-hidden="true">
                {[14, 26, 38, 21, 48, 31, 18, 42, 25, 35, 15].map((height, index) => (
                  <span key={height + "-" + index} style={{ height }} />
                ))}
              </div>
              <span>此刻 · {writingTime}</span>
            </div>
          </header>

          <form className="diary-compose-form" onSubmit={handleSubmit}>
            <div className="diary-compose-sheet">
              <label className="visually-hidden" htmlFor="diary-title">日记标题</label>
              <input
                id="diary-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={36}
                placeholder="给它一个名字"
                className="diary-compose-title"
              />

              <label className="visually-hidden" htmlFor="diary-content">日记内容</label>
              <textarea
                id="diary-content"
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  if (event.target.value.trim()) setShowRequired(false);
                }}
                maxLength={2000}
                placeholder="先写下你舍不得略过的那一瞬。"
                className="diary-compose-body"
              />
            </div>

            <div className="diary-compose-moods">
              <p>这一页的颜色</p>
              <div role="group" aria-label="选择心情">
                {moods.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMood(item)}
                    className={
                      "diary-compose-mood" +
                      (mood === item ? " diary-compose-mood--active" : "")
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="diary-compose-footer">
              <div className="diary-compose-meta" aria-live="polite">
                <span>
                  {showRequired
                    ? "先留下一点此刻的痕迹"
                    : content.trim()
                      ? "这一页正在有了形状"
                      : "还没有落笔"}
                </span>
                <span>{content.length ? content.length + " 字" : ""}</span>
              </div>

              <button type="submit" className="diary-compose-save">
                <Waves size={18} strokeWidth={1.9} />
                留作声音
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}

function DiaryAudioProgressView({
  progress,
  goBack,
  openEntry,
  retry,
}: {
  progress: DiaryAudioProgress | null;
  goBack: () => void;
  openEntry: (id: string) => void;
  retry: () => void;
}) {
  const status = progress?.status ?? "replying";
  const title =
    status === "ready"
      ? "这一段，已经留好"
      : status === "error"
        ? "文字已经留好"
        : "慢慢来";
  const description =
    status === "ready"
      ? "想听的时候，再回来。"
      : status === "error"
        ? "声音还没完成，想继续时再试就好。"
        : "这一刻，值得被好好收下。";

  return (
    <>
      <BackHeader goBack={goBack} title="声音日记" />
      <section className="diary-audio-page">
        <div className={"diary-audio-canvas diary-audio-canvas--" + status}>
          <div className="diary-audio-canvas__top">
            <span>声音日记</span>
            <span>·</span>
          </div>
          <div className="diary-audio-wave" aria-hidden="true">
            {[22, 38, 28, 52, 35, 68, 42, 58, 30, 48, 25, 39, 20].map((height, index) => (
              <span
                key={index}
                style={{ height: height + "px", animationDelay: index * 100 + "ms" }}
              />
            ))}
          </div>
          <div className="diary-audio-canvas__bottom">
            <Image
              src={melodayLogo}
              alt="Meloday"
              width={1500}
              height={669}
              className="diary-audio-logo"
              style={{ display: "block", width: 76, height: "auto" }}
            />
            <Radio size={17} strokeWidth={1.7} />
          </div>
        </div>

        <div className="diary-audio-intro">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>


        {progress?.reply ? (
          <article className="diary-audio-reply">
            <div>
              <Radio size={15} strokeWidth={1.8} />
              <span>Meloday 的回应</span>
            </div>
            <p>{progress.reply}</p>
          </article>
        ) : null}

        {status === "ready" && progress?.entryId ? (
          <button
            type="button"
            onClick={() => openEntry(progress.entryId!)}
            className="diary-audio-open"
          >
            听听这篇《{progress.title || "声音日记"}》
            <Play size={16} fill="currentColor" />
          </button>
        ) : null}

        {status === "error" ? (
          <div className="diary-audio-error-actions">
            <button type="button" onClick={retry} className="diary-audio-retry">
              <RefreshCw size={16} />
              继续准备声音
            </button>
            {progress?.entryId ? (
              <button
                type="button"
                onClick={() => openEntry(progress.entryId!)}
                className="diary-audio-saved"
              >
                先查看已保存的文字
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

function DiaryHubView({
  entries,
  startWriting,
  openEntry,
  renameEntry,
  deleteEntry,
  favoriteEntry,
}: {
  entries: DiaryEntry[];
  startWriting: () => void;
  openEntry: (id: string) => void;
  renameEntry: (id: string, title: string) => void;
  deleteEntry: (entry: DiaryEntry) => void;
  favoriteEntry: (id: string, favorite: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "favorite">("all");

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const scopedEntries =
      scope === "favorite" ? entries.filter((entry) => entry.favorite) : entries;
    if (!normalized) return scopedEntries;

    return scopedEntries.filter((entry) =>
      [
        entry.title,
        entry.summary,
        entry.fullDiary,
        entry.source?.content,
        entry.source?.mood,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [entries, query, scope]);

  const groupedEntries = useMemo(() => {
    return filteredEntries.reduce<Record<string, DiaryEntry[]>>((groups, entry) => {
      groups[entry.date] = groups[entry.date] ?? [];
      groups[entry.date].push(entry);
      return groups;
    }, {});
  }, [filteredEntries]);

  return (
    <section className="diary-page">
      <header className="diary-page__header">
        <p className="diary-eyebrow">声音日记</p>
        <h1 className="diary-page__title">日记</h1>
        <p className="diary-page__intro">把值得记住的片段，留成一段可以重听的声音。</p>
      </header>

      <button
        type="button"
        onClick={startWriting}
        className="diary-compose-button"
      >
        <span className="diary-compose-button__icon" aria-hidden="true">
          <PenLine size={23} />
        </span>
        <span className="diary-compose-button__copy">
          <small>今天想留下些什么？</small>
          <strong>写今天</strong>
        </span>
        <span className="diary-compose-button__action">开始</span>
      </button>
      {entries.length > 0 ? (
        <div className="diary-search" role="search">
          <Search size={20} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、内容或心情"
            aria-label="搜索声音日记"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")}>清除</button>
          ) : null}
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="diary-filter" role="group" aria-label="筛选日记">
          <button
            type="button"
            onClick={() => setScope("all")}
            aria-pressed={scope === "all"}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setScope("favorite")}
            aria-pressed={scope === "favorite"}
          >
            <Heart size={16} fill={scope === "favorite" ? "currentColor" : "none"} />
            收藏
          </button>
        </div>
      ) : null}

      <div className="diary-page__list">
        {entries.length === 0 ? (
          <button type="button" onClick={startWriting} className="diary-empty">
            <BookOpen size={28} strokeWidth={1.5} />
            <span>还没有留下什么</span>
            <small>从今天的一句话开始。</small>
          </button>
        ) : null}
        {entries.length > 0 && filteredEntries.length === 0 ? (
          <div className="diary-search-empty">
            <strong>{scope === "favorite" && !query ? "还没有收藏的声音" : "没有找到相关日记"}</strong>
            <p>
              {scope === "favorite" && !query
                ? "遇到想再听的日记时，点一下心形就好。"
                : "换一个标题、心情或记忆片段试试。"}
            </p>
          </div>
        ) : null}


        {Object.entries(groupedEntries).map(([date, dayEntries]) => (
          <section key={date} className="diary-day">
            <div className="diary-day__heading">
              <time>{formatDateLabel(date)}</time>
              <span>{dayEntries.length} 篇</span>
            </div>
            <div className="diary-day__entries">
              {dayEntries.map((entry) => (
                <NotebookEntryCard
                  key={entry.id}
                  entry={entry}
                  openEntry={openEntry}
                  renameEntry={renameEntry}
                  deleteEntry={deleteEntry}
                  favoriteEntry={favoriteEntry}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

type BrowserSpeechResultEvent = {
  results: ArrayLike<{ 0?: { transcript?: string } }>;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: BrowserSpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
const momentPrompts = [
  "有点累，想让身体松下来",
  "脑子很吵，想安静一点",
  "心里空空的，想有人陪着",
  "提不起劲，想慢慢找回力气",
] as const;

const refinePrompts = ["再轻一点", "更温暖一点", "想要一点力量"] as const;
function TodayView({
  messages,
  input,
  isAgentBusy,
  soundStyle,
  setInput,
  submitMessage,
  generation,
  soundNeedsConnection,
  openServices,
  retryGeneration,
  draft,
  isDraftPreviewOpen,
  openDraftPreview,
  closeDraftPreview,
  openDraftDetail,
  resetToday,
  goHome,
}: {
  messages: ChatMessage[];
  input: string;
  isAgentBusy: boolean;
  soundStyle: CompanionPreferences["soundStyle"];
  setInput: React.Dispatch<React.SetStateAction<string>>;
  submitMessage: (contentOverride?: string) => void;
  generation: { running: boolean; error?: string } | null;
  soundNeedsConnection: boolean;
  openServices: () => void;
  retryGeneration: () => void;
  draft: GeneratedCard | null;
  isDraftPreviewOpen: boolean;
  openDraftPreview: () => void;
  closeDraftPreview: () => void;
  openDraftDetail: () => void;
  resetToday: () => void;
  goHome: () => void;
}) {
  const writingDate = formatWritingDate(new Date());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatFrameRef = useRef<HTMLElement>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const isGenerating = Boolean(generation?.running && !generation.error);
  const isBusy = isAgentBusy || isGenerating;
  const latestUserText = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const showMomentPrompts = !latestUserText && !isBusy && !draft;
  const latestAgentId = [...messages]
    .reverse()
    .find((message) => message.role === "agent")?.id;
  useEffect(() => {
    return () => speechRecognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [input]);

  useEffect(() => {
    const frame = chatFrameRef.current;
    if (!frame) return;
    frame.scrollTop = frame.scrollHeight;
  }, [messages, draft, isBusy]);
  function toggleVoiceInput() {
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop();
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceNotice("当前浏览器暂不支持语音输入，可以直接打字。");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("")
        .trim();
      if (transcript) {
        setInput((current) => [current.trim(), transcript].filter(Boolean).join(" "));
        setVoiceNotice("已经听见，可以继续补充或发送。");
      }
    };
    recognition.onerror = () => {
      setVoiceNotice("这次没有听清，可以再说一次。");
    };
    recognition.onend = () => {
      setIsListening(false);
      speechRecognitionRef.current = null;
    };

    speechRecognitionRef.current = recognition;
    setIsListening(true);
    setVoiceNotice("正在听，你可以直接说。");
    recognition.start();
  }
  return (
    <>
      <section className="chat-room">
        <header className="chat-header">
          <button
            type="button"
            onClick={goHome}
            aria-label="返回首页"
            title="返回首页"
            className="chat-header__button"
          >
            <ChevronLeft size={21} />
          </button>

          <div className="chat-header__center">
            <h1 className="chat-header__title">Meloday 电台</h1>
            <p className="chat-header__status">
              <span className="chat-header__status-dot" />
              在线 · 正在听
            </p>
          </div>

          <div className="chat-header__signal" aria-hidden="true">
            <Radio size={18} />
          </div>
        </header>

        <ChatAudioStatus
          key={draft?.audioUrl ?? "audio-status"}
          draft={draft}
          generation={generation}
          isAgentBusy={isAgentBusy}
          momentText={latestUserText}
          openDraftPreview={openDraftPreview}
        />

        <section
          ref={chatFrameRef}
          className="diary-scroll chat-transcript"
          aria-label="与 Meloday 的对话"
        >
          <div className="chat-date-divider" aria-label={`${writingDate.date} ${writingDate.weekday}`}>
            <span />
            <time>{writingDate.date} · {writingDate.weekday}</time>
            <span />
          </div>

          <div className="chat-transcript__messages">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                loading={message.id === latestAgentId && isBusy}
                soundStyle={soundStyle}
              />
            ))}

            {showMomentPrompts ? (
              <div className="moment-starters" aria-label="快捷描述此刻状态">
                <p>不想组织语言，可以从一句接近的开始</p>
                <div>
                  {momentPrompts.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => submitMessage(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {draft && !generation ? (
              <div className="chat-media-message">
                <div className="chat-avatar" aria-hidden="true">
                  <Radio size={16} />
                </div>
                <div className="chat-media-message__body">
                  <p className="chat-media-message__name">Meloday</p>
                  <InlineDraftCard
                    draft={draft}
                    openDraftPreview={openDraftPreview}
                    openDraftDetail={openDraftDetail}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <footer className="chat-composer">
          {draft && !generation ? (
            <div className="chat-refine-suggestions" aria-label="继续调整这段声音">
              <span>还想让它</span>
              {refinePrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => submitMessage(prompt)} disabled={isBusy}>
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
          {voiceNotice ? <p className="chat-composer__voice-notice">{voiceNotice}</p> : null}
          <div className="chat-composer__inner">
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-label={isListening ? "停止语音输入" : "语音输入"}
              title={isListening ? "停止语音输入" : "语音输入"}
              aria-pressed={isListening}
              className={"chat-composer__voice" + (isListening ? " is-listening" : "")}
            >
              <Mic size={19} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !isBusy) {
                  event.preventDefault();
                  submitMessage();
                }
              }}
              placeholder="发消息给 Meloday…"
              rows={1}
              className="chat-composer__input"
            />

            <button
              type="button"
              onClick={() => submitMessage()}
              disabled={!input.trim() || isBusy}
              aria-label="发送消息"
              title="发送消息"
              className="chat-composer__send"
            >
              {isBusy ? (
                <LoaderCircle size={18} className="loading-icon" />
              ) : (
                <ArrowUp size={19} strokeWidth={2.2} />
              )}
            </button>
          </div>
        </footer>
      </section>

      {generation?.error ? (
        <GenerationErrorToast
          message={generation.error}
          connectionNeeded={soundNeedsConnection}
          openServices={openServices}
          retryGeneration={retryGeneration}
          resetToday={resetToday}
        />
      ) : null}

      {draft && isDraftPreviewOpen && !generation ? (
        <FloatingDraftCard
          draft={draft}
          closeDraftPreview={closeDraftPreview}
          openDraftDetail={openDraftDetail}
        />
      ) : null}
    </>
  );
}

function ChatAudioStatus({
  draft,
  generation,
  isAgentBusy,
  momentText,
  openDraftPreview,
}: {
  draft: GeneratedCard | null;
  generation: { running: boolean; error?: string } | null;
  isAgentBusy: boolean;
  momentText: string;
  openDraftPreview: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const isCreating = Boolean(generation?.running && !generation.error);
  const isActive = isCreating || isAgentBusy || isPlaying;
  const waveform = [12, 20, 15, 27, 18, 32, 22, 29, 16, 25, 13, 30, 19, 24, 15, 27, 18, 22];

  const momentExcerpt = momentText.replace(/\s+/g, " ").trim().slice(0, 26);
  const status = draft
    ? "这一刻的声音"
    : isCreating
      ? "正在为此刻写一段声音"
      : isAgentBusy
        ? "Meloday 正在听"
        : "等你说一句";

  const detail = draft
    ? momentExcerpt
      ? `${draft.title} · 来自「${momentExcerpt}」`
      : draft.title
    : isCreating
      ? momentExcerpt
        ? `来自你刚才说的「${momentExcerpt}」`
        : "正在靠近你此刻的状态"
      : isAgentBusy
        ? "正在听见你话里的状态和需要"
        : "说一句现在的感觉，声音会从这里长出来";

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !draft) return;

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  return (
    <div
      className={"audio-status-bar" + (isActive ? " is-active" : "") + (draft ? " has-audio" : "")}
      aria-label={`声音状态：${status}`}
    >
      {draft ? (
        <audio
          ref={audioRef}
          src={draft.audioUrl}
          preload="metadata"
          onTimeUpdate={(event) => {
            const audio = event.currentTarget;
            setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
        />
      ) : null}

      <button
        type="button"
        onClick={togglePlayback}
        disabled={!draft}
        aria-label={draft ? (isPlaying ? "暂停音频" : "播放音频") : status}
        title={draft ? (isPlaying ? "暂停音频" : "播放音频") : status}
        className="audio-status-bar__control"
      >
        {draft ? (
          isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} className="icon-leading" fill="currentColor" />
        ) : (
          <Radio size={16} />
        )}
      </button>

      <button
        type="button"
        onClick={draft ? openDraftPreview : undefined}
        disabled={!draft}
        className="audio-status-bar__copy"
      >
        <span className="audio-status-bar__label">{status}</span>
        <span className="audio-status-bar__detail">{detail}</span>
      </button>

      <div className="audio-status-wave" aria-hidden="true">
        {waveform.map((height, index) => {
          const reached = draft ? index / waveform.length <= progress : false;
          return (
            <span
              key={index}
              className={reached ? "is-reached" : undefined}
              style={{ height: `${height}px`, animationDelay: `${index * 55}ms` }}
            />
          );
        })}
      </div>

      {draft ? (
        <button
          type="button"
          onClick={openDraftPreview}
          aria-label="查看音频与封面"
          title="查看音频与封面"
          className="audio-status-bar__expand"
        >
          <Maximize2 size={14} />
        </button>
      ) : null}
    </div>
  );
}

function ChatBubble({
  message,
  loading = false,
  soundStyle,
}: {
  message: ChatMessage;
  loading?: boolean;
  soundStyle: CompanionPreferences["soundStyle"];
}) {
  if (message.role === "user") {
    return (
      <div className="chat-message chat-message--user">
        <div className="chat-bubble chat-bubble--user">
          <p className="text-preserve">{message.content || " "}</p>
        </div>
      </div>
    );
  }

  return (
    <article className="chat-message chat-message--agent">
      <div className="chat-avatar" aria-hidden="true">
        <Radio size={16} />
      </div>
      <div className="chat-agent-column">
        <div className="chat-agent-meta">
          <span className="chat-agent-meta__name">Meloday</span>
          {loading ? <span className="chat-typing-dot" aria-label="正在输入" /> : null}
        </div>
        <div className="chat-bubble chat-bubble--agent">
          <p className="text-preserve">
            {message.content || (loading ? "正在输入…" : " ")}
          </p>
          {message.content.trim() && !loading ? (
            <SpokenReplyButton text={message.content} soundStyle={soundStyle} compact />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function GenerationErrorToast({
  message,
  connectionNeeded,
  openServices,
  retryGeneration,
  resetToday,
}: {
  message: string;
  connectionNeeded: boolean;
  openServices: () => void;
  retryGeneration: () => void;
  resetToday: () => void;
}) {
  return (
    <div className="generation-error-toast">
      <div className="healing-card generation-error-toast__card">
        <div className="generation-error-toast__body">
          <div className="generation-error-toast__icon">
            <X size={17} />
          </div>
          <div className="generation-error-toast__copy">
            <p className="generation-error-toast__title">
              {connectionNeeded ? "声音还没准备好" : "创作没有完成"}
            </p>
            <p className="generation-error-toast__message">{message}</p>
          </div>
        </div>
        <div className="generation-error-toast__actions">
          <button
            type="button"
            onClick={connectionNeeded ? openServices : retryGeneration}
            className="healing-primary generation-error-toast__primary"
          >
            {connectionNeeded ? <Radio size={16} /> : <RefreshCw size={15} />}
            {connectionNeeded ? "完成连接" : "重试"}
          </button>
          <button
            type="button"
            onClick={resetToday}
            className="generation-error-toast__secondary"
          >
            重新讲
          </button>
        </div>
      </div>
    </div>
  );
}

function DebugCopyToast({ message }: { message: string }) {
  return (
    <div className="debug-copy-toast">
      <div className="debug-copy-toast__message">
        {message}
      </div>
    </div>
  );
}

function InlineDraftCard({
  draft,
  openDraftPreview,
  openDraftDetail,
}: {
  draft: GeneratedCard;
  openDraftPreview: () => void;
  openDraftDetail: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  async function togglePlayback(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function expandDetail(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    openDraftDetail();
  }

  return (
    <article
      onClick={openDraftPreview}
      className="radio-audio-card inline-draft-card"
    >
      <audio
        key={draft.audioUrl}
        ref={audioRef}
        src={draft.audioUrl}
        preload="auto"
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="inline-draft-card__grid">
        <div
          className="radio-cover-thumb"
          style={{ backgroundImage: `linear-gradient(160deg, rgba(248,255,249,0.2), rgba(33,49,44,0.42)), url(${draft.coverUrl})` }}
          aria-label="为此刻创作的音乐封面"
        >
          <Waves size={22} />
        </div>
        <div className="inline-draft-card__copy">
          <p className="inline-draft-card__status">
            这一段声音已经准备好
          </p>
          <h2 className="inline-draft-card__title">
            {draft.title}
          </h2>
          <div className="radio-mini-wave inline-draft-card__wave" aria-hidden="true">
            {[8, 16, 11, 21, 13, 18, 10, 15].map((height, index) => (
              <span key={index} style={{ height: `${height}px`, animationDelay: `${index * 80}ms` }} />
            ))}
          </div>
        </div>
        <div className="inline-draft-card__actions">
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
            title={isPlaying ? "暂停音乐" : "播放音乐"}
            className="radio-play-button radio-play-button--small"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="icon-leading" />}
          </button>
          <button
            type="button"
            onClick={expandDetail}
            aria-label="展开卡片"
            title="展开卡片"
            className="radio-icon-button"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
function FloatingDraftCard({
  draft,
  closeDraftPreview,
  openDraftDetail,
}: {
  draft: GeneratedCard;
  closeDraftPreview: () => void;
  openDraftDetail: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  return (
    <div
      className="draft-preview-backdrop"
      onClick={closeDraftPreview}
    >
      <article
        className="radio-player-modal draft-preview-card"
        aria-label="为此刻创作的歌曲预览"
        onClick={(event) => event.stopPropagation()}
      >
        <audio
          key={draft.audioUrl}
          ref={audioRef}
          src={draft.audioUrl}
          preload="auto"
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
        <button
          type="button"
          onClick={closeDraftPreview}
          aria-label="关闭卡片"
          title="关闭卡片"
          className="draft-preview-close"
        >
          <X size={17} />
        </button>

        <div
          className="radio-modal-cover"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(248,255,249,0.12), rgba(26,45,39,0.66)), url(${draft.coverUrl})` }}
        >
          <div className="draft-preview-cover-copy">
            <p className="draft-preview-eyebrow">
              只属于这一刻
            </p>
            <h2 className="draft-preview-title">
              {draft.title}
            </h2>
            <p className="draft-preview-description">从你今天的心情里，写给此刻的一段音乐</p>
          </div>
        </div>

        <div className="draft-preview-audio">
          <div className="radio-wave" aria-hidden="true">
            {[18, 34, 22, 46, 30, 54, 28, 40, 20, 36, 24, 44].map((height, index) => (
              <span key={index} style={{ height: `${height}px`, animationDelay: `${index * 75}ms` }} />
            ))}
          </div>
          <div className="draft-preview-controls">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
              title={isPlaying ? "暂停音乐" : "播放音乐"}
              className="radio-play-button radio-play-button--large"
            >
              {isPlaying ? <Pause size={17} /> : <Play size={17} className="icon-leading" />}
            </button>
            <button
              type="button"
              onClick={openDraftDetail}
              aria-label="展开卡片"
              title="展开卡片"
              className="radio-send-button"
            >
              查看完整日记
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
function NotebookView({
  entries,
  openEntry,
  renameEntry,
  deleteEntry,
  startNew,
}: {
  entries: DiaryEntry[];
  openEntry: (id: string) => void;
  renameEntry: (id: string, title: string) => void;
  deleteEntry: (entry: DiaryEntry) => void;
  startNew: () => void;
}) {
  const groupedEntries = useMemo(() => {
    return entries.reduce<Record<string, DiaryEntry[]>>((groups, entry) => {
      groups[entry.date] = groups[entry.date] ?? [];
      groups[entry.date].push(entry);
      return groups;
    }, {});
  }, [entries]);

  return (
    <>
      <AppHeader
        right={
          <button
            type="button"
            onClick={startNew}
            title="写新的日记"
            aria-label="写新的日记"
            className="healing-blue notebook-create-button"
          >
            <PenLine size={19} />
          </button>
        }
      />
      <section className="notebook-page">
        {entries.length === 0 ? (
          <div className="healing-card notebook-empty">
            还没有日记
          </div>
        ) : null}

        {Object.entries(groupedEntries).map(([date, dayEntries]) => (
          <div key={date} className="notebook-day">
            <h2 className="notebook-day__title">{formatDateLabel(date)}</h2>
            {dayEntries.map((entry) => (
              <NotebookEntryCard
                key={entry.id}
                entry={entry}
                openEntry={openEntry}
                renameEntry={renameEntry}
                deleteEntry={deleteEntry}
              />
            ))}
          </div>
        ))}
      </section>
    </>
  );
}

function NotebookEntryCard({
  entry,
  openEntry,
  renameEntry,
  deleteEntry,
  favoriteEntry,
}: {
  entry: DiaryEntry;
  openEntry: (id: string) => void;
  renameEntry: (id: string, title: string) => void;
  deleteEntry: (entry: DiaryEntry) => void;
  favoriteEntry?: (id: string, favorite: boolean) => void;
}) {
  const { audioUrl, coverUrl } = useEntryMedia(entry);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const isAudioPending = entry.generationStatus === "audio-pending";

  return (
    <article
      onClick={() => {
        if (!editing) openEntry(entry.id);
      }}
      className="diary-entry"
    >
      <div className="diary-entry__row">
        <div className="diary-entry__cover">
          {entry.audioBlobId ? (
            <CoverArt title={entry.title} coverUrl={coverUrl} compact />
          ) : (
            <div className="diary-entry__note-cover">
              {isAudioPending ? (
                <Waves size={19} strokeWidth={1.7} />
              ) : (
                <PenLine size={17} strokeWidth={1.6} />
              )}
              <span>{isAudioPending ? "声音待完成" : "文字日记"}</span>
            </div>
          )}
        </div>

        <div className="diary-entry__content">
          {editing ? (
            <div
              className="diary-entry__edit"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="diary-entry__input"
              />
              <button
                type="button"
                onClick={() => {
                  renameEntry(entry.id, title);
                  setEditing(false);
                }}
                aria-label="保存名称"
                title="保存名称"
                className="diary-icon-button diary-icon-button--accent"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <h3 className="diary-entry__title">{entry.title}</h3>
          )}

          <p className="diary-entry__summary">{entry.summary}</p>

          <div
            className="diary-entry__tools"
            onClick={(event) => event.stopPropagation()}
          >
            {favoriteEntry ? (
              <button
                type="button"
                onClick={() => favoriteEntry(entry.id, !entry.favorite)}
                aria-label={entry.favorite ? "取消收藏" : "收藏"}
                title={entry.favorite ? "取消收藏" : "收藏"}
                className={"diary-icon-button" + (entry.favorite ? " diary-icon-button--favorite" : "")}
              >
                <Heart size={16} fill={entry.favorite ? "currentColor" : "none"} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setTitle(entry.title);
                setEditing(true);
              }}
              aria-label="重命名"
              title="重命名"
              className="diary-icon-button"
            >
              <PenLine size={14} />
            </button>
            <button
              type="button"
              onClick={() => deleteEntry(entry)}
              aria-label="删除"
              title="删除"
              className="diary-icon-button diary-icon-button--danger"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {entry.audioBlobId ? (
        <div
          onClick={(event) => event.stopPropagation()}
          className="diary-entry__audio"
        >
          <AudioPlayer
            src={audioUrl}
            label={entry.title}
            persistenceKey={entry.id}
            artworkUrl={coverUrl}
          />
        </div>
      ) : null}
    </article>
  );
}

function EntryDetailView({
  entry,
  goBack,
  renameEntry,
  deleteEntry,
  favoriteEntry,
  retryAudioDiary,
  autoPlay = false,
  soundStyle = "warm",
}: {
  entry?: DiaryEntry;
  goBack: () => void;
  renameEntry: (id: string, title: string) => void;
  deleteEntry: (entry: DiaryEntry) => void;
  favoriteEntry: (id: string, favorite: boolean) => void;
  retryAudioDiary: (entry: DiaryEntry) => void;
  autoPlay?: boolean;
  soundStyle?: CompanionPreferences["soundStyle"];
}) {
  const { audioUrl, coverUrl } = useEntryMedia(entry);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry?.title ?? "");

  if (!entry) {
    return (
      <>
        <BackHeader goBack={goBack} title="日记不存在" />
        <section className="entry-missing-message">这张卡片可能已经被删除。</section>
      </>
    );
  }
  const source = entry.source;
  const isAudioPending = entry.generationStatus === "audio-pending";

  return (
    <>
      <BackHeader goBack={goBack} title={entry.title} />
      <section className="diary-detail-page entry-detail-page">
        {entry.audioBlobId ? (
          <>
            <CoverArt title={entry.title} summary={entry.summary} coverUrl={coverUrl} />
            <AudioPlayer
              src={audioUrl}
              label={entry.title}
              autoPlay={autoPlay}
              persistenceKey={entry.id}
              artworkUrl={coverUrl}
            />
          </>
        ) : (
          <div className="diary-text-entry-hero">
            <p>{formatDateLabel(entry.date)} · {isAudioPending ? "文字已经留下" : "文字记录"}</p>
            <h1>{entry.title}</h1>
            <span>{entry.summary}</span>
          </div>
        )}
        {isAudioPending ? (
          <article className="diary-detail-pending">
            <div>
              <Waves size={20} aria-hidden="true" />
              <span>声音还没有完成</span>
              <p>原文已经安全留下，想继续时再回来就好。</p>
            </div>
            <button type="button" onClick={() => retryAudioDiary(entry)}>
              继续准备声音
            </button>
          </article>
        ) : null}
        {source ? (
          <article className="diary-detail-source">
            <div className="diary-detail-source__meta">
              <span>你写下的</span>
              <time>{formatDateLabel(entry.date)}{source.mood ? ` · ${source.mood}` : ""}</time>
            </div>
            {source.title ? <h2>{source.title}</h2> : null}
            <p>{source.content}</p>
          </article>
        ) : null}

        {source?.reply ? (
          <article className="diary-detail-response">
            <div className="diary-detail-response__top">
              <span>Meloday 的回应</span>
              <SpokenReplyButton text={source.reply} soundStyle={soundStyle} />
            </div>
            <p>{source.reply}</p>
          </article>
        ) : null}

        <div className="healing-card detail-card">
          {editing ? (
            <div className="entry-title-editor">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="entry-title-input"
              />
              <button
                type="button"
                onClick={() => {
                  renameEntry(entry.id, title);
                  setEditing(false);
                }}
                aria-label="保存名称"
                title="保存名称"
                className="healing-primary entry-title-save"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="entry-summary-row">
              <div className="entry-summary-copy">
                {entry.audioBlobId ? (
                  <>
                    <p className="entry-summary-date">{formatDateLabel(entry.date)}</p>
                    <h2 className="entry-summary-title">{entry.title}</h2>
                  </>
                ) : (
                  <p className="entry-summary-text">{entry.summary}</p>
                )}
              </div>
              <div className="diary-detail-actions">
                <button
                  type="button"
                  onClick={() => favoriteEntry(entry.id, !entry.favorite)}
                  aria-label={entry.favorite ? "取消收藏" : "收藏"}
                  title={entry.favorite ? "取消收藏" : "收藏"}
                  className={entry.favorite ? "is-favorite" : undefined}
                >
                  <Heart size={17} fill={entry.favorite ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle(entry.title);
                    setEditing(true);
                  }}
                  aria-label="重命名"
                  title="重命名"
                >
                  <PenLine size={16} />
                </button>
              </div>
            </div>
          )}
          {entry.audioBlobId ? (
            <p className="entry-summary-text entry-summary-text--with-space">{entry.summary}</p>
          ) : null}
        </div>

        <article className="diary-detail-adaptation">
          <h3>{source ? "声音日记文字" : "完整日记"}</h3>
          <p>
            {entry.fullDiary}
          </p>
        </article>

        <button
          type="button"
          onClick={() => deleteEntry(entry)}
          className="detail-delete-button"
        >
          <Trash2 size={16} />
          删除这篇日记
        </button>
      </section>
    </>
  );
}

function DraftDetailView({
  draft,
  goBack,
  saveCurrentDraft,
  isSavingDraft,
}: {
  draft: GeneratedCard | null;
  goBack: () => void;
  saveCurrentDraft: () => void;
  isSavingDraft: boolean;
}) {
  if (!draft) {
    return (
      <>
        <BackHeader goBack={goBack} title="完整日记" />
        <section className="entry-missing-message">还没有生成可查看的卡片。</section>
      </>
    );
  }

  return (
    <>
      <BackHeader goBack={goBack} title={draft.title} />
      <section className="draft-detail-page">
        <CoverArt title={draft.title} summary={draft.summary} coverUrl={draft.coverUrl} />
        <AudioPlayer src={draft.audioUrl} label={draft.title} />
        <div className="healing-card detail-card">
          <h2 className="draft-detail-title">{draft.title}</h2>
          <p className="draft-detail-summary">{draft.summary}</p>
        </div>
        <div className="healing-card detail-card">
          <h3 className="draft-detail-heading">完整日记</h3>
          <p className="draft-detail-full text-preserve">
            {draft.fullDiary}
          </p>
        </div>
        <button
          type="button"
          onClick={saveCurrentDraft}
          disabled={isSavingDraft}
          className="healing-primary draft-save-button"
        >
          {isSavingDraft ? <LoaderCircle size={16} className="loading-icon" /> : <Save size={16} />}
          保存当前版本
        </button>
      </section>
    </>
  );
}

