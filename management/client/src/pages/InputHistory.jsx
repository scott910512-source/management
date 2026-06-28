import { useEffect, useState, useCallback, Fragment } from 'react';
import { api, downloadCsv } from '../api';
import { Loading, Empty, Badge } from '../components/ui';

const catLabel = (c) => (c === 'raw' ? '원재료' : c === 'sub' ? '부재료' : c);
const catColor = (c) => (c === 'raw' ? 'blue' : 'orange');

export default function InputHistory() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const d = await api.get('/batches/inputs');
    setItems(d.items);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = (items || []).filter((b) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return (
      `#${b.batchNo}`.includes(t) ||
      String(b.batchNo).includes(t) ||
      (b.product || '').toLowerCase().includes(t) ||
      b.materials.some((m) => (m.name || '').toLowerCase().includes(t) || (m.lotNo || '').toLowerCase().includes(t))
    );
  });

  return (
    <>
      <div className="page-head">
        <div className="desc">합성 Batch별 원·부재료 <b>투입 현황</b>을 확인합니다. 출고(사용) 시 입력한 Batch No. 기준으로 자동 집계됩니다.</div>
        <div className="btn-row">
          <button className="btn secondary sm" onClick={() => downloadCsv('/batches/inputs/export')}>⬇ CSV 다운로드</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <span>🔍</span>
          <input placeholder="Batch No / 제품 / 품목 / Lot 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {!items ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="card card-pad"><Empty>투입이력이 없습니다. 원·부재료 출고(사용) 시 Batch No.를 입력하면 이곳에 집계됩니다.</Empty></div>
      ) : (
        <div className="card table-wrap">
          <table className="tbl compact">
            <thead>
              <tr>
                <th style={{ width: 90 }}>구분</th>
                <th>투입 품목</th>
                <th className="num" style={{ width: 120 }}>투입량</th>
                <th style={{ width: 60 }}>단위</th>
                <th style={{ width: 180 }}>투입 Lot</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <Fragment key={b.batchId}>
                  <tr className="group-row">
                    <td colSpan={5}>
                      <span style={{ fontWeight: 800, color: 'var(--accent)' }}>#{b.batchNo}</span>
                      {b.product && <> · 제품 <b>{b.product}</b></>}
                      {b.startDate && <span className="muted" style={{ fontWeight: 400 }}> · 합성시작일 {b.startDate}</span>}
                      <span className="muted" style={{ fontWeight: 400 }}> · 투입품목 {b.materials.length}건</span>
                    </td>
                  </tr>
                  {b.materials.map((m, i) => (
                    <tr key={i}>
                      <td><Badge color={catColor(m.category)}>{catLabel(m.category)}</Badge></td>
                      <td><b>{m.name}</b></td>
                      <td className="num">{Number(m.quantity).toLocaleString()}</td>
                      <td className="muted">{m.unit}</td>
                      <td className="muted">{m.lotNo || '–'}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
