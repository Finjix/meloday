"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, formatDate, formatTime } from "@/lib/client";
import { draftText, type GenerationJob, type SessionSnapshot } from "@/lib/types";
import { useAuth } from "./AuthContext";
import { AnimatedAgentMessage } from "./AnimatedAgentMessage";
import { GenerationCard } from "./GenerationCard";

function currentGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了，";
  if (hour < 12) return "早上好，";
  if (hour < 18) return "下午好，";
  return "晚上好，";
}

export function HomeApp() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const generationInFlight = Boolean(job && (job.status === "queued" || job.status === "running"));

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSession(); }, [loadSession]);

  const startSession = async () => {
    setCreating(true); setNotice(""); setJob(null);
    try {
      const next = await apiFetch<SessionSnapshot>("/api/sessions", { method: "POST", body: JSON.stringify({}) });
      setSession(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "暂时无法开始新的日记。");
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !session || session.status !== "active" || sending || generationInFlight) return;
    setSending(true); setNotice(""); setInput("");
    try {
      const result = await apiFetch<{ snapshot: SessionSnapshot; shouldGenerate: boolean; generationReason: string | null }>(`/api/sessions/${session.id}/messages`, { method: "POST", body: JSON.stringify({ content }) });
      setSession(result.snapshot);
      if (result.shouldGenerate) await startGeneration(result.snapshot.id);
    } catch (error) {
      setInput(content);
      setNotice(error instanceof Error ? error.message : "这次没有发送成功，请再试一次。");
    } finally {
      setSending(false);
    }
  };

  const startGeneration = async (sessionId: string) => {
    setNotice("");
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
      const entry = await apiFetch<{ id: string }>(`/api/generations/${job.id}/save`, { method: "POST" });
      await refresh();
      router.push(`/diary/${entry.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async (feedback: string) => {
    if (!job || job.status !== "succeeded") return;
    setNotice("");
    try {
      const next = await apiFetch<GenerationJob>(`/api/generations/${job.id}/regenerate`, { method: "POST", body: JSON.stringify({ feedback }) });
      setJob(next);
      void pollGeneration(next.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "暂时无法重新生成。");
    }
  };

  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在打开今天…</div>;
  if (!user) return null;

  const canGenerate = Boolean(session && session.status === "active" && draftText(session.draft));
  const latestAgentMessage = session ? [...session.messages].reverse().find((message) => message.role === "agent") : undefined;
  const generating = generationInFlight;
  const noticeView = notice && <div className="notice" role="status">{notice}</div>;

  return <div className={`page-scroll home-page${session && job?.status !== "succeeded" ? " home-page--session" : ""}`}>
    <div className="home-heading">
      <div><span className="eyebrow">{formatDate(new Date().toISOString())}</span><h1>{currentGreeting()}{user.displayName}</h1><p>把今天的片段，慢慢变成一段音乐。</p></div>
    </div>

    {!session && <section className="welcome-panel">
      <div className="welcome-orbit"><span>♫</span></div>
      <div><span className="eyebrow">给今天留一页</span><h2>你愿意和我说说今天吗？</h2><p>不用想得很完整，从一个画面、一句话，或者一种心情开始就好。</p><button className="button button-primary button-large" onClick={startSession} disabled={creating}>{creating ? "正在准备…" : "开始新日记  →"}</button></div>
      <div className="welcome-note"><span>随手写</span><span>慢慢说</span><span>留下来</span></div>
    </section>}

    {session && <>
      {job?.status === "succeeded" ? <>
        <GenerationCard job={job} onSave={saveJob} onRegenerate={regenerate} saving={saving} />
        {noticeView}
      </> : <div className="home-writing">
        <section className="agent-panel" aria-label={`${user.agentName} 的当前回复`}>
          <div className="agent-avatar" aria-hidden="true"><span>♫</span><i /></div>
          <div className="agent-bubble">
            <div className="agent-bubble-header"><span className="eyebrow">{user.agentName} · 陪你写</span><span className="live-dot">● {sending ? "正在倾听" : "在线"}</span></div>
            <div className="agent-bubble-content" aria-live="polite" aria-atomic="true">
              {sending ? <div className="agent-thinking" role="status"><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span><span>正在倾听…</span></div> : latestAgentMessage ? <AnimatedAgentMessage content={latestAgentMessage.content} /> : <div className="agent-message"><p>我在听。</p><p>今天发生了什么，想从哪一刻说起？</p></div>}
            </div>
          </div>
          <button className="small-link" onClick={() => { void endCurrentSession(); }}>结束这页</button>
        </section>
        <section className="paper-card">
          <div className="paper-meta"><span>{formatDate(session.createdAt)}</span></div>
          <div className="paper-time">{formatTime(new Date().toISOString())}</div>
          <div className="paper-lines"><p className={!draftText(session.draft) ? "paper-placeholder" : ""}>{draftText(session.draft) || "你的日记会从这里慢慢长出来…"}</p></div>
          {canGenerate && <button className="generate-cta" onClick={() => void startGeneration(session.id)} disabled={generating}>{generating ? "正在把故事变成音乐…" : "开始生成音乐日记  ✦"}</button>}
        </section>
        <div className="home-session-footer">
          {job?.status === "failed" && <section className="generation-failed"><div><strong>这次生成没有完成</strong><p>{job.errorMessage || "服务暂时没有接住这段故事。"}</p></div><button className="button button-ghost" onClick={() => void startGeneration(session.id)}>再试一次</button></section>}
          {job && generating && <section className="generation-progress"><span className="loading-orbit" /><div><strong>{job.status === "queued" ? "已经排上队了…" : job.stage === "finalizing" ? "正在整理你的日记…" : job.stage === "music" ? "正在为故事写一段音乐…" : "正在画一张封面…"}</strong><p>不用一直等着，可以先去看看日记本。</p></div><Link href="/diary" className="small-link">去日记本</Link></section>}
          {noticeView}
          <form className="composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="写下此刻想说的话…" rows={2} disabled={sending || generating || session.status !== "active"} />
            <button type="submit" className="send-button" disabled={!input.trim() || sending || generating} aria-label="发送">↗</button>
          </form>
        </div>
      </div>}
    </>}
    {!session && noticeView}
  </div>;

  async function endCurrentSession() {
    if (!session) return;
    try { await apiFetch(`/api/sessions/${session.id}`, { method: "DELETE" }); setSession(null); setJob(null); } catch (error) { setNotice(error instanceof Error ? error.message : "无法结束这页。"); }
  }
}
