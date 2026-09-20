"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ImagePreview({ src, alt, className, children }: { src: string; alt: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerClassName = ["image-preview-trigger", className].filter(Boolean).join(" ");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const overlay = open ? <div className="image-preview-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={() => setOpen(false)}>
    <div className="image-preview-panel" onClick={(event) => event.stopPropagation()}>
      <div className="image-preview-toolbar">
        <span id={titleId}>图片预览</span>
        <button type="button" className="image-preview-close" onClick={() => setOpen(false)} aria-label="关闭图片预览">×</button>
      </div>
      <img className="image-preview-image" src={src} alt={alt} />
      <div className="image-preview-actions">
        <a className="button button-primary" href={`${src}?download=1`} download>下载图片</a>
        <button type="button" className="button button-ghost" onClick={() => setOpen(false)}>关闭</button>
      </div>
    </div>
  </div> : null;

  return <>
    <button type="button" className={triggerClassName} onClick={() => setOpen(true)} aria-label={`${alt}，点击放大预览`}>
      {children}
    </button>
    {overlay && createPortal(overlay, document.body)}
  </>;
}
