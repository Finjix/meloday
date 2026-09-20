"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { DiaryEntry } from "@/lib/types";
import { AudioPlayer } from "./AudioPlayer";
import { ConfirmDialog } from "./ConfirmDialog";
import { ImagePreview } from "./ImagePreview";

export function DiaryDetail({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void apiFetch<DiaryEntry | null>(`/api/diaries/${id}`).then(setEntry).catch((err) => setError(err instanceof Error ? err.message : "这一页暂时打不开。")).finally(() => setLoading(false)); }, [id]);

  const togglePublish = async () => {
    if (!entry) return;
    setBusy(true); setError("");
    try { const next = await apiFetch<DiaryEntry>(`/api/diaries/${id}/${entry.publishedAt ? "unpublish" : "publish"}`, { method: "POST" }); setEntry(next); } catch (err) { setError(err instanceof Error ? err.message : "公开状态更新失败。"); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await apiFetch(`/api/diaries/${id}`, { method: "DELETE" }); router.replace("/diary"); } catch (err) { setError(err instanceof Error ? err.message : "删除失败。"); setConfirmOpen(false); setBusy(false); }
  };

  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在打开这一页…</div>;
  if (error || !entry) return <div className="page-scroll"><div className="notice">{error || "找不到这一页。"}</div><Link href="/diary" className="button button-primary">回到日记本</Link></div>;
  const cover = mediaUrl(entry.coverAssetId); const audio = mediaUrl(entry.audioAssetId);
  return <div className="page-scroll detail-page"><div className="detail-actions detail-actions-top"><button className="button button-ghost danger-border detail-delete-button" onClick={() => setConfirmOpen(true)} disabled={busy} aria-label="删除这一页" title="删除这一页"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" /></svg></button><button className="button button-primary" onClick={() => void togglePublish()} disabled={busy}>{entry.publishedAt ? "取消分享" : "分享"}</button></div><article className="saved-card"><div className="saved-cover">{cover ? <ImagePreview src={cover} alt="音乐日记封面" className="image-preview-fill"><img src={cover} alt="音乐日记封面" /></ImagePreview> : <div className="cover-placeholder">Meloday</div>}</div><div className="saved-main"><span className="eyebrow">{formatDate(entry.createdAt)}</span><h1>{entry.title}</h1><p className="saved-summary">{entry.summary}</p>{audio && <AudioPlayer src={audio} />}</div><div className="saved-body">{entry.body.split(/\n+/).map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)}</div></article><ConfirmDialog open={confirmOpen} title="确定删除这一页吗？" description="" confirmLabel="删除这一页" busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={() => void remove()} /></div>;
}
