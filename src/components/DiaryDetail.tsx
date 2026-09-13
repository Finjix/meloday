"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { DiaryEntry } from "@/lib/types";

export function DiaryDetail({ id }: { id: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void apiFetch<DiaryEntry | null>(`/api/diaries/${id}`).then(setEntry).catch((err) => setError(err instanceof Error ? err.message : "这一页暂时打不开。")).finally(() => setLoading(false)); }, [id]);

  const togglePublish = async () => {
    if (!entry) return;
    setBusy(true); setError("");
    try { const next = await apiFetch<DiaryEntry>(`/api/diaries/${id}/${entry.publishedAt ? "unpublish" : "publish"}`, { method: "POST" }); setEntry(next); } catch (err) { setError(err instanceof Error ? err.message : "公开状态更新失败。"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm("确定要删除这一页吗？删除后无法恢复。")) return;
    setBusy(true);
    try { await apiFetch(`/api/diaries/${id}`, { method: "DELETE" }); router.replace("/diary"); } catch (err) { setError(err instanceof Error ? err.message : "删除失败。"); setBusy(false); }
  };

  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在打开这一页…</div>;
  if (error || !entry) return <div className="page-scroll"><div className="notice">{error || "找不到这一页。"}</div><Link href="/diary" className="button button-primary">回到日记本</Link></div>;
  const cover = mediaUrl(entry.coverAssetId); const audio = mediaUrl(entry.audioAssetId);
  return <div className="page-scroll detail-page"><div className="detail-back"><Link href="/diary">← 日记本</Link><span>{formatDate(entry.createdAt)}</span></div><article className="saved-card"><div className="saved-cover">{cover ? <img src={cover} alt="音乐日记封面" /> : <div className="cover-placeholder">Meloday</div>}</div><div className="saved-main"><span className="eyebrow">音乐日记 · 已保存</span><h1>{entry.title}</h1><p className="saved-summary">{entry.summary}</p>{audio && <audio className="audio-player" controls src={audio} />}</div><div className="saved-body">{entry.body.split(/\n+/).map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)}</div><div className="detail-actions"><button className="button button-primary" onClick={() => void togglePublish()} disabled={busy}>{entry.publishedAt ? "取消公开" : "分享到社区"}</button><button className="button button-ghost danger-border" onClick={() => void remove()} disabled={busy}>删除这一页</button></div></article></div>;
}
