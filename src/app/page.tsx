"use client";

import {
  BookOpen,
  Check,
  ChevronLeft,
  LoaderCircle,
  Maximize2,
  Music2,
  Pause,
  PenLine,
  Play,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
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

type AppView =
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const [view, setView] = useState<AppView>({ name: "today" });
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
      ...writtenParagraphs.map((paragraph) => createMessage("user", paragraph)),
      userMessage,
    ];
    const nextWrittenParagraphCount = writtenParagraphs.length + 1;

    setInput("");
    setWrittenParagraphs((current) => [...current, content]);
    setMessages([...conversation, assistantMessage]);
    setIsAgentBusy(true);

    try {
      const meta = await requestAgentTurn(conversation, (delta) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: `${message.content}${delta}` }
              : message,
          ),
        );
      });

      setIsAgentBusy(false);

      if (meta.action === "generate" && nextWrittenParagraphCount >= 3) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: "正在为您创作" }
              : message,
          ),
        );
        await runGeneration(conversation);
      }
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: "刚刚连接不太稳定。你可以再发一次，我会接着听。" }
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
    setView({ name: "notebook" });
  }

  return (
    <main className="min-h-dvh bg-[#f5f7f4] text-[#20302d]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#f8faf7] shadow-[0_0_60px_rgba(50,70,65,0.08)]">
        <div className="flex-1 pb-24">
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
              retryGeneration={() => runGeneration(messages)}
              draft={currentDraft}
              isDraftPreviewOpen={isDraftPreviewOpen}
              openDraftPreview={() => setIsDraftPreviewOpen(true)}
              closeDraftPreview={() => setIsDraftPreviewOpen(false)}
              openDraftDetail={() => {
                setIsDraftPreviewOpen(false);
                setView({ name: "draft-detail" });
              }}
              resetToday={resetToday}
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
                setView({ name: "notebook" });
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
            view.name === "today" || view.name === "draft-detail"
              ? "today"
              : view.name === "mine"
                ? "mine"
                : "notebook"
          }
          goToday={() => setView({ name: "today" })}
          goNotebook={() => {
            refreshEntries();
            setView({ name: "notebook" });
          }}
          goMine={() => {
            setView({ name: "mine" });
          }}
        />
      </div>
    </main>
  );
}

