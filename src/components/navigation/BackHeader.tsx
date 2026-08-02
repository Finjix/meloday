"use client";

import { ChevronLeft } from "lucide-react";

type BackHeaderProps = {
  goBack: () => void;
  title: string;
};

export function BackHeader({ goBack, title }: BackHeaderProps) {
  return (
    <header className="diary-back-header">
      <div className="diary-back-header__inner">
        <button
          type="button"
          onClick={goBack}
          aria-label="返回"
          title="返回"
          className="healing-blue diary-back-header__button"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="diary-back-header__title">{title}</h1>
      </div>
    </header>
  );
}
