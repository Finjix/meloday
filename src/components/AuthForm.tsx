"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { apiFetch } from "@/lib/client";
import { useAuth } from "./AuthContext";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  return <Suspense fallback={<main className="auth-page"><div className="loading-panel">正在准备 Meloday…</div></main>}><AuthFormContent mode={mode} /></Suspense>;
}

function AuthFormContent({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isRegister = mode === "register";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (isRegister && password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ username, password, ...(isRegister ? { confirmPassword } : {}) }) });
      await refresh();
      router.replace(params.get("next") || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法完成操作。");
    } finally { setBusy(false); }
  };

  return (
    <main className="auth-page">
      <div className="auth-decoration"><span className="brand-dot" />Meloday</div>
      <section className="auth-card">
        <span className="eyebrow">{isRegister ? "欢迎来到 Meloday" : "欢迎回来"}</span>
        <h1>{isRegister ? "给每天留一段旋律" : "继续听见你的故事"}</h1>
        <p className="auth-intro">{isRegister ? "从今天开始，把值得留下的心情写成音乐日记。" : "你的每一页故事，都还在这里。"}</p>
        <form onSubmit={submit}>
          <label>用户名
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={isRegister ? "2-8 位用户名" : undefined}
              autoComplete="username"
              minLength={2}
              maxLength={isRegister ? 8 : 24}
              required
            />
          </label>
          <label>密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? "至少 8 位" : undefined} autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} maxLength={128} required />
          </label>
          {isRegister && <label>确认密码
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再输入一次密码" autoComplete="new-password" minLength={8} maxLength={128} required />
          </label>}
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary button-large" disabled={busy}>{busy ? "正在进入…" : isRegister ? "创建我的日记本  →" : "登录  →"}</button>
        </form>
        <p className="auth-switch">{isRegister ? "已经有账号了？" : "还没有账号？"}<Link href={isRegister ? "/login" : "/register"}>{isRegister ? "直接登录" : "创建一个"}</Link></p>
      </section>
      <p className="auth-footer">把每一天，变成一段旋律。</p>
    </main>
  );
}
