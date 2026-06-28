import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Loading } from './components/ui';
import { Icon } from './components/icons';
import { api } from './api';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import RawMaterials from './pages/RawMaterials';
import SubMaterials from './pages/SubMaterials';
import Canisters from './pages/Canisters';
import CanisterDetail from './pages/CanisterDetail';
import Transactions from './pages/Transactions';
import Anomalies from './pages/Anomalies';
import Tasks from './pages/Tasks';
import Admin from './pages/Admin';
import Items from './pages/Items';
import Search from './pages/Search';
import Manual from './pages/Manual';
import Hazardous from './pages/Hazardous';
import InputHistory from './pages/InputHistory';
import Suggestions from './pages/Suggestions';
import Reports from './pages/Reports';

// 큰 묶음 단위로 그룹화 — 그룹마다 테두리로 구분
const NAV_GROUPS = [
  { items: [
    { to: '/search', label: 'AI 검색', ico: 'search' },
    { to: '/', label: '종합현황', ico: 'grid', end: true },
  ] },
  { title: '재고 관리', items: [
    { to: '/raw', label: '원재료', ico: 'canister' },
    { to: '/sub', label: '부재료', ico: 'drum' },
    { to: '/canisters', label: 'Canister', ico: 'star' },
  ] },
  { title: '내역 · 업무', items: [
    { to: '/transactions', label: '수불 이력', ico: 'swap' },
    { to: '/input-history', label: '원·부재료 투입이력', ico: 'swap' },
    { to: '/anomalies', label: '이상발생 목록', ico: 'alert' },
    { to: '/tasks', label: 'Task 관리', ico: 'task' },
    { to: '/hazardous', label: '유해화학물질', ico: 'alert' },
  ] },
  { title: '설정', adminOnly: true, items: [
    { to: '/items', label: '기준정보', ico: 'db' },
    { to: '/reports', label: '월간 보고서', ico: 'grid' },
    { to: '/admin', label: '관리자 설정', ico: 'shield', badge: 'pending' },
  ] },
  { title: '도움말', items: [
    { to: '/manual', label: '사용자 메뉴얼', ico: 'book' },
    { to: '/suggestions', label: '건의사항', ico: 'task' },
  ] },
];

function NavItem({ n, pendingCount }) {
  return (
    <NavLink to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={n.label}>
      <span className="ico"><Icon name={n.ico} /></span>
      <span className="nav-label">{n.label}</span>
      {n.badge === 'pending' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
    </NavLink>
  );
}

function Sidebar() {
  const { user, isAdmin, plants, plant, changePlant, roleLabel } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [mini, setMini] = useState(() => localStorage.getItem('sidebarMini') === '1');
  useEffect(() => { localStorage.setItem('sidebarMini', mini ? '1' : '0'); }, [mini]);
  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = () => api.get('/users').then((d) => setPendingCount((d.items || []).filter((u) => u.status === 'pending').length)).catch(() => {});
    fetchPending();
    const id = setInterval(fetchPending, 60000);
    return () => clearInterval(id);
  }, [isAdmin]);

  const groups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin);

  return (
    <aside className={`sidebar ${mini ? 'mini' : ''}`}>
      <div className="brand-row">
        <Link to="/" className="brand" title="종합현황으로 이동">
          <div className="brand-logo">
            <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <polygon points="3,14 17,5 31,14" fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
              <rect x="3" y="14" width="28" height="16" rx="1" stroke="#fff" strokeWidth="1.8" />
              <rect x="13" y="20" width="8" height="10" rx="1" fill="#fff" />
              <rect x="4" y="18" width="7" height="6" rx="0.5" fill="rgba(255,255,255,0.7)" />
              <rect x="23" y="18" width="7" height="6" rx="0.5" fill="rgba(255,255,255,0.7)" />
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-title">StockPilot</div>
            <div className="brand-sub">화학공장 운영관리</div>
          </div>
        </Link>
        <button className="sidebar-toggle" onClick={() => setMini((v) => !v)} title={mini ? '메뉴 펼치기' : '메뉴 최소화'} aria-label="메뉴 최소화">
          {mini ? '»' : '«'}
        </button>
      </div>

      <div className="plant-pick">
        <span className="plant-label">공장</span>
        {plants && plants.length > 1 ? (
          <select className="plant-select" value={plant} onChange={(e) => changePlant(e.target.value)}>
            {plants.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        ) : (
          <span className="plant-single">{plant || (plants && plants[0]) || '-'}</span>
        )}
      </div>

      <nav className="nav">
        {groups.map((g, i) => (
          <div className="nav-group" key={i}>
            {g.title && <div className="nav-section">{g.title}</div>}
            {g.items.map((n) => <NavItem key={n.to} n={n} pendingCount={pendingCount} />)}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">{user?.name} 님<span> · {roleLabel}</span></div>
    </aside>
  );
}

function Shell({ children, title }) {
  const { user, logout, isViewer, plant } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <h1>{title}{plant && <span className="topbar-plant">{plant}</span>}</h1>
          <div className="topbar-slot" id="topbar-slot" />
          <div className="user">
            {isViewer && <span className="badge orange">조회 전용</span>}
            <span>{user?.name} ({user?.id})</span>
            <button className="btn secondary sm" onClick={async () => { await logout(); navigate('/login'); }}>로그아웃</button>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

function Protected({ children, title, adminOnly }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <Shell title={title}>{children}</Shell>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
      <Route path="/" element={<Protected title="종합현황"><Dashboard /></Protected>} />
      <Route path="/search" element={<Protected title="AI 검색"><Search /></Protected>} />
      <Route path="/manual" element={<Protected title="사용자 메뉴얼"><Manual /></Protected>} />
      <Route path="/suggestions" element={<Protected title="건의사항"><Suggestions /></Protected>} />
      <Route path="/raw" element={<Protected title="원재료 관리"><RawMaterials /></Protected>} />
      <Route path="/sub" element={<Protected title="부재료 관리"><SubMaterials /></Protected>} />
      <Route path="/canisters" element={<Protected title="Canister 관리"><Canisters /></Protected>} />
      <Route path="/canisters/:id" element={<Protected title="용기이력카드"><CanisterDetail /></Protected>} />
      <Route path="/transactions" element={<Protected title="수불 이력"><Transactions /></Protected>} />
      <Route path="/anomalies" element={<Protected title="이상발생 목록"><Anomalies /></Protected>} />
      <Route path="/tasks" element={<Protected title="Task 관리"><Tasks /></Protected>} />
      <Route path="/hazardous" element={<Protected title="유해화학물질 관리대장"><Hazardous /></Protected>} />
      <Route path="/input-history" element={<Protected title="원·부재료 투입이력"><InputHistory /></Protected>} />
      <Route path="/reports" element={<Protected title="월간 보고서" adminOnly><Reports /></Protected>} />
      <Route path="/items" element={<Protected title="기준정보 (품목·안전재고)" adminOnly><Items /></Protected>} />
      <Route path="/admin" element={<Protected title="관리자 설정" adminOnly><Admin /></Protected>} />
      <Route path="/settings" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
