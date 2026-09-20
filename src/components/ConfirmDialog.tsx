"use client";

import { createPortal } from "react-dom";
import { useEffect, useId } from "react";

export function ConfirmDialog({ open, title, description, confirmLabel, busy, onCancel, onConfirm }: { open: boolean; title: string; description: string; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  return createPortal(<div className="confirm-dialog-backdrop" role="presentation" onClick={() => { if (!busy) onCancel(); }}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onClick={(event) => event.stopPropagation()}>
      <h2 id={titleId}>{title}</h2>
      {description && <p id={descriptionId}>{description}</p>}
      <div className="confirm-dialog-actions">
        <button type="button" className="button confirm-dialog-danger" onClick={onConfirm} disabled={busy}>{busy ? "删除中…" : confirmLabel}</button>
        <button type="button" className="button button-ghost" onClick={onCancel} disabled={busy}>取消</button>
      </div>
    </section>
  </div>, document.body);
}
