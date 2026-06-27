import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { GlobalSearch } from './GlobalSearch';
import { BadgeToast } from './BadgeToast';

const NAV = [
  { to: '/', label: '대시보드', icon: '🏠' },
  { to: '/map', label: '여행 지도', icon: '🗺️' },
  { to: '/stats', label: '통계', icon: '📊' },
  { to: '/wishlist', label: '버킷리스트', icon: '⭐' },
  { to: '/timeline', label: '여행 히스토리', icon: '🕒' },
  { to: '/gallery', label: '사진 갤러리', icon: '📸' },
  { to: '/badges', label: '여행 배지', icon: '🏅' },
  { to: '/settings', label: '설정 · 백업', icon: '⚙️' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const nav = [...NAV];
  if (user?.role === 'ADMIN') nav.push({ to: '/admin', label: '관리자', icon: '🛡️' });

  const SidebarContent = (
    <div className="flex h-full flex-col gap-2 p-4">
      <Link to="/" className="mb-4 flex items-center gap-2 px-2" onClick={() => setMobileOpen(false)}>
        <span className="text-2xl">🗺️</span>
        <div className="leading-tight">
          <div className="text-base font-extrabold tracking-tight">Travel Korea</div>
          <div className="text-[11px] text-slate-500">대한민국 여행 지도</div>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="glass-soft mt-2 flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
          {user?.name?.[0] ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{user?.name}</div>
          <div className="truncate text-[11px] text-slate-500">
            {user?.role === 'ADMIN' ? '관리자' : '일반 사용자'}
          </div>
        </div>
        <button onClick={logout} title="로그아웃" className="btn-ghost px-2 py-1.5 text-xs">
          나가기
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <BadgeToast />

      {/* 데스크탑 사이드바 */}
      <aside className="glass sticky top-0 m-3 hidden h-[calc(100vh-1.5rem)] w-64 shrink-0 lg:block">
        {SidebarContent}
      </aside>

      {/* 모바일 슬라이드오버 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="glass absolute left-2 top-2 h-[calc(100vh-1rem)] w-64 animate-fade-in">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 상단바 */}
        <header className="glass sticky top-0 z-30 m-3 flex items-center gap-3 px-4 py-3">
          <button
            className="btn-ghost px-2.5 py-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          <div className="hidden flex-1 sm:block">
            <GlobalSearch />
          </div>
          <div className="flex-1 sm:hidden" />
          <button onClick={toggle} className="btn-ghost px-3 py-2" title="다크모드 전환">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>

        {/* 모바일 검색바 */}
        <div className="mx-3 mb-1 sm:hidden">
          <GlobalSearch />
        </div>

        <main key={location.pathname} className="animate-fade-in flex-1 px-3 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
