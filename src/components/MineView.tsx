"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, mediaUrl } from "@/lib/client";
import type { DiaryCheckinStatus, User } from "@/lib/types";
import { useAuth } from "./AuthContext";
import { PurchaseDialog } from "./PurchaseDialog";

export function MineView() {
  const router = useRouter();
  const { refresh, logout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [capacity, setCapacity] = useState<{ used: number; limit: number } | null>(null);
  const [checkin, setCheckin] = useState<DiaryCheckinStatus | null>(null);
  const [agentName, setAgentName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    void apiFetch<{ user: User; capacity: { used: number; limit: number }; checkin: DiaryCheckinStatus }>("/api/profile").then((result) => {
      setUser(result.user); setCapacity(result.capacity); setCheckin(result.checkin); setAgentName(result.user.agentName);
    }).catch((err) => setNotice(err instanceof Error ? err.message : "个人资料暂时打不开。")).finally(() => setProfileLoading(false));
  }, []);
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);

  const showToast = (message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => { setToast(""); toastTimer.current = null; }, 2400);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice("");
    try { const next = await apiFetch<User>("/api/profile", { method: "PATCH", body: JSON.stringify({ agentName }) }); setUser(next); await refresh(); showToast("已经记下新的称呼了。"); } catch (err) { setNotice(err instanceof Error ? err.message : "保存失败。"); } finally { setBusy(false); }
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); const form = new FormData(); form.set("avatar", file);
    try { const response = await fetch("/api/profile/avatar", { method: "POST", body: form }); const payload = await response.json(); if (!response.ok) throw new Error(payload?.error?.message ?? "头像上传失败。"); setUser(payload.data); await refresh(); } catch (err) { setNotice(err instanceof Error ? err.message : "头像上传失败。"); } finally { setBusy(false); event.target.value = ""; }
  };
  const signOut = async () => { setBusy(true); await logout(); router.replace("/login"); };

  if (!user) return profileLoading ? <div className="page-scroll loading-panel"><span className="loading-orbit" />正在打开我的…</div> : <div className="page-scroll"><div className="notice">{notice || "个人资料暂时打不开。"}</div><button className="button button-primary" onClick={() => window.location.reload()}>重新打开</button></div>;
  const usage = capacity ? Math.min(100, (capacity.used / Math.max(capacity.limit, 1)) * 100) : 0;
  const checkedDays = checkin?.rewardReady ? 7 : checkin?.progress ?? 0;
  return <div className="page-scroll mine-page"><div className="page-intro"><div><span className="eyebrow">把自己照顾好</span><h1>我的</h1><p>这里放着你的称呼、日记容量和一些小小设置。</p></div><div className="profile-avatar">{user.avatarAssetId ? <img src={mediaUrl(user.avatarAssetId)!} alt="头像" /> : user.displayName.slice(0, 1)}</div></div>{notice && <div className="notice">{notice}</div>}{toast && <div className="notice notice-toast" role="status">{toast}</div>}<section className="settings-card"><div className="settings-title"><span>个性化</span><label className="upload-link">更换头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy} /></label></div><form onSubmit={save}><label>Meloday 怎么称呼你<input value={agentName} onChange={(event) => setAgentName(event.target.value)} maxLength={24} /></label><button className="button button-primary" disabled={busy}>{busy ? "保存中…" : "保存设置"}</button></form></section><section className="checkin-section"><div className="settings-title"><span>日记打卡</span><strong>{checkin?.totalDays ?? 0} 天</strong></div><div className="checkin-days" aria-label={`已完成 ${checkedDays} 天本轮打卡`}>{Array.from({ length: 7 }, (_, index) => <i className={index < checkedDays ? "active" : ""} key={index}>{index + 1}</i>)}</div><p>{checkin?.checkedToday ? checkin.rewardReady ? "今天打卡完成，已获得 1 篇日记容量。" : "今天已打卡，继续记录生活吧。" : "每天生成一篇日记即可打卡，每满 7 天获得 1 篇容量。"}</p></section><section className="capacity-section"><div className="settings-title"><span>日记容量</span><strong>{capacity?.used ?? 0} / {capacity?.limit ?? 30}</strong></div><div className="capacity-track"><span style={{ width: `${usage}%` }} /></div><p>每个账号默认可以保存 30 篇音乐日记。选择适合你的容量，把每一页心情都留下来。</p><button className="button button-muted" onClick={() => setPurchaseOpen(true)}>购买扩容</button></section>{purchaseOpen && <PurchaseDialog onClose={() => setPurchaseOpen(false)} />}<div className="logout-section"><button className="logout-button" onClick={() => void signOut()} disabled={busy}>退出登录</button></div></div>;
}
