import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty, useToast } from '../components/ui';

const today = new Date();
const n = (v) => (v === '' || v == null ? 0 : Number(v));
const fmt = (v) => Number(v || 0).toLocaleString();
const monthLabel = (mm) => `${Number(mm.slice(5, 7))}월`;

export default function Hazardous() {
  const { canWrite } = useAuth();
  const toast = useToast();
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('');
  const [loading, setLoading] = useState(false);
  const [openMonth, setOpenMonth] = useState(null); // 펼친 월(YYYY-MM)
  const [adding, setAdding] = useState(null); // 추가 중인 월

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

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i);
  const hasItems = data && data.hazardousItems && data.hazardousItems.length > 0;
  const cur = (data && tab && data.byItem[tab]) || null;
  const unit = cur ? cur.unit : '';

  function exportCsv() {
    if (!cur) return;
    const headers = ['날짜', '이월량', '입고량', '출하량', '잔량', '비고'];
    const lines = [headers.join(',')];
    cur.days.forEach((d) => lines.push([d.date, d.carryOver, d.inQty, d.outQty, d.balance, d.note].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `유해화학물질_${tab}_${year}.csv`;
    a.click();
  }

  async function saveEntry(payload) {
    try { await api.post('/hazardous/entry', { itemName: tab, ...payload }); await load(); toast.ok('저장했습니다.'); }
    catch (e) { toast.err(e.message); }
  }
  async function delEntry(date) {
    try { await api.del(`/hazardous/entry?itemName=${encodeURIComponent(tab)}&date=${date}`); await load(); toast.ok('자동집계로 되돌렸습니다.'); }
    catch (e) { toast.err(e.message); }
  }

  return (
    <>
      <div className="page-head">
        <div className="desc">유해화학물질 품목의 <b>월별 입고·출하·잔량</b>을 요약하고, ▶를 눌러 <b>일자별 대장(이월·입고·출하·잔량)</b>을 확인·수정합니다.</div>
        <div className="btn-row">
          <select className="plant-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <button className="btn secondary sm" onClick={exportCsv} disabled={!cur}>⬇ CSV (일자별)</button>
        </div>
      </div>

      {hasItems && (
        <div className="sheet-tabs">
          {data.hazardousItems.map((nm) => (
            <button key={nm} className={`sheet-tab ${tab === nm ? 'active' : ''}`} onClick={() => { setTab(nm); setOpenMonth(null); }}>{nm}</button>
          ))}
        </div>
      )}

      {loading ? <Loading /> : !hasItems ? (
        <div className="card card-pad"><Empty>유해화학물질로 지정된 품목이 없습니다.<br />기준정보에서 품목 등록 시 "유해화학물질" 체크박스를 선택해 주세요.</Empty></div>
      ) : cur && (
        <div className="card table-wrap" style={{ borderTopLeftRadius: 0 }}>
          <table className="tbl compact haz-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th style={{ width: 90 }}>월</th>
                <th className="num">이월량</th>
                <th className="num">입고수량</th>
                <th className="num">출하수량</th>
                <th className="num">잔량</th>
                <th style={{ width: 60 }}>단위</th>
              </tr>
            </thead>
            <tbody>
              {cur.months.map((m) => {
                const open = openMonth === m.month;
                const md = cur.days.filter((d) => d.date.startsWith(m.month));
                return (
                  <MonthBlock
                    key={m.month} m={m} open={open} md={md} unit={unit} canWrite={canWrite}
                    onToggle={() => setOpenMonth(open ? null : m.month)}
                    onSave={saveEntry} onDelete={delEntry}
                    adding={adding === m.month} setAdding={(v) => setAdding(v ? m.month : null)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function MonthBlock({ m, open, md, unit, canWrite, onToggle, onSave, onDelete, adding, setAdding }) {
  const empty = m.dayCount === 0;
  return (
    <>
      <tr className="haz-month" style={{ cursor: 'pointer', background: open ? 'var(--accent-soft,#eaf3fe)' : undefined }} onClick={onToggle}>
        <td style={{ textAlign: 'center', color: 'var(--accent)' }}>{open ? '▼' : '▶'}</td>
        <td><b>{monthLabel(m.month)}</b></td>
        <td className="num muted">{fmt(m.carryIn)}</td>
        <td className="num" style={{ color: 'var(--green)' }}>{m.inQty ? '+' + fmt(m.inQty) : '–'}</td>
        <td className="num" style={{ color: 'var(--orange)' }}>{m.outQty ? '-' + fmt(m.outQty) : '–'}</td>
        <td className="num"><b>{fmt(m.balance)}</b></td>
        <td className="muted">{unit}</td>
      </tr>
      {open && (
        <tr>
          <td></td>
          <td colSpan={6} style={{ background: '#fafbff', padding: '8px 10px' }}>
            <table className="tbl compact" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>날짜</th>
                  <th className="num">이월량</th>
                  <th className="num">입고량</th>
                  <th className="num">출하량</th>
                  <th className="num">잔량</th>
                  <th>비고</th>
                  {canWrite && <th style={{ width: 1 }}></th>}
                </tr>
              </thead>
              <tbody>
                {md.length === 0 && !adding && (
                  <tr><td colSpan={canWrite ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 10 }}>이 달의 수불 내역이 없습니다. {canWrite && '아래 [+ 일자 추가]로 임시 입력할 수 있습니다.'}</td></tr>
                )}
                {md.map((d) => <DayRow key={d.date} d={d} unit={unit} canWrite={canWrite} onSave={onSave} onDelete={onDelete} />)}
                {adding && <AddRow month={m.month} carryFrom={md.length ? md[md.length - 1].balance : m.carryIn} unit={unit} onSave={onSave} onCancel={() => setAdding(false)} />}
              </tbody>
            </table>
            {canWrite && !adding && (
              <div style={{ marginTop: 8 }}><button className="btn secondary sm" onClick={() => setAdding(true)}>+ 일자 추가 (임시입력)</button></div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DayRow({ d, unit, canWrite, onSave, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ inQty: d.inQty, outQty: d.outQty, balance: d.balance, note: d.note });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const previewBal = f.balance !== '' && f.balance != null ? n(f.balance) : d.carryOver + n(f.inQty) - n(f.outQty);

  if (!edit) {
    return (
      <tr style={d.edited ? { background: '#fffaf0' } : {}}>
        <td><b>{d.date}</b>{d.edited && <span className="badge orange" style={{ marginLeft: 6, fontSize: 10 }}>수정</span>}</td>
        <td className="num muted">{fmt(d.carryOver)}</td>
        <td className="num" style={{ color: d.inQty ? 'var(--green)' : undefined }}>{d.inQty ? fmt(d.inQty) : '–'}</td>
        <td className="num" style={{ color: d.outQty ? 'var(--orange)' : undefined }}>{d.outQty ? fmt(d.outQty) : '–'}</td>
        <td className="num"><b>{fmt(d.balance)}</b> <span className="muted">{unit}</span></td>
        <td className="muted">{d.note || '–'}</td>
        {canWrite && <td><div className="btn-row">
          <button className="btn secondary sm" onClick={() => { setF({ inQty: d.inQty, outQty: d.outQty, balance: d.balance, note: d.note }); setEdit(true); }}>수정</button>
          {d.edited && <button className="btn ghost sm" onClick={() => onDelete(d.date)} title="자동집계로 되돌리기">↺</button>}
        </div></td>}
      </tr>
    );
  }
  return (
    <tr style={{ background: '#fff' }}>
      <td><b>{d.date}</b></td>
      <td className="num muted">{fmt(d.carryOver)}</td>
      <td className="num"><input className="haz-in" type="number" value={f.inQty} onChange={(e) => set('inQty', e.target.value)} /></td>
      <td className="num"><input className="haz-in" type="number" value={f.outQty} onChange={(e) => set('outQty', e.target.value)} /></td>
      <td className="num"><input className="haz-in" type="number" placeholder={String(previewBal)} value={f.balance} onChange={(e) => set('balance', e.target.value)} title="비우면 (이월+입고-출하)로 자동계산" /></td>
      <td><input className="haz-note" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="비고" /></td>
      <td><div className="btn-row">
        <button className="btn sm" onClick={async () => { await onSave({ date: d.date, carryOver: d.carryOver, ...f }); setEdit(false); }}>저장</button>
        <button className="btn secondary sm" onClick={() => setEdit(false)}>취소</button>
      </div></td>
    </tr>
  );
}

function AddRow({ month, carryFrom, unit, onSave, onCancel }) {
  const [f, setF] = useState({ date: `${month}-01`, inQty: '', outQty: '', balance: '', note: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const previewBal = f.balance !== '' ? n(f.balance) : n(carryFrom) + n(f.inQty) - n(f.outQty);
  return (
    <tr style={{ background: '#f3fbf5' }}>
      <td><input className="haz-note" type="date" min={`${month}-01`} max={`${month}-31`} value={f.date} onChange={(e) => set('date', e.target.value)} /></td>
      <td className="num muted">{fmt(carryFrom)}</td>
      <td className="num"><input className="haz-in" type="number" value={f.inQty} onChange={(e) => set('inQty', e.target.value)} /></td>
      <td className="num"><input className="haz-in" type="number" value={f.outQty} onChange={(e) => set('outQty', e.target.value)} /></td>
      <td className="num"><input className="haz-in" type="number" placeholder={String(previewBal)} value={f.balance} onChange={(e) => set('balance', e.target.value)} /></td>
      <td><input className="haz-note" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="비고" /></td>
      <td><div className="btn-row">
        <button className="btn sm" onClick={() => onSave({ date: f.date, carryOver: carryFrom, inQty: f.inQty, outQty: f.outQty, balance: f.balance, note: f.note })}>추가</button>
        <button className="btn secondary sm" onClick={onCancel}>취소</button>
      </div></td>
    </tr>
  );
}
