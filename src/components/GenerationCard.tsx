"use client";

import Image from "next/image";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { GenerationJob } from "@/lib/types";
import { formatDate, mediaUrl } from "@/lib/client";
import { AudioPlayer } from "./AudioPlayer";
import { ImagePreview } from "./ImagePreview";

export function GenerationCard({ job, onSave, onBack, saving }: { job: GenerationJob; onSave: () => void; onBack: () => void; saving: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const cover = mediaUrl(job.coverAssetId);
  const audio = mediaUrl(job.audioAssetId);
  const closeAfterFade = (callback: () => void) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(callback, 240);
  };
  return createPortal(<div className={`generation-backdrop${leaving ? " generation-backdrop--leaving" : ""}`} role="dialog" aria-modal="true" aria-label="生成的音乐日记"><article className={`music-card generation-dialog${leaving ? " generation-dialog--leaving" : ""}`}><button type="button" className="generation-card-close" onClick={() => closeAfterFade(onBack)} disabled={leaving} aria-label="关闭音乐日记">×</button>
    <div className="music-card-cover">{cover ? <ImagePreview src={cover} alt="音乐日记封面" className="image-preview-fill"><Image src={cover} alt="音乐日记封面" fill sizes="250px" unoptimized /></ImagePreview> : <div className="cover-placeholder">Meloday</div>}<span className="card-stamp">M</span></div>
    <div className="music-card-body">
      <div className="eyebrow">{formatDate(job.createdAt)} · 音乐日记</div>
      <h2>{job.title}</h2>
      <p className="card-summary">{job.summary}</p>
      {audio && <AudioPlayer src={audio} />}
      <div className="card-actions"><button className="button button-primary" onClick={onSave} disabled={saving || leaving}>{saving ? "正在保存…" : "保存到日记本"}</button><button className="button button-ghost" onClick={() => closeAfterFade(onBack)} disabled={leaving}>关闭</button></div>
    </div>
  </article></div>, document.body);
}
