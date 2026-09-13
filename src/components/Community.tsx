"use client";

import { useEffect, useState } from "react";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { CommunityItem } from "@/lib/types";
import { EmptyState } from "./EmptyState";

export function Community() {
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void apiFetch<{ items: CommunityItem[] }>("/api/community").then((result) => setItems(result.items)).catch((err) => setError(err instanceof Error ? err.message : "社区暂时打不开。")).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在走进社区…</div>;
  return <div className="page-scroll community-page"><div className="page-intro"><div><span className="eyebrow">听见别人的一天</span><h1>社区</h1><p>一张卡片，一段音乐，和一个被认真生活过的瞬间。</p></div><span className="community-mark">♫</span></div>{error && <div className="notice">{error}</div>}{items.length === 0 ? <EmptyState title="还没有公开的日记" text="当有人愿意分享，这里会慢慢亮起来。" /> : <div className="community-grid">{items.map((item) => <article className="community-card" key={item.entryId}><div className="community-cover">{mediaUrl(item.coverAssetId) ? <img src={mediaUrl(item.coverAssetId)!} alt="公开日记封面" /> : <span>♫</span>}</div><div className="community-copy"><div className="author-line"><span className="avatar-mini">{item.authorName.slice(0, 1)}</span><span>{item.authorName}</span><time>{formatDate(item.publishedAt)}</time></div><h2>{item.title}</h2><p>{item.summary}</p>{item.audioAssetId && <audio controls preload="none" src={mediaUrl(item.audioAssetId)!} />}</div></article>)}</div>}</div>;
}
