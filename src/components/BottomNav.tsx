"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "今天", icon: "✦" },
  { href: "/diary", label: "日记本", icon: "▤" },
  { href: "/community", label: "社区", icon: "◌" },
  { href: "/mine", label: "我的", icon: "⌂" },
];

export function BottomNav() {
  const pathname = usePathname();
  return <nav className="bottom-nav" aria-label="主导航">{items.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href ? "nav-item active" : "nav-item"}><span>{item.icon}</span>{item.label}</Link>)}</nav>;
}
