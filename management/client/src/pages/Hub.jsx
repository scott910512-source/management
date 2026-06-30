import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Hub() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="hub-shell">
      <div className="hub-topbar">
        <div className="hub-brand">
          <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 28, height: 28 }}>
            <polygon points="3,14 17,5 31,14" fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
            <rect x="3" y="14" width="28" height="16" rx="1" stroke="#fff" strokeWidth="1.8" />
            <rect x="13" y="20" width="8" height="10" rx="1" fill="#fff" />
            <rect x="4" y="18" width="7" height="6" rx="0.5" fill="rgba(255,255,255,0.7)" />
            <rect x="23" y="18" width="7" height="6" rx="0.5" fill="rgba(255,255,255,0.7)" />
          </svg>
          <span>공장 관리 허브</span>
        </div>
        <div className="hub-user">
          <span>{user?.name} 님</span>
          <button className="btn secondary sm" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      <div className="hub-body">
        <div className="hub-welcome">
          <h1>어떤 모듈을 사용하시겠어요?</h1>
          <p className="muted">관리할 업무 영역을 선택해 주세요.</p>
        </div>

        <div className="hub-cards">
          {/* 생산관리 — 좌측 */}
          <div className="hub-card hub-card-primary" onClick={() => navigate('/production')}>
            <div className="hub-card-icon">🏭</div>
            <div className="hub-card-body">
              <div className="hub-card-title">생산관리</div>
              <div className="hub-card-desc">생산현황, AI 검색, 종합현황 등 생산 전반을 관리합니다.</div>
              <ul className="hub-card-features">
                <li>AI 검색</li>
                <li>종합현황</li>
                <li>생산현황</li>
              </ul>
            </div>
            <div className="hub-card-arrow">→</div>
          </div>

          {/* StockPilot — 우측 */}
          <div className="hub-card hub-card-secondary" onClick={() => navigate('/')}>
            <div className="hub-card-icon">📦</div>
            <div className="hub-card-body">
              <div className="hub-card-title">StockPilot</div>
              <div className="hub-card-desc">원부재료·용기 재고 관리, 수불 이력, 유해화학물질 대장을 관리합니다.</div>
              <ul className="hub-card-features">
                <li>원재료 / 부재료 관리</li>
                <li>Canister 관리</li>
                <li>수불 이력 · 유해화학물질</li>
              </ul>
            </div>
            <div className="hub-card-arrow">→</div>
          </div>
        </div>
      </div>
    </div>
  );
}
