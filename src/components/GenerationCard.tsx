"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GenerationJob } from "@/lib/types";
import { formatDate, mediaUrl } from "@/lib/client";
import { AudioPlayer } from "./AudioPlayer";

export function GenerationCard({ job, onSave, onBack, saving }: { job: GenerationJob; onSave: () => void; onBack: () => void; saving: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const cover = mediaUrl(job.coverAssetId);
  const audio = mediaUrl(job.audioAssetId);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onBack(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onBack]);

  const closeAfterFade = (callback: () => void) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(callback, 240);
  };
  return createPortal(<div className={`generation-backdrop${leaving ? " generation-backdrop--leaving" : ""}`} role="dialog" aria-modal="true" aria-label="生成的音乐日记"><article className={`generation-dialog${leaving ? " generation-dialog--leaving" : ""}`}>
    <button type="button" className="generation-card-close" onClick={() => closeAfterFade(onBack)} disabled={leaving} aria-label="关闭音乐日记">×</button>
    <div className="generation-cover">{cover ? <Image src={cover} alt="音乐日记封面" fill sizes="(max-width: 700px) 100vw, 600px" unoptimized /> : <div className="cover-placeholder">Meloday</div>}</div>
    <div className="generation-content">
      <div className="generation-card-meta"><span className="eyebrow">{formatDate(job.createdAt)}</span><button className="button button-primary" onClick={onSave} disabled={saving || leaving}>{saving ? "正在保存…" : "保存到日记本"}</button></div>
      <h2>{job.title}</h2>
      <p className="card-summary">{job.summary}</p>
      {audio && <AudioPlayer src={audio} />}
    </div>
  </article></div>, document.body);
}