function AppHeader(props: { right?: React.ReactNode }) {
  void props;
  return null;
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
          <div className="grid h-11 w-11 place-items-center rounded-full bg-[#e9f0eb] text-[#47615b]">
            <Music2 size={20} />
          </div>
        }
      />
      <div className="relative">
        <section className="absolute inset-x-0 top-0 z-20 px-5 pt-5">
          <div className="space-y-4">
            {latestAgentMessage ? (
              <ChatBubble message={latestAgentMessage} loading={isGenerating} />
            ) : null}
          </div>
        </section>
        {!hasStartedWriting ? (
          <section className="px-5 pb-5 pt-36">
            <button
              type="button"
              onClick={startWriting}
              className="flex min-h-[52dvh] w-full flex-col items-center justify-center text-center outline-none"
            >
              <p className="text-[17px] leading-7 text-[#51615c]">
                写点什么吧，请按开始
              </p>
            </button>
          </section>
        ) : (
          <section
            ref={diaryFrameRef}
            className="diary-scroll h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain px-5 pb-6 pt-36"
          >
            <div>
              <div className="animate-[diaryDateIn_700ms_ease-out_forwards] text-center opacity-0">
                <div className="text-3xl font-semibold tracking-normal text-[#263d3a]">
                  {writingDate.date}
                </div>
                <div className="mt-1 text-sm font-medium text-[#68736f]">
                  {writingDate.weekday}
                </div>
              </div>
              {writtenParagraphs.length > 0 ? (
                <div className="mt-8 space-y-4 text-[17px] leading-8 text-[#20302d]">
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
                className="mt-4 min-h-32 w-full resize-none overflow-hidden bg-transparent text-[17px] leading-8 text-[#20302d] outline-none placeholder:text-[#9aa39f] disabled:text-[#8e9994]"
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

function ChatBubble({ message, loading = false }: { message: ChatMessage; loading?: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "items-stretch justify-start"}`}>
      {!isUser ? (
        <div className="mr-2 grid min-h-14 w-14 shrink-0 items-start justify-items-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-[#dfe6df]">
            🌙
          </div>
        </div>
      ) : null}
      <div
        className={`min-h-14 min-w-0 whitespace-pre-wrap break-all px-4 py-3 text-[15px] leading-7 shadow-sm ${
          isUser
            ? "max-w-[78%] rounded-[8px] bg-[#263d3a] text-white"
            : "max-w-[calc(100%-4rem)] rounded-[8px] border border-[#dfe6df] bg-white text-[#263d3a]"
        }`}
      >
        <span>{message.content || " "}</span>
        {loading ? (
          <LoaderCircle
            size={15}
            className="ml-2 inline-block animate-spin align-[-2px] text-[#d47d6a]"
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
      <div className="mx-auto max-w-md rounded-[8px] border border-[#efc8c1] bg-white p-4 shadow-[0_18px_40px_rgba(50,70,65,0.18)]">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fbebe7] text-[#bd6253]">
            <X size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#20302d]">创作没有完成</p>
            <p className="mt-1 text-xs leading-5 text-[#68736f]">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={retryGeneration}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#263d3a] px-4 text-sm font-medium text-white"
          >
            <RefreshCw size={15} />
            重试
          </button>
          <button
            type="button"
            onClick={resetToday}
            className="h-10 flex-1 rounded-full border border-[#cfd8d1] bg-white px-4 text-sm font-medium text-[#263d3a]"
          >
            重新讲
          </button>
        </div>
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
      className="mt-6 grid cursor-pointer grid-cols-[76px_1fr_auto] items-center gap-3 rounded-[8px] border border-[#dfe6df] bg-white/92 p-3 shadow-sm transition active:scale-[0.99]"
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
        className="aspect-square overflow-hidden rounded-[8px] bg-[#dbe7e3] bg-cover bg-center"
        style={{ backgroundImage: `url(${draft.coverUrl})` }}
        aria-label="生成卡片封面"
      />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#d47d6a]">
          Meloday
        </p>
        <h2 className="mt-1 truncate text-base font-semibold text-[#20302d]">
          {draft.title}
        </h2>
        <p className="mt-1 truncate text-xs text-[#68736f]">今日纯器乐日记已完成</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? "暂停音乐" : "播放音乐"}
          title={isPlaying ? "暂停音乐" : "播放音乐"}
          className="grid h-10 w-10 place-items-center rounded-full bg-[#263d3a] text-white"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <button
          type="button"
          onClick={expandDetail}
          aria-label="展开卡片"
          title="展开卡片"
          className="grid h-10 w-10 place-items-center rounded-full bg-[#edf2ee] text-[#47615b]"
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
      className="fixed inset-0 z-30 grid place-items-center bg-[#20302d]/18 px-6 pb-20 backdrop-blur-[6px]"
      onClick={closeDraftPreview}
    >
      <article
        className="relative aspect-square w-full max-w-[340px] overflow-hidden rounded-[8px] border border-white/80 bg-[#dbe7e3] bg-cover bg-center shadow-[0_22px_54px_rgba(32,48,45,0.24)] animate-[draftCardIn_260ms_ease-out_forwards]"
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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,31,29,0.08)_0%,rgba(20,31,29,0.12)_42%,rgba(20,31,29,0.72)_100%)]" />
        <button
          type="button"
          onClick={closeDraftPreview}
          aria-label="关闭卡片"
          title="关闭卡片"
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/88 text-[#263d3a] shadow-sm backdrop-blur"
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
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#263d3a] shadow-sm"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={openDraftDetail}
            aria-label="展开卡片"
            title="展开卡片"
            className="grid h-11 w-11 place-items-center rounded-full bg-[#263d3a] text-white shadow-sm"
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
            className="grid h-11 w-11 place-items-center rounded-full bg-[#e9f0eb] text-[#47615b]"
          >
            <PenLine size={19} />
          </button>
        }
      />
      <section className="space-y-6 px-5 py-5">
        {entries.length === 0 ? (
          <div className="grid min-h-[55dvh] place-items-center text-sm text-[#7b8580]">
            还没有日记
          </div>
        ) : null}

        {Object.entries(groupedEntries).map(([date, dayEntries]) => (
          <div key={date} className="space-y-3">
            <h2 className="text-sm font-semibold text-[#68736f]">{formatDateLabel(date)}</h2>
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
      className="cursor-pointer rounded-[8px] border border-[#dfe6df] bg-white p-3 shadow-sm transition active:scale-[0.99]"
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
                className="h-9 min-w-0 flex-1 rounded-[8px] border border-[#cfd8d1] px-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  renameEntry(entry.id, title);
                  setEditing(false);
                }}
                aria-label="保存名称"
                title="保存名称"
                className="grid h-9 w-9 place-items-center rounded-full bg-[#263d3a] text-white"
              >
                <Check size={15} />
              </button>
            </div>
          ) : (
            <h3 className="truncate text-lg font-semibold text-[#20302d]">{entry.title}</h3>
          )}
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#68736f]">
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
              className="grid h-9 w-9 place-items-center rounded-full bg-[#edf2ee] text-[#47615b]"
            >
              <PenLine size={15} />
            </button>
            <button
              type="button"
              onClick={() => deleteEntry(entry)}
              aria-label="删除"
              title="删除"
              className="grid h-9 w-9 place-items-center rounded-full bg-[#fbebe7] text-[#bd6253]"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => openEntry(entry.id)}
              aria-label="打开详情"
              title="打开详情"
              className="grid h-9 w-9 place-items-center rounded-full bg-[#edf2ee] text-[#47615b]"
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
        <section className="px-5 py-8 text-sm text-[#68736f]">这张卡片可能已经被删除。</section>
      </>
    );
  }

  return (
    <>
      <BackHeader goBack={goBack} title={entry.title} />
      <section className="space-y-5 px-5 py-5">
        <CoverArt title={entry.title} summary={entry.summary} coverUrl={coverUrl} />
        <AudioPlayer src={audioUrl} label={entry.title} />

        <div className="rounded-[8px] border border-[#dfe6df] bg-white p-4 shadow-sm">
          {editing ? (
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#cfd8d1] px-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  renameEntry(entry.id, title);
                  setEditing(false);
                }}
                aria-label="保存名称"
                title="保存名称"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#263d3a] text-white"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#d47d6a]">{formatDateLabel(entry.date)}</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#20302d]">{entry.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTitle(entry.title);
                  setEditing(true);
                }}
                aria-label="重命名"
                title="重命名"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#edf2ee] text-[#47615b]"
              >
                <PenLine size={16} />
              </button>
            </div>
          )}
          <p className="mt-4 text-sm leading-7 text-[#68736f]">{entry.summary}</p>
        </div>

        <div className="rounded-[8px] border border-[#dfe6df] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#20302d]">完整日记</h3>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-[#394a46]">
            {entry.fullDiary}
          </p>
        </div>

        <button
          type="button"
          onClick={() => deleteEntry(entry)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#efc8c1] bg-white text-sm font-medium text-[#bd6253]"
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
        <section className="px-5 py-8 text-sm text-[#68736f]">还没有生成可查看的卡片。</section>
      </>
    );
  }

  return (
    <>
      <BackHeader goBack={goBack} title={draft.title} />
      <section className="space-y-5 px-5 py-5">
        <CoverArt title={draft.title} summary={draft.summary} coverUrl={draft.coverUrl} />
        <AudioPlayer src={draft.audioUrl} label={draft.title} />
        <div className="rounded-[8px] border border-[#dfe6df] bg-white p-4 shadow-sm">
          <h2 className="text-2xl font-semibold text-[#20302d]">{draft.title}</h2>
          <p className="mt-3 text-sm leading-7 text-[#68736f]">{draft.summary}</p>
        </div>
        <div className="rounded-[8px] border border-[#dfe6df] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#20302d]">完整日记</h3>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-[#394a46]">
            {draft.fullDiary}
          </p>
        </div>
        <button
          type="button"
          onClick={saveCurrentDraft}
          disabled={isSavingDraft}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#263d3a] px-4 text-sm font-medium text-white disabled:bg-[#aeb8b2]"
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
        placeholder="DeepSeek API Key"
        className="h-12 w-full rounded-[8px] border border-[#dfe6df] bg-white px-3 text-[15px] text-[#20302d] outline-none transition focus:border-[#8fb3a8]"
      />
      <input
        value={settings.minimaxApiKey}
        onChange={(event) => updateSetting("minimaxApiKey", event.target.value)}
        type="password"
        autoComplete="off"
        aria-label="Minimax API Key"
        placeholder="Minimax API Key"
        className="h-12 w-full rounded-[8px] border border-[#dfe6df] bg-white px-3 text-[15px] text-[#20302d] outline-none transition focus:border-[#8fb3a8]"
      />
    </section>
  );
}

function BackHeader({ goBack, title }: { goBack: () => void; title: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-[#e1e8e1] bg-[#f8faf7]/92 px-4 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="返回"
          title="返回"
          className="grid h-10 w-10 place-items-center rounded-full bg-[#e9f0eb] text-[#47615b]"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="min-w-0 truncate text-lg font-semibold text-[#20302d]">{title}</h1>
      </div>
    </header>
  );
}

function BottomNav({
  active,
  goToday,
  goNotebook,
  goMine,
}: {
  active: "today" | "notebook" | "mine";
  goToday: () => void;
  goNotebook: () => void;
  goMine: () => void;
}) {
  const itemClass = (target: typeof active) =>
    `grid h-12 w-12 place-items-center rounded-full transition ${
      active === target
        ? "bg-[#263d3a] text-white shadow-sm"
        : "text-[#52645f] hover:bg-[#eef2ee]"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2">
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-[#dfe6df] bg-white/94 p-2 shadow-[0_14px_34px_rgba(50,70,65,0.16)] backdrop-blur">
        <button
          type="button"
          onClick={goToday}
          aria-label="写日记"
          title="写日记"
          className={itemClass("today")}
        >
          <PenLine size={19} />
        </button>
        <button
          type="button"
          onClick={goNotebook}
          aria-label="日记本"
          title="日记本"
          className={itemClass("notebook")}
        >
          <BookOpen size={19} />
        </button>
        <button
          type="button"
          onClick={goMine}
          aria-label="我的"
          title="我的"
          className={itemClass("mine")}
        >
          <UserRound size={19} />
        </button>
      </div>
    </nav>
  );
}
