"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/client";
import type { User } from "@/lib/types";

type AuthValue = {
  user: User | null;
  capacity: { used: number; limit: number } | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [capacity, setCapacity] = useState<AuthValue["capacity"]>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const result = await apiFetch<{ user: User; capacity: { used: number; limit: number } } | null>("/api/me");
      setUser(result?.user ?? null);
      setCapacity(result?.capacity ?? null);
    } catch {
      setUser(null);
      setCapacity(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    capacity,
    loading,
    refresh,
    logout: async () => {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setCapacity(null);
    },
  }), [user, capacity, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
