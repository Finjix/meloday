"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

const products = [
  { name: "30篇", price: "9元", description: "增加 30 篇日记容量" },
  { name: "90篇", price: "24元", description: "增加 90 篇日记容量" },
  { name: "180篇", price: "39元", description: "增加 180 篇日记容量" },
  { name: "360篇", price: "69元", description: "增加 360 篇日记容量" },
  { name: "解锁音乐和图片下载", price: "9元", description: "保存喜欢的旋律与封面" },
  { name: "无限", price: "99元", description: "不再受日记容量限制" },
];

export function PurchaseDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();

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

  return createPortal(<div className="purchase-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
    <section className="purchase-dialog" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="shared-diary-close" onClick={onClose} aria-label="关闭购买页面">×</button>
      <span className="eyebrow">Meloday</span><h2 id={titleId}>选择你的空间</h2><p>把更多值得留下的日子，慢慢收进日记本。</p>
      <div className="purchase-products">{products.map((product) => <article className="purchase-product" key={product.name}><h3>{product.name}</h3><strong>{product.price}</strong><p>{product.description}</p><button type="button" className="button button-primary">购买</button></article>)}</div>
    </section>
  </div>, document.body);
}
