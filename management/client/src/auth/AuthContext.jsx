import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getPlant, setPlant } from '../api';

const AuthCtx = createContext(null);

// 현재 공장이 접근 가능 목록에 없으면 기본값으로 보정
function normalizePlant(plants, userPlant) {
  const cur = getPlant();
  if (cur && plants.includes(cur)) return cur;
  const next = userPlant && plants.includes(userPlant) ? userPlant : plants[0] || '';
  setPlant(next);
  return next;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [plants, setPlants] = useState([]);
  const [plant, setPlantState] = useState(getPlant());
  const [loading, setLoading] = useState(true);

  function applyAuth(d) {
    setUser(d.user);
    const ps = d.plants || [];
    setPlants(ps);
    if (d.user) setPlantState(normalizePlant(ps, d.user.plant));
  }

  useEffect(() => {
    api
      .get('/auth/me')
      .then(applyAuth)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (id, password) => {
    const d = await api.post('/auth/login', { id, password });
    applyAuth(d);
    return d.user;
  }, []);

  const signup = useCallback((payload) => api.post('/auth/signup', payload), []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
  }, []);

  // 공장 전환: 저장 후 전체 화면 갱신(모든 데이터 재조회)
  const changePlant = useCallback((p) => {
    setPlant(p);
    setPlantState(p);
    window.location.reload();
  }, []);

  const isAdmin = user && user.role === 'admin';
  const isViewer = user && user.role === 'viewer';
  const isDemo = user && user.role === 'demo';
  const canWrite = !!user && user.role !== 'viewer' && user.role !== 'demo';
  const isSuper = user && user.role === 'admin' && user.plantScope === 'all';
  const roleLabel = (() => {
    if (!user) return '';
    if (user.role === 'viewer') return '팀관리자(조회전용)';
    if (user.role === 'demo') return '데모';
    if (user.role === 'admin') return user.plantScope === 'all' ? '통합관리자' : `${user.plantScope} 관리자`;
    return '사용자';
  })();

  // 데모 계정용 숫자 마스킹
  const demoNum = (val) => isDemo ? '***' : val;
  // 데모 계정용 텍스트 마스킹 (첫 글자 제외 * 처리)
  const demoText = (val) => {
    if (!isDemo || !val) return val;
    const s = String(val);
    return s.charAt(0) + '*'.repeat(Math.max(s.length - 1, 2));
  };

  return (
    <AuthCtx.Provider value={{ user, plants, plant, loading, login, signup, logout, changePlant, isAdmin, isViewer, isDemo, canWrite, isSuper, roleLabel, demoNum, demoText }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
