import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './ui';

// 공장 활성/비활성 관리 — StockPilot·ManagePilot 공통. 총괄관리자만 변경 가능.
// 비활성화된 공장은 모든 모듈에서 공장 선택 목록·탭에서 제외되고, 데이터 접근이 차단된다.
export default function PlantManagement() {
  const { isSuper } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState('');

  function load() {
    api.get('/plants').then((d) => setItems(d.items || [])).catch(() => setItems([]));
  }
  useEffect(() => { load(); }, []);

  async function toggle(plant, next) {
    if (!next) {
      const ok = window.confirm(`[${plant}]를 비활성화하시겠습니까?\n비활성화되면 모든 모듈(StockPilot·ManagePilot)에서 해당 공장 데이터에 접근할 수 없게 됩니다.`);
      if (!ok) return;
    }
    setBusy(plant);
    try {
      const d = await api.patch(`/plants/${encodeURIComponent(plant)}`, { enabled: next });
      setItems(d.items || []);
      toast.ok(`[${plant}] ${next ? '활성화' : '비활성화'}되었습니다.`);
    } catch (e) { toast.err(e.message); } finally { setBusy(''); }
  }

  if (items == null) return null;

  return (
    <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 4 }}>🏭 공장 관리</h3>
      <p className="hint" style={{ marginBottom: 14 }}>
        공장을 비활성화하면 <b>모든 모듈(StockPilot·ManagePilot)</b>에서 해당 공장을 선택·접근할 수 없습니다.
        {!isSuper && <> 상태 변경은 <b>총괄관리자</b>만 가능합니다.</>}
      </p>
      {items.map((it) => (
        <div key={it.plant} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #f0f0f5' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: it.enabled ? '#34c759' : '#ff3b30',
          }} />
          <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{it.plant}</span>
          <span style={{ fontSize: 12, color: it.enabled ? '#1a7f3c' : '#c0001a', fontWeight: 600 }}>
            {it.enabled ? '활성' : '비활성화됨'}
          </span>
          {isSuper && (
            <button
              className={`btn sm${it.enabled ? ' secondary' : ''}`}
              disabled={busy === it.plant}
              onClick={() => toggle(it.plant, !it.enabled)}
              style={it.enabled ? { color: '#c0001a', borderColor: '#ffb3b3' } : {}}
            >
              {busy === it.plant ? '처리 중…' : it.enabled ? '비활성화' : '활성화'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
