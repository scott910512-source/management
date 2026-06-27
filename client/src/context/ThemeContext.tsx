import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);
const KEY = 'tkt_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY) as Theme | null;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
