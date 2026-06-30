import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../api';
import { Loading, Empty, useToast } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';

const STEP_ICONS = { done: '✓', active: '●', wait: '–' };
const ALERT_ICO = { error: '🔴', warn: '🟡', ok: '🟢' };

// ── 유틸 ──────────────────────────────────────────────────────────
const fmt = (v) => (v == null ? '–' : Number(v).toLocaleString());
const pct = (v) => (v == null ? '–' : `${Number(v).toFixed(1)}%`);
function deltaColor(now, prev) {
  if (now == null || prev == null) return '#86868b';
  return now >= prev ? 'var(--green,#34c759)' : 'var(--red,#ff3b30)';
}
function rateColor(rate) {
  if (rate == null) return '#1d1d1f';
  if (rate >= 100) return '#34c759';
  if (rate >= 85) return '#ff9500';
  return '#ff3b30';
}

// ── SVG 일별 라인 차트 ────────────────────────────────────────────
function DailyChart({ byProduct, products }) {
  const W = 540, H = 95, PL = 36, PR = 8, PT = 8, PB = 14;
  const iW = W - PL - PR, iH = H - PT - PB;
  const maxQty = Math.max(...products.flatMap((p) => (byProduct[p]?.dailyData || []).map((d) => d.qty || 0)), 1);
  const yLabels = [maxQty, Math.round(maxQty * 0.67), Math.round(maxQty * 0.33), 0];

  function toX(i, len) { return PL + (i / (len - 1)) * iW; }
  function toY(v) { return PT + (1 - v / maxQty) * iH; }
  function points(data) {
    return data.map((d, i) => `${toX(i, data.length)},${toY(d.qty || 0)}`).join(' ');
  }

  const colors = products.map((p) => byProduct[p]?.color || '#ccc');
  const xTicks = [0, 4, 9, 14, 19, 24, 28];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {/* 격자 */}
      {yLabels.map((_, i) => {
        const y = PT + (i / (yLabels.length - 1)) * iH;
        return <line key={i} x1={PL} y1={y} x2={W - PR} y2={y} stroke={i === yLabels.length - 1 ? '#e5e5ea' : '#f0f0f5'} strokeWidth="1" />;
      })}
      {/* Y 라벨 */}
      {yLabels.map((v, i) => (
        <text key={i} x={PL - 3} y={PT + (i / (yLabels.length - 1)) * iH + 3} fontSize="7" fill="#86868b" textAnchor="end">{fmt(v)}</text>
      ))}
      {/* X 라벨 */}
      {xTicks.map((idx) => {
        const data = byProduct[products[0]]?.dailyData || [];
        const label = data[idx] ? data[idx].date.slice(8) : String(idx + 1);
        return <text key={idx} x={toX(idx, data.length || 29)} y={H - 1} fontSize="7" fill="#86868b" textAnchor="middle">{Number(label)}일</text>;
      })}
      {/* 라인 */}
      {products.map((p, pi) => {
        const data = byProduct[p]?.dailyData || [];
        if (!data.length) return null;
        return <polyline key={p} points={points(data)} fill="none" stroke={colors[pi]} strokeWidth="1.8" strokeLinejoin="round" />;
      })}
      {/* 오늘 마커 */}
      {products.map((p, pi) => {
        const data = byProduct[p]?.dailyData || [];
        const last = data[data.length - 1];
        if (!last) return null;
        return <circle key={p} cx={toX(data.length - 1, data.length)} cy={toY(last.qty || 0)} r="3" fill={colors[pi]} />;
      })}
    </svg>
  );
}

