"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { DiaryEntry } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";
import { DiaryDialog } from "./DiaryDialog";
import { EmptyState } from "./EmptyState";

export function DiaryBook() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<DiaryEntry | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextOpen = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };
  const startLongPress = (entry: DiaryEntry) => {
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      suppressNextOpen.current = true;
      setDeleteEntry(entry);
      longPressTimer.current = null;
    }, 650);
  };

  const load = async () => {
    try { const result = await apiFetch<{ entries: DiaryEntry[] }>("/api/diaries"); setEntries(result.entries); } catch (err) { setError(err instanceof Error ? err.message : "日记本暂时打不开。"); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); return cancelLongPress; }, []);

  const updateEntry = (updated: DiaryEntry) => {
    setEntries((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    setSelectedEntry((current) => current?.id === updated.id ? updated : current);
  }; 
  const togglePublish = async (entry: DiaryEntry) => {
    setBusyEntryId(entry.id); setError("");
    try { updateEntry(await apiFetch<DiaryEntry>(`/api/diaries/${entry.id}/${entry.publishedAt ? "unpublish" : "publish"}`, { method: "POST" })); } catch (err) { setError(err instanceof Error ? err.message : "分享状态更新失败。"); } finally { setBusyEntryId(null); }
  };
  const remove = async () => {
    if (!deleteEntry) return;
    setBusyEntryId(deleteEntry.id); setError("");
    try { await apiFetch(`/api/diaries/${deleteEntry.id}`, { method: "DELETE" }); setEntries((current) => current.filter((entry) => entry.id !== deleteEntry.id)); setDeleteEntry(null); } catch (err) { setError(err instanceof Error ? err.message : "删除失败。"); setDeleteEntry(null); } finally { setBusyEntryId(null); }
  };

  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在翻开日记本…</div>;
  return <div className="page-scroll diary-book-page"><div className="page-intro"><div><span className="eyebrow">保存下来的日子</span><h1>日记本</h1><p>每一页，都是今天曾经认真生活过的证据。</p></div></div>{error && <div className="notice">{error}</div>}{entries.length === 0 ? <EmptyState title="这里还很安静" text="完成第一张音乐日记卡片，它就会出现在这里。" action={<Link href="/" className="button button-primary">写下今天  →</Link>} /> : <div className="diary-list">{entries.map((entry) => {
    const cover = mediaUrl(entry.coverAssetId);
    return <article className="diary-list-card" key={entry.id} role="link" tabIndex={0} onPointerDown={(event) => { if (event.isPrimary && !(event.target instanceof Element && event.target.closest(".diary-list-actions"))) startLongPress(entry); }} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerLeave={cancelLongPress} onClick={(event) => { if (event.target instanceof Element && event.target.closest(".diary-list-actions")) return; if (suppressNextOpen.current) { suppressNextOpen.current = false; return; } setSelectedEntry(entry); }} onKeyDown={(event) => { if (event.target instanceof Element && event.target.closest(".diary-list-actions")) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedEntry(entry); } }}>
      {cover ? <div className="diary-list-cover"><Image src={cover} alt="日记封面" fill sizes="(max-width: 700px) 92px, 132px" unoptimized /></div> : <div className="diary-list-cover"><span>♫</span></div>}
      <div className="diary-list-copy"><div className="diary-list-meta"><span className="eyebrow">{formatDate(entry.createdAt)}</span>{entry.publishedAt && <span className="eyebrow diary-published">分享中</span>}</div><h2>{entry.title}</h2><p>{entry.summary}</p></div>
    </article>;
  })}</div>}{selectedEntry && <DiaryDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} onTogglePublish={() => void togglePublish(selectedEntry)} busy={busyEntryId === selectedEntry.id} />}<ConfirmDialog open={Boolean(deleteEntry)} title="确定删除这一页吗？" description="" confirmLabel="删除这一页" busy={busyEntryId === deleteEntry?.id} onCancel={() => setDeleteEntry(null)} onConfirm={() => void remove()} /></div>;
}
