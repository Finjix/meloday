"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { BottomNav } from "./BottomNav";

export function AppShell({ children, title, requireAuth = true }: { children: ReactNode; title?: string; requireAuth?: boolean }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && requireAuth && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, requireAuth, user, router, pathname]);

  if (loading || (requireAuth && !user)) return <div className="loading-screen"><span className="loading-orbit" />正在准备你的音乐日记…</div>;

  return (
    <main className="app-root">
      <div className="app-shell">
        <header className="topbar">
          <Link href="/" className="brand-mark" aria-label="Meloday 首页"><span className="brand-dot" />Meloday</Link>
          <div className="topbar-right">
            {title && <span className="topbar-title">{title}</span>}
            {user && <span id="topbar-status" className="topbar-status"><span className="topbar-slogan">把每一天，变成一段旋律！</span></span>}
          </div>
        </header>
        <section className="app-content">{children}</section>
        {user && <BottomNav />}
      </div>
    </main>
  );
}
