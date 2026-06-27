import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function LoginPage() {
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <button onClick={toggle} className="btn-ghost absolute right-4 top-4 px-3 py-2">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="glass w-full max-w-md animate-fade-in p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">🗺️</div>
          <h1 className="text-2xl font-extrabold tracking-tight">Travel Korea Tracker</h1>
          <p className="mt-1 text-sm text-slate-500">대한민국 방문 기록을 색칠해보세요</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-white/40 p-1 dark:bg-white/5">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError('');
              }}
              className={`rounded-xl py-2 text-sm font-semibold transition ${
                mode === m ? 'bg-white text-brand-700 shadow dark:bg-white/15 dark:text-brand-500' : 'text-slate-500'
              }`}
            >
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'register' && (
            <input
              className="glass-input"
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            className="glass-input"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="glass-input"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}
          <button type="submit" className="btn-primary mt-1" disabled={loading}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        <div className="mt-5 rounded-xl bg-white/30 px-4 py-3 text-center text-xs text-slate-500 dark:bg-white/5">
          기본 관리자 계정 · <b>admin@travel.kr</b> / <b>admin1234</b>
          <br />
          데모 계정 · <b>demo@travel.kr</b> / <b>demo1234</b>
        </div>
      </div>
    </div>
  );
}
