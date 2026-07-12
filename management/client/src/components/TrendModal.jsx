import { useEffect, useState } from 'react';
import { api } from '../api';
import { Modal, Loading, Empty } from './ui';

const COLORS = ['#0071e3', '#30d158', '#ff9f0a', '#ff375f', '#bf5af2', '#5ac8fa', '#ffd60a', '#ff6961'];

/** SVG 꺾은선 차트 */
function LineChart({ labels, items }) {
  const W = 680, H = 220, PL = 54, PR = 16, PT = 16, PB = 36;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const n = labels.length;
  if (n === 0) return null;

  const maxVal = Math.max(1, ...items.flatMap(it => labels.map(l => it.series[l]?.out || 0)));
  const yTicks = 4;
  const step = Math.ceil(maxVal / yTicks);
  const yMax = step * yTicks;

  function xPos(i) { return PL + (n === 1 ? cW / 2 : (i / (n - 1)) * cW); }
  function yPos(v) { return PT + cH - (v / yMax) * cH; }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* 격자선 */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = step * i;
        const y = yPos(v);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e5e5ea" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#8e8e93">{v.toLocaleString()}</text>
          </g>
        );
      })}
      {/* X축 레이블 */}
      {labels.map((l, i) => (
        <text key={l} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#8e8e93">
          {l.length > 7 ? l.slice(2) : l}
        </text>
      ))}
      {/* 품목별 꺾은선 */}
      {items.map((it, ci) => {
        const color = COLORS[ci % COLORS.length];
        const pts = labels.map((l, i) => [xPos(i), yPos(it.series[l]?.out || 0)]);
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        return (
          <g key={it.name}>
            <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([x, y], i) => {
              const v = it.series[labels[i]]?.out || 0;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill={color} stroke="#fff" strokeWidth="1.5" />
                  {v > 0 && <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill={color}>{v.toLocaleString()}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** 품목별 사용량(출고) 트렌드 — 주/월/년, 꺾은선 시각화 */
export function TrendModal({ category, title = '사용량 분석', onClose }) {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/trends?category=${category}&period=${period}`).then(setData);
  }, [period, category]);

  return (
    <Modal title={`📈 ${title} (트렌드)`} size="lg" onClose={onClose} footer={<button className="btn" onClick={onClose}>닫기</button>}>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        {[['week', '주별'], ['month', '월별'], ['year', '연별']].map(([p, l]) => (
          <button key={p} className={`btn sm ${period === p ? '' : 'secondary'}`} onClick={() => setPeriod(p)}>{l}</button>
        ))}
        <span className="hint" style={{ marginLeft: 8 }}>꺾은선 = 기간별 사용량(출고)</span>
      </div>

      {!data ? <Loading /> : data.items.length === 0 ? <Empty>수불 데이터가 없습니다.</Empty> : (
        <>
          {/* 범례 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            {data.items.map((it, ci) => (
              <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ width: 24, height: 3, background: COLORS[ci % COLORS.length], borderRadius: 2, display: 'inline-block' }} />
                <span>{it.name}</span>
              </div>
            ))}
          </div>

          {/* 꺾은선 차트 */}
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 8px', marginBottom: 16 }}>
            <LineChart labels={data.labels} items={data.items} />
          </div>

          {/* 요약 테이블 */}
          <div className="table-wrap">
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>품목</th>
                  <th className="num">총 입고</th>
                  <th className="num">총 사용</th>
                  {data.labels.map((l) => <th key={l} className="num">{l.length > 7 ? l.slice(2) : l}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, ci) => (
                  <tr key={it.name}>
                    <td><b style={{ color: COLORS[ci % COLORS.length] }}>●</b> {it.name}</td>
                    <td className="num" style={{ color: 'var(--green)' }}>{it.totalIn.toLocaleString()}</td>
                    <td className="num" style={{ color: 'var(--orange)' }}>{it.totalOut.toLocaleString()}</td>
                    {data.labels.map((l) => (
                      <td key={l} className="num" style={{ fontSize: 13 }}>
                        {(it.series[l]?.out || 0) ? (it.series[l].out).toLocaleString() : '–'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
