'use client';

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import type { AuthUser } from '@/lib/api/types';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = 'fundraising_auth';

function readAuthFromStorage(): { token: string | null; user: AuthUser | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw) as { token: string; user: AuthUser };
    return { token: parsed.token, user: parsed.user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = readAuthFromStorage();
  const [token, setToken] = useState<string | null>(initial.token);
  const [user, setUser] = useState<AuthUser | null>(initial.user);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      setAuth: (nextToken, nextUser) => {
        setToken(nextToken);
        setUser(nextUser);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
      },
      clearAuth: () => {
        setToken(null);
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
