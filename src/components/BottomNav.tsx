"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { rememberHomeReturn } from "@/lib/client";
import { AppIcon } from "./AppIcon";

const items = [
  { href: "/", label: "今天", icon: "today" },
  { href: "/diary", label: "日记本", icon: "diary" },
  { href: "/community", label: "分享", icon: "community" },
  { href: "/mine", label: "我的", icon: "profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return <nav className="bottom-nav" aria-label="主导航">{items.map((item) => <Link key={item.href} href={item.href} onClick={() => { if (pathname !== item.href) rememberHomeReturn(); }} className={pathname === item.href ? "nav-item active" : "nav-item"} aria-current={pathname === item.href ? "page" : undefined}><span className="nav-icon"><AppIcon name={item.icon} /></span><span className="nav-label">{item.label}</span></Link>)}</nav>;
}
