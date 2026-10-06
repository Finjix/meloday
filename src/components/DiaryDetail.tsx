"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { DiaryEntry, DiaryRegeneration, DiaryRevision } from "@/lib/types";
import { AudioPlayer } from "./AudioPlayer";
import { ConfirmDialog } from "./ConfirmDialog";
import { ImagePreview } from "./ImagePreview";

const revisionLabels: Record<DiaryRevision["reason"], string> = {
  edit: "文字或照片修改前", music: "音乐更新前", cover: "封面更新前", restore: "恢复版本前",
};

export function DiaryDetail({ id }: { id: string }) {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [revisions, setRevisions] = useState<DiaryRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", summary: "", body: "" });
  const [feedback, setFeedback] = useState("");
  const [job, setJob] = useState<DiaryRegeneration | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [nextEntry, nextRevisions] = await Promise.all([
      apiFetch<DiaryEntry | null>(`/api/diaries/${id}`),
      apiFetch<DiaryRevision[]>(`/api/diaries/${id}/revisions`),
    ]);
    setEntry(nextEntry);
    setRevisions(nextRevisions);
    if (nextEntry) setForm({ title: nextEntry.title, summary: nextEntry.summary, body: nextEntry.body });
  }, [id]);

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "这一页暂时打不开。"))
      .finally(() => setLoading(false));
    void apiFetch<DiaryRegeneration | null>(`/api/diaries/${id}/regenerate`).then(setJob).catch(() => undefined);
  }, [id, refresh]);

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const timer = window.setInterval(() => {
      void apiFetch<DiaryRegeneration>(`/api/diary-regenerations/${job.id}`).then(async (next) => {
        setJob(next);
        if (next.status === "succeeded") await refresh();
        if (next.status === "failed") setError(next.errorMessage || "生成没有完成，请稍后重试。");
      }).catch((err) => setError(err instanceof Error ? err.message : "无法读取生成进度。"));
    }, 1300);
    return () => window.clearInterval(timer);
  }, [job, refresh]);

  const saveText = async () => {
    setBusy(true); setError("");
    try {
      const next = await apiFetch<DiaryEntry>(`/api/diaries/${id}`, { method: "PATCH", body: JSON.stringify(form) });
      setEntry(next); setEditing(false);
      setRevisions(await apiFetch<DiaryRevision[]>(`/api/diaries/${id}/revisions`));
    } catch (err) { setError(err instanceof Error ? err.message : "修改没有保存成功。"); }
    finally { setBusy(false); }
  };

  const regenerate = async (kind: "music" | "cover") => {
    setBusy(true); setError("");
    try {
      setJob(await apiFetch<DiaryRegeneration>(`/api/diaries/${id}/regenerate`, {
        method: "POST", body: JSON.stringify({ kind, feedback: feedback.trim() }),
      }));
    } catch (err) { setError(err instanceof Error ? err.message : "暂时无法开始生成。"); }
    finally { setBusy(false); }
  };

  const restore = async (revisionId: string) => {
    setBusy(true); setError("");
    try {
      await apiFetch<DiaryEntry>(`/api/diaries/${id}/revisions/${revisionId}/restore`, { method: "POST" });
      await refresh();
      setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : "这个版本暂时无法恢复。"); }
    finally { setBusy(false); }
  };

  const upload = async (file: File) => {
    const formData = new FormData(); formData.set("photo", file);
    setBusy(true); setError("");
    try {
      await apiFetch<DiaryEntry>(`/api/diaries/${id}/photo`, { method: "POST", body: formData });
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "照片上传失败。"); }
    finally { setBusy(false); if (photoInput.current) photoInput.current.value = ""; }
  };

  const removePhoto = async () => {
    setBusy(true); setError("");
    try { await apiFetch(`/api/diaries/${id}/photo`, { method: "DELETE" }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "照片移除失败。"); }
    finally { setBusy(false); }
  };

  const togglePublish = async () => {
    if (!entry) return;
    setBusy(true); setError("");
    try { setEntry(await apiFetch<DiaryEntry>(`/api/diaries/${id}/${entry.publishedAt ? "unpublish" : "publish"}`, { method: "POST" })); }
    catch (err) { setError(err instanceof Error ? err.message : "公开状态更新失败。"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setError("");
    try { await apiFetch(`/api/diaries/${id}`, { method: "DELETE" }); router.replace("/diary"); }
    catch (err) { setError(err instanceof Error ? err.message : "删除失败。"); setConfirmOpen(false); setBusy(false); }
  };

  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在打开这一页…</div>;
  if (!entry) return <div className="page-scroll detail-page"><div className="notice">{error || "找不到这一页。"}</div><Link href="/diary" className="button button-primary">回到日记本</Link></div>;
  const cover = mediaUrl(entry.coverAssetId);
  const audio = mediaUrl(entry.audioAssetId);
  const photo = mediaUrl(entry.photoAssetId);
  const generating = job?.status === "queued" || job?.status === "running";

  return <div className="page-scroll detail-page">
    <div className="detail-actions detail-actions-top">
      <Link href="/diary" className="button button-ghost">← 日记本</Link>
      <button className="button button-ghost danger-border detail-delete-button" onClick={() => setConfirmOpen(true)} disabled={busy} aria-label="删除这一页" title="删除这一页"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" /></svg></button>
      <button className="button button-primary" onClick={() => void togglePublish()} disabled={busy}>{entry.publishedAt ? "取消分享" : "分享"}</button>
    </div>
    {error && <div className="notice" role="alert">{error}</div>}
    <article className="saved-card">
      <div className="saved-cover">{cover ? <ImagePreview src={cover} alt="音乐日记封面" className="image-preview-fill"><Image src={cover} alt="音乐日记封面" fill sizes="(max-width: 700px) 310px, 230px" unoptimized /></ImagePreview> : <div className="cover-placeholder">Meloday</div>}</div>
      <div className="saved-main"><span className="eyebrow">{formatDate(entry.createdAt)}</span><h1>{entry.title}</h1><p className="saved-summary">{entry.summary}</p>{audio && <AudioPlayer src={audio} />}</div>
    </article>

    <section className="diary-editor-panel" aria-label="日记正文与编辑">
      <div className="diary-section-heading"><h2>这一页的故事</h2><button className="button button-ghost" type="button" onClick={() => { setForm({ title: entry.title, summary: entry.summary, body: entry.body }); setEditing(!editing); }} disabled={busy}>{editing ? "取消" : "编辑文字"}</button></div>
      {editing ? <form onSubmit={(event) => { event.preventDefault(); void saveText(); }} className="diary-edit-form">
        <label>标题<input value={form.title} maxLength={100} required onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>摘要<textarea value={form.summary} maxLength={300} rows={2} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
        <label>正文<textarea value={form.body} maxLength={10000} rows={9} required onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
        <button className="button button-primary" disabled={busy} type="submit">{busy ? "正在保存…" : "保存修改"}</button>
      </form> : <p className="diary-body-text">{entry.body}</p>}
    </section>

    <section className="diary-editor-panel" aria-label="这一天的照片">
      <div className="diary-section-heading"><div><h2>这一天的照片</h2><p>仅自己可见，分享日记时不会公开。</p></div><button className="button button-ghost" type="button" disabled={busy} onClick={() => photoInput.current?.click()}>{photo ? "换一张" : "添加照片"}</button></div>
      <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      {photo && <><div className="diary-private-photo"><Image src={photo} alt="这一天的照片" fill sizes="(max-width: 700px) 100vw, 520px" unoptimized /></div><button className="button button-ghost" disabled={busy} type="button" onClick={() => void removePhoto()}>移除照片</button></>}
    </section>

    <section className="diary-editor-panel" aria-label="重新生成">
      <div className="diary-section-heading"><div><h2>换一种表达</h2><p>音乐和封面可以分别重做，旧版本会留下来。</p></div></div>
      <label className="diary-feedback-label">想调整的感觉（可选）<input value={feedback} maxLength={500} onChange={(event) => setFeedback(event.target.value)} placeholder="例如：更轻盈一些，像雨后的早晨" /></label>
      <div className="diary-edit-actions"><button className="button button-ghost" disabled={busy || generating} onClick={() => void regenerate("music")}>重做音乐</button><button className="button button-ghost" disabled={busy || generating} onClick={() => void regenerate("cover")}>重做封面</button></div>
      {generating && <p role="status">正在{job.kind === "music" ? "谱写音乐" : "绘制封面"}，完成后会自动更新这一页…</p>}
    </section>

    {revisions.length > 0 && <section className="diary-editor-panel" aria-label="历史版本"><div className="diary-section-heading"><div><h2>旧稿留存</h2><p>修改前的内容会保存在这里，打开可查看，再决定是否恢复。</p></div></div><div className="diary-revision-list">{revisions.map((revision) => <div key={revision.id} className="diary-revision"><div className="diary-revision-main"><strong>{revisionLabels[revision.reason]}</strong><small>{new Date(revision.createdAt).toLocaleString("zh-CN")}</small><span>{revision.title}</span><details><summary>查看旧版内容</summary><p>{revision.summary}</p><p className="diary-body-text">{revision.body}</p>{revision.coverAssetId && <Image src={mediaUrl(revision.coverAssetId)!} alt="旧版封面" width={110} height={110} unoptimized />}{revision.audioAssetId && <AudioPlayer src={mediaUrl(revision.audioAssetId)!} />}</details></div><button className="button button-ghost" disabled={busy || generating} onClick={() => void restore(revision.id)}>恢复此版</button></div>)}</div></section>}
    <ConfirmDialog open={confirmOpen} title="确定删除这一页吗？" description="" confirmLabel="删除这一页" busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={() => void remove()} />
  </div>;
}
