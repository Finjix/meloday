"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, mediaUrl } from "@/lib/client";
import type { User } from "@/lib/types";
import { useAuth } from "./AuthContext";

export function MineView() {
  const router = useRouter();
  const { refresh, logout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [capacity, setCapacity] = useState<{ used: number; limit: number } | null>(null);
  const [agentName, setAgentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  useEffect(() => { void apiFetch<{ user: User; capacity: { used: number; limit: number } }>("/api/profile").then((result) => { setUser(result.user); setCapacity(result.capacity); setAgentName(result.user.agentName); }).catch((err) => setNotice(err instanceof Error ? err.message : "个人资料暂时打不开。")); }, []);
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);

  const showToast = (message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => { setToast(""); toastTimer.current = null; }, 2400);
  };

  const save = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setNotice(""); try { const next = await apiFetch<User>("/api/profile", { method: "PATCH", body: JSON.stringify({ agentName }) }); setUser(next); await refresh(); showToast("已经记下新的称呼了。"); } catch (err) { setNotice(err instanceof Error ? err.message : "保存失败。"); } finally { setBusy(false); } };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); const form = new FormData(); form.set("avatar", file); try { const response = await fetch("/api/profile/avatar", { method: "POST", body: form }); const payload = await response.json(); if (!response.ok) throw new Error(payload?.error?.message ?? "头像上传失败。"); setUser(payload.data); await refresh(); } catch (err) { setNotice(err instanceof Error ? err.message : "头像上传失败。"); } finally { setBusy(false); event.target.value = ""; } };
  const signOut = async () => { setBusy(true); await logout(); router.replace("/login"); };

  if (!user) return <div className="page-scroll loading-panel"><span className="loading-orbit" />正在打开我的…</div>;
  const usage = capacity ? Math.min(100, (capacity.used / Math.max(capacity.limit, 1)) * 100) : 0;
  return <div className="page-scroll mine-page"><div className="page-intro"><div><span className="eyebrow">把自己照顾好</span><h1>我的</h1><p>这里放着你的称呼、日记容量和一些小小设置。</p></div><label className="profile-avatar" title="点击更换头像" aria-label="点击更换头像">{user.avatarAssetId ? <img src={mediaUrl(user.avatarAssetId)!} alt="头像" /> : user.displayName.slice(0, 1)}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy} /></label></div>{notice && <div className="notice">{notice}</div>}{toast && <div className="notice notice-toast" role="status">{toast}</div>}<section className="settings-card"><div className="settings-title"><span>个性化</span><label className="upload-link">更换头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy} /></label></div><form onSubmit={save}><label>Meloday 怎么称呼你<input value={agentName} onChange={(event) => setAgentName(event.target.value)} maxLength={24} /></label><button className="button button-primary" disabled={busy}>{busy ? "保存中…" : "保存设置"}</button></form></section><section className="capacity-section"><div className="settings-title"><span>日记容量</span><strong>{capacity?.used ?? 0} / {capacity?.limit ?? 31}</strong></div><div className="capacity-track"><span style={{ width: `${usage}%` }} /></div><p>每个账号默认可以保存 31 篇音乐日记。扩容功能暂未开放，你可以先好好保存每一页。</p><button className="button button-muted" disabled>购买扩容 · 暂未开放</button></section><button className="logout-button" onClick={() => void signOut()} disabled={busy}>退出登录</button></div>;
}
