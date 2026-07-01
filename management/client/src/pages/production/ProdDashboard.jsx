import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../api';
import { Loading, Empty, useToast } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { buildReportHtml, downloadHtml } from './report';

const STEP_ICONS = { done: '✓', active: '●', wait: '–' };
const ALERT_ICO = { error: '🔴', warn: '🟡', ok: '🟢' };

// ── 유틸 ──────────────────────────────────────────────────────────
// 숫자는 소수점 1자리 (Can 수량 등 정수는 별도 fmtInt 사용)
const fmt = (v) => (v == null ? '–' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const fmtInt = (v) => (v == null ? '–' : Number(v).toLocaleString());
const pct = (v) => (v == null ? '–' : `${Number(v).toFixed(1)}%`);

// 계획달성 표에 표시 가능한 컬럼 (관리자 설정에서 선택). mRate는 특수 렌더.
// 라벨의 ${MON} 은 데이터 기준월(예: 7월)로 치환된다.
export const PROD_TABLE_COLS = [
  { key: 'today', label: '일생산' },
  { key: 'mPlan', label: '${MON}계획' },
  { key: 'mAct', label: '${MON}실적' },
  { key: 'mRate', label: '${MON} 달성율' },
  { key: 'cumRate', label: '연 생산 달성율' },
  { key: 'batch', label: 'Batch(월/년)' },
  { key: 'yieldM', label: '수율(월)' },
  { key: 'yieldY', label: '수율(년)' },
];
// reportDate("7월29일" 등) → "7월". 없으면 "당월".
export function monthLabel(reportDate) {
  const m = String(reportDate || '').match(/(\d{1,2})\s*월/);
  return m ? `${parseInt(m[1], 10)}월` : '당월';
}
export function colLabel(label, mon) { return String(label).replace('${MON}', mon); }
function colValue(key, d) {
  switch (key) {
    case 'today': return fmt(d.todayQty);
    case 'mPlan': return fmt(d.monthPlan);
    case 'mAct': return fmt(d.monthActual);
    case 'cumRate': return pct(d.yearRate);
    case 'batch': return `${d.monthBatch ?? '–'} / ${d.yearBatch ?? '–'}`;
    case 'yieldM': return pct(d.yield);
    case 'yieldY': return pct(d.yearYield);
    default: return '';
  }
}

// 수율 셀: "74.2% (-2.2%p)" 표기, 클릭 시 "목표 78.7% 미달" 노출
function YieldCell({ actual, target }) {
  const [open, setOpen] = useState(false);
  if (actual == null) return <span style={{ color: '#c7c7cc' }}>–</span>;
  const delta = target != null ? actual - target : null;
  const ok = delta == null || delta >= 0;
  return (
    <div onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} style={{ cursor: target != null ? 'pointer' : 'default' }} title="클릭: 목표 대비 상세">
      <div style={{ whiteSpace: 'nowrap' }}>
        <b style={{ fontSize: 14, color: ok ? '#1d1d1f' : '#ff3b30' }}>{Number(actual).toFixed(1)}%</b>
        {delta != null && <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 4, color: ok ? '#34c759' : '#ff3b30' }}>({delta >= 0 ? '+' : ''}{delta.toFixed(1)}%p)</span>}
      </div>
      {open && target != null && (
        <div style={{ fontSize: 10, marginTop: 2, color: ok ? '#86868b' : '#ff3b30' }}>목표 {Number(target).toFixed(1)}% {ok ? '달성' : '미달'}</div>
      )}
    </div>
  );
}

