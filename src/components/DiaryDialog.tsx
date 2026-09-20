"use client";

import Image from "next/image";
import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { formatDate, mediaUrl } from "@/lib/client";
import type { DiaryEntry } from "@/lib/types";
import { AudioPlayer } from "./AudioPlayer";

export function DiaryDialog({ entry, onClose, onTogglePublish, busy }: { entry: DiaryEntry; onClose: () => void; onTogglePublish: () => void; busy: boolean }) {
  const titleId = useId();
  const cover = mediaUrl(entry.coverAssetId);
  const audio = mediaUrl(entry.audioAssetId);

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

  return createPortal(<div className="shared-diary-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
    <article className="shared-diary-dialog" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="shared-diary-close" onClick={onClose} aria-label="关闭详情">×</button>
      <div className="shared-diary-cover">{cover ? <Image src={cover} alt="日记封面" fill sizes="min(100vw, 400px)" unoptimized /> : <span>♫</span>}</div>
      <div className="shared-diary-copy"><div className="diary-dialog-meta"><span className="eyebrow">{formatDate(entry.createdAt)}</span><button type="button" className="button button-primary" onClick={onTogglePublish} disabled={busy}>{entry.publishedAt ? "取消分享" : "分享"}</button></div><h2 id={titleId}>{entry.title}</h2><p className="shared-diary-summary">{entry.summary}</p>{audio && <AudioPlayer src={audio} />}</div>
    </article>
  </div>, document.body);
}
