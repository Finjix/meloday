"use client";

import {
  BookOpen,
  Check,
  ChevronLeft,
  LoaderCircle,
  Music2,
  PenLine,
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
  updateEntryWithGeneratedCard,
} from "@/lib/storage";
import type { CardPayload, ChatMessage, DiaryEntry, GeneratedCard } from "@/lib/types";

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

function toCardPayload(card: GeneratedCard | DiaryEntry): CardPayload {
  if ("musicPrompt" in card) {
    return card;
  }

  return {
    ...card,
    musicPrompt: "",
    audioSeed: `${card.id}|${card.title}|${card.updatedAt}`,
    coverSeed: `${card.id}|${card.coverMeta.query}|${card.updatedAt}`,
  };
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
  const [draftFeedback, setDraftFeedback] = useState("");
  const [isRegeneratingDraft, setIsRegeneratingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [pendingSavedVersion, setPendingSavedVersion] = useState<GeneratedCard | null>(
    null,
  );
  const [savedFeedback, setSavedFeedback] = useState("");
  const [isRegeneratingSaved, setIsRegeneratingSaved] = useState(false);

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
      setDraftFeedback("");
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

  async function submitMessage() {
    const content = input.trim();
    if (!content || isAgentBusy || generation?.running) return;

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

  async function regenerateDraft() {
    if (!currentDraft || !draftFeedback.trim()) return;
    setIsRegeneratingDraft(true);

    try {
      const nextCard = await requestCardRegeneration(currentDraft, draftFeedback);
      setDraftVersions((current) => [...current, nextCard]);
      setDraftIndex(draftVersions.length);
      setDraftFeedback("");
    } finally {
      setIsRegeneratingDraft(false);
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
    setDraftFeedback("");
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

  async function regenerateSaved(entry: DiaryEntry) {
    if (!savedFeedback.trim()) return;
    setIsRegeneratingSaved(true);

    try {
      const nextCard = await requestCardRegeneration(toCardPayload(entry), savedFeedback);
      disposeGeneratedCard(pendingSavedVersion);
      setPendingSavedVersion(nextCard);
      setSavedFeedback("");
    } finally {
      setIsRegeneratingSaved(false);
    }
  }

  async function commitPendingSaved(entry: DiaryEntry) {
    if (!pendingSavedVersion) return;
    const updated = await updateEntryWithGeneratedCard(entry, pendingSavedVersion);
    disposeGeneratedCard(pendingSavedVersion);
    setPendingSavedVersion(null);
    refreshEntries();
    setView({ name: "entry", id: updated.id });
  }

  function discardPendingSaved() {
    disposeGeneratedCard(pendingSavedVersion);
    setPendingSavedVersion(null);
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
              isAgentBusy={isAgentBusy}
              generation={generation}
              retryGeneration={() => runGeneration(messages)}
              draft={currentDraft}
              draftVersionsCount={draftVersions.length}
              draftIndex={draftIndex}
              setDraftIndex={setDraftIndex}
              draftFeedback={draftFeedback}
              setDraftFeedback={setDraftFeedback}
              regenerateDraft={regenerateDraft}
              isRegeneratingDraft={isRegeneratingDraft}
              saveCurrentDraft={saveCurrentDraft}
              isSavingDraft={isSavingDraft}
              openDraftDetail={() => setView({ name: "draft-detail" })}
              resetToday={resetToday}
            />
          ) : null}

          {view.name === "notebook" ? (
            <NotebookView
              entries={entries}
              openEntry={(id) => {
                setPendingSavedVersion(null);
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
                discardPendingSaved();
                setView({ name: "notebook" });
              }}
              renameEntry={handleRename}
              deleteEntry={handleDelete}
              feedback={savedFeedback}
              setFeedback={setSavedFeedback}
              regenerateSaved={regenerateSaved}
              isRegenerating={isRegeneratingSaved}
              pending={pendingSavedVersion}
              commitPending={commitPendingSaved}
              discardPending={discardPendingSaved}
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
            setPendingSavedVersion(null);
            refreshEntries();
            setView({ name: "notebook" });
          }}
          goMine={() => {
            setPendingSavedVersion(null);
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
  isAgentBusy,
  generation,
  retryGeneration,
  draft,
  draftVersionsCount,
  draftIndex,
  setDraftIndex,
  draftFeedback,
  setDraftFeedback,
  regenerateDraft,
  isRegeneratingDraft,
  saveCurrentDraft,
  isSavingDraft,
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
  isAgentBusy: boolean;
  generation: { running: boolean; stage: number; error?: string } | null;
  retryGeneration: () => void;
  draft: GeneratedCard | null;
  draftVersionsCount: number;
  draftIndex: number;
  setDraftIndex: (index: number) => void;
  draftFeedback: string;
  setDraftFeedback: (value: string) => void;
  regenerateDraft: () => void;
  isRegeneratingDraft: boolean;
  saveCurrentDraft: () => void;
  isSavingDraft: boolean;
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

  if (generation) {
    return (
      <GenerationView
        generation={generation}
        retryGeneration={retryGeneration}
        resetToday={resetToday}
      />
    );
  }

  if (draft) {
    return (
      <DraftResultView
        draft={draft}
        draftVersionsCount={draftVersionsCount}
        draftIndex={draftIndex}
        setDraftIndex={setDraftIndex}
        draftFeedback={draftFeedback}
        setDraftFeedback={setDraftFeedback}
        regenerateDraft={regenerateDraft}
        isRegeneratingDraft={isRegeneratingDraft}
        saveCurrentDraft={saveCurrentDraft}
        isSavingDraft={isSavingDraft}
        openDraftDetail={openDraftDetail}
        resetToday={resetToday}
      />
    );
  }

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
            {latestAgentMessage ? <ChatBubble message={latestAgentMessage} /> : null}
            {isAgentBusy ? (
              <div className="flex items-center gap-2 pl-1 text-sm text-[#68736f]">
                <LoaderCircle size={15} className="animate-spin" />
                正在听你说
              </div>
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
                placeholder={writtenParagraphs.length > 0 ? "继续写下去" : "写下今天的事"}
                rows={10}
                autoFocus
                className="mt-4 min-h-32 w-full resize-none overflow-hidden bg-transparent text-[17px] leading-8 text-[#20302d] outline-none placeholder:text-[#9aa39f]"
              />
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
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
        {message.content || " "}
      </div>
    </div>
  );
}

function GenerationView({
  generation,
  retryGeneration,
  resetToday,
}: {
  generation: { running: boolean; stage: number; error?: string };
  retryGeneration: () => void;
  resetToday: () => void;
}) {
  return (
    <>
      <AppHeader />
      <section className="px-5 py-10">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#263d3a] text-white shadow-sm">
            {generation.error ? <X size={24} /> : <Music2 size={25} />}
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-normal text-[#20302d]">
            {generation.error ? "生成没有完成" : "正在写成音乐日记"}
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-[#68736f]">
            {generation.error ?? "我会先整理今天的心情，再把它交给一段纯器乐。"}
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {generationStages.map((stage, index) => {
            const active = index === generation.stage && !generation.error;
            const done = index < generation.stage && !generation.error;
            return (
              <div
                key={stage}
                className="flex items-center gap-3 rounded-[8px] border border-[#dfe6df] bg-white px-4 py-3 shadow-sm"
              >
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full ${
                    done
                      ? "bg-[#b7d8cf] text-[#20302d]"
                      : active
                        ? "bg-[#d47d6a] text-white"
                        : "bg-[#eef2ee] text-[#7b8580]"
                  }`}
                >
                  {done ? <Check size={16} /> : active ? <LoaderCircle size={16} className="animate-spin" /> : index + 1}
                </div>
                <span className="text-sm font-medium text-[#263d3a]">{stage}</span>
              </div>
            );
          })}
        </div>

        {generation.error ? (
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={retryGeneration}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#263d3a] px-4 text-sm font-medium text-white"
            >
              <RefreshCw size={16} />
              重试
            </button>
            <button
              type="button"
              onClick={resetToday}
              className="h-11 flex-1 rounded-full border border-[#cfd8d1] bg-white px-4 text-sm font-medium text-[#263d3a]"
            >
              重新讲
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function DraftResultView({
  draft,
  draftVersionsCount,
  draftIndex,
  setDraftIndex,
  draftFeedback,
  setDraftFeedback,
  regenerateDraft,
  isRegeneratingDraft,
  saveCurrentDraft,
  isSavingDraft,
  openDraftDetail,
  resetToday,
}: {
  draft: GeneratedCard;
  draftVersionsCount: number;
  draftIndex: number;
  setDraftIndex: (index: number) => void;
  draftFeedback: string;
  setDraftFeedback: (value: string) => void;
  regenerateDraft: () => void;
  isRegeneratingDraft: boolean;
  saveCurrentDraft: () => void;
  isSavingDraft: boolean;
  openDraftDetail: () => void;
  resetToday: () => void;
}) {
  return (
    <>
      <AppHeader
        right={
          <button
            type="button"
            onClick={resetToday}
            title="写新的日记"
            aria-label="写新的日记"
            className="grid h-11 w-11 place-items-center rounded-full bg-[#e9f0eb] text-[#47615b]"
          >
            <PenLine size={19} />
          </button>
        }
      />
      <section className="space-y-5 px-5 py-5">
        <CoverArt title={draft.title} summary={draft.summary} coverUrl={draft.coverUrl} />
        <AudioPlayer src={draft.audioUrl} label="生成的纯器乐" />

        <div className="rounded-[8px] border border-[#dfe6df] bg-white p-4 shadow-sm">
          <p className="text-sm leading-6 text-[#68736f]">{draft.summary}</p>
          <button
            type="button"
            onClick={openDraftDetail}
            className="mt-4 h-10 w-full rounded-full border border-[#cfd8d1] text-sm font-medium text-[#263d3a]"
          >
            查看完整日记
          </button>
        </div>

        {draftVersionsCount > 1 ? (
          <div className="flex items-center justify-between rounded-[8px] border border-[#dfe6df] bg-white px-3 py-2 text-sm text-[#68736f] shadow-sm">
            <button
              type="button"
              onClick={() => setDraftIndex(Math.max(0, draftIndex - 1))}
              disabled={draftIndex === 0}
              className="rounded-full px-3 py-2 font-medium text-[#263d3a] disabled:text-[#aeb8b2]"
            >
              上一版
            </button>
            <span>
              第 {draftIndex + 1} / {draftVersionsCount} 版
            </span>
            <button
              type="button"
              onClick={() => setDraftIndex(Math.min(draftVersionsCount - 1, draftIndex + 1))}
              disabled={draftIndex === draftVersionsCount - 1}
              className="rounded-full px-3 py-2 font-medium text-[#263d3a] disabled:text-[#aeb8b2]"
            >
              下一版
            </button>
          </div>
        ) : null}

        <RegenerateBox
          value={draftFeedback}
          setValue={setDraftFeedback}
          onSubmit={regenerateDraft}
          loading={isRegeneratingDraft}
          placeholder="比如：更轻快一点，只改音乐"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={saveCurrentDraft}
            disabled={isSavingDraft}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#263d3a] px-4 text-sm font-medium text-white disabled:bg-[#aeb8b2]"
          >
            {isSavingDraft ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            保存当前版本
          </button>
        </div>
      </section>
    </>
  );
}

function RegenerateBox({
  value,
  setValue,
  onSubmit,
  loading,
  placeholder,
}: {
  value: string;
  setValue: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  placeholder: string;
}) {
  return (
    <div className="rounded-[8px] border border-[#dfe6df] bg-white p-3 shadow-sm">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent text-[15px] leading-6 text-[#20302d] outline-none placeholder:text-[#9aa39f]"
      />
      <div className="flex justify-end border-t border-[#eef2ee] pt-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || loading}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#d47d6a] px-4 text-sm font-medium text-white disabled:bg-[#d9b7ae]"
        >
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          重新生成
        </button>
      </div>
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
  feedback,
  setFeedback,
  regenerateSaved,
  isRegenerating,
  pending,
  commitPending,
  discardPending,
}: {
  entry?: DiaryEntry;
  goBack: () => void;
  renameEntry: (id: string, title: string) => void;
  deleteEntry: (entry: DiaryEntry) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  regenerateSaved: (entry: DiaryEntry) => void;
  isRegenerating: boolean;
  pending: GeneratedCard | null;
  commitPending: (entry: DiaryEntry) => void;
  discardPending: () => void;
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

        {pending ? (
          <div className="space-y-4 rounded-[8px] border border-[#d47d6a]/40 bg-[#fffaf7] p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-[#bd6253]">待确认版本</p>
              <h3 className="mt-1 text-xl font-semibold text-[#20302d]">{pending.title}</h3>
            </div>
            <CoverArt title={pending.title} summary={pending.summary} coverUrl={pending.coverUrl} compact />
            <AudioPlayer src={pending.audioUrl} label={pending.title} />
            <p className="text-sm leading-7 text-[#68736f]">{pending.summary}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => commitPending(entry)}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#263d3a] text-sm font-medium text-white"
              >
                <Save size={16} />
                保存更改
              </button>
              <button
                type="button"
                onClick={discardPending}
                className="h-11 flex-1 rounded-full border border-[#cfd8d1] bg-white text-sm font-medium text-[#263d3a]"
              >
                放弃
              </button>
            </div>
          </div>
        ) : null}

        <RegenerateBox
          value={feedback}
          setValue={setFeedback}
          onSubmit={() => regenerateSaved(entry)}
          loading={isRegenerating}
          placeholder="比如：保留日记，只让音乐更安静一点"
        />

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