// 최상단 요약 카드
function SummaryCard({ icon, label, value, unit, sub, color, valueSize = 25 }) {
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f4ff', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: '#86868b', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: valueSize, fontWeight: 800, lineHeight: 1.05, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}{unit && <span style={{ fontSize: 13, fontWeight: 600, color: '#86868b', marginLeft: 3 }}>{unit}</span>}
        </div>
        <div style={{ fontSize: 10.5, color: '#86868b', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
    </div>
  );
}
// 최상단 롤링 경고 배너 (StockPilot 경고창 형식) — 알림을 일정 간격으로 순환 표시
function RollingAlerts({ alerts }) {
  const items = (alerts || []).filter((a) => a.level && a.level !== 'ok');
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return undefined;
    const id = setInterval(() => setI((v) => (v + 1) % items.length), 4000);
    return () => clearInterval(id);
  }, [items.length]);
  if (!items.length) return null;
  const a = items[i % items.length];
  const err = a.level === 'error';
  const text = a.msg
    ? a.msg
    : `${a.product} — ${a.batchNo} 수율 ${a.yield != null ? `${Number(a.yield).toFixed(1)}%` : '–'} (기준 ${a.target != null ? `${Number(a.target).toFixed(1)}%` : '–'})${a.step ? ` · ${a.step}` : ''}${a.date ? ` · ${a.date}` : ''}`;
  return (
    <div style={{
      background: err ? '#ffe8e8' : '#fff8e1', border: `1px solid ${err ? '#ffb3b3' : '#ffe082'}`,
      borderRadius: 8, padding: '9px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 15 }}>{err ? '🔴' : '🟡'}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: err ? '#c0001a' : '#795548', flex: 1 }}>{text}</span>
      <span style={{ fontSize: 11, color: err ? '#c0001a' : '#795548', opacity: 0.7 }}>{(i % items.length) + 1}/{items.length}</span>
    </div>
  );
}

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

// ── 월별 내역 표 모달 (품목 × 월) ─────────────────────────────────
function MonthlyMatrixModal({ byProduct, products, mode, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const cell = (p, m) => {
    const md = byProduct[p]?.monthlyData?.[m - 1];
    const v = md ? (mode === 'yield' ? md.yield : md.actual) : null;
    if (v == null || v < 10) return '–';
    return mode === 'yield' ? `${Number(v).toFixed(1)}%` : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
  };
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 'min(94vw,820px)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e5ea' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{mode === 'yield' ? '월별 수율 내역 (%)' : '월별 생산량 내역 (kg)'}</div>
          <button onClick={onClose} style={{ background: '#f0f0f5', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✕ 닫기</button>
        </div>
        <div style={{ overflow: 'auto', padding: '8px 16px 16px' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#fafafd', padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e5ea' }}>품목</th>
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i} style={{ padding: '8px 8px', textAlign: 'right', borderBottom: '1px solid #e5e5ea', color: '#6e6e73', fontWeight: 600 }}>{i + 1}월</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '7px 10px', fontWeight: 700, borderBottom: '1px solid #f5f5f7', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: byProduct[p]?.color || '#ccc', marginRight: 6 }} />{p}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => (
                    <td key={i} style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #f5f5f7', color: '#1d1d1f' }}>{cell(p, i + 1)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── SVG 월별 선 차트 (생산량 또는 수율) ───────────────────────────
// mode='prod': 품목별 + 총생산량 선, Y max = 총합×1.1
// mode='yield': 품목별 수율 선(%), Y max = max(100, 최대수율×1.1)
// 0/빈값은 점/선을 그리지 않고 공백으로 끊는다. 미래월은 회색 처리.
function MonthlyLineChart({ byProduct, products, currentMonth, mode }) {
  const W = 560, H = 250, PL = 46, PR = 64, PT = 16, PB = 26;
  const iW = W - PL - PR, iH = H - PT - PB;
  const M = 12;
  const cur = currentMonth || 12;

  // 10% 미만(및 음수/오류값)은 0과 동일하게 공백 처리
  const val = (p, m) => {
    const md = byProduct[p]?.monthlyData?.[m - 1];
    if (!md) return null;
    const v = mode === 'yield' ? md.yield : md.actual;
    return (v == null || v < 10) ? null : v;
  };
  const totals = Array.from({ length: M }, (_, i) => {
    let s = 0, has = false;
    for (const p of products) { const v = val(p, i + 1); if (v != null) { s += v; has = true; } }
    return has ? s : null;
  });
  let maxV;
  if (mode === 'yield') {
    const mx = Math.max(0, ...products.flatMap((p) => Array.from({ length: M }, (_, i) => val(p, i + 1) || 0)));
    maxV = Math.max(100, Math.ceil(mx * 1.1));
  } else {
    maxV = Math.max(1, ...totals.map((t) => t || 0)) * 1.1;
  }
  const toX = (m) => PL + ((m - 1) / (M - 1)) * iW;
  const toY = (v) => PT + (1 - v / maxV) * iH;

  const segsOf = (getter) => {
    const segs = []; let curSeg = [];
    for (let m = 1; m <= M; m++) {
      const v = getter(m);
      if (v != null) curSeg.push([toX(m), toY(v), m, v]);
      else { if (curSeg.length) segs.push(curSeg); curSeg = []; }
    }
    if (curSeg.length) segs.push(curSeg);
    return segs;
  };

  const series = products.map((p) => ({ key: p, color: byProduct[p]?.color || '#888', segs: segsOf((m) => val(p, m)) }));
  if (mode === 'prod') series.push({ key: '총 생산량', color: '#3c3c43', total: true, segs: segsOf((m) => totals[m - 1]) });

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxV * f));
  const futureX = cur < M ? toX(cur) + (iW / (M - 1)) / 2 : null;
  const fmtLabel = (v) => (mode === 'yield' ? `${Number(v).toFixed(1)}%` : Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* 미래월 회색 영역 */}
      {futureX != null && (
        <>
          <rect x={futureX} y={PT} width={W - PR - futureX} height={iH} fill="#f5f5f7" />
          <text x={(futureX + (W - PR)) / 2} y={PT + iH / 2} fontSize="9" fill="#b0b0b8" textAnchor="middle">데이터 없음</text>
        </>
      )}
      {/* 격자 + Y라벨 */}
      {yTicks.map((t, i) => {
        const y = toY(t);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={i === 0 ? '#e5e5ea' : '#f0f0f5'} strokeWidth="1" />
            <text x={PL - 5} y={y + 3} fontSize="8" fill="#86868b" textAnchor="end">{t.toLocaleString()}</text>
          </g>
        );
      })}
      {/* X라벨 */}
      {Array.from({ length: M }, (_, i) => (
        <text key={i} x={toX(i + 1)} y={H - 8} fontSize="8" fill="#86868b" textAnchor="middle">{i + 1}월</text>
      ))}
      {/* 선 + 점 */}
      {series.map((s) => (
        <g key={s.key}>
          {s.segs.map((seg, si) => (
            <g key={si}>
              {seg.length >= 2 && <polyline points={seg.map((pt) => `${pt[0]},${pt[1]}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.total ? 2.6 : 1.8} strokeLinejoin="round" strokeLinecap="round" />}
              {seg.map((pt, pi) => <circle key={pi} cx={pt[0]} cy={pt[1]} r={s.total ? 3 : 2.4} fill={s.color} />)}
            </g>
          ))}
        </g>
      ))}
      {/* 끝값 라벨 — 세로 겹침 회피 */}
      {(() => {
        const labels = series.map((s) => {
          const lastSeg = s.segs[s.segs.length - 1];
          if (!lastSeg) return null;
          const last = lastSeg[lastSeg.length - 1];
          return { x: last[0], origY: last[1], y: last[1], color: s.color, text: fmtLabel(last[3]) };
        }).filter(Boolean).sort((a, b) => a.origY - b.origY);
        const GAP = 15;
        for (let i = 1; i < labels.length; i++) {
          if (labels[i].y - labels[i - 1].y < GAP) labels[i].y = labels[i - 1].y + GAP;
        }
        // 차트 영역 내로 클램프 (아래 초과 시 위로 되밀기)
        const bottom = PT + iH;
        for (let i = labels.length - 1; i >= 0; i--) {
          if (labels[i].y > bottom - 2) labels[i].y = bottom - 2;
          if (i < labels.length - 1 && labels[i + 1].y - labels[i].y < GAP) labels[i].y = labels[i + 1].y - GAP;
          if (labels[i].y < PT + 6) labels[i].y = PT + 6;
        }
        return labels.map((L, i) => (
          <g key={i}>
            {Math.abs(L.y - L.origY) > 1 && <line x1={L.x} y1={L.origY} x2={L.x + 5} y2={L.y} stroke={L.color} strokeWidth="0.8" opacity="0.5" />}
            <rect x={L.x + 5} y={L.y - 8} width={52} height={16} rx={3} fill={L.color} />
            <text x={L.x + 31} y={L.y + 3.5} fontSize="9" fontWeight="700" fill="#fff" textAnchor="middle">{L.text}</text>
          </g>
        ));
      })()}
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
  const mon = monthLabel(data.reportDate);
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
          <span style={{ fontSize: 12, fontWeight: 700 }}>{mon} 실적 <b>{fmt(totalMonthActual)} kg</b> <span style={{ color: rateColor(totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null) }}>{pct(totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null)}</span></span>
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
              { label: `${mon} 실적`, val: fmt(d.monthActual), unit: `kg · 계획 ${fmt(d.monthPlan)}` },
              { label: `${mon} 달성율`, val: pct(d.monthRate), subColor: rateColor(d.monthRate), valColor: rateColor(d.monthRate), sub: d.monthRate >= 100 ? '▲ 달성' : d.monthRate >= 85 ? '△ 진행중' : '▼ 미달' },
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
  const [matrixMode, setMatrixMode] = useState(null);  // 'prod' | 'yield' | null
  const [month, setMonth] = useState(null);  // null=최신, 숫자=해당월 스냅샷
  const timerRef = useRef(null);

  const load = useCallback(async (silent = false, targetPlant, targetMonth) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const p = targetPlant || plant;
      const mo = targetMonth !== undefined ? targetMonth : month;
      const params = [];
      if (isAll) params.push(`plant=${encodeURIComponent(p)}`);
      if (mo != null) params.push(`month=${mo}`);
      const url = '/production/data' + (params.length ? `?${params.join('&')}` : '');
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
  }, [plant, isAll, month]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), 3600000);
    return () => clearInterval(timerRef.current);
  }, [plant, month]);

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

  // 전월 대비 증감(%) — batch-yield 월별 생산량 기준
  const curMonthNum = parseInt((String(data.reportDate || '').match(/(\d{1,2})\s*월/) || [])[1], 10) || null;
  const momDelta = (p) => {
    if (!curMonthNum || curMonthNum < 2) return null;
    const md = byProduct[p]?.monthlyData || [];
    const c = md[curMonthNum - 1]?.actual, pv = md[curMonthNum - 2]?.actual;
    if (c == null || pv == null || pv <= 0 || c < 10 || pv < 10) return null;
    return (c - pv) / pv * 100;
  };

  const mismatches = isAdmin
    ? alerts.filter((a) => a._mismatch)
    : [];

  return (
    <>
      {/* ── 최상단: 롤링 경고 배너 (수율 미달·재고 부족 실시간 집계) ── */}
      {(() => {
        const live = [];
        for (const p of products) {
          const d = byProduct[p];
          if (!d) continue;
          if (d.yield != null && d.yieldTarget != null && d.yield < d.yieldTarget) {
            const gap = d.yieldTarget - d.yield;
            live.push({ level: gap >= 5 ? 'error' : 'warn', msg: `${p} 수율 ${d.yield.toFixed(1)}% — 목표 ${d.yieldTarget.toFixed(1)}% 대비 -${gap.toFixed(1)}%p` });
          }
          const inv = d.inventory;
          if (inv && inv.belowSafety && inv.remainingMonths != null) {
            live.push({ level: 'warn', msg: `${p} 재고 잔여 ${inv.remainingMonths.toFixed(1)}개월 — 안전재고(${inv.safetyMonths}개월) 미만` });
          }
        }
        return <RollingAlerts alerts={live.length ? live : alerts} />;
      })()}

      {/* ── 상단 상태바: 기준일 · 파일 · 수동 갱신 ── */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34c759', display: 'inline-block' }} />
        <span style={{ fontWeight: 700, color: '#1d1d1f' }}>📅 기준일 {data.reportDate || (mtime ? mtime.slice(0, 10) : '–')}</span>
        <span style={{ color: '#86868b' }}>· CSV 갱신 {mtime ? mtime.slice(0, 16).replace('T', ' ') : '–'}</span>
        <span style={{ color: '#86868b' }}>· {source === 'demo' ? '데모 데이터' : source || '–'}</span>
        {(data.availableMonths || []).length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
            <span style={{ color: '#86868b' }}>기준월</span>
            <select value={month == null ? '' : month} onChange={(e) => setMonth(e.target.value === '' ? null : parseInt(e.target.value, 10))}
              style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid #d1d1d6', cursor: 'pointer' }}>
              <option value="">최신</option>
              {data.availableMonths.map((m) => <option key={m} value={m}>{m}월 말</option>)}
            </select>
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn secondary sm" onClick={() => {
            const html = buildReportHtml({ title: `${plant} 생산현황 보고서`, subtitle: `기준일 ${data.reportDate || ''}`, plants: [{ plant, data, mtime }] });
            downloadHtml(`ManagePilot_${plant}_보고서.html`, html);
          }}>📄 보고서</button>
          {isAll && (
            <button className="btn secondary sm" onClick={async () => {
              try {
                const got = [];
                for (const pl of ['1공장', '2공장']) {
                  try { const r = await api.get(`/production/data?plant=${encodeURIComponent(pl)}`); got.push({ plant: pl, data: r.data, mtime: r.mtime }); } catch { /* 해당 공장 데이터 없음 → 건너뜀 */ }
                }
                if (!got.length) { toast.err('통합 보고서를 만들 데이터가 없습니다.'); return; }
                const html = buildReportHtml({ title: '통합 생산현황 보고서', subtitle: got.map((g) => g.plant).join(' + '), plants: got });
                downloadHtml('ManagePilot_통합_보고서.html', html);
              } catch (e) { toast.err(e.message); }
            }}>📑 통합 보고서</button>
          )}
          <button className="btn secondary sm" onClick={() => load()}>🔄 수동 갱신</button>
        </span>
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

      {/* ── 최상단 요약 카드 (공장별) ── */}
      {(() => {
        const rates = products.map((p) => byProduct[p]?.monthRate).filter((v) => v != null);
        const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
        let yieldWarn = null;
        for (const p of products) {
          const d = byProduct[p];
          if (!d || d.yield == null || d.yieldTarget == null) continue;
          const gap = d.yieldTarget - d.yield;
          if (gap > 0 && (!yieldWarn || gap > yieldWarn.gap)) yieldWarn = { p, gap };
        }
        let invWarn = null;
        for (const p of products) {
          const inv = byProduct[p]?.inventory;
          if (!inv || !inv.belowSafety || inv.remainingMonths == null) continue;
          if (!invWarn || inv.remainingMonths < invWarn.rm) invWarn = { p, rm: inv.remainingMonths };
        }
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
            <SummaryCard icon="📊" label={`${monthLabel(data.reportDate)} 생산 실적`} value={fmt(totalMonthActual)} unit="kg" sub={`${monthLabel(data.reportDate)} 총 실적 생산량`} color="#0071e3" />
            <SummaryCard icon="🎯" label="평균 생산 달성율" value={pct(avgRate)} sub="품목별 계획 대비 평균" color={rateColor(avgRate)} />
            <SummaryCard icon="📈" label="수율 주의 품목" value={yieldWarn ? yieldWarn.p : '없음'}
              sub={yieldWarn ? `목표대비 -${yieldWarn.gap.toFixed(1)}%p` : '모두 목표 달성'} color={yieldWarn ? '#ff3b30' : '#34c759'} valueSize={20} />
            <SummaryCard icon="📦" label="재고관리 필요" value={invWarn ? invWarn.p : '없음'}
              sub={invWarn ? `안전재고 이탈 · 잔여 ${invWarn.rm.toFixed(1)}개월` : '모두 정상'} color={invWarn ? '#ff9500' : '#34c759'} valueSize={20} />
          </div>
        );
      })()}

      {/* ── 품목별 계획 달성 현황(좌) + 재고 현황(우) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* 좌: 품목별 계획 달성 현황 */}
        <div className="card">
          <div className="card-head">
            <h3>🎯 품목별 계획 달성 현황</h3>
            <button onClick={() => setShowAll(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0071e3', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" stroke="#0071e3" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1" stroke="#0071e3" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1" stroke="#0071e3" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="#0071e3" strokeWidth="1.5"/></svg>
              전체 보기
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {(() => {
              const enabled = (data.tableCols && data.tableCols.length)
                ? data.tableCols.map((k) => PROD_TABLE_COLS.find((c) => c.key === k)).filter(Boolean)
                : PROD_TABLE_COLS;
              const footer = (key) => {
                switch (key) {
                  case 'today': return fmt(products.reduce((s, p) => s + (byProduct[p]?.todayQty || 0), 0));
                  case 'mPlan': return fmt(totalMonthPlan);
                  case 'mAct': return fmt(totalMonthActual);
                  case 'mRate': return pct(totalMonthPlan ? totalMonthActual / totalMonthPlan * 100 : null);
                  case 'cumRate': return pct(totalYearPlan ? totalYearActual / totalYearPlan * 100 : null);
                  case 'batch': return `${products.reduce((s, p) => s + (byProduct[p]?.monthBatch || 0), 0)} / ${products.reduce((s, p) => s + (byProduct[p]?.yearBatch || 0), 0)}`;
                  default: return '–';
                }
              };
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafd' }}>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid #e5e5ea', color: '#6e6e73', fontSize: 12, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>품목</th>
                      {enabled.map((c) => (
                        <th key={c.key} style={{ padding: '8px 10px', borderBottom: '1px solid #e5e5ea', color: '#6e6e73', fontSize: 12, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{colLabel(c.label, monthLabel(data.reportDate))}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const d = byProduct[p] || {};
                      const r = d.monthRate;
                      const badge = r == null ? null : r >= 100 ? { t: '달성', c: '#34c759' } : r >= 85 ? { t: '진행', c: '#ff9500' } : { t: '미달', c: '#ff3b30' };
                      return (
                        <tr key={p}>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f5f7', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: d.color || '#ccc', marginRight: 7, verticalAlign: 'middle' }} />
                            <b style={{ color: '#1d1d1f', fontSize: 14 }}>{p}</b>
                            {d.monthBatch != null && (
                              <span title={`이번달 ${d.monthBatch}배치 / 연 ${d.yearBatch ?? '-'}배치`}
                                style={{ fontSize: 10, fontWeight: 700, color: '#86868b', marginLeft: 5, background: '#f0f0f5', borderRadius: 8, padding: '1px 6px', verticalAlign: 'middle' }}>
                                {d.monthBatch}
                              </span>
                            )}
                          </td>
                          {enabled.map((c) => c.key === 'mRate' ? (
                            <td key={c.key} style={{ padding: '9px 10px', borderBottom: '1px solid #f5f5f7', textAlign: 'center', minWidth: 120 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: rateColor(r) }}>{pct(r)}</span>
                                {badge && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: badge.c, borderRadius: 10, padding: '1px 7px' }}>{badge.t}</span>}
                              </div>
                              <div style={{ height: 4, background: '#f0f0f5', borderRadius: 3, marginTop: 4 }}>
                                <div style={{ height: 4, borderRadius: 3, background: d.color, width: `${Math.min(100, r || 0)}%` }} />
                              </div>
                            </td>
                          ) : (c.key === 'yieldM' || c.key === 'yieldY') ? (
                            <td key={c.key} style={{ padding: '9px 10px', borderBottom: '1px solid #f5f5f7', textAlign: 'center' }}>
                              <YieldCell actual={c.key === 'yieldM' ? d.yield : d.yearYield} target={c.key === 'yieldM' ? d.yieldTarget : d.yearYieldTarget} />
                            </td>
                          ) : c.key === 'mAct' ? (
                            (() => {
                              const mom = momDelta(p);
                              return (
                                <td key={c.key} style={{ padding: '9px 10px', borderBottom: '1px solid #f5f5f7', textAlign: 'center' }}>
                                  <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(d.monthActual)}</div>
                                  {mom != null && (
                                    <div style={{ fontSize: 9.5, fontWeight: 700, color: mom >= 0 ? '#34c759' : '#ff3b30' }}>
                                      전월 {mom >= 0 ? '▲' : '▼'}{Math.abs(mom).toFixed(1)}%
                                    </div>
                                  )}
                                </td>
                              );
                            })()
                          ) : (
                            <td key={c.key} style={{ padding: '9px 10px', borderBottom: '1px solid #f5f5f7', textAlign: 'center', fontSize: 14, fontWeight: c.key === 'mAct' ? 600 : 400, color: c.key === 'batch' ? '#6e6e73' : '#1d1d1f' }}>
                              {colValue(c.key, d)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    <tr style={{ background: '#f8f8fb' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 700, color: '#6e6e73', fontSize: 12 }}>합계</td>
                      {enabled.map((c) => (
                        <td key={c.key} style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#1d1d1f' }}>{footer(c.key)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>

        {/* 우: 재고 현황 */}
        <div className="card">
          <div className="card-head"><h3>📦 재고 현황 (can)</h3><span style={{ fontSize: 10, color: '#86868b' }}>충전·출하·잔여 / 소진</span></div>
          <div style={{ padding: '6px 0' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', padding: '4px 14px', fontSize: 10, color: '#86868b' }}>
              <div style={{ width: 88 }} />
              {['충진', '출하', '잔여', '잔여(개월)'].map((h) => <div key={h} style={{ flex: 1, textAlign: 'center' }}>{h}</div>)}
            </div>
            {products.map((p) => {
              const inv = byProduct[p]?.inventory || {};
              const c = byProduct[p]?.color || '#ccc';
              const rm = inv.remainingMonths;
              // 색상: 안전재고(개월) 기준. 안전재고 미만=빨강, 1.5배 미만=주황, 이상=초록
              const sm = inv.safetyMonths != null ? inv.safetyMonths : 2;
              const rmColor = rm == null ? '#c7c7cc' : rm < sm ? '#ff3b30' : rm < sm * 1.5 ? '#ff9500' : '#34c759';
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid #f5f5f7' }}>
                  <div style={{ width: 88, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: '#1d1d1f', whiteSpace: 'nowrap' }}>
                    <span style={{ width: 8, height: 8, background: c, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />{p}
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#1d1d1f' }}>{fmtInt(inv.filled)}</div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#1d1d1f' }}>{fmtInt(inv.shipped)}</div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#1d1d1f' }}>{fmtInt(inv.total)}</div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: rmColor }}>
                    {rm == null ? '–' : `${rm.toFixed(1)}개월`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 중단: 월별 생산량 추이 + 월별 수율 추이 ── */}
      {(() => {
        const cm = (String(data.reportDate || '').match(/(\d{1,2})\s*월/) || [])[1];
        const curMonth = cm ? parseInt(cm, 10) : 12;
        const legend = (withTotal) => (
          <div style={{ display: 'flex', gap: 10, fontSize: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {products.map((p) => (
              <span key={p}><span style={{ display: 'inline-block', width: 12, height: 2, background: byProduct[p]?.color, verticalAlign: 'middle', marginRight: 3, borderRadius: 2 }} />{p}</span>
            ))}
            {withTotal && <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#3c3c43', verticalAlign: 'middle', marginRight: 3, borderRadius: 2 }} />총 생산량</span>}
          </div>
        );
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="card" style={{ cursor: 'pointer' }} onClick={() => setMatrixMode('prod')} title="클릭하면 품목/월 내역 표 보기">
              <div className="card-head"><h3>📈 월별 생산량 (kg)</h3>{legend(true)}</div>
              <div style={{ padding: '6px 12px 10px' }}>
                <MonthlyLineChart byProduct={byProduct} products={products} currentMonth={curMonth} mode="prod" />
                <div style={{ fontSize: 9, color: '#86868b', marginTop: 2 }}>클릭 → 품목/월 내역 · 미래월은 데이터 없음</div>
              </div>
            </div>
            <div className="card" style={{ cursor: 'pointer' }} onClick={() => setMatrixMode('yield')} title="클릭하면 품목/월 내역 표 보기">
              <div className="card-head"><h3>📊 월별 수율 (%)</h3>{legend(false)}</div>
              <div style={{ padding: '6px 12px 10px' }}>
                <MonthlyLineChart byProduct={byProduct} products={products} currentMonth={curMonth} mode="yield" />
                <div style={{ fontSize: 9, color: '#86868b', marginTop: 2 }}>클릭 → 품목/월 내역 · 미래월은 데이터 없음</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 모달 ── */}
      {showAll && <AllProductsModal data={data} onClose={() => setShowAll(false)} />}
      {showMonthly && <MonthlyExpandModal data={data} onClose={() => setShowMonthly(false)} />}
      {matrixMode && <MonthlyMatrixModal byProduct={byProduct} products={products} mode={matrixMode} onClose={() => setMatrixMode(null)} />}
    </>
  );
}
