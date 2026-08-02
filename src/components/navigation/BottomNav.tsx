"use client";

import { BookOpen, House, UserRound } from "lucide-react";

type BottomNavProps = {
  active: "home" | "diary" | "mine";
  goHome: () => void;
  goDiary: () => void;
  goMine: () => void;
};

export function BottomNav({ active, goHome, goDiary, goMine }: BottomNavProps) {
  const itemClass = (target: BottomNavProps["active"]) =>
    `bottom-nav__item ${active === target ? "is-active" : "is-inactive"}`;

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__grid">
        <button
          type="button"
          onClick={goHome}
          aria-label="首页"
          title="首页"
          className={itemClass("home")}
        >
          <House size={20} strokeWidth={1.8} />
          <span>此刻</span>
        </button>
        <button
          type="button"
          onClick={goDiary}
          aria-label="日记本"
          title="日记本"
          className={itemClass("diary")}
        >
          <BookOpen size={20} strokeWidth={1.8} />
          <span>日记</span>
        </button>
        <button
          type="button"
          onClick={goMine}
          aria-label="个人"
          title="个人"
          className={itemClass("mine")}
        >
          <UserRound size={20} strokeWidth={1.8} />
          <span>我的</span>
        </button>
      </div>
    </nav>
  );
}
