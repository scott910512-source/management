import { useState, useMemo, useEffect } from 'react';
import { api } from '../api';
import { Modal, Field, Select, TextInput } from './ui';
import { BatchFields, BalanceBox } from './inputs';

/**
 * 사용(출고) 모달: 품목 선택 → 재고 있는 Lot 선택 → 수량 입력.
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
  const [lotId, setLotId] = useState('');
  const sel = lots.find((l) => l.id === lotId) || lots[0];
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [batch, setBatch] = useState({});
  const [busy, setBusy] = useState(false);
  const [fifo, setFifo] = useState(null);

  const cur = sel ? Number(sel[qtyField]) : 0;
  const qty = Number(quantity);
  const over = qty > cur;
  const category = base === 'sub-materials' ? 'sub' : 'raw';

  async function doSubmit(force) {
    if (!sel) return onError('재고가 있는 Lot이 없습니다.');
    setBusy(true);
    try {
      await api.post(`/${base}/${sel.id}/transaction`, { type: '출고', quantity: qty, note, force, batchNo: batch.batchNo, product: batch.product, batchStartDate: batch.batchStartDate });
      onSaved();
    } catch (e) {
      if (e.status === 409 && e.data && e.data.fifoWarning) setFifo(e.data);
      else onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function submit() {
    if (!sel) return onError('Lot을 선택하세요.');
    if (!quantity || qty <= 0) return onError('수량은 0보다 커야 합니다.');
    if (over) return onError('현재 재고를 초과했습니다.');
    doSubmit(false);
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
          <button className="btn" onClick={submit} disabled={busy || over}>{busy ? '처리 중…' : '사용 처리'}</button>
        </>}
      >
        <Field label="품목" required>
          <Select value={name} onChange={(e) => { setName(e.target.value); setLotId(''); }}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Lot (재고 있는 것)" required>
          <Select value={sel ? sel.id : ''} onChange={(e) => setLotId(e.target.value)}>
            {lots.map((l) => <option key={l.id} value={l.id}>{l.lotNo} — 재고 {Number(l[qtyField]).toLocaleString()}{l.unit} (입고 {l.receivedDate || '-'})</option>)}
          </Select>
        </Field>
        {sel && <BalanceBox cur={cur} qty={qty} type="출고" unit={sel.unit} over={over} hasQty={!!quantity} />}
        <Field label={`사용 수량 (${sel ? sel.unit : ''})`} required error={over ? '현재 재고를 초과했습니다.' : ''}>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextInput type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" autoFocus />
            {sel && <button type="button" className="btn secondary sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setQuantity(String(cur))}>전량</button>}
          </div>
        </Field>
        <BatchFields category={category} materialName={name} onChange={setBatch} onAutofillQty={(q) => setQuantity(String(q))} />
        <Field label="비고">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 3공정 투입" />
        </Field>
      </Modal>

      {fifo && (
        <Modal
          title="⚠ 선입선출 오류"
          onClose={() => setFifo(null)}
          footer={<>
            <button className="btn secondary" onClick={() => setFifo(null)}>취소</button>
            <button className="btn danger" onClick={() => { setFifo(null); doSubmit(true); }}>강제 사용</button>
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
