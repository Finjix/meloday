"use client";

import { useEffect, useState } from "react";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { SharedDiaryEntry } from "@/lib/types";
import { AudioPlayer } from "./AudioPlayer";

export function SharedDiaryDetail({ id }: { id: string }) {
  const [entry, setEntry] = useState<SharedDiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void apiFetch<SharedDiaryEntry | null>(`/api/community/${id}`).then(setEntry).catch((err) => setError(err instanceof Error ? err.message : "这一页暂时打不开。")).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在打开这一页…</div>;
  if (error || !entry) return <div className="page-scroll"><div className="notice">{error || "这篇分享已不再公开。"}</div></div>;

  const cover = mediaUrl(entry.coverAssetId);
  const audio = mediaUrl(entry.audioAssetId);
  return <div className="page-scroll detail-page"><article className="saved-card shared-saved-card"><div className="saved-cover">{cover ? <img src={cover} alt="分享日记封面" /> : <div className="cover-placeholder">Meloday</div>}</div><div className="saved-main"><span className="eyebrow">{entry.authorName} · {formatDate(entry.publishedAt)}</span><h1>{entry.title}</h1><p className="saved-summary">{entry.summary}</p>{audio && <AudioPlayer src={audio} />}</div><div className="saved-body">{entry.body.split(/\n+/).map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)}</div></article></div>;
}
