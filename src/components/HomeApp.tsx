"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Image from "next/image";
import { apiFetch, cacheHomeInput, cacheHomeState, formatDate, formatTime, mediaUrl, restoreHomeState } from "@/lib/client";
import { draftText, type GenerationJob, type SessionSnapshot } from "@/lib/types";
import { useAuth } from "./AuthContext";
import { AnimatedAgentMessage } from "./AnimatedAgentMessage";
import { AppIcon, WelcomeMark } from "./AppIcon";
import { GenerationCard } from "./GenerationCard";

function currentGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了，";
  if (hour < 12) return "早上好，";
  if (hour < 18) return "下午好，";
  return "晚上好，";
}

let cachedSession: SessionSnapshot | null = null;
let cachedJob: GenerationJob | null = null;
let cachedInput = "";

export function resetHomeCache(): void {
  cachedSession = null;
  cachedJob = null;
  cachedInput = "";
  cacheHomeState(null, null);
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function HomeApp() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [session, setSessionState] = useState<SessionSnapshot | null>(cachedSession);
  const [job, setJobState] = useState<GenerationJob | null>(cachedJob);
  const [input, setInputState] = useState(cachedInput);
  const [quickLine, setQuickLine] = useState("");
  const [quickPhoto, setQuickPhoto] = useState<File | null>(null);
  const [listening, setListening] = useState<"quick" | "composer" | null>(null);
  const [creating, setCreating] = useState(false);
  const [sessionTransitioning, setSessionTransitioning] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generationCardOpen, setGenerationCardOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [agentReplyError, setAgentReplyError] = useState("");
  const [retryAgentContent, setRetryAgentContent] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const generationInFlight = Boolean(job && (job.status === "queued" || job.status === "running"));

  const setSession = (next: SessionSnapshot | null) => {
    cachedSession = next;
    cacheHomeState(next, cachedJob);
    setSessionState(next);
  };
  const setJob = (next: GenerationJob | null) => {
    cachedJob = next;
    cacheHomeState(cachedSession, next);
    setJobState(next);
  };
  const setInput = (next: string) => {
    cachedInput = next;
    cacheHomeInput(next);
    setInputState(next);
  };

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const active = await apiFetch<SessionSnapshot | null>("/api/sessions");
      setSession(active);
      if (!active) {
        setJob(null);
      } else {
        try {
          const latest = await apiFetch<GenerationJob | null>(`/api/sessions/${active.id}/generate`);
          setJob(latest);
        } catch { /* no generation may exist yet */ }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法读取临时日记。");
    }
  }, []);

  useEffect(() => { resizeTextarea(); }, [input, resizeTextarea]);
  useEffect(() => () => recognitionRef.current?.stop(), []);

  const dictate = (target: "quick" | "composer") => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) { setNotice("当前浏览器暂不支持语音转文字，可以直接输入，或换用支持语音识别的浏览器。"); return; }
    const recognition = new Constructor();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (target === "quick") setQuickLine((current) => [current, transcript].filter(Boolean).join(" "));
      else setInput([cachedInput, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = () => setNotice("没有听清这次录音，请检查麦克风权限后重试。");
    recognition.onend = () => { setListening(null); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(target); setNotice(""); }
    catch { setListening(null); setNotice("语音识别暂时无法启动，请检查麦克风权限。"); }
  };

  useEffect(() => {
    if (job?.status === "succeeded") setGenerationCardOpen(true);
  }, [job?.id, job?.status]);

  useEffect(() => {
    const restored = restoreHomeState();
    if (!restored) {
      if (!cachedSession) {
        cachedInput = "";
        cacheHomeState(null, null);
      }
      return;
    }
    if (cachedSession) return;
    cachedSession = restored.session;
    cachedJob = restored.job;
    cachedInput = restored.input;
    setSessionState(restored.session);
    setJobState(restored.job);
    setInputState(restored.input);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateKeyboardOffset = () => {
      const nextOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset((current) => current === nextOffset ? current : nextOffset);
    };
    updateKeyboardOffset();
    viewport.addEventListener("resize", updateKeyboardOffset);
    viewport.addEventListener("scroll", updateKeyboardOffset);
    return () => {
      viewport.removeEventListener("resize", updateKeyboardOffset);
      viewport.removeEventListener("scroll", updateKeyboardOffset);
    };
  }, []);

  const startSession = async () => {
    const replaceCurrentSession = Boolean(session);
    setCreating(true); setNotice(""); setAgentReplyError(""); setRetryAgentContent(null); setGenerationCardOpen(false); setJob(null);
    if (replaceCurrentSession) setSessionTransitioning(true);
    try {
      const request = apiFetch<SessionSnapshot>("/api/sessions", { method: "POST", body: JSON.stringify({}) });
      if (replaceCurrentSession) await new Promise((resolve) => window.setTimeout(resolve, 180));
      const next = await request;
      setSession(next);
      setInput("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "暂时无法开始新的日记。");
    } finally {
      setSessionTransitioning(false);
      setCreating(false);
    }
  };

  const startQuickMusic = async (preset: "relax" | "move") => {
    setCreating(true); setNotice(""); setAgentReplyError(""); setRetryAgentContent(null); setGenerationCardOpen(false); setJob(null);
    try {
      const result = await apiFetch<{ session: SessionSnapshot; job: GenerationJob }>("/api/quick-music", { method: "POST", body: JSON.stringify({ preset }) });
      setSession(result.session);
      setJob(result.job);
      setInput("");
      void pollGeneration(result.job.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "暂时无法开始生成音乐。");
    } finally {
      setCreating(false);
    }
  };

  const startFromLine = async (mode: "generate" | "chat") => {
    const seed = quickLine.trim();
    if (!seed || creating) return;
    setCreating(true); setNotice(""); setJob(null);
    try {
      let next = await apiFetch<SessionSnapshot>("/api/sessions", { method: "POST", body: JSON.stringify({ seed }) });
      setSession(next);
      setQuickLine("");
      if (quickPhoto) {
        const form = new FormData(); form.set("photo", quickPhoto);
        try {
          next = await apiFetch<SessionSnapshot>(`/api/sessions/${next.id}/photo`, { method: "POST", body: form });
          setSession(next); setQuickPhoto(null);
        } catch (error) {
          setNotice(error instanceof Error ? `${error.message} 请先重新添加照片，再开始生成。` : "照片上传失败，请重试。");
          return;
        }
      }
      if (mode === "generate") await startGeneration(next.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "暂时无法开始记录。"); }
    finally { setCreating(false); }
  };

  const uploadSessionPhoto = async (file: File) => {
    if (!session) return;
    const form = new FormData(); form.set("photo", file);
    setNotice("");
    try { setSession(await apiFetch<SessionSnapshot>(`/api/sessions/${session.id}/photo`, { method: "POST", body: form })); }
    catch (error) { setNotice(error instanceof Error ? error.message : "照片上传失败。"); }
    finally { if (photoInputRef.current) photoInputRef.current.value = ""; }
  };

  const removeSessionPhoto = async () => {
    if (!session) return;
    try { setSession(await apiFetch<SessionSnapshot>(`/api/sessions/${session.id}/photo`, { method: "DELETE" })); }
    catch (error) { setNotice(error instanceof Error ? error.message : "照片移除失败。"); }
  };

  const sendMessage = async (contentToRetry?: string) => {
    const content = (contentToRetry ?? input).trim();
    if (!content || !session || session.status !== "active" || sending || generationInFlight) return;
    const previousSession = session;
    const sentAt = new Date().toISOString();
    const optimisticSession: SessionSnapshot = {
      ...session,
      lastActivityAt: sentAt,
      draft: {
        ...session.draft,
        userTurnCount: session.draft.userTurnCount + 1,
        turnsSinceOrganization: 0,
        recentText: [session.draft.recentText, content].filter(Boolean).join("\n"),
      },
      messages: [...session.messages, { id: `pending-${sentAt}`, role: "user", content, createdAt: sentAt }],
    };
    setSending(true); setNotice(""); setAgentReplyError(""); setRetryAgentContent(null); setSession(optimisticSession); setInput("");
    try {
      const result = await apiFetch<{ snapshot: SessionSnapshot; shouldGenerate: boolean; generationReason: string | null }>(`/api/sessions/${session.id}/messages`, { method: "POST", body: JSON.stringify({ content }) });
      setSession(result.snapshot);
      if (result.shouldGenerate) await startGeneration(result.snapshot.id);
    } catch (error) {
      setSession(previousSession);
      setInput(content);
      setRetryAgentContent(content);
      setAgentReplyError(error instanceof Error ? error.message : "这次没有发送成功，请再试一次。");
    } finally {
      setSending(false);
    }
  };

  const startGeneration = async (sessionId: string) => {
    setNotice(""); setGenerationCardOpen(false);
    try {
      const nextJob = await apiFetch<GenerationJob>(`/api/sessions/${sessionId}/generate`, { method: "POST", body: JSON.stringify({}) });
      setJob(nextJob);
      void pollGeneration(nextJob.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "暂时无法开始生成。");
    }
  };

  const pollGeneration = async (generationId: string) => {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      try {
        const next = await apiFetch<GenerationJob>(`/api/generations/${generationId}`);
        setJob(next);
        if (next.status === "succeeded" || next.status === "failed") {
          await loadSession();
          return;
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "无法读取生成进度。");
        return;
      }
    }
    setNotice("生成时间有些久，你可以稍后回到首页查看。");
  };

  const saveJob = async () => {
    if (!job || job.status !== "succeeded") return;
    setSaving(true); setNotice("");
    try {
      await apiFetch<{ id: string }>(`/api/generations/${job.id}/save`, { method: "POST" });
      await refresh();
      router.push("/diary");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  };

  const returnToWriting = () => {
    setNotice("");
    setGenerationCardOpen(false);
  };

  if (!user) return null;

  const latestAgentMessage = session ? [...session.messages].reverse().find((message) => message.role === "agent") : undefined;
  const generating = generationInFlight;
  const generationReady = job?.status === "succeeded";
  const noticeView = notice && <div className="notice home-notice" role="status">{notice}</div>;
  const pageStyle = { "--keyboard-offset": `${keyboardOffset}px` } as CSSProperties;
  const topbarStatusTarget = typeof document === "undefined" ? null : document.getElementById("topbar-status");

  return <div className={`page-scroll home-page${session ? " home-page--session" : ""}`} style={pageStyle}>
    {(generating || generationReady) && topbarStatusTarget && createPortal(generating ? <span className="generation-topbar" role="status"><span className="loading-orbit" />正在生成音乐日记…</span> : <button type="button" className="generation-topbar generation-topbar--ready" onClick={() => setGenerationCardOpen(true)}>音乐日记已生成，点击查看。</button>, topbarStatusTarget)}
    {!session && <div className="home-heading">
      <div><span className="eyebrow">{formatDate(new Date().toISOString())}</span><h1>{currentGreeting()}{user.agentName}</h1><p>把今天的片段，慢慢变成一段音乐。</p></div>
    </div>}

    {!session && <section className="welcome-panel">
      <div className="welcome-mark" aria-hidden="true"><WelcomeMark /></div>
      <div><span className="eyebrow">给今天留一页</span><h2>你愿意和我说说今天吗？</h2><p>不用想得很完整，从一个画面、一句话，或者一种心情开始就好。</p><button className="button button-primary button-large" onClick={startSession} disabled={creating}>{creating ? "正在准备…" : "开始新日记  →"}</button></div>
      <div className="welcome-note"><span>随手写</span><span>慢慢说</span><span>留下来</span></div>
    </section>}
    {!session && <section className="quick-music-actions" aria-label="快捷生成音乐">
      <button type="button" className="quick-music-card quick-music-card--relax" onClick={() => void startQuickMusic("relax")} disabled={creating}>
        <span className="quick-music-icon" aria-hidden="true"><AppIcon name="rest" /></span><span><strong>放松片刻</strong><small>为此刻谱一段舒缓的旋律</small></span>
      </button>
      <button type="button" className="quick-music-card quick-music-card--move" onClick={() => void startQuickMusic("move")} disabled={creating}>
        <span className="quick-music-icon" aria-hidden="true"><AppIcon name="energy" /></span><span><strong>轻快出发</strong><small>为此刻谱一段轻快的旋律</small></span>
      </button>
    </section>}

    {!session && <section className="quick-entry-panel" aria-label="一句话记下今天">
      <span className="eyebrow">也可以从一句话开始</span><h2>先写下此刻</h2>
      <textarea value={quickLine} maxLength={5000} rows={3} onChange={(event) => setQuickLine(event.target.value)} placeholder="今天有什么值得留住的瞬间？" />
      <div className="quick-entry-tools">
        <button className="button button-ghost" type="button" onClick={() => dictate("quick")} aria-pressed={listening === "quick"}>{listening === "quick" ? "停止聆听" : "语音输入"}</button>
        <label className="button button-ghost" htmlFor="quick-photo-input">{quickPhoto ? `已选：${quickPhoto.name}` : "附一张照片"}</label>
        <input id="quick-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => setQuickPhoto(event.target.files?.[0] ?? null)} />
      </div>
      <div className="quick-entry-choices"><button className="button button-primary" disabled={creating || !quickLine.trim()} onClick={() => void startFromLine("generate")}>直接生成</button><button className="button button-ghost" disabled={creating || !quickLine.trim()} onClick={() => void startFromLine("chat")}>继续聊聊</button></div>
    </section>}

    {session && <>
      {generationReady && generationCardOpen && <GenerationCard job={job} onSave={saveJob} onBack={returnToWriting} saving={saving} />}
      <div key={session.id} className={`home-writing ${sessionTransitioning ? "home-writing--exit" : "home-writing--enter"}`}>
        <section className="agent-panel" aria-label={`${user.agentName} 的当前回复`}>
          <div className="agent-avatar" aria-hidden="true"><Image src="/meloday-companion-v2.webp" alt="" width={51} height={51} unoptimized /></div>
          <div className="agent-bubble">
            <div className="agent-bubble-content" aria-live="polite" aria-atomic="true">
              {sending ? <div className="agent-thinking" role="status"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span><span>正在倾听…</span></div> : agentReplyError ? <div className="agent-reply-error" role="alert"><span>{agentReplyError}</span>{retryAgentContent && <button type="button" onClick={() => void sendMessage(retryAgentContent)}>重试</button>}</div> : latestAgentMessage ? <AnimatedAgentMessage key={latestAgentMessage.id} messageId={latestAgentMessage.id} content={latestAgentMessage.content} /> : <div className="agent-message"><p>你好呀，有什么想和我说的！</p></div>}
            </div>
          </div>
        </section>
        <section className="paper-card">
          <div className="paper-meta"><span>{formatDate(session.createdAt)}</span></div>
          <div className="paper-time">{formatTime(new Date().toISOString())}</div>
          <div className="paper-lines"><p className={!draftText(session.draft) ? "paper-placeholder" : ""}>{draftText(session.draft) || "写下你的故事…"}</p></div>
          {session.photoAssetId && <div className="paper-photo"><Image src={mediaUrl(session.photoAssetId)!} alt="今天的照片" width={180} height={135} unoptimized /><button type="button" onClick={() => void removeSessionPhoto()} aria-label="移除照片">×</button></div>}
        </section>
        <div className="home-session-footer">
          {job?.status === "failed" && <section className="generation-failed" role="alert"><div><strong>这次生成没有完成</strong><p>{job.errorMessage || "服务暂时没有接住这段故事。"}</p></div><button className="button button-ghost" onClick={() => void startGeneration(session.id)}>再试一次</button></section>}
          {noticeView}
          <form className="composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <div className="composer-input">
              <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="写下此刻想说的话…" rows={1} disabled={sending || generating || session.status !== "active"} />
              <div className="composer-actions">
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadSessionPhoto(file); }} />
                <button type="button" className="composer-tool-button" onClick={() => photoInputRef.current?.click()} disabled={creating || sending || generating} title="添加照片"><AppIcon name="photo" /><span>照片</span></button>
                <button type="button" className="composer-tool-button" onClick={() => dictate("composer")} disabled={creating || sending || generating} aria-pressed={listening === "composer"} title="语音转文字"><AppIcon name="mic" /><span>{listening === "composer" ? "停止" : "语音"}</span></button>
                <button type="button" className="composer-tool-button" onClick={() => void startSession()} disabled={creating || sending || generating} title="新开日记"><AppIcon name="newDiary" /><span>新日记</span></button>
                <button type="submit" className="composer-send-button" disabled={!input.trim() || sending || generating} title="发送消息"><AppIcon name="send" /><span>发送</span></button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>}
    {!session && noticeView}
  </div>;

}
