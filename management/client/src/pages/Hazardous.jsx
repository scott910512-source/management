import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Loading, Empty, Badge } from '../components/ui';

const today = new Date();

function toCsv(rows, itemName) {
  const headers = ['날짜', '품목명', 'Lot No.', '구분', '수량', '단위', '처리후잔량', '비고', '작성자'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.date,
      r.empty ? '' : (r.materialName || itemName),
      r.empty ? '' : r.lotNo,
      r.empty ? '' : r.type,
      r.empty ? '' : r.quantity,
      r.empty ? '' : r.unit,
      r.empty ? '' : r.balanceAfter,
      r.empty ? '' : r.note,
      r.empty ? '' : r.createdBy,
    ].map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n');
}

export default function Hazardous() {
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/hazardous?year=${year}`);
      setData(d);
      setTab((prev) => (d.hazardousItems.includes(prev) ? prev : d.hazardousItems[0] || ''));
    } catch { setData({ hazardousItems: [], byItem: {} }); }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const rows = (data && tab && data.byItem[tab]) || [];

  function downloadCsv() {
    if (!tab) return;
    const csv = toCsv(rows, tab);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `유해화학물질관리대장_${tab}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);
  const hasItems = data && data.hazardousItems && data.hazardousItems.length > 0;

  return (
    <>
      <div className="page-head">
        <div className="desc">유해화학물질로 지정된 품목의 연간 수불 이력을 <b>품목별 탭</b>으로 확인합니다.</div>
        <div className="btn-row">
          <select className="plant-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <button className="btn secondary sm" onClick={downloadCsv} disabled={!tab}>⬇ CSV 다운로드 (현재 품목)</button>
        </div>
      </div>

      {/* 품목 탭 (엑셀 시트 탭 형태) */}
      {hasItems && (
        <div className="sheet-tabs">
          {data.hazardousItems.map((n) => (
            <button key={n} className={`sheet-tab ${tab === n ? 'active' : ''}`} onClick={() => setTab(n)}>{n}</button>
          ))}
        </div>
      )}

      {loading ? <Loading /> : !hasItems ? (
        <div className="card card-pad">
          <Empty>유해화학물질로 지정된 품목이 없습니다.<br />기준정보에서 품목 등록 시 "유해화학물질" 체크박스를 선택해 주세요.</Empty>
        </div>
      ) : (
        <div className="card table-wrap" style={{ borderTopLeftRadius: 0 }}>
          <table className="tbl compact">
            <thead>
              <tr>
                <th style={{ width: 100 }}>날짜</th>
                <th>Lot No.</th>
                <th style={{ width: 70 }}>구분</th>
                <th className="num" style={{ width: 80 }}>수량</th>
                <th style={{ width: 50 }}>단위</th>
                <th className="num" style={{ width: 90 }}>처리후잔량</th>
                <th>비고</th>
                <th style={{ width: 80 }}>작성자</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={r.empty ? { background: 'var(--bg-2, #f8f8f8)' } : {}}>
                  <td className={r.empty ? 'muted' : ''}><b>{r.date}</b></td>
                  <td className="muted">{r.empty ? '' : r.lotNo}</td>
                  <td>{r.empty ? '' : <Badge color={['입고', '반입'].includes(r.type) ? 'green' : 'orange'}>{r.type}</Badge>}</td>
                  <td className="num">{r.empty ? '' : Number(r.quantity).toLocaleString()}</td>
                  <td className="muted">{r.empty ? '' : r.unit}</td>
                  <td className="num muted">{r.empty ? '' : Number(r.balanceAfter).toLocaleString()}</td>
                  <td className="muted">{r.empty ? '' : r.note}</td>
                  <td className="muted">{r.empty ? '' : r.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
