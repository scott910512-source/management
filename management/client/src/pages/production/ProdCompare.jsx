import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { Loading } from '../../components/ui';

const fmt = (v) => (v == null ? '–' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const pct = (v) => (v == null ? '–' : `${Number(v).toFixed(1)}%`);
function rateColor(r) { if (r == null) return '#1d1d1f'; if (r >= 100) return '#34c759'; if (r >= 85) return '#ff9500'; return '#ff3b30'; }

function summarize(data) {
  const { products, byProduct } = data;
  const totalMonthActual = products.reduce((s, p) => s + (byProduct[p]?.monthActual || 0), 0);
  const totalMonthPlan = products.reduce((s, p) => s + (byProduct[p]?.monthPlan || 0), 0);
  const totalYearActual = products.reduce((s, p) => s + (byProduct[p]?.yearActual || 0), 0);
  let warn = 0;
  for (const p of products) {
    const d = byProduct[p]; if (!d) continue;
    if (d.yield != null && d.yieldTarget != null && d.yield < d.yieldTarget) warn++;
    if (d.inventory?.belowSafety) warn++;
  }
  return { totalMonthActual, totalMonthPlan, totalYearActual, rate: totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null, warn };
}

function PlantColumn({ plant, entry }) {
  if (entry.error) {
    return (
      <div className="card card-pad">
        <h3 style={{ marginBottom: 8 }}>🏭 {plant}</h3>
        <div style={{ color: '#ff3b30', fontSize: 13 }}>데이터 없음: {entry.error}</div>
      </div>
    );
  }
  const { data } = entry;
  const sm = summarize(data);
  return (
    <div className="card">
      <div className="card-head"><h3>🏭 {plant}</h3><span style={{ fontSize: 11, color: '#86868b' }}>기준일 {data.reportDate || '–'}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '8px 14px' }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: '#86868b' }}>당월 실적</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(sm.totalMonthActual)}</div><div style={{ fontSize: 9, color: '#86868b' }}>kg</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: '#86868b' }}>평균 달성율</div><div style={{ fontSize: 18, fontWeight: 800, color: rateColor(sm.rate) }}>{pct(sm.rate)}</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: '#86868b' }}>경고</div><div style={{ fontSize: 18, fontWeight: 800, color: sm.warn ? '#ff9500' : '#34c759' }}>{sm.warn}건</div></div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: '#fafafd', color: '#6e6e73', fontSize: 11 }}>
            <th style={{ textAlign: 'left', padding: '6px 10px' }}>품목</th>
            <th style={{ textAlign: 'right', padding: '6px 10px' }}>실적</th>
            <th style={{ textAlign: 'right', padding: '6px 10px' }}>달성율</th>
            <th style={{ textAlign: 'right', padding: '6px 10px' }}>수율</th>
          </tr>
        </thead>
        <tbody>
          {data.products.map((p) => {
            const d = data.byProduct[p] || {};
            return (
              <tr key={p} style={{ borderTop: '1px solid #f5f5f7' }}>
                <td style={{ padding: '6px 10px' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: d.color || '#ccc', marginRight: 6 }} /><b>{p}</b></td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(d.monthActual)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: rateColor(d.monthRate) }}>{pct(d.monthRate)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{pct(d.yield)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ProdCompare() {
  const { isSuper, plants: allowedPlants } = useAuth();
  const [entries, setEntries] = useState(null);
  // 비활성화된 공장은 자동 제외됨 (allowedPlants = useAuth().plants)
  const plants = (allowedPlants || []).filter((p) => p !== 'demo');

  useEffect(() => {
    if (!isSuper || !plants.length) return;
    (async () => {
      const out = {};
      for (const pl of plants) {
        try { const r = await api.get(`/production/data?plant=${encodeURIComponent(pl)}`); out[pl] = { data: r.data }; }
        catch (e) { out[pl] = { error: e.message }; }
      }
      setEntries(out);
    })();
  }, [isSuper, plants.join(',')]);

  if (!isSuper) return <div className="card card-pad" style={{ textAlign: 'center', padding: 40, color: '#86868b' }}>총괄관리자만 접근할 수 있습니다.</div>;
  if (entries == null) return <Loading />;

  const valid = plants.filter((p) => entries[p] && !entries[p].error);
  const combinedActual = valid.reduce((s, p) => s + summarize(entries[p].data).totalMonthActual, 0);
  const combinedWarn = valid.reduce((s, p) => s + summarize(entries[p].data).warn, 0);

  return (
    <>
      <div className="page-head"><div className="desc">ManagePilot — 1공장 · 2공장 통합 현황 비교</div></div>

      <div className="card card-pad" style={{ marginBottom: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 11, color: '#86868b' }}>통합 당월 실적</div><div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(combinedActual)} <span style={{ fontSize: 13, color: '#86868b' }}>kg</span></div></div>
        <div><div style={{ fontSize: 11, color: '#86868b' }}>대상 공장</div><div style={{ fontSize: 22, fontWeight: 800 }}>{valid.length}개</div></div>
        <div><div style={{ fontSize: 11, color: '#86868b' }}>경고 합계</div><div style={{ fontSize: 22, fontWeight: 800, color: combinedWarn ? '#ff9500' : '#34c759' }}>{combinedWarn}건</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, plants.length)}, 1fr)`, gap: 12 }}>
        {plants.map((p) => <PlantColumn key={p} plant={p} entry={entries[p]} />)}
      </div>
    </>
  );
}