// ── SVG 월별 바 차트 (미니) ───────────────────────────────────────
function MonthlyMiniChart({ byProduct, products }) {
  const W = 540, H = 72, PL = 36, PT = 6, PB = 14;
  const iW = W - PL - 8, iH = H - PT - PB;
  const months = 12;
  const allActuals = products.flatMap((p) => (byProduct[p]?.monthlyData || []).map((m) => m.actual || 0));
  const maxV = Math.max(...allActuals, 1);
  const bW = Math.floor(iW / months) - 4;
  const colors = products.map((p) => byProduct[p]?.color || '#ccc');
  const curMonth = new Date().getMonth() + 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <line x1={PL} y1={PT} x2={W - 8} y2={PT} stroke="#f0f0f5" strokeWidth="1" />
      <line x1={PL} y1={PT + iH * 0.5} x2={W - 8} y2={PT + iH * 0.5} stroke="#f0f0f5" strokeWidth="1" />
      <line x1={PL} y1={PT + iH} x2={W - 8} y2={PT + iH} stroke="#e5e5ea" strokeWidth="1" />
      <text x={PL - 3} y={PT + 3} fontSize="7" fill="#86868b" textAnchor="end">{fmt(maxV)}</text>
      <text x={PL - 3} y={PT + iH * 0.5 + 3} fontSize="7" fill="#86868b" textAnchor="end">{fmt(Math.round(maxV / 2))}</text>
      <text x={PL - 3} y={PT + iH + 3} fontSize="7" fill="#86868b" textAnchor="end">0</text>

      {Array.from({ length: months }, (_, mi) => {
        const x0 = PL + (mi / months) * iW + 2;
        const cx = x0 + bW / 2;
        const isCur = mi + 1 === curMonth;
        const isFuture = mi + 1 > curMonth;
        let stackY = PT + iH;

        return (
          <g key={mi}>
            {isCur && <rect x={x0 - 1} y={PT} width={bW + 2} height={iH} fill="#e3f0ff" opacity=".4" rx="2" />}
            {products.map((p, pi) => {
              const md = byProduct[p]?.monthlyData || [];
              const actual = md[mi]?.actual || 0;
              if (!actual) return null;
              const barH = Math.max(2, (actual / maxV) * iH);
              stackY -= barH;
              return (
                <rect key={p} x={x0} y={stackY} width={bW} height={barH}
                  fill={colors[pi]} opacity={isFuture ? 0.25 : 0.9} rx="1"
                  stroke={isFuture ? colors[pi] : 'none'} strokeWidth={isFuture ? 0.8 : 0}
                  strokeDasharray={isFuture ? '2,1.5' : '0'} />
              );
            })}
            <text x={cx} y={H - 2} fontSize="7" fill={isCur ? '#0071e3' : '#86868b'} textAnchor="middle" fontWeight={isCur ? '700' : '400'}>{mi + 1}월</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── 전체 품목 보기 모달 ───────────────────────────────────────────
function AllProductsModal({ data, onClose }) {
  const { byProduct, products } = data;
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const totalToday = products.reduce((s, p) => s + (byProduct[p]?.todayQty || 0), 0);
  const totalMonthActual = products.reduce((s, p) => s + (byProduct[p]?.monthActual || 0), 0);
  const totalMonthPlan = products.reduce((s, p) => s + (byProduct[p]?.monthPlan || 0), 0);
  const totalYearActual = products.reduce((s, p) => s + (byProduct[p]?.yearActual || 0), 0);
  const totalBatch = products.reduce((s, p) => s + (byProduct[p]?.monthBatch || 0), 0);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(94vw,760px)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>📊 품목별 종합 현황</div>
            <div style={{ fontSize: 11, color: '#86868b', marginTop: 2 }}>{data.reportDate} 기준 · 전체 {products.length}개 품목</div>
          </div>
          <button onClick={onClose} style={{ background: '#f0f0f5', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✕ 닫기</button>
        </div>
        {/* 전체 합계 바 */}
        <div style={{ background: '#f5f8ff', borderBottom: '1px solid #e5e5ea', padding: '9px 20px', display: 'flex', gap: 20, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#86868b' }}>전체 합계</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>오늘 <b style={{ color: '#1d1d1f' }}>{fmt(totalToday)} kg</b></span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>6월 실적 <b>{fmt(totalMonthActual)} kg</b> <span style={{ color: rateColor(totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null) }}>{pct(totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null)}</span></span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>연간 실적 <b>{fmt(totalYearActual)} kg</b></span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>이번달 배치 <b>{totalBatch}배치</b></span>
        </div>
        {/* 스크롤 본문 */}
        <div style={{ overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {products.map((p) => {
            const d = byProduct[p];
            if (!d) return null;
            const isWarn = d.monthRate != null && d.monthRate < 85;
            const cols = [
              { label: '오늘 생산량', val: fmt(d.todayQty), unit: 'kg', sub: d.prevDayQty != null ? (d.todayQty >= d.prevDayQty ? `▲ 전일 +${Math.round((d.todayQty - d.prevDayQty) / d.prevDayQty * 100)}%` : `▼ 전일 ${Math.round((d.todayQty - d.prevDayQty) / d.prevDayQty * 100)}%`) : '–', subColor: deltaColor(d.todayQty, d.prevDayQty) },
              { label: '6월 실적', val: fmt(d.monthActual), unit: `kg · 계획 ${fmt(d.monthPlan)}` },
              { label: '6월 달성율', val: pct(d.monthRate), subColor: rateColor(d.monthRate), valColor: rateColor(d.monthRate), sub: d.monthRate >= 100 ? '▲ 달성' : d.monthRate >= 85 ? '△ 진행중' : '▼ 미달' },
              { label: '연간 달성율', val: pct(d.yearRate), valColor: '#0071e3', sub: '연 계획 진행중' },
              { label: '수율', val: pct(d.yield), unit: `목표 ${pct(d.yieldTarget)}`, sub: d.yieldPrev != null ? (d.yield >= d.yieldPrev ? `▲ +${(d.yield - d.yieldPrev).toFixed(1)}%p` : `▼ ${(d.yield - d.yieldPrev).toFixed(1)}%p`) : '', subColor: deltaColor(d.yield, d.yieldPrev) },
            ];
            return (
              <div key={p} style={{ border: `2px solid ${d.color}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: d.color, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, background: 'rgba(255,255,255,.7)', borderRadius: '50%', display: 'inline-block' }} />
                    {p}
                    {isWarn && <span style={{ background: 'rgba(255,60,60,.35)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>⚠ 달성율 미달</span>}
                  </div>
                  <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '2px 9px' }}>월 {d.monthBatch}배치 / 연 {d.yearBatch}배치</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length},1fr)`, background: `${d.color}10` }}>
                  {cols.map((c, ci) => (
                    <div key={ci} style={{ padding: '10px 12px', textAlign: 'center', borderRight: ci < cols.length - 1 ? `1px solid ${d.color}30` : 'none' }}>
                      <div style={{ fontSize: 10, color: '#6e6e73', marginBottom: 4 }}>{c.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: c.valColor || '#1d1d1f' }}>{c.val}</div>
                      <div style={{ fontSize: 10, color: '#86868b', marginTop: 2 }}>{c.unit || ''}</div>
                      {c.sub && <div style={{ fontSize: 10, fontWeight: 600, marginTop: 3, color: c.subColor || '#86868b' }}>{c.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 월별 차트 확대 모달 ───────────────────────────────────────────
function MonthlyExpandModal({ data, onClose }) {
  const { byProduct, products } = data;
  const [hidden, setHidden] = useState({});
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const visProducts = products.filter((p) => !hidden[p]);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const curMonth = new Date().getMonth() + 1;

  const W = 820, H = 240, PL = 52, PT = 16, PB = 20;
  const iW = W - PL - 12, iH = H - PT - PB;
  const allVals = products.flatMap((p) => (byProduct[p]?.monthlyData || []).map((m) => m.actual || 0));
  const maxV = Math.max(...allVals, 1);
  const bSlot = iW / 12;
  const bW = Math.max(6, Math.floor(bSlot * 0.55));

  // 월별 합산 행
  const monthTotals = months.map((m) => ({
    month: m,
    total: products.reduce((s, p) => s + ((byProduct[p]?.monthlyData || [])[m - 1]?.actual || 0), 0),
    plan: products.reduce((s, p) => s + ((byProduct[p]?.monthlyData || [])[m - 1]?.plan || 0), 0),
  }));

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(94vw,900px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e5e5ea', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📅 연간 월별 생산량 추이</div>
            <div style={{ fontSize: 11, color: '#86868b', marginTop: 1 }}>실적(진한색) + 예측(점선) · 현재월 파란 강조</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
              {products.map((p) => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!hidden[p]} onChange={(e) => setHidden((h) => ({ ...h, [p]: !e.target.checked }))} />
                  <span style={{ color: byProduct[p]?.color, fontWeight: 700 }}>{p}</span>
                </label>
              ))}
            </div>
            <button onClick={onClose} style={{ background: '#f0f0f5', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ 닫기</button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 20px' }}>
          {/* 큰 SVG 차트 */}
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
            {[0, 0.33, 0.66, 1].map((r, i) => {
              const y = PT + r * iH;
              return <line key={i} x1={PL} y1={y} x2={W - 12} y2={y} stroke={r === 1 ? '#e5e5ea' : '#f0f0f5'} strokeWidth="1" />;
            })}
            {[0, 0.33, 0.66, 1].map((r, i) => (
              <text key={i} x={PL - 4} y={PT + r * iH + 3} fontSize="9" fill="#86868b" textAnchor="end">{fmt(Math.round(maxV * (1 - r)))}</text>
            ))}
            {months.map((m) => {
              const x0 = PL + ((m - 1) / 12) * iW + (bSlot - bW) / 2;
              const cx = x0 + bW / 2;
              const isCur = m === curMonth;
              const isFuture = m > curMonth;
              let stackY = PT + iH;
              return (
                <g key={m}>
                  {isCur && <rect x={x0 - 2} y={PT} width={bW + 4} height={iH} fill="#e3f0ff" opacity=".5" rx="2" />}
                  {visProducts.map((p) => {
                    const md = (byProduct[p]?.monthlyData || [])[m - 1];
                    const actual = md?.actual || 0;
                    if (!actual) return null;
                    const barH = Math.max(2, (actual / maxV) * iH);
                    stackY -= barH;
                    return (
                      <rect key={p} x={x0} y={stackY} width={bW} height={barH}
                        fill={byProduct[p]?.color} rx="2"
                        opacity={isFuture ? 0.25 : 0.9}
                        stroke={isFuture ? byProduct[p]?.color : 'none'}
                        strokeWidth={isFuture ? 1 : 0}
                        strokeDasharray={isFuture ? '3,2' : '0'} />
                    );
                  })}
                  {!isFuture && monthTotals[m - 1].total > 0 && (
                    <text x={cx} y={stackY - 2} fontSize="8" fill={isCur ? '#0071e3' : '#3c3c43'} textAnchor="middle" fontWeight={isCur ? '700' : '400'}>
                      {fmt(monthTotals[m - 1].total)}
                    </text>
                  )}
                  <text x={cx} y={H - 3} fontSize="9" fill={isCur ? '#0071e3' : '#6e6e73'} textAnchor="middle" fontWeight={isCur ? '700' : '400'}>{m}월</text>
                </g>
              );
            })}
          </svg>

          {/* 월별 요약 테이블 */}
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#fafafd' }}>
                  <th style={{ padding: '5px 10px', borderBottom: '1px solid #e5e5ea', textAlign: 'left', color: '#6e6e73', fontSize: 10 }}>월</th>
                  {products.map((p) => <th key={p} style={{ padding: '5px 10px', borderBottom: '1px solid #e5e5ea', textAlign: 'right', color: byProduct[p]?.color, fontWeight: 700 }}>{p}</th>)}
                  <th style={{ padding: '5px 10px', borderBottom: '1px solid #e5e5ea', textAlign: 'right', fontWeight: 700 }}>합계</th>
                  <th style={{ padding: '5px 10px', borderBottom: '1px solid #e5e5ea', textAlign: 'center' }}>달성율</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const isCur = m === curMonth;
                  const isFuture = m > curMonth;
                  const tot = monthTotals[m - 1];
                  const rate = tot.plan ? tot.total / tot.plan * 100 : null;
                  return (
                    <tr key={m} style={{ background: isCur ? '#eef5ff' : isFuture ? '#fafafa' : 'transparent' }}>
                      <td style={{ padding: '5px 10px', borderBottom: '1px solid #f5f5f7', fontWeight: isCur ? 700 : 400, color: isCur ? '#0071e3' : '#3c3c43' }}>{m}월{isCur ? ' ●' : ''}</td>
                      {products.map((p) => {
                        const md = (byProduct[p]?.monthlyData || [])[m - 1];
                        return <td key={p} style={{ padding: '5px 10px', borderBottom: '1px solid #f5f5f7', textAlign: 'right', color: isFuture ? '#c0c0c5' : '#1d1d1f' }}>{isFuture ? '–' : fmt(md?.actual || 0)}</td>;
                      })}
                      <td style={{ padding: '5px 10px', borderBottom: '1px solid #f5f5f7', textAlign: 'right', fontWeight: 700, color: isCur ? '#0071e3' : '#1d1d1f' }}>{isFuture ? '–' : fmt(tot.total)}</td>
                      <td style={{ padding: '5px 10px', borderBottom: '1px solid #f5f5f7', textAlign: 'center' }}>
                        {!isFuture && rate != null && <span style={{ fontWeight: 700, color: rateColor(rate) }}>{pct(rate)}</span>}
                        {isFuture && <span style={{ color: '#c0c0c5', fontStyle: 'italic', fontSize: 10 }}>예측</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────
export default function ProdDashboard() {
  const { isAdmin, user } = useAuth();
  const isAll = user?.plantScope === 'all';
  const toast = useToast();
  const [plant, setPlant] = useState(isAll ? '1공장' : (user?.plantScope || user?.plant || '2공장'));
  const [data, setData] = useState(null);
  const [source, setSource] = useState('');
  const [mtime, setMtime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selProd, setSelProd] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false, targetPlant) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const p = targetPlant || plant;
      const url = isAll ? `/production/data?plant=${encodeURIComponent(p)}` : '/production/data';
      const res = await api.get(url);
      setData(res.data);
      setSource(res.source || '');
      setMtime(res.mtime || '');
      setSelProd('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [plant, isAll]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), 3600000);
    return () => clearInterval(timerRef.current);
  }, [plant]);

  function switchPlant(p) {
    setPlant(p);
    setData(null);
    setSelProd('');
  }

  if (loading) return <Loading />;
  if (error) return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{error}</div>
      <button className="btn secondary" onClick={() => load()}>다시 시도</button>
    </div>
  );
  if (!data) return null;

  const { products, byProduct, batches, stepLabels, alerts } = data;
  const activeProd = selProd && products.includes(selProd) ? selProd : products[0] || '';
  const cur = byProduct[activeProd];

  const totalToday = products.reduce((s, p) => s + (byProduct[p]?.todayQty || 0), 0);
  const totalMonthActual = products.reduce((s, p) => s + (byProduct[p]?.monthActual || 0), 0);
  const totalMonthPlan = products.reduce((s, p) => s + (byProduct[p]?.monthPlan || 0), 0);
  const totalYearActual = products.reduce((s, p) => s + (byProduct[p]?.yearActual || 0), 0);
  const totalYearPlan = products.reduce((s, p) => s + (byProduct[p]?.yearPlan || 0), 0);

  const mismatches = isAdmin
    ? alerts.filter((a) => a._mismatch)
    : [];

  return (
    <>
      {/* ── 상단 상태바: 파일 · 수정시간 · 수동 갱신 ── */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#86868b' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34c759', display: 'inline-block' }} />
        {source === 'demo' ? '데모 데이터' : source ? `파일: ${source}` : '–'}
        {mtime && <span>· 수정: {mtime.slice(0, 16).replace('T', ' ')}</span>}
        <button className="btn secondary sm" onClick={() => load()} style={{ marginLeft: 'auto' }}>🔄 수동 갱신</button>
      </div>

      {/* ── 공장 탭 (총괄관리자만) ── */}
      {isAll && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {['1공장', '2공장'].map((p) => (
            <button
              key={p}
              onClick={() => switchPlant(p)}
              style={{
                padding: '5px 18px', borderRadius: 20, border: '1.5px solid',
                borderColor: plant === p ? '#0071e3' : '#d1d1d6',
                background: plant === p ? '#0071e3' : '#fff',
                color: plant === p ? '#fff' : '#3c3c43',
                fontWeight: plant === p ? 700 : 400,
                fontSize: 13, cursor: 'pointer',
              }}
            >{p}</button>
          ))}
          {loading && <span style={{ fontSize: 12, color: '#86868b', alignSelf: 'center' }}>로딩 중…</span>}
        </div>
      )}

      {/* ── 관리자 불일치 경고 ── */}
      {isAdmin && mismatches.length > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '7px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠️</span>
          <span style={{ fontSize: 11, color: '#795548', flex: 1 }}>
            <b>[관리자 전용]</b> 종합시트 ↔ 배치탭 불일치 {mismatches.length}건
          </span>
          <span style={{ fontSize: 10, background: '#ff9800', color: '#fff', borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>{mismatches.length}건</span>
        </div>
      )}

      {/* ── 최상단: 품목 탭 KPI + 재고 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 12, marginBottom: 12 }}>

        {/* 좌: KPI */}
        <div className="card">
          <div style={{ padding: '10px 14px 0' }}>
            {/* 전체 합계 + 전체보기 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#86868b' }}>
                전체 합계 — 오늘: <b>{fmt(totalToday)} kg</b> · 6월: <b>{fmt(totalMonthActual)} kg</b> / <b style={{ color: rateColor(totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null) }}>{pct(totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null)}</b> · 연간: <b>{fmt(totalYearActual)} kg</b> / <b style={{ color: '#0071e3' }}>{pct(totalYearPlan ? totalYearActual / totalYearPlan * 100 : null)}</b>
              </div>
              <button onClick={() => setShowAll(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0071e3', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="#0071e3" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="#0071e3" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="#0071e3" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="#0071e3" strokeWidth="1.5"/></svg>
                전체 보기
              </button>
            </div>
            {/* 품목 탭 */}
            <div style={{ display: 'flex', gap: 6 }}>
              {products.map((p) => {
                const c = byProduct[p]?.color || '#ccc';
                const active = activeProd === p;
                return (
                  <button key={p} onClick={() => setSelProd(p)} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                    borderRadius: 20, border: `2px solid ${active ? c : '#e5e5ea'}`,
                    background: active ? c : '#fff', color: active ? '#fff' : '#6e6e73',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>
                    <span style={{ width: 7, height: 7, background: active ? 'rgba(255,255,255,.8)' : c, borderRadius: '50%', display: 'inline-block' }} />
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* KPI 5개 */}
          {cur && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 0, padding: '10px 10px 12px' }}>
              {[
                { label: '오늘 생산량', val: fmt(cur.todayQty), unit: 'kg', sub: cur.prevDayQty != null ? `${cur.todayQty >= cur.prevDayQty ? '▲' : '▼'} 전일 ${cur.todayQty >= cur.prevDayQty ? '+' : ''}${Math.round((cur.todayQty - cur.prevDayQty) / (cur.prevDayQty || 1) * 100)}%` : '–', subColor: deltaColor(cur.todayQty, cur.prevDayQty), valColor: cur.color },
                { label: '6월 실적', val: fmt(cur.monthActual), unit: 'kg', sub: `계획 ${fmt(cur.monthPlan)}` },
                { label: '6월 달성율', val: pct(cur.monthRate), sub: cur.monthRate >= 100 ? '▲ 목표 초과' : cur.monthRate >= 85 ? '△ 진행중' : '▼ 목표 미달', subColor: rateColor(cur.monthRate), valColor: rateColor(cur.monthRate) },
                { label: '연간 달성율', val: pct(cur.yearRate), valColor: '#0071e3', sub: '연 계획 진행중' },
                { label: 'Batch 수', val: String(cur.monthBatch ?? '–'), unit: '이번달', sub: `연 ${cur.yearBatch ?? '–'}배치` },
              ].map((k, i) => (
                <div key={i} style={{ background: '#fafafd', borderRadius: 8, padding: '10px 8px', textAlign: 'center', margin: 2, border: '1px solid #f0f0f5' }}>
                  <div style={{ fontSize: 10, color: '#86868b', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: k.valColor || '#1d1d1f' }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: '#86868b', marginTop: 2 }}>{k.unit || ''}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, marginTop: 3, color: k.subColor || '#86868b' }}>{k.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우: 재고 현황 */}
        <div className="card">
          <div className="card-head"><h3>📦 재고 현황 (can)</h3><span style={{ fontSize: 10, color: '#86868b' }}>6월 기준</span></div>
          <div style={{ padding: '6px 0' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', padding: '4px 14px', fontSize: 10, color: '#86868b' }}>
              <div style={{ width: 64 }} />
              {['이월', '충진', '출하', '잔량'].map((h) => <div key={h} style={{ flex: 1, textAlign: 'center' }}>{h}</div>)}
            </div>
            {products.map((p) => {
              const inv = byProduct[p]?.inventory || {};
              const c = byProduct[p]?.color || '#ccc';
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid #f5f5f7' }}>
                  <div style={{ width: 64, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: c }}>
                    <span style={{ width: 8, height: 8, background: c, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />{p}
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#86868b' }}>{inv.carryOver || '–'}</div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#34c759' }}>{inv.filled || '–'}</div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#ff9500' }}>{inv.shipped || '–'}</div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#0071e3' }}>{inv.total || '–'}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 중단: 차트 + 달성테이블 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* 일별+월별 차트 */}
        <div className="card">
          <div className="card-head">
            <h3>📈 생산 추이</h3>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, alignItems: 'center' }}>
              {products.map((p) => (
                <span key={p}><span style={{ display: 'inline-block', width: 12, height: 2, background: byProduct[p]?.color, verticalAlign: 'middle', marginRight: 3, borderRadius: 2 }} />{p}</span>
              ))}
            </div>
          </div>
          <div style={{ padding: '8px 14px 4px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#3c3c43', marginBottom: 4 }}>6월 일별 (kg)</div>
            <DailyChart byProduct={byProduct} products={products} />
          </div>
          <div style={{ borderTop: '1px dashed #e5e5ea', margin: '0 14px' }} />
          <div style={{ padding: '8px 14px 10px', cursor: 'pointer' }} onClick={() => setShowMonthly(true)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3c3c43' }}>연간 월별 (kg)</div>
              <div style={{ fontSize: 10, color: '#0071e3', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 3h4V1H1v6h2V3zm10 0v4h2V1h-6v2h4zM3 13H1v6h6v-2H3v-4zm10 4h-4v2h6v-6h-2v4z" fill="#0071e3"/></svg>
                확대 보기
              </div>
            </div>
            <MonthlyMiniChart byProduct={byProduct} products={products} />
            <div style={{ fontSize: 9, color: '#86868b', marginTop: 2 }}>■ 실적 &nbsp;■ 예측(점선, 미래월)</div>
          </div>
        </div>

        {/* 달성 현황 테이블 */}
        <div className="card">
          <div className="card-head"><h3>🎯 품목별 계획 달성 현황</h3></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: '#fafafd' }}>
                {['품목', '일생산', '6월계획', '6월실적', '6월%', '연%', 'Batch(월/연)'].map((h) => (
                  <th key={h} style={{ padding: '5px 8px', borderBottom: '1px solid #e5e5ea', color: '#6e6e73', fontSize: 10, fontWeight: 600, textAlign: h === '품목' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const d = byProduct[p];
                return (
                  <tr key={p}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f5f5f7' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, background: d?.color, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                        <b style={{ color: d?.color }}>{p}</b>
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f5f5f7', textAlign: 'center' }}>{fmt(d?.todayQty)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f5f5f7', textAlign: 'center' }}>{fmt(d?.monthPlan)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f5f5f7', textAlign: 'center', fontWeight: 600 }}>{fmt(d?.monthActual)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f5f5f7', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: rateColor(d?.monthRate) }}>{pct(d?.monthRate)}</div>
                      <div style={{ height: 4, background: '#f0f0f5', borderRadius: 3, marginTop: 3 }}>
                        <div style={{ height: 4, borderRadius: 3, background: d?.color, width: `${Math.min(100, d?.monthRate || 0)}%` }} />
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f5f5f7', textAlign: 'center', fontWeight: 700, color: '#0071e3' }}>{pct(d?.yearRate)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f5f5f7', textAlign: 'center', color: '#6e6e73' }}>{d?.monthBatch ?? '–'} / {d?.yearBatch ?? '–'}</td>
                  </tr>
                );
              })}
              {/* 합계 행 */}
              <tr style={{ background: '#f8f8fb' }}>
                <td colSpan={3} style={{ padding: '5px 8px', fontWeight: 700, color: '#6e6e73', fontSize: 10.5 }}>합계</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: 10.5 }}>{fmt(totalMonthActual)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: 10.5 }}>{pct(totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: 10.5, color: '#0071e3' }}>{pct(totalYearPlan ? totalYearActual / totalYearPlan * 100 : null)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: 10.5 }}>
                  {products.reduce((s, p) => s + (byProduct[p]?.monthBatch || 0), 0)} / {products.reduce((s, p) => s + (byProduct[p]?.yearBatch || 0), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 하단 3열 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

        {/* 배치 타임라인 */}
        <div className="card">
          <div className="card-head">
            <h3>🔧 현재 배치 진행</h3>
            <span style={{ background: '#e3f0ff', color: '#0055b3', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>
              {batches.filter((b) => b.steps.includes('active')).length} 진행중
            </span>
          </div>
          <div style={{ padding: '8px 14px' }}>
            {/* 스텝 라벨 헤더 */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 6, paddingLeft: 44, fontSize: 9, color: '#86868b' }}>
              {(stepLabels || []).map((s) => <div key={s} style={{ flex: 1, textAlign: 'center' }}>{s}</div>)}
            </div>
            {batches.length === 0 ? <div style={{ textAlign: 'center', color: '#86868b', padding: 16, fontSize: 12 }}>진행 중인 배치가 없습니다.</div> : batches.map((b) => {
              const c = byProduct[b.product]?.color || '#ccc';
              return (
                <div key={b.no} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, width: 40, flexShrink: 0, lineHeight: 1.3, color: c }}>{b.no}<br /><span style={{ fontWeight: 400, color: '#86868b', fontSize: 9 }}>{b.product}</span></div>
                  <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                    {b.steps.map((s, si) => (
                      <div key={si} style={{
                        flex: 1, padding: '3px 0', borderRadius: 4, fontSize: 9, textAlign: 'center', border: '1px solid transparent',
                        background: s === 'done' ? '#e8f8ed' : s === 'active' ? '#e3f0ff' : '#f5f5f7',
                        borderColor: s === 'done' ? '#a8e6bc' : s === 'active' ? '#7bb8f5' : '#ebebf0',
                        color: s === 'done' ? '#1a7f3c' : s === 'active' ? '#0055b3' : '#c0c0c5',
                        fontWeight: s === 'active' ? 700 : 400,
                      }}>{STEP_ICONS[s]}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 수율 트래킹 */}
        <div className="card">
          <div className="card-head"><h3>📊 수율 트래킹 (6월)</h3></div>
          <div style={{ padding: '8px 14px' }}>
            {products.map((p) => {
              const d = byProduct[p];
              if (!d) return null;
              const fillPct = Math.min(100, (d.yield / Math.max(d.yieldTarget || 1, d.yield || 1)) * 100);
              const targetPct = Math.min(100, (d.yieldTarget / Math.max(d.yieldTarget || 1, d.yield || 1)) * 100);
              const ok = d.yield >= (d.yieldTarget || 0);
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f5f5f7' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, width: 50, color: d.color }}>{p}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, width: 46, textAlign: 'right', color: ok ? '#1d1d1f' : '#ff3b30' }}>{pct(d.yield)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ background: '#f0f0f5', borderRadius: 5, height: 8, position: 'relative' }}>
                      <div style={{ height: 8, borderRadius: 5, background: d.color, width: `${fillPct}%` }} />
                      <div style={{ position: 'absolute', top: -2, height: 12, width: 2, background: '#ff3b30', borderRadius: 1, left: `${targetPct}%` }} />
                    </div>
                    <div style={{ fontSize: 9, color: ok ? '#86868b' : '#ff3b30', marginTop: 2 }}>목표 {pct(d.yieldTarget)}{ok ? ' ✓' : ' 미달'}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, width: 36, textAlign: 'right', color: deltaColor(d.yield, d.yieldPrev) }}>
                    {d.yieldPrev != null ? `${d.yield >= d.yieldPrev ? '▲' : '▼'}${Math.abs(d.yield - d.yieldPrev).toFixed(1)}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 수율 이상 알림 */}
        <div className="card">
          <div className="card-head">
            <h3>⚠️ 수율 이상 알림</h3>
            <span style={{ background: '#ffe8e8', color: '#c0001a', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>
              {alerts.filter((a) => a.level !== 'ok').length}건
            </span>
          </div>
          <div style={{ padding: '4px 14px' }}>
            {alerts.length === 0 ? <div style={{ textAlign: 'center', color: '#86868b', padding: 16, fontSize: 12 }}>이상 알림이 없습니다.</div>
              : alerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f5f5f7' }}>
                  <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>{ALERT_ICO[a.level] || '🔵'}</span>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600 }}>{a.product} — {a.batchNo} 수율 {pct(a.yield)}</div>
                    <div style={{ fontSize: 10, color: '#86868b', marginTop: 1 }}>
                      기준 {pct(a.target)}{a.level === 'ok' ? ' 우수' : a.level === 'error' ? ' 미달' : ' 근접'} · {a.date}{a.step ? ` · ${a.step}` : ''}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── 모달 ── */}
      {showAll && <AllProductsModal data={data} onClose={() => setShowAll(false)} />}
      {showMonthly && <MonthlyExpandModal data={data} onClose={() => setShowMonthly(false)} />}
    </>
  );
}
