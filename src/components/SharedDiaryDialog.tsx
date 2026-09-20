"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, formatDate, mediaUrl } from "@/lib/client";
import type { SharedDiaryEntry } from "@/lib/types";
import { AudioPlayer } from "./AudioPlayer";

export function SharedDiaryDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [entry, setEntry] = useState<SharedDiaryEntry | null>(null);
  const [error, setError] = useState("");
  const titleId = useId();

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch<SharedDiaryEntry | null>(`/api/community/${id}`, { signal: controller.signal }).then((result) => {
      if (!result) setError("这篇分享已不再公开。");
      else setEntry(result);
    }).catch((err) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "这一页暂时打不开。");
    });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const cover = mediaUrl(entry?.coverAssetId ?? null);
  const audio = mediaUrl(entry?.audioAssetId ?? null);
  const authorAvatar = mediaUrl(entry?.authorAvatarAssetId ?? null);
  return createPortal(<div className="shared-diary-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
    <article className="shared-diary-dialog" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="shared-diary-close" onClick={onClose} aria-label="关闭详情">×</button>
      {!entry && !error && <div className="shared-diary-status"><span className="loading-orbit" />正在展开这张卡片…</div>}
      {error && <div className="shared-diary-status">{error}</div>}
      {entry && <><div className="shared-diary-cover">{cover ? <img src={cover} alt="分享日记封面" /> : <span>♫</span>}</div><div className="shared-diary-copy"><div className="author-line"><span className="avatar-mini">{authorAvatar ? <img src={authorAvatar} alt="" /> : entry.authorName.slice(0, 1)}</span><span>{entry.authorName}</span><time>{formatDate(entry.publishedAt)}</time></div><h2 id={titleId}>{entry.title}</h2><p className="shared-diary-summary">{entry.summary}</p>{audio && <AudioPlayer src={audio} />}<div className="shared-diary-body">{entry.body.split(/\n+/).map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)}</div></div></>}
    </article>
  </div>, document.body);
}
