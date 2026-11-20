import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "../api";
import type { PublicUser } from "../lib/types";

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, avatar?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: PublicUser) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const existing = tokenStore.get();
    if (!existing) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((profile) => {
        if (active) {
          setUserState(profile);
          setToken(tokenStore.get());
        }
      })
      .catch(() => {
        if (active) {
          tokenStore.clear();
          setToken(null);
          setUserState(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username.trim(), password);
    tokenStore.set(res.token);
    setToken(res.token);
    setUserState(res.user);
  }, []);

  const register = useCallback(async (username: string, password: string, avatar?: string) => {
    const res = await api.register(username.trim(), password, avatar);
    tokenStore.set(res.token);
    setToken(res.token);
    setUserState(res.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((next: PublicUser) => setUserState(next), []);

  const refresh = useCallback(async () => {
    const profile = await api.me();
    setUserState(profile);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, setUser, refresh }),
    [user, token, loading, login, register, logout, setUser, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
