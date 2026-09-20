"use client";

import { createPortal } from "react-dom";
import type { GenerationJob } from "@/lib/types";
import { formatDate, mediaUrl } from "@/lib/client";
import { AudioPlayer } from "./AudioPlayer";
import { ImagePreview } from "./ImagePreview";

export function GenerationCard({ job, onSave, onBack, saving }: { job: GenerationJob; onSave: () => void; onBack: () => void; saving: boolean }) {
  const cover = mediaUrl(job.coverAssetId);
  const audio = mediaUrl(job.audioAssetId);
  return createPortal(<div className="generation-backdrop" role="dialog" aria-modal="true" aria-label="生成的音乐日记"><article className="music-card generation-dialog">
    <div className="music-card-cover">{cover ? <ImagePreview src={cover} alt="音乐日记封面" className="image-preview-fill"><img src={cover} alt="音乐日记封面" /></ImagePreview> : <div className="cover-placeholder">Meloday</div>}<span className="card-stamp">M</span></div>
    <div className="music-card-body">
      <div className="eyebrow">{formatDate(job.createdAt)} · 音乐日记</div>
      <h2>{job.title}</h2>
      <p className="card-summary">{job.summary}</p>
      {audio && <AudioPlayer src={audio} />}
      <details className="body-details"><summary>查看完整日记</summary><p>{job.body}</p></details>
      <div className="card-actions"><button className="button button-primary" onClick={onSave} disabled={saving}>{saving ? "正在保存…" : "保存到日记本"}</button><button className="button button-ghost" onClick={onBack}>返回</button></div>
    </div>
  </article></div>, document.body);
}
