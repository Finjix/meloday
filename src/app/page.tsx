"use client";

import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronLeft,
  House,
  LoaderCircle,
  Maximize2,
  Mic,
  Pause,
  PenLine,
  Play,
  Radio,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  Waves,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { CoverArt } from "@/components/CoverArt";
import {
  requestAgentTurn,
  requestCardGeneration,
  requestCardRegeneration,
} from "@/lib/client-api";
import {
  deleteEntry,
  getMediaBlob,
  loadDiaryEntries,
  renameEntry,
  saveGeneratedCard,
} from "@/lib/storage";
import type { ChatMessage, DiaryEntry, GeneratedCard } from "@/lib/types";

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
  | { name: "mine" }
  | { name: "entry"; id: string }
  | { name: "draft-detail" };

const generationStages = [
  "整理今天的片段",
  "听见情绪里的需要",
  "写下音乐日记",
  "准备器乐和封面",
];

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
      "你好呀，有什么想和我说的！",
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

export default function Home() {
  const [view, setView] = useState<AppView>({ name: "home" });
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages());
  const [input, setInput] = useState("");
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [generation, setGeneration] = useState<{
    running: boolean;
    stage: number;
    error?: string;
  } | null>(null);
  const [draftVersions, setDraftVersions] = useState<GeneratedCard[]>([]);
  const [draftIndex, setDraftIndex] = useState(0);
  const [isDraftPreviewOpen, setIsDraftPreviewOpen] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [diaryAudioProgress, setDiaryAudioProgress] = useState<DiaryAudioProgress | null>(null);
  const [debugCopyNotice, setDebugCopyNotice] = useState("");
  const debugCopyTimerRef = useRef<number | null>(null);
  const fullAgentRepliesRef = useRef<Record<string, string>>({});

  const currentDraft = draftVersions[draftIndex] ?? null;
  const selectedEntry =
    view.name === "entry" ? entries.find((entry) => entry.id === view.id) : undefined;

  const refreshEntries = useCallback(() => {
    setEntries(loadDiaryEntries());
  }, []);


  useEffect(() => {
    const timer = window.setTimeout(refreshEntries, 0);
    return () => window.clearTimeout(timer);
  }, [refreshEntries]);

  useEffect(() => {
    async function copyDebugConversation() {
      const debugText =
        formatDebugConversation(messages, fullAgentRepliesRef.current) ||
        "暂无用户和 agent 对话内容。";
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
    setGeneration({ running: true, stage: 0 });
    setView({ name: "today" });

    try {
      for (let index = 0; index < generationStages.length - 1; index += 1) {
        setGeneration({ running: true, stage: index });
        await sleep(520);
      }

      setGeneration({ running: true, stage: generationStages.length - 1 });
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
        stage: generationStages.length - 1,
        error: `生成时出了点问题。对话还在，可以再试一次。${error instanceof Error ? `（${error.message}）` : ""}`,
      });
    }
  }

  async function runRegenerationFromMain(card: GeneratedCard, feedback: string) {
    setGeneration({ running: true, stage: 0 });
    setIsDraftPreviewOpen(false);
    setView({ name: "today" });

    try {
      for (let index = 0; index < generationStages.length - 1; index += 1) {
        setGeneration({ running: true, stage: index });
        await sleep(520);
      }

      setGeneration({ running: true, stage: generationStages.length - 1 });
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
        stage: generationStages.length - 1,
        error: `重新生成时出了点问题。你可以再试一次。${error instanceof Error ? `（${error.message}）` : ""}`,
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

  async function submitMessage() {
    const content = input.trim();
    if (!content || isAgentBusy || generation?.running) return;

    if (currentDraft) {
      const userMessage = createMessage("user", content);
      const assistantMessage = createMessage("agent", "正在为您创作");

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
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: "正在为您创作" }
              : message,
          ),
        );
        await runGeneration(conversation);
      }
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                content: `生成回复时出了点问题。${error instanceof Error ? error.message : "请稍后再试。"}`,
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
      const entry = await saveGeneratedCard(currentDraft);
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

  async function createAudioDiaryFromComposer(input: DiaryComposeInput) {
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

    setDiaryAudioProgress({ status: "replying", input });
    setView({ name: "diary-audio" });

    try {
      const response = await requestAgentTurn([userMessage]);
      const reply = response.text.trim() || "我已经读到了你的这段心情。";
      setDiaryAudioProgress({ status: "rendering", input, reply });

      await sleep(650);
      const card = await requestCardGeneration([
        userMessage,
        createMessage("agent", reply),
      ]);
      const entry = await saveGeneratedCard(card);
      disposeGeneratedCard(card);
      refreshEntries();
      setDiaryAudioProgress({
        status: "ready",
        input,
        reply,
        entryId: entry.id,
        title: entry.title,
      });
    } catch (error) {
      setDiaryAudioProgress({
        status: "error",
        input,
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

  async function handleDelete(entry: DiaryEntry) {
    if (!window.confirm(`删除《${entry.title}》吗？`)) return;
    await deleteEntry(entry);
    refreshEntries();
    setView({ name: "diary" });
  }

  return (
    <main className="healing-root min-h-dvh text-[#2f3328]">
      <div className="healing-phone mx-auto flex min-h-dvh w-full max-w-[900px] flex-col overflow-hidden shadow-[0_0_80px_rgba(73,78,55,0.18)]">
        <div className="flex-1 pb-24">
          {view.name === "home" ? (
            <HomeDashboardView
              openRadio={() => setView({ name: "today" })}
              openDiaryCompose={() => setView({ name: "compose-diary" })}
              openMode={(mode) => setView({ name: "mode", mode })}
            />
          ) : null}

          {view.name === "mode" ? (
            <ModeDetailView
              mode={view.mode}
              goBack={() => setView({ name: "home" })}
              openSession={() => setView({ name: "today" })}
            />
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
                  void createAudioDiaryFromComposer(diaryAudioProgress.input);
                }
              }}
            />
          ) : null}

          {view.name === "today" ? (
            <TodayView
              messages={messages}
              input={input}
              isAgentBusy={isAgentBusy}
              setInput={setInput}
              submitMessage={submitMessage}
              generation={generation}
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
                setView({ name: "diary" });
              }}
              renameEntry={handleRename}
              deleteEntry={handleDelete}
            />
          ) : null}

          {view.name === "mine" ? <MineView /> : null}

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
            (view.name === "home" || view.name === "mode" || view.name === "today" || view.name === "draft-detail")
              ? "home"
              : view.name === "mine"
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
  openDiaryCompose,
  openMode,
}: {
  openRadio: () => void;
  openDiaryCompose: () => void;
  openMode: (mode: ModeKey) => void;
}) {
  const featureCards = [
    {
      number: "01",
      title: "写下心情",
      detail: "把今天慢慢说清楚，留成一页日记",
      icon: <BookOpen size={22} />,
      className: "mode-card--paper",
      onClick: openDiaryCompose,
    },
    {
      number: "02",
      title: "轻冥想",
      detail: "三分钟，把呼吸和思绪放回原位",
      icon: <Sparkles size={22} />,
      className: "mode-card--mint",
      onClick: () => openMode("meditate"),
    },
    {
      number: "03",
      title: "安心入睡",
      detail: "让夜晚轻一点，让身体先休息",
      icon: <Waves size={22} />,
      className: "mode-card--night",
      onClick: () => openMode("sleep"),
    },
    {
      number: "04",
      title: "恢复能量",
      detail: "用轻快节奏，陪你重新动起来",
      icon: <Radio size={22} />,
      className: "mode-card--blue",
      onClick: () => openMode("move"),
    },
  ];

  return (
    <section className="home-shell px-5 pb-8 pt-7">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1 className="text-[21px] font-semibold leading-none tracking-[-0.04em] text-[#19352e]">
              Meloday
            </h1>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#71827d]">
              Sound diary
            </p>
          </div>
        </div>
        <span className="home-status">
          <span className="h-1.5 w-1.5 rounded-full bg-[#b8d94c]" />
          今晚在线
        </span>
      </div>

      <button
        type="button"
        onClick={openRadio}
        className="premium-hero mt-7 min-h-[370px] w-full overflow-hidden rounded-[30px] p-6 text-left text-white transition duration-300 active:scale-[0.985]"
      >
        <div className="relative z-10 flex min-h-[322px] flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="premium-hero__badge">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d8f472] shadow-[0_0_12px_rgba(216,244,114,0.72)]" />
              悦听室
            </div>
            <span className="text-[11px] font-medium tracking-[0.14em] text-white/55">
              01 / 04
            </span>
          </div>

          <div>
            <p className="text-sm font-medium text-[#d8f472]">这里没有标准答案</p>
            <h2 className="mt-4 max-w-[19rem] text-[42px] font-medium leading-[1.03] tracking-[-0.055em]">
              把今天的心事，留给一段声音
            </h2>
            <p className="mt-5 max-w-[18rem] text-[14px] leading-6 text-white/62">
              我会先陪你聊一会儿，再把那些没说完的感受写进音乐里。
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/12 pt-5">
            <span className="text-sm font-semibold text-white">开始聊聊</span>
            <span className="premium-hero__play">
              <Play size={17} className="ml-0.5" fill="currentColor" />
            </span>
          </div>
        </div>
      </button>

      <div className="mb-4 mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#80918c]">Choose a moment</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[#19352e]">此刻，你更需要什么</h2>
        </div>
        <span className="pb-1 text-xs text-[#82908c]">四种方式</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {featureCards.map((card) => {
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="mode-card__icon">
                  {card.icon}
                </span>
                <span className="mode-card__number">{card.number}</span>
              </div>
              <div className="mt-8">
                <h3 className="text-[19px] font-semibold leading-tight tracking-[-0.03em]">{card.title}</h3>
                <p className="mt-2 text-[12px] leading-5 opacity-65">{card.detail}</p>
              </div>
            </>
          );

          return card.onClick ? (
            <button
              key={card.title}
              type="button"
              onClick={card.onClick}
              className={"mode-card min-h-[178px] rounded-[22px] p-4 text-left transition duration-200 active:scale-[0.985] " + card.className}
            >
              {content}
            </button>
          ) : (
            <article
              key={card.title}
              className={"mode-card min-h-[178px] rounded-[22px] p-4 text-left " + card.className}
            >
              {content}
            </article>
          );
        })}
      </div>
    </section>
  );
}
function ModeDetailView({
  mode,
  goBack,
  openSession,
}: {
  mode: ModeKey;
  goBack: () => void;
  openSession: () => void;
}) {
  const details: Record<ModeKey, {
    eyebrow: string;
    title: string;
    description: string;
    duration: string;
    note: string;
    icon: React.ReactNode;
    className: string;
  }> = {
    meditate: {
      eyebrow: "A QUIET MINUTE",
      title: "轻冥想",
      description: "给自己三分钟，把呼吸和注意力慢慢带回来。",
      duration: "03:00",
      note: "柔和、留白、没有催促",
      icon: <Sparkles size={18} />,
      className: "mode-detail-hero--mint",
    },
    sleep: {
      eyebrow: "NIGHT ROOM",
      title: "安心入睡",
      description: "把今天放在门外，让房间只剩下安静的声音。",
      duration: "30:00",
      note: "低频、缓慢、适合睡前",
      icon: <Waves size={18} />,
      className: "mode-detail-hero--night",
    },
    move: {
      eyebrow: "MOVE WITH EASE",
      title: "恢复能量",
      description: "不用急着变好，先用一点轻快节奏把身体叫醒。",
      duration: "12:00",
      note: "清爽、有光、逐渐提速",
      icon: <Radio size={18} />,
      className: "mode-detail-hero--blue",
    },
  };

  const detail = details[mode];

  return (
    <>
      <BackHeader goBack={goBack} title={detail.title} />
      <section className="mode-detail-page">
        <div className={"mode-detail-hero " + detail.className}>
          <div className="mode-detail-hero__top">
            <span className="mode-detail-hero__icon">{detail.icon}</span>
            <span className="mode-detail-hero__duration">{detail.duration}</span>
          </div>
          <p className="mode-detail-hero__eyebrow">{detail.eyebrow}</p>
          <h1>{detail.title}</h1>
          <p className="mode-detail-hero__description">{detail.description}</p>
          <div className="mode-detail-wave" aria-hidden="true">
            {[18, 28, 14, 34, 22, 42, 20, 30, 16, 36, 24, 31].map((height, index) => (
              <span key={index} style={{ height: `${height}px`, animationDelay: `${index * 90}ms` }} />
            ))}
          </div>
        </div>

        <div className="mode-detail-note">
          <span>{detail.note}</span>
          <span>Meloday 为你留一段时间</span>
        </div>

        <button type="button" onClick={openSession} className="mode-detail-primary">
          进入声音空间
          <span>→</span>
        </button>
        <p className="mode-detail-footnote">进入后，你也可以直接和 Meloday 聊聊此刻的心情。</p>
      </section>
    </>
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
        <header className="diary-compose-page__header">
          <p className="diary-compose-page__date">
            {writingDate.weekday} · {writingDate.date}
          </p>
          <h1>写一篇声音日记</h1>
          <p>写下片段，Meloday会先回应，再把今天做成一段声音。</p>
          <div className="diary-compose-flow" aria-label="声音日记流程">
            <span>写下片段</span>
            <i />
            <span>收到回应</span>
            <i />
            <span>声音日记</span>
          </div>
        </header>

        <form className="diary-compose-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="diary-title">日记标题</label>
          <input
            id="diary-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={36}
            placeholder="给今天一个标题（可选）"
            className="diary-compose-title"
          />

          <label className="sr-only" htmlFor="diary-content">日记内容</label>
          <textarea
            id="diary-content"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              if (event.target.value.trim()) setShowRequired(false);
            }}
            maxLength={2000}
            placeholder={"今天发生了什么？\n也可以只写一句。"}
            className="diary-compose-body"
          />

          <div className="diary-compose-moods">
            <p>此刻的心情</p>
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

          <div className="diary-compose-meta" aria-live="polite">
            <span>{showRequired ? "先写下一句话，再开始制作吧" : "提交后，你会先收到一段回应"}</span>
            <span>{content.length} / 2000</span>
          </div>

          <button type="submit" className="diary-compose-save">
            <Waves size={18} strokeWidth={1.9} />
            生成专属声音日记
          </button>
        </form>
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
  const stages = ["读到你的日记", "回应此刻的感受", "写成一段声音"];
  const activeStage =
    status === "replying" ? 0 : status === "rendering" ? 2 : 3;
  const title =
    status === "ready"
      ? "声音日记已经准备好了"
      : status === "error"
        ? "这次没有完成声音日记"
        : status === "rendering"
          ? "正在把感受写成声音"
          : "正在读你的日记";
  const description =
    status === "ready"
      ? "这段声音已经留在你的日记里。"
      : status === "error"
        ? "你可以重新开始制作，原来的文字不会丢失。"
        : status === "rendering"
          ? "旋律、节奏与封面正在慢慢成形。"
          : "Meloday正在从你的文字里听见今天。";

  return (
    <>
      <BackHeader goBack={goBack} title="声音日记" />
      <section className="diary-audio-page">
        <div className={"diary-audio-canvas diary-audio-canvas--" + status}>
          <div className="diary-audio-canvas__top">
            <span>SOUND DIARY</span>
            <span>{status === "ready" ? "READY" : "LIVE"}</span>
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
            <span>{status === "replying" ? "LISTENING" : status === "rendering" ? "COMPOSING" : "SAVED"}</span>
            <Radio size={17} strokeWidth={1.7} />
          </div>
        </div>

        <div className="diary-audio-intro">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="diary-audio-steps" aria-label="制作进度">
          {stages.map((stage, index) => (
            <div
              key={stage}
              className={index <= activeStage ? "diary-audio-step diary-audio-step--active" : "diary-audio-step"}
            >
              <span>{index + 1}</span>
              <p>{stage}</p>
            </div>
          ))}
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
          <button type="button" onClick={retry} className="diary-audio-retry">
            <RefreshCw size={16} />
            重新生成
          </button>
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
}: {
  entries: DiaryEntry[];
  startWriting: () => void;
  openEntry: (id: string) => void;
  renameEntry: (id: string, title: string) => void;
  deleteEntry: (entry: DiaryEntry) => void;
}) {
  const groupedEntries = useMemo(() => {
    return entries.reduce<Record<string, DiaryEntry[]>>((groups, entry) => {
      groups[entry.date] = groups[entry.date] ?? [];
      groups[entry.date].push(entry);
      return groups;
    }, {});
  }, [entries]);

  return (
    <section className="diary-page">
      <header className="diary-page__header">
        <div className="min-w-0">
          <p className="diary-eyebrow">YOUR NOTES</p>
          <h1 className="diary-page__title">日记</h1>
          <p className="diary-page__intro">把值得记住的片段，安静地留在这里。</p>
        </div>
        <button
          type="button"
          onClick={startWriting}
          className="diary-compose-button"
        >
          <PenLine size={17} />
          <span>写今天</span>
        </button>
      </header>

      <div className="diary-page__meta">
        <span><strong>{entries.length}</strong> 条记录</span>
        <span className="diary-page__meta-rule" />
        <span>只属于你</span>
      </div>

      <div className="diary-page__list">
        {entries.length === 0 ? (
          <button type="button" onClick={startWriting} className="diary-empty">
            <BookOpen size={20} strokeWidth={1.6} />
            <span>还没有日记</span>
            <small>写下今天的第一句话，之后的声音会留在这里。</small>
          </button>
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
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function TodayView({
  messages,
  input,
  isAgentBusy,
  setInput,
  submitMessage,
  generation,
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
  setInput: (value: string) => void;
  submitMessage: () => void;
  generation: { running: boolean; stage: number; error?: string } | null;
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
  const isGenerating = Boolean(generation?.running && !generation.error);
  const isBusy = isAgentBusy || isGenerating;
  const latestAgentId = [...messages]
    .reverse()
    .find((message) => message.role === "agent")?.id;

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

          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-[15px] font-semibold text-[#2d3d38]">Meloday 电台</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-[#80908b]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8fcdbb]" />
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

          <div className="space-y-4">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                loading={message.id === latestAgentId && isBusy}
              />
            ))}

            {draft && !generation ? (
              <div className="chat-media-message">
                <div className="chat-avatar" aria-hidden="true">
                  <Radio size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 text-[11px] font-medium text-[#81908b]">Meloday</p>
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
          <div className="chat-composer__inner">
            <button
              type="button"
              aria-label="语音输入"
              title="语音输入"
              className="chat-composer__voice"
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
              onClick={submitMessage}
              disabled={!input.trim() || isBusy}
              aria-label="发送消息"
              title="发送消息"
              className="chat-composer__send"
            >
              {isBusy ? (
                <LoaderCircle size={18} className="animate-spin" />
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
  openDraftPreview,
}: {
  draft: GeneratedCard | null;
  generation: { running: boolean; stage: number; error?: string } | null;
  isAgentBusy: boolean;
  openDraftPreview: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const isCreating = Boolean(generation?.running && !generation.error);
  const isActive = isCreating || isAgentBusy || isPlaying;
  const waveform = [12, 20, 15, 27, 18, 32, 22, 29, 16, 25, 13, 30, 19, 24, 15, 27, 18, 22];

  const status = draft
    ? "声音已送达"
    : isCreating
      ? generationStages[generation?.stage ?? 0] ?? "正在写成声音"
      : isAgentBusy
        ? "Meloday 正在回应"
        : "声场待机";

  const detail = draft
    ? draft.title
    : isCreating
      ? "让情绪慢慢变成旋律"
      : isAgentBusy
        ? "正在听见你话里的情绪"
        : "聊到合适的时候，音乐会从这里出现";

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
          isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} className="ml-0.5" fill="currentColor" />
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
}: {
  message: ChatMessage;
  loading?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="chat-message chat-message--user">
        <div className="chat-bubble chat-bubble--user">
          <p className="whitespace-pre-wrap break-words">{message.content || " "}</p>
        </div>
      </div>
    );
  }

  return (
    <article className="chat-message chat-message--agent">
      <div className="chat-avatar" aria-hidden="true">
        <Radio size={16} />
      </div>
      <div className="min-w-0 max-w-[82%]">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#81908b]">Meloday</span>
          {loading ? <span className="chat-typing-dot" aria-label="正在输入" /> : null}
        </div>
        <div className="chat-bubble chat-bubble--agent">
          <p className="whitespace-pre-wrap break-words">
            {message.content || (loading ? "正在输入…" : " ")}
          </p>
        </div>
      </div>
    </article>
  );
}

function GenerationErrorToast({
  message,
  retryGeneration,
  resetToday,
}: {
  message: string;
  retryGeneration: () => void;
  resetToday: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-28 z-30 px-4">
      <div className="healing-card mx-auto max-w-md rounded-[8px] p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f3ff9b] text-[#7a7754]">
            <X size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#3f442f]">创作没有完成</p>
            <p className="mt-1 text-xs leading-5 text-[#7a7754]">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={retryGeneration}
            className="healing-primary inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium"
          >
            <RefreshCw size={15} />
            重试
          </button>
          <button
            type="button"
            onClick={resetToday}
            className="h-10 flex-1 rounded-full border border-[#7a7754]/20 bg-[#fffff7]/80 px-4 text-sm font-medium text-[#56583d]"
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
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 px-5">
      <div className="mx-auto w-fit rounded-full bg-[#7a7754] px-4 py-2 text-sm font-medium text-[#fffff7] shadow-[0_4px_8px_rgba(73,78,55,0.18)]">
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
      className="radio-audio-card mt-5 cursor-pointer rounded-[8px] p-3 transition active:scale-[0.99]"
    >
      <audio
        key={draft.audioUrl}
        ref={audioRef}
        src={draft.audioUrl}
        preload="auto"
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="grid grid-cols-[86px_1fr_auto] items-center gap-3">
        <div
          className="radio-cover-thumb"
          style={{ backgroundImage: `linear-gradient(160deg, rgba(248,255,249,0.2), rgba(33,49,44,0.42)), url(${draft.coverUrl})` }}
          aria-label="为此刻创作的音乐封面"
        >
          <Waves size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4aa895]">
            YOUR SONG IS READY
          </p>
          <h2 className="mt-1 truncate text-base font-semibold text-[#26312d]">
            {draft.title}
          </h2>
          <div className="radio-mini-wave mt-3" aria-hidden="true">
            {[8, 16, 11, 21, 13, 18, 10, 15].map((height, index) => (
              <span key={index} style={{ height: `${height}px`, animationDelay: `${index * 80}ms` }} />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
            title={isPlaying ? "暂停音乐" : "播放音乐"}
            className="radio-play-button h-10 w-10"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
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
      className="fixed inset-0 z-30 grid place-items-center bg-[#21312c]/28 px-6 pb-20 backdrop-blur-[14px]"
      onClick={closeDraftPreview}
    >
      <article
        className="radio-player-modal relative w-full max-w-[340px] overflow-hidden rounded-[8px] p-4 animate-[draftCardIn_260ms_ease-out_forwards]"
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
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/70 text-[#26312d] shadow-sm backdrop-blur"
        >
          <X size={17} />
        </button>

        <div
          className="radio-modal-cover"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(248,255,249,0.12), rgba(26,45,39,0.66)), url(${draft.coverUrl})` }}
        >
          <div className="absolute inset-x-5 bottom-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#bff5e7]">
              MADE FOR THIS MOMENT
            </p>
            <h2 className="mt-2 line-clamp-2 text-3xl font-semibold leading-tight text-white">
              {draft.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/78">从你今天的心情里，写给此刻的一段音乐</p>
          </div>
        </div>

        <div className="mt-4 rounded-[8px] bg-white/46 p-3">
          <div className="radio-wave" aria-hidden="true">
            {[18, 34, 22, 46, 30, 54, 28, 40, 20, 36, 24, 44].map((height, index) => (
              <span key={index} style={{ height: `${height}px`, animationDelay: `${index * 75}ms` }} />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
              title={isPlaying ? "暂停音乐" : "播放音乐"}
              className="radio-play-button h-12 w-12"
            >
              {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={openDraftDetail}
              aria-label="展开卡片"
              title="展开卡片"
              className="radio-send-button h-12 flex-1"
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
            className="healing-blue grid h-11 w-11 place-items-center rounded-full"
          >
            <PenLine size={19} />
          </button>
        }
      />
      <section className="space-y-6 px-5 py-5">
        {entries.length === 0 ? (
          <div className="healing-card grid min-h-[55dvh] place-items-center rounded-[8px] text-sm text-[#7a7754]">
            还没有日记
          </div>
        ) : null}

        {Object.entries(groupedEntries).map(([date, dayEntries]) => (
          <div key={date} className="space-y-3">
            <h2 className="text-sm font-semibold text-[#7a7754]">{formatDateLabel(date)}</h2>
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
}: {
  entry: DiaryEntry;
  openEntry: (id: string) => void;
  renameEntry: (id: string, title: string) => void;
  deleteEntry: (entry: DiaryEntry) => void;
}) {
  const { audioUrl, coverUrl } = useEntryMedia(entry);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);

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
              <PenLine size={17} strokeWidth={1.6} />
              <span>文字日记</span>
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
          <AudioPlayer src={audioUrl} label={entry.title} />
        </div>
      ) : (
        <div className="diary-entry__text-kind">
          <PenLine size={13} strokeWidth={1.7} />
          <span>文字记录</span>
        </div>
      )}
    </article>
  );
}

function EntryDetailView({
  entry,
  goBack,
  renameEntry,
  deleteEntry,
}: {
  entry?: DiaryEntry;
  goBack: () => void;
  renameEntry: (id: string, title: string) => void;
  deleteEntry: (entry: DiaryEntry) => void;
}) {
  const { audioUrl, coverUrl } = useEntryMedia(entry);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry?.title ?? "");

  if (!entry) {
    return (
      <>
        <BackHeader goBack={goBack} title="日记不存在" />
        <section className="px-5 py-8 text-sm text-[#7a7754]">这张卡片可能已经被删除。</section>
      </>
    );
  }

  return (
    <>
      <BackHeader goBack={goBack} title={entry.title} />
      <section className="diary-detail-page space-y-5 px-5 py-5">
        {entry.audioBlobId ? (
          <>
            <CoverArt title={entry.title} summary={entry.summary} coverUrl={coverUrl} />
            <AudioPlayer src={audioUrl} label={entry.title} />
          </>
        ) : (
          <div className="diary-text-entry-hero">
            <p>{formatDateLabel(entry.date)} · 文字记录</p>
            <h1>{entry.title}</h1>
            <span>{entry.summary}</span>
          </div>
        )}

        <div className="healing-card rounded-[8px] p-4">
          {editing ? (
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#7a7754]/20 bg-[#fffff7]/80 px-3 text-sm outline-none focus:border-[#82b7eb]"
              />
              <button
                type="button"
                onClick={() => {
                  renameEntry(entry.id, title);
                  setEditing(false);
                }}
                aria-label="保存名称"
                title="保存名称"
                className="healing-primary grid h-10 w-10 place-items-center rounded-full"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                {entry.audioBlobId ? (
                  <>
                    <p className="text-xs font-medium text-[#82b7eb]">{formatDateLabel(entry.date)}</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#3f442f]">{entry.title}</h2>
                  </>
                ) : (
                  <p className="text-sm leading-7 text-[#7a7754]">{entry.summary}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setTitle(entry.title);
                  setEditing(true);
                }}
                aria-label="重命名"
                title="重命名"
                className="healing-blue grid h-10 w-10 shrink-0 place-items-center rounded-full"
              >
                <PenLine size={16} />
              </button>
            </div>
          )}
          {entry.audioBlobId ? (
            <p className="mt-4 text-sm leading-7 text-[#7a7754]">{entry.summary}</p>
          ) : null}
        </div>

        <div className="healing-card rounded-[8px] p-4">
          <h3 className="text-sm font-semibold text-[#3f442f]">完整日记</h3>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-[#4d5038]">
            {entry.fullDiary}
          </p>
        </div>

        <button
          type="button"
          onClick={() => deleteEntry(entry)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#9a675f]/24 bg-[#fffff7]/80 text-sm font-medium text-[#9a675f]"
        >
          <Trash2 size={16} />
          删除这张卡片
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
        <section className="px-5 py-8 text-sm text-[#7a7754]">还没有生成可查看的卡片。</section>
      </>
    );
  }

  return (
    <>
      <BackHeader goBack={goBack} title={draft.title} />
      <section className="space-y-5 px-5 py-5">
        <CoverArt title={draft.title} summary={draft.summary} coverUrl={draft.coverUrl} />
        <AudioPlayer src={draft.audioUrl} label={draft.title} />
        <div className="healing-card rounded-[8px] p-4">
          <h2 className="text-2xl font-semibold text-[#3f442f]">{draft.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[#7a7754]">{draft.summary}</p>
        </div>
        <div className="healing-card rounded-[8px] p-4">
          <h3 className="text-sm font-semibold text-[#3f442f]">完整日记</h3>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-[#4d5038]">
            {draft.fullDiary}
          </p>
        </div>
        <button
          type="button"
          onClick={saveCurrentDraft}
          disabled={isSavingDraft}
          className="healing-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-medium disabled:bg-[#b9b58e]"
        >
          {isSavingDraft ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
          保存当前版本
        </button>
      </section>
    </>
  );
}

const apiSettingsStorageKey = "meloday.api-settings.v1";

type ApiSettings = {
  deepseekApiKey: string;
  minimaxApiKey: string;
};

function loadApiSettings(): ApiSettings {
  if (typeof window === "undefined") {
    return { deepseekApiKey: "", minimaxApiKey: "" };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(apiSettingsStorageKey) || "{}");
    return {
      deepseekApiKey: typeof parsed.deepseekApiKey === "string" ? parsed.deepseekApiKey : "",
      minimaxApiKey: typeof parsed.minimaxApiKey === "string" ? parsed.minimaxApiKey : "",
    };
  } catch {
    return { deepseekApiKey: "", minimaxApiKey: "" };
  }
}

function MineView() {
  const [settings, setSettings] = useState<ApiSettings>(() => loadApiSettings());

  function updateSetting(key: keyof ApiSettings, value: string) {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(apiSettingsStorageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="space-y-3 px-5 py-5">
      <input
        value={settings.deepseekApiKey}
        onChange={(event) => updateSetting("deepseekApiKey", event.target.value)}
        type="password"
        autoComplete="off"
        aria-label="DeepSeek API Key"
        placeholder="DeepSeek API Key（对话与日记）"
        className="healing-surface h-12 w-full rounded-[8px] px-3 text-[15px] text-[#3f442f] outline-none transition focus:border-[#82b7eb]"
      />
      <input
        value={settings.minimaxApiKey}
        onChange={(event) => updateSetting("minimaxApiKey", event.target.value)}
        type="password"
        autoComplete="off"
        aria-label="Minimax API Key"
        placeholder="MiniMax API Key（海螺音乐）"
        className="healing-surface h-12 w-full rounded-[8px] px-3 text-[15px] text-[#3f442f] outline-none transition focus:border-[#82b7eb]"
      />
    </section>
  );
}

function BackHeader({ goBack, title }: { goBack: () => void; title: string }) {
  return (
    <header className="diary-back-header sticky top-0 z-10 border-b border-[#7a7754]/12 bg-[#fffff7]/78 px-4 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="返回"
          title="返回"
          className="healing-blue grid h-10 w-10 place-items-center rounded-full"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="min-w-0 truncate text-lg font-semibold text-[#3f442f]">{title}</h1>
      </div>
    </header>
  );
}

function BottomNav({
  active,
  goHome,
  goDiary,
  goMine,
}: {
  active: "home" | "diary" | "mine";
  goHome: () => void;
  goDiary: () => void;
  goMine: () => void;
}) {
  const itemClass = (target: typeof active) =>
    `relative flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#9bc7bb] ${
      active === target
        ? "text-[#5f8f82]"
        : "text-[#9aa6a2] hover:text-[#6f827c]"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-[#dfe7e3] bg-[#fbfcfb]/98 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="grid h-[68px] w-full grid-cols-3 items-center">
        <button
          type="button"
          onClick={goHome}
          aria-label="首页"
          title="首页"
          className={itemClass("home")}
        >
          <House size={18} strokeWidth={1.8} />
          <span>此刻</span>
        </button>
        <button
          type="button"
          onClick={goDiary}
          aria-label="日记本"
          title="日记本"
          className={itemClass("diary")}
        >
          <BookOpen size={18} strokeWidth={1.8} />
          <span>日记</span>
        </button>
        <button
          type="button"
          onClick={goMine}
          aria-label="个人"
          title="个人"
          className={itemClass("mine")}
        >
          <UserRound size={18} strokeWidth={1.8} />
          <span>我的</span>
        </button>
      </div>
    </nav>
  );
}
