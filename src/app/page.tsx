"use client";

import {
  BookOpen,
  Check,
  ChevronLeft,
  House,
  LoaderCircle,
  Maximize2,
  Music2,
  Pause,
  PenLine,
  Play,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
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

type AppView =
  | { name: "home" }
  | { name: "diary" }
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

const agentAvatarEmojis = ["🙂", "😊", "😌", "😉", "🤗", "😴", "🐱", "🐶", "🐰", "🐻", "🐼", "🦊"];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function randomAgentAvatarEmoji() {
  const index = Math.floor(Math.random() * agentAvatarEmojis.length);
  return agentAvatarEmojis[index] ?? "🙂";
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
  const [agentAvatarEmoji, setAgentAvatarEmoji] = useState("🙂");
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages());
  const [input, setInput] = useState("");
  const [writtenParagraphs, setWrittenParagraphs] = useState<string[]>([]);
  const [hasStartedWriting, setHasStartedWriting] = useState(false);
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
    setAgentAvatarEmoji(randomAgentAvatarEmoji());
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
    setWrittenParagraphs((current) => [...current, content]);
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
      setWrittenParagraphs([]);
      setHasStartedWriting(false);
      refreshEntries();
      setView({ name: "entry", id: entry.id });
    } finally {
      setIsSavingDraft(false);
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
    setWrittenParagraphs([]);
    setHasStartedWriting(false);
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
      <div className="healing-phone mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden shadow-[0_0_80px_rgba(73,78,55,0.18)]">
        <div className="flex-1 pb-24">
          {view.name === "home" ? <HomeDashboardView /> : null}

          {view.name === "diary" ? (
            <DiaryHubView
              entries={entries}
              startWriting={() => setView({ name: "today" })}
              openEntry={(id) => {
                setView({ name: "entry", id });
              }}
              renameEntry={handleRename}
              deleteEntry={handleDelete}
            />
          ) : null}

          {view.name === "today" ? (
            <TodayView
              messages={messages}
              input={input}
              writtenParagraphs={writtenParagraphs}
              hasStartedWriting={hasStartedWriting}
              startWriting={() => setHasStartedWriting(true)}
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
              agentAvatarEmoji={agentAvatarEmoji}
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
              startNew={resetToday}
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
            view.name === "home"
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

function HomeDashboardView() {
  const secondaryModes = [
    {
      title: "冥想模式",
      iconSrc: "/mode-icons/mode-meditate.png?v=1",
      className: "row-span-2 bg-[#dcebcf] text-[#2f3d29]",
      iconClassName: "right-[-25%] bottom-[-17%] h-[90%] w-[90%] opacity-55",
    },
    {
      title: "助眠模式",
      iconSrc: "/mode-icons/mode-sleep.png?v=1",
      className: "bg-[#ddd3ff] text-[#342f55]",
      iconClassName: "right-[-24%] bottom-[-31%] h-[104%] w-[104%] opacity-50",
    },
    {
      title: "运动模式",
      iconSrc: "/mode-icons/mode-move.png?v=1",
      className: "bg-[#82b7eb] text-[#20364a]",
      iconClassName: "right-[-25%] bottom-[-29%] h-[108%] w-[108%] opacity-48",
    },
  ];

  return (
    <section className="px-5 pb-6 pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#7a7754]">今天想听点什么</p>
          <h1 className="mt-1 text-[32px] font-semibold leading-tight text-[#2f3328]">
            Meloday
          </h1>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-[8px] border border-[#7a7754]/18 bg-[#f3ff9b] text-[#4a4c33]">
          <Music2 size={24} strokeWidth={1.7} />
        </div>
      </div>

      <article
        className="relative mt-6 min-h-[268px] overflow-hidden rounded-[8px] bg-[#f3ff9b] p-5 text-left text-[#3f442f] transition active:scale-[0.99]"
      >
        <div className="absolute inset-0 bg-[#82b7eb]/26 [clip-path:polygon(0_58%,66%_100%,0_100%)]" />
        <div className="absolute inset-y-0 left-0 w-[64%] bg-[#fffff7]/30 [clip-path:polygon(0_0,82%_100%,0_100%)]" />
        <Image
          src="/mascot/meloday-tiger-listening.png?v=1"
          alt="小老虎听音乐"
          width={260}
          height={220}
          unoptimized
          className="absolute bottom-[2px] left-[-14px] z-10 h-auto w-[52%] max-w-[248px] object-contain drop-shadow-[0_8px_8px_rgba(55,89,126,0.16)]"
          priority
        />
        <div className="absolute right-5 top-5 z-20 flex max-w-[13rem] flex-col items-end text-right">
          <span className="mb-5 grid h-12 w-12 place-items-center rounded-[8px] bg-[#fffff7]/86 text-[#7a7754]">
            <Play size={18} strokeWidth={1.7} className="ml-0.5" />
          </span>
          <h2 className="text-[44px] font-semibold leading-none text-[#343729]">悦听</h2>
          <p className="mt-4 text-[16px] leading-6 text-[#55583d]">
            闭上眼，让今天的心情先被声音接住。
          </p>
        </div>
      </article>

      <div className="mt-3 grid h-[234px] grid-cols-[1.08fr_0.92fr] grid-rows-[1.08fr_0.92fr] gap-3">
        {secondaryModes.map((mode) => {
          return (
            <article
              key={mode.title}
              className={`relative overflow-hidden rounded-[8px] p-4 text-left transition active:scale-[0.99] ${mode.className}`}
            >
              <Image
                src={mode.iconSrc}
                alt=""
                width={260}
                height={260}
                unoptimized
                aria-hidden="true"
                className={`pointer-events-none absolute z-0 object-contain ${mode.iconClassName}`}
              />
              <div className="relative z-10 flex h-full max-w-[8.6rem] flex-col justify-start">
                <h3 className="text-[26px] font-semibold leading-tight">{mode.title}</h3>
              </div>
            </article>
          );
        })}
      </div>
    </section>
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
    <section className="px-5 pb-6 pt-6">
      <div>
        <p className="text-sm font-medium text-[#7a7754]">情绪和音乐的日记本</p>
        <h1 className="mt-1 text-[30px] font-semibold leading-tight text-[#2f3328]">
          今天也可以慢慢说
        </h1>
      </div>

      <div className="mt-6 grid grid-cols-[1.2fr_0.8fr] gap-3">
        <button
          type="button"
          onClick={startWriting}
          className="min-h-36 rounded-[8px] bg-[#82b7eb] p-4 text-left text-[#20364a] transition active:scale-[0.99]"
        >
          <PenLine size={22} />
          <h2 className="mt-8 text-2xl font-semibold leading-tight">写一段今天</h2>
          <p className="mt-2 text-sm leading-5 text-[#20364a]/72">把心情交给 Meloday</p>
        </button>
        <div className="min-h-36 rounded-[8px] bg-[#f3ff9b] p-4 text-[#4a4c33]">
          <BookOpen size={22} />
          <p className="mt-9 text-[34px] font-semibold leading-none">{entries.length}</p>
          <p className="mt-1 text-sm text-[#4a4c33]/70">已保存</p>
        </div>
      </div>

      <div className="mt-7 space-y-6">
        {entries.length === 0 ? (
          <button
            type="button"
            onClick={startWriting}
            className="grid min-h-[34dvh] w-full place-items-center rounded-[8px] border border-[#7a7754]/18 bg-[#fffff7]/78 p-6 text-center text-[#56583d] transition active:scale-[0.99]"
          >
            <span className="max-w-[15rem] text-sm leading-6">
              还没有日记。先写下一段今天，之后生成的音乐会留在这里。
            </span>
          </button>
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
      </div>
    </section>
  );
}

function TodayView({
  messages,
  input,
  writtenParagraphs,
  hasStartedWriting,
  startWriting,
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
  agentAvatarEmoji,
}: {
  messages: ChatMessage[];
  input: string;
  writtenParagraphs: string[];
  hasStartedWriting: boolean;
  startWriting: () => void;
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
  agentAvatarEmoji: string;
}) {
  const latestAgentMessage = [...messages]
    .reverse()
    .find((message) => message.role === "agent");
  const writingDate = formatWritingDate(new Date());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const diaryFrameRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input, writtenParagraphs.length, hasStartedWriting]);

  useEffect(() => {
    const frame = diaryFrameRef.current;
    if (!frame) return;
    frame.scrollTop = frame.scrollHeight;
  }, [input, writtenParagraphs, hasStartedWriting]);

  const isGenerating = Boolean(generation?.running && !generation.error);
  const inputPlaceholder = draft
    ? "还有什么说的吗"
    : writtenParagraphs.length > 0
      ? "继续写下去"
      : "写下今天的事";

  return (
    <>
      <AppHeader
        right={
          <div className="healing-blue grid h-11 w-11 place-items-center rounded-full ring-1 ring-white/70">
            <Music2 size={20} />
          </div>
        }
      />
      <div className="relative">
        <section className="absolute inset-x-0 top-0 z-20 px-5 pt-5">
          <div className="space-y-4">
            {latestAgentMessage ? (
              <ChatBubble
                message={latestAgentMessage}
                loading={isGenerating}
                agentAvatarEmoji={agentAvatarEmoji}
              />
            ) : null}
          </div>
        </section>
        {!hasStartedWriting ? (
          <section className="px-5 pb-5 pt-36">
            <button
              type="button"
              onClick={startWriting}
              className="healing-card flex min-h-[52dvh] w-full flex-col items-center justify-center rounded-[8px] px-7 text-center outline-none transition active:scale-[0.99]"
            >
              <Image
                src="/mascot/meloday-fox.png?v=4"
                alt="Meloday mascot"
                width={144}
                height={144}
                unoptimized
                className="mb-5 h-36 w-36 object-contain drop-shadow-[0_4px_6px_rgba(122,119,84,0.18)]"
              />
              <div className="mb-8 h-px w-24 healing-rule" />
              <p className="max-w-[15rem] text-[18px] leading-8 text-[#56583d]">
                写点什么吧，轻点屏幕开始
              </p>
              <div className="mt-8 rounded-full bg-[#f3ff9b] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a7754]">
                Meloday
              </div>
            </button>
          </section>
        ) : (
          <section
            ref={diaryFrameRef}
            className="diary-scroll h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain px-5 pb-6 pt-36"
          >
            <div>
              <div className="animate-[diaryDateIn_700ms_ease-out_forwards] text-center opacity-0">
                <div className="mx-auto mb-4 h-px w-20 healing-rule" />
                <div className="text-4xl font-semibold tracking-normal text-[#3f442f]">
                  {writingDate.date}
                </div>
                <div className="mt-2 text-sm font-medium text-[#7a7754]">
                  {writingDate.weekday}
                </div>
              </div>
              {writtenParagraphs.length > 0 ? (
                <div className="mt-8 space-y-4 text-[17px] leading-8 text-[#363a2b]">
                  {writtenParagraphs.map((paragraph, index) => (
                    <p key={`${paragraph}_${index}`} className="whitespace-pre-wrap break-all">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : null}
              {draft && !generation ? (
                <InlineDraftCard
                  draft={draft}
                  openDraftPreview={openDraftPreview}
                  openDraftDetail={openDraftDetail}
                />
              ) : null}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                disabled={isGenerating}
                placeholder={inputPlaceholder}
                rows={10}
                autoFocus
                className="mt-4 min-h-32 w-full resize-none overflow-hidden bg-transparent text-[17px] leading-8 text-[#363a2b] outline-none placeholder:text-[#8f8b68] disabled:text-[#9a9676]"
              />
            </div>
          </section>
        )}
      </div>
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

function ChatBubble({
  message,
  loading = false,
  agentAvatarEmoji,
}: {
  message: ChatMessage;
  loading?: boolean;
  agentAvatarEmoji: string;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "items-stretch justify-start"}`}>
      {!isUser ? (
        <div className="mr-2 grid min-h-16 w-16 shrink-0 items-start justify-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-[8px] bg-[#fffff7]/86 shadow-[0_4px_8px_rgba(73,78,55,0.12)] ring-1 ring-[#f3ff9b]/70 backdrop-blur">
            <Image
              src="/mascot/meloday-fox.png?v=4"
              alt={`Meloday ${agentAvatarEmoji}`}
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 object-contain"
            />
          </div>
        </div>
      ) : null}
      <div
        className={`min-h-14 min-w-0 whitespace-pre-wrap break-all px-4 py-3 text-[15px] leading-7 shadow-sm ${
          isUser
            ? "max-w-[78%] rounded-[8px] bg-[#7a7754] text-[#fffff7]"
            : "healing-surface max-w-[calc(100%-4rem)] rounded-[8px] text-[#3f442f]"
        }`}
      >
        <span>{message.content || " "}</span>
        {loading ? (
          <LoaderCircle
            size={15}
            className="ml-2 inline-block animate-spin align-[-2px] text-[#82b7eb]"
          />
        ) : null}
      </div>
    </div>
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
      className="healing-card mt-6 grid cursor-pointer grid-cols-[76px_1fr_auto] items-center gap-3 rounded-[8px] p-3 transition active:scale-[0.99]"
    >
      <audio
        key={draft.audioUrl}
        ref={audioRef}
        src={draft.audioUrl}
        preload="auto"
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <div
        className="aspect-square overflow-hidden rounded-[8px] bg-[#82b7eb]/30 bg-cover bg-center ring-1 ring-white/70"
        style={{ backgroundImage: `url(${draft.coverUrl})` }}
        aria-label="生成卡片封面"
      />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#82b7eb]">
          Meloday
        </p>
        <h2 className="mt-1 truncate text-base font-semibold text-[#3f442f]">
          {draft.title}
        </h2>
        <p className="mt-1 truncate text-xs text-[#7a7754]">今日纯器乐日记已完成</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
          title={isPlaying ? "暂停音乐" : "播放音乐"}
          className="healing-primary grid h-10 w-10 place-items-center rounded-full"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <button
          type="button"
          onClick={expandDetail}
          aria-label="展开卡片"
          title="展开卡片"
          className="healing-blue grid h-10 w-10 place-items-center rounded-full"
        >
          <Maximize2 size={16} />
        </button>
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
      className="fixed inset-0 z-30 grid place-items-center bg-[#2f3328]/22 px-6 pb-20 backdrop-blur-[10px]"
      onClick={closeDraftPreview}
    >
      <article
        className="relative aspect-square w-full max-w-[340px] overflow-hidden rounded-[8px] border border-white/80 bg-[#82b7eb]/30 bg-cover bg-center shadow-[0_8px_8px_rgba(73,78,55,0.2)] animate-[draftCardIn_260ms_ease-out_forwards]"
        style={{ backgroundImage: `url(${draft.coverUrl})` }}
        aria-label="生成卡片预览"
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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,247,0.08)_0%,rgba(63,68,47,0.10)_42%,rgba(47,51,40,0.76)_100%)]" />
        <button
          type="button"
          onClick={closeDraftPreview}
          aria-label="关闭卡片"
          title="关闭卡片"
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-[#fffff7]/88 text-[#3f442f] shadow-sm backdrop-blur"
        >
          <X size={17} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-4 pr-28 text-white">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/78">
            Meloday
          </p>
          <h2 className="mt-1 line-clamp-2 text-2xl font-semibold leading-tight">
            {draft.title}
          </h2>
          <p className="mt-2 text-xs text-white/82">今日纯器乐日记已完成</p>
        </div>
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
            title={isPlaying ? "暂停音乐" : "播放音乐"}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#fffff7] text-[#3f442f] shadow-sm"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={openDraftDetail}
            aria-label="展开卡片"
            title="展开卡片"
            className="grid h-11 w-11 place-items-center rounded-full bg-[#f3ff9b] text-[#4a4c33] shadow-sm"
          >
            <Maximize2 size={16} />
          </button>
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
      className="healing-card cursor-pointer rounded-[8px] p-3 transition active:scale-[0.99]"
    >
      <div className="grid grid-cols-[112px_1fr] gap-3">
        <CoverArt title={entry.title} coverUrl={coverUrl} compact />
        <div className="min-w-0">
          {editing ? (
            <div
              className="flex gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-[8px] border border-[#7a7754]/20 bg-[#fffff7]/80 px-3 text-sm outline-none focus:border-[#82b7eb]"
              />
              <button
                type="button"
                onClick={() => {
                  renameEntry(entry.id, title);
                  setEditing(false);
                }}
                aria-label="保存名称"
                title="保存名称"
                className="healing-primary grid h-9 w-9 place-items-center rounded-full"
              >
                <Check size={15} />
              </button>
            </div>
          ) : (
            <h3 className="truncate text-lg font-semibold text-[#3f442f]">{entry.title}</h3>
          )}
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#7a7754]">
            {entry.summary}
          </p>
          <div
            className="mt-3 flex items-center gap-2"
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
              className="healing-blue grid h-9 w-9 place-items-center rounded-full"
            >
              <PenLine size={15} />
            </button>
            <button
              type="button"
              onClick={() => deleteEntry(entry)}
              aria-label="删除"
              title="删除"
              className="grid h-9 w-9 place-items-center rounded-full bg-[#fffff7] text-[#9a675f] ring-1 ring-[#9a675f]/18"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => openEntry(entry.id)}
              aria-label="打开详情"
              title="打开详情"
              className="healing-blue grid h-9 w-9 place-items-center rounded-full"
            >
              <BookOpen size={15} />
            </button>
          </div>
        </div>
      </div>
      <div onClick={(event) => event.stopPropagation()} className="mt-3">
        <AudioPlayer src={audioUrl} label={entry.title} />
      </div>
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
      <section className="space-y-5 px-5 py-5">
        <CoverArt title={entry.title} summary={entry.summary} coverUrl={coverUrl} />
        <AudioPlayer src={audioUrl} label={entry.title} />

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
                <p className="text-xs font-medium text-[#82b7eb]">{formatDateLabel(entry.date)}</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#3f442f]">{entry.title}</h2>
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
          <p className="mt-4 text-sm leading-7 text-[#7a7754]">{entry.summary}</p>
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
    <header className="sticky top-0 z-10 border-b border-[#7a7754]/12 bg-[#fffff7]/78 px-4 py-4 backdrop-blur-xl">
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
    `relative grid h-14 w-full place-items-center rounded-[8px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#82b7eb] ${
      active === target
        ? "bg-[#f3ff9b]/72 text-[#3f442f] after:absolute after:bottom-1.5 after:h-0.5 after:w-8 after:rounded-full after:bg-[#7a7754]"
        : "text-[#7a7754] hover:bg-[#82b7eb]/12"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-[#7a7754]/14 bg-[#fffff7]/96 px-5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur">
      <div className="grid w-full grid-cols-3 items-center gap-3">
        <button
          type="button"
          onClick={goHome}
          aria-label="首页"
          title="首页"
          className={itemClass("home")}
        >
          <House size={22} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={goDiary}
          aria-label="日记本"
          title="日记本"
          className={itemClass("diary")}
        >
          <BookOpen size={22} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={goMine}
          aria-label="个人"
          title="个人"
          className={itemClass("mine")}
        >
          <FoxLineIcon />
        </button>
      </div>
    </nav>
  );
}

function FoxLineIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 28"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.2 12.1 5.7 5.7l5.2 3.1" />
      <path d="m20.8 12.1 1.5-6.4-5.2 3.1" />
      <path d="M6.6 13.1c.8-3 3.5-5.1 7.4-5.1s6.6 2.1 7.4 5.1" />
      <path d="M6.7 13.2c-.8 4.8 2.5 8.4 7.3 8.4s8.1-3.6 7.3-8.4" />
      <path d="M10.3 15.2h.1" />
      <path d="M17.6 15.2h.1" />
      <path d="M13.1 17.2c.5.4 1.3.4 1.8 0" />
      <path d="M11 20.6c-1.4.8-2.9.9-4.1.2 1.3-.6 2.1-1.6 2.4-3" />
    </svg>
  );
}
