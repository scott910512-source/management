import { useState, useMemo, useEffect } from 'react';
import { api } from '../api';
import { Modal, Field, Select, TextInput } from './ui';
import { BatchFields, BalanceBox } from './inputs';

// 서버(anomaly.js)와 동일한 기준 — Lot 번호 우선, 같으면 입고일로 보조 판단
function sortFifo(list) {
  return [...list].sort((a, b) => {
    const c = String(a.lotNo || '').localeCompare(String(b.lotNo || ''), undefined, { numeric: true, sensitivity: 'base' });
    if (c !== 0) return c;
    return (a.receivedDate || '') < (b.receivedDate || '') ? -1 : 1;
  });
}

/**
 * 사용(출고) 모달: 품목 선택 → 재고 있는 Lot 선택 → 수량 입력.
 * 필요 수량이 선택한 단일 Lot의 재고를 초과하면, 여러 Lot(FIFO 자동분배 또는 직접 지정)으로
 * 나눠서 한 번에 사용 처리할 수 있다.
 * base: 'raw-materials' | 'sub-materials', nameField: 'itemName' | 'name', qtyField: 'quantity' | 'weight'
 */
export function UseModal({ title = '사용 처리', base, items, nameField, qtyField, onClose, onSaved, onError }) {
  const inStock = useMemo(() => (items || []).filter((i) => Number(i[qtyField]) > 0), [items, qtyField]);
  const names = useMemo(() => Array.from(new Set(inStock.map((i) => i[nameField]))), [inStock, nameField]);
  const [name, setName] = useState(names[0] || '');
  // 품목 목록이 늦게 로드되면 첫 품목으로 보정
  useEffect(() => {
    if (names.length && !names.includes(name)) setName(names[0]);
  }, [names]); // eslint-disable-line react-hooks/exhaustive-deps
  const lots = inStock.filter((i) => i[nameField] === name);
  const sortedLots = useMemo(() => sortFifo(lots), [lots]);
  const [lotId, setLotId] = useState('');
  const sel = lots.find((l) => l.id === lotId) || lots[0];
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [batch, setBatch] = useState({});
  const [busy, setBusy] = useState(false);
  const [fifo, setFifo] = useState(null);
  const [pendingLines, setPendingLines] = useState(null);
  const [multi, setMulti] = useState(false);
  const [alloc, setAlloc] = useState({}); // lotId → 수량(문자열)

  const cur = sel ? Number(sel[qtyField]) : 0;
  const qty = Number(quantity);
  const over = qty > cur;
  const category = base === 'sub-materials' ? 'sub' : 'raw';
  const totalAvail = sortedLots.reduce((s, l) => s + Number(l[qtyField]), 0);

  function autoAllocate(totalQty) {
    let remain = totalQty;
    const next = {};
    for (const l of sortedLots) {
      if (remain <= 0) break;
      const avail = Number(l[qtyField]);
      const take = Math.min(avail, remain);
      if (take > 0) { next[l.id] = String(take); remain -= take; }
    }
    setAlloc(next);
  }

  // 필요 수량이 선택한 단일 Lot 재고를 초과하면 자동으로 여러 Lot 분배 모드로 전환
  useEffect(() => {
    if (over && qty > 0 && !multi) {
      setMulti(true);
      autoAllocate(qty);
    }
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  // 다중 Lot 모드에서 총 수량/품목이 바뀌면 FIFO 순서로 재분배
  useEffect(() => {
    if (multi && qty > 0) autoAllocate(qty);
  }, [multi, qty, name]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMulti() {
    const next = !multi;
    setMulti(next);
    if (next && qty > 0) autoAllocate(qty);
    else setAlloc({});
  }

  function setLotQty(id, v) {
    setAlloc((p) => ({ ...p, [id]: v }));
  }

  const allocSum = sortedLots.reduce((s, l) => s + (Number(alloc[l.id]) || 0), 0);
  const allocOver = sortedLots.some((l) => (Number(alloc[l.id]) || 0) > Number(l[qtyField]));
  const allocMismatch = multi && quantity !== '' && Math.abs(allocSum - qty) > 0.0001;

  // Lot별 수불(출고)을 순서대로 처리 — 도중에 선입선출 409가 발생하면 그 지점부터 재개
  async function runLines(lines, force) {
    setBusy(true);
    try {
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        try {
          await api.post(`/${base}/${ln.id}/transaction`, {
            type: '출고', quantity: ln.qty, note, force,
            batchNo: batch.batchNo, product: batch.product, batchStartDate: batch.batchStartDate,
          });
        } catch (e) {
          if (e.status === 409 && e.data && e.data.fifoWarning) {
            setFifo(e.data);
            setPendingLines(lines.slice(i));
            setBusy(false);
            return;
          }
          throw e;
        }
      }
      setPendingLines(null);
      onSaved();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (multi) {
      const lines = sortedLots.filter((l) => (Number(alloc[l.id]) || 0) > 0).map((l) => ({ id: l.id, qty: Number(alloc[l.id]) }));
      if (!lines.length) return onError('Lot별 사용 수량을 입력하세요.');
      if (allocMismatch) return onError('Lot별 수량의 합이 사용 수량과 일치해야 합니다.');
      if (allocOver) return onError('일부 Lot의 배분 수량이 해당 Lot 재고를 초과했습니다.');
      runLines(lines, false);
      return;
    }
    if (!sel) return onError('Lot을 선택하세요.');
    if (!quantity || qty <= 0) return onError('수량은 0보다 커야 합니다.');
    if (over) return onError('현재 재고를 초과했습니다.');
    runLines([{ id: sel.id, qty }], false);
  }

  if (names.length === 0) {
    return (
      <Modal title={title} onClose={onClose} footer={<button className="btn" onClick={onClose}>닫기</button>}>
        <p style={{ margin: 0, color: 'var(--text-2)' }}>재고가 있는 Lot이 없습니다. 먼저 입고하세요.</p>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        title={title}
        onClose={onClose}
        footer={<>
          <button className="btn secondary" onClick={onClose}>취소</button>
          <button className="btn" onClick={submit} disabled={busy || (multi ? (allocMismatch || allocOver) : over)}>{busy ? '처리 중…' : '사용 처리'}</button>
        </>}
      >
        <Field label="품목" required>
          <Select value={name} onChange={(e) => { setName(e.target.value); setLotId(''); }}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>

        {!multi && (
          <Field label="Lot (재고 있는 것)" required>
            <Select value={sel ? sel.id : ''} onChange={(e) => setLotId(e.target.value)}>
              {lots.map((l) => <option key={l.id} value={l.id}>{l.lotNo} — 재고 {Number(l[qtyField]).toLocaleString()}{l.unit} (입고 {l.receivedDate || '-'})</option>)}
            </Select>
          </Field>
        )}
        {!multi && sel && <BalanceBox cur={cur} qty={qty} type="출고" unit={sel.unit} over={over} hasQty={!!quantity} />}

        <Field label={`사용 수량 (${sel ? sel.unit : ''})`} required error={!multi && over ? '현재 재고를 초과했습니다.' : ''}>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextInput type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" autoFocus />
            {!multi && sel && <button type="button" className="btn secondary sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setQuantity(String(cur))}>전량</button>}
          </div>
        </Field>

        <div style={{ margin: '4px 0 10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={multi} onChange={toggleMulti} />
            여러 Lot으로 나눠서 사용 (필요 수량이 한 Lot 재고를 초과할 때)
          </label>
        </div>

        {multi && (
          <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 14px', margin: '4px 0 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Lot별 사용 수량 (FIFO: Lot 번호 순)</div>
              <button type="button" className="btn secondary sm" onClick={() => autoAllocate(qty || 0)}>자동분배(FIFO)</button>
            </div>
            {sortedLots.map((l) => {
              const a = Number(alloc[l.id]) || 0;
              const stock = Number(l[qtyField]);
              const lineOver = a > stock;
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    {l.lotNo} <span style={{ color: 'var(--text-3)' }}>· 재고 {stock.toLocaleString()}{l.unit} (입고 {l.receivedDate || '-'})</span>
                  </div>
                  <TextInput
                    type="number"
                    value={alloc[l.id] || ''}
                    onChange={(e) => setLotQty(l.id, e.target.value)}
                    placeholder="0"
                    style={{ width: 100 }}
                  />
                  {lineOver && <span style={{ color: 'var(--red)', fontSize: 12 }}>재고초과</span>}
                </div>
              );
            })}
            <div className="hint" style={{ marginTop: 6, color: allocMismatch || allocOver ? 'var(--red)' : 'var(--text-3)' }}>
              배분 합계: {allocSum.toLocaleString()} / 필요 {quantity ? qty.toLocaleString() : 0}
              {qty > totalAvail && <span> · 전체 재고({totalAvail.toLocaleString()})가 부족합니다.</span>}
            </div>
          </div>
        )}

        <BatchFields category={category} materialName={name} onChange={setBatch} onAutofillQty={(q) => setQuantity(String(q))} />
        <Field label="비고">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 3공정 투입" />
        </Field>
      </Modal>

      {fifo && (
        <Modal
          title="⚠ 선입선출 오류"
          onClose={() => { setFifo(null); setPendingLines(null); }}
          footer={<>
            <button className="btn secondary" onClick={() => { setFifo(null); setPendingLines(null); }}>취소</button>
            <button className="btn danger" onClick={() => { const lines = pendingLines; setFifo(null); runLines(lines, true); }}>강제 사용</button>
          </>}
        >
          <p style={{ margin: 0, color: 'var(--text-2)' }}>
            {fifo.message}<br />더 빠른 Lot: <b>{fifo.earliest?.lotNo}</b> (입고 {fifo.earliest?.receivedDate})
            <br /><br />강제 사용 시 <b>이상발생 목록에 자동 기록</b>됩니다. 계속하시겠습니까?
          </p>
        </Modal>
      )}
    </>
  );
}
