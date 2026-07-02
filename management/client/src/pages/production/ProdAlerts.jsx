import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { Loading } from '../../components/ui';

const TYPES = ['전체', '수율미달', '재고부족'];

export default function ProdAlerts() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('전체');

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/production/alerts').then((d) => setItems(d.items || [])).catch(() => setItems([]));
  }, [isAdmin]);

  if (!isAdmin) return <div className="card card-pad" style={{ textAlign: 'center', padding: 40, color: '#86868b' }}>관리자만 접근할 수 있습니다.</div>;
  if (items == null) return <Loading />;

  const rows = filter === '전체' ? items : items.filter((r) => r.type === filter);

  return (
    <>
      <div className="page-head"><div className="desc">ManagePilot — 수율 미달·재고 부족 경고 이력 (일자별 자동 기록)</div></div>
      <div className="card card-pad">
        <div className="btn-row" style={{ marginBottom: 12 }}>
          {TYPES.map((t) => (
            <button key={t} className={`btn sm${filter === t ? '' : ' ghost'}`} onClick={() => setFilter(t)}>{t}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#86868b', alignSelf: 'center' }}>{rows.length}건</span>
        </div>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#86868b' }}>경고 이력이 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafd', color: '#6e6e73', fontSize: 12 }}>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>기준일</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>공장</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>품목</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>유형</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>내용</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>기록시각</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const err = r.level === 'error';
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f0f0f5' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.date}</td>
                    <td style={{ padding: '8px 10px' }}>{r.plant}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>{r.product}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', borderRadius: 8, padding: '2px 8px', background: r.type === '재고부족' ? '#ff9500' : err ? '#ff3b30' : '#ff9500' }}>{r.type}</span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#3c3c43' }}>{r.detail}</td>
                    <td style={{ padding: '8px 10px', color: '#86868b', fontSize: 12 }}>{(r.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
