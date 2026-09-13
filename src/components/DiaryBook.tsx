"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { DiaryEntry } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { useAuth } from "./AuthContext";

export function DiaryBook() {
  const { refresh } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try { const result = await apiFetch<{ entries: DiaryEntry[] }>("/api/diaries"); setEntries(result.entries); } catch (err) { setError(err instanceof Error ? err.message : "日记本暂时打不开。"); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const remove = async (id: string) => {
    if (!window.confirm("确定要删除这一页吗？删除后无法恢复。")) return;
    try { await apiFetch(`/api/diaries/${id}`, { method: "DELETE" }); setEntries((items) => items.filter((item) => item.id !== id)); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "删除失败。"); }
  };

  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在翻开日记本…</div>;
  return <div className="page-scroll diary-book-page"><div className="page-intro"><div><span className="eyebrow">保存下来的日子</span><h1>日记本</h1><p>每一页，都是今天曾经认真生活过的证据。</p></div></div>{error && <div className="notice">{error}</div>}{entries.length === 0 ? <EmptyState title="这里还很安静" text="完成第一张音乐日记卡片，它就会出现在这里。" action={<Link href="/" className="button button-primary">写下今天  →</Link>} /> : <div className="diary-list">{entries.map((entry) => <article className="diary-list-card" key={entry.id}><Link href={`/diary/${entry.id}`} className="diary-list-cover">{mediaUrl(entry.coverAssetId) ? <img src={mediaUrl(entry.coverAssetId)!} alt="日记封面" /> : <span>♫</span>}</Link><div className="diary-list-copy"><span className="eyebrow">{formatDate(entry.createdAt)}{entry.publishedAt ? " · 已公开" : ""}</span><Link href={`/diary/${entry.id}`}><h2>{entry.title}</h2></Link><p>{entry.summary}</p>{entry.audioAssetId && <audio controls preload="none" src={mediaUrl(entry.audioAssetId)!} />}<div className="list-actions"><Link href={`/diary/${entry.id}`} className="small-link">打开这一页</Link><button className="text-button danger" onClick={() => void remove(entry.id)}>删除</button></div></div></article>)}</div>}</div>;
}
