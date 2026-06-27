import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Loading } from './components/ui';
import { Icon } from './components/icons';
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

const NAV = [
  { to: '/', label: '종합현황', ico: 'grid', end: true },
  { to: '/search', label: 'AI 검색', ico: 'search' },
  { section: '재고 관리' },
  { to: '/raw', label: '원재료', ico: 'canister' },
  { to: '/sub', label: '부재료', ico: 'drum' },
  { to: '/canisters', label: 'Canister', ico: 'star' },
  { section: '내역 · 업무' },
  { to: '/transactions', label: '수불 이력', ico: 'swap' },
  { to: '/anomalies', label: '이상발생 목록', ico: 'alert' },
  { to: '/tasks', label: 'Task 관리', ico: 'task' },
];

function Sidebar() {
  const { user, isAdmin, plants, plant, changePlant, roleLabel } = useAuth();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%'}}>
            <polygon points="3,14 17,5 31,14" fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
            <rect x="3" y="14" width="28" height="16" rx="1" stroke="#fff" strokeWidth="1.8"/>
            <rect x="13" y="20" width="8" height="10" rx="1" fill="#fff"/>
            <rect x="4" y="18" width="7" height="6" rx="0.5" fill="rgba(255,255,255,0.7)"/>
            <rect x="23" y="18" width="7" height="6" rx="0.5" fill="rgba(255,255,255,0.7)"/>
          </svg>
        </div>
        <div>
          <div className="brand-title">수불관리</div>
          <div className="brand-sub">화학공장 운영관리</div>
        </div>
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
        {NAV.map((n, i) =>
          n.section ? (
            <div className="nav-section" key={i}>{n.section}</div>
          ) : (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="ico"><Icon name={n.ico} /></span>
              {n.label}
            </NavLink>
          ),
        )}
        <div className="nav-section">설정</div>
        {isAdmin && (
          <NavLink to="/items" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="ico"><Icon name="db" /></span>기준정보
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="ico"><Icon name="shield" /></span>관리자 설정
          </NavLink>
        )}
        <div className="nav-section">도움말</div>
        <NavLink to="/manual" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="ico"><Icon name="book" /></span>사용자 메뉴얼
        </NavLink>
      </nav>
      <div style={{ marginTop: 24, padding: '0 12px', fontSize: 12, color: 'var(--text-3)' }}>
        {user?.name} 님<br />· {roleLabel}
      </div>
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
      <Route path="/raw" element={<Protected title="원재료 관리"><RawMaterials /></Protected>} />
      <Route path="/sub" element={<Protected title="부재료 관리"><SubMaterials /></Protected>} />
      <Route path="/canisters" element={<Protected title="Canister 관리"><Canisters /></Protected>} />
      <Route path="/canisters/:id" element={<Protected title="용기이력카드"><CanisterDetail /></Protected>} />
      <Route path="/transactions" element={<Protected title="수불 이력"><Transactions /></Protected>} />
      <Route path="/anomalies" element={<Protected title="이상발생 목록"><Anomalies /></Protected>} />
      <Route path="/tasks" element={<Protected title="Task 관리"><Tasks /></Protected>} />
      <Route path="/items" element={<Protected title="기준정보 (품목·안전재고)" adminOnly><Items /></Protected>} />
      <Route path="/admin" element={<Protected title="관리자 설정" adminOnly><Admin /></Protected>} />
      <Route path="/settings" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
