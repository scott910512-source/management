import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../api/client';
import type { User } from '../types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

interface AuthResponse {
  token: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = (res: AuthResponse) => {
    tokenStore.set(res.token);
    setUser(res.user);
  };

  const login = async (email: string, password: string) => {
    handleAuth(await api.post<AuthResponse>('/auth/login', { email, password }));
  };

  const register = async (name: string, email: string, password: string) => {
    handleAuth(await api.post<AuthResponse>('/auth/register', { name, email, password }));
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
