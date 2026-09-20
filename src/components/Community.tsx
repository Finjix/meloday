"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { CommunityItem } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { SharedDiaryDialog } from "./SharedDiaryDialog";

export function Community() {
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  useEffect(() => { void apiFetch<{ items: CommunityItem[] }>("/api/community").then((result) => setItems(result.items)).catch((err) => setError(err instanceof Error ? err.message : "社区暂时打不开。")).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在查看分享…</div>;
  return <div className="page-scroll community-page"><div className="page-intro"><div><span className="eyebrow">听见别人的一天</span><h1>你我的故事</h1><p>一张卡片，一段音乐，和一个被认真生活过的瞬间。</p></div><span className="community-mark">♫</span></div>{error && <div className="notice">{error}</div>}{items.length === 0 ? <EmptyState title="还没有公开的日记" text="当有人愿意分享，这里会慢慢亮起来。" /> : <div className="community-grid">{items.map((item) => {
    const cover = mediaUrl(item.coverAssetId);
    const authorAvatar = mediaUrl(item.authorAvatarAssetId);
    return <button type="button" className="community-card" onClick={() => setSelectedEntryId(item.entryId)} key={item.entryId} aria-label={`查看${item.authorName}分享的《${item.title}》`}>
      <div className="community-cover">{cover ? <Image src={cover} alt="公开日记封面" fill sizes="(max-width: 700px) 50vw, 250px" unoptimized /> : <span>♫</span>}</div>
      <div className="community-copy"><div className="author-line"><span className="avatar-mini">{authorAvatar ? <Image src={authorAvatar} alt="" fill sizes="28px" unoptimized /> : item.authorName.slice(0, 1)}</span><span>{item.authorName}</span><time>{formatDate(item.publishedAt)}</time></div><h2>{item.title}</h2><p>{item.summary}</p></div>
    </button>;
  })}</div>}{selectedEntryId && <SharedDiaryDialog id={selectedEntryId} onClose={() => setSelectedEntryId(null)} />}</div>;
}
