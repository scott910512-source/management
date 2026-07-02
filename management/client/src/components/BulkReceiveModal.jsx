import { useState, useMemo } from 'react';
import { api } from '../api';
import { Modal, Field, TextInput, Select } from './ui';
import { UnitInput, ItemSelect, expandLot } from './inputs';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * 다량 Lot 입고 모달 — 동일 품목의 Lot를 범위(A01~A20)로 한 번에 등록.
 * props: base('raw-materials'|'sub-materials'), onClose, onSaved(msg), onError(msg)
 */
export function BulkReceiveModal({ base, onClose, onSaved, onError }) {
  const isSub = base === 'sub-materials';

  const [itemName, setItemName] = useState('');
  const [meta, setMeta] = useState(null); // master item info
  const [prefix, setPrefix] = useState('');     // e.g. "T-2026-A"
  const [startNum, setStartNum] = useState('1');
  const [endNum, setEndNum] = useState('');
  const [digits, setDigits] = useState('2');    // zero-padding digits
  const [qtyPer, setQtyPer] = useState('');     // quantity per lot
  const [unit, setUnit] = useState('kg');
  const [vendor, setVendor] = useState('');
  const [receivedDate, setReceivedDate] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // {done, total}

  function handleItemChange(name, m) {
    setItemName(name);
    setMeta(m);
    if (m) {
      if (m.unit) setUnit(m.unit);
      if (m.vendor) setVendor(m.vendor);
      if (m.defaultQty) setQtyPer(m.defaultQty);
      if (m.lotPattern) setPrefix(expandLot(m.lotPattern));
    }
  }

  // 생성될 Lot 번호 미리보기
  const preview = useMemo(() => {
    const s = parseInt(startNum, 10);
    const e = parseInt(endNum, 10);
    const d = parseInt(digits, 10) || 2;
    if (!prefix || isNaN(s) || isNaN(e) || s > e || e - s > 99) return [];
    const lots = [];
    for (let i = s; i <= e; i++) {
      lots.push(`${prefix}${String(i).padStart(d, '0')}`);
    }
    return lots;
  }, [prefix, startNum, endNum, digits]);

  const qty = parseFloat(qtyPer) || 0;
  const totalQty = qty * preview.length;

  async function submit() {
    if (!itemName.trim()) return onError('품목을 선택하거나 입력하세요.');
    if (!prefix.trim()) return onError('Lot 앞번호(prefix)를 입력하세요.');
    if (preview.length === 0) return onError('생성할 Lot 범위를 올바르게 입력하세요. (시작 ≤ 끝, 최대 100개)');
    if (qty <= 0) return onError('Lot당 수량을 입력하세요.');

    setBusy(true);
    setProgress({ done: 0, total: preview.length });

    let failed = [];
    for (let i = 0; i < preview.length; i++) {
      const lotNo = preview[i];
      try {
        const payload = isSub
          ? { name: itemName.trim(), lotNo, unit, vendor, receivedDate, note, initialWeight: qty, weight: qty }
          : { itemName: itemName.trim(), lotNo, unit, vendor, receivedDate, note, quantity: qty };
        await api.post(`/${base}`, payload);
        setProgress({ done: i + 1, total: preview.length });
      } catch (e) {
        failed.push(`${lotNo}: ${e.message}`);
      }
    }

    setBusy(false);
    setProgress(null);

    if (failed.length === 0) {
      onSaved(`${preview.length}개 Lot 입고 등록 완료 (${itemName})`);
    } else if (failed.length < preview.length) {
      onSaved(`${preview.length - failed.length}개 등록 완료, ${failed.length}개 실패:\n${failed.join('\n')}`);
    } else {
      onError(`전체 실패:\n${failed.join('\n')}`);
    }
  }

  return (
    <Modal
      title="다량 Lot 입고 등록"
      subtitle="동일 품목의 Lot를 번호 범위로 한 번에 등록합니다."
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose} disabled={busy}>취소</button>
        <button className="btn" onClick={submit} disabled={busy || preview.length === 0}>
          {busy && progress
            ? `등록 중… (${progress.done}/${progress.total})`
            : `${preview.length > 0 ? preview.length + '개 ' : ''}Lot 등록`}
        </button>
      </>}
    >
      <Field label="품목" required hint="목록에서 선택하거나 '기타'로 직접 입력">
        <ItemSelect category={isSub ? 'sub' : 'raw'} value={itemName} onChange={handleItemChange} />
      </Field>

      <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', marginBottom: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Lot 번호 범위 설정</div>
        <Field label="Lot 앞번호 (prefix)" required hint="숫자 범위 앞에 붙는 공통 문자열 (예: T-2026-A)">
          <TextInput value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="예: T-2026-A" />
        </Field>
        <div className="form-row">
          <Field label="시작 번호" required>
            <TextInput type="number" value={startNum} onChange={(e) => setStartNum(e.target.value)} placeholder="1" min="1" />
          </Field>
          <Field label="끝 번호" required>
            <TextInput type="number" value={endNum} onChange={(e) => setEndNum(e.target.value)} placeholder="20" min="1" />
          </Field>
          <Field label="자릿수" hint="01이면 2, 001이면 3">
            <Select value={digits} onChange={(e) => setDigits(e.target.value)}>
              <option value="1">1자리 (1, 2…)</option>
              <option value="2">2자리 (01, 02…)</option>
              <option value="3">3자리 (001, 002…)</option>
            </Select>
          </Field>
        </div>
        {preview.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-2)' }}>
            생성 예시: <b>{preview[0]}</b> ~ <b>{preview[preview.length - 1]}</b> (총 {preview.length}개)
          </div>
        )}
        {parseInt(endNum) - parseInt(startNum) > 99 && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>⚠ 최대 100개까지 한 번에 등록 가능합니다.</div>
        )}
      </div>

      <div className="form-row" style={{ marginTop: 0 }}>
        <Field label="Lot당 수량" required>
          <TextInput type="number" value={qtyPer} onChange={(e) => setQtyPer(e.target.value)} placeholder="0" />
        </Field>
        <Field label="단위" required>
          <UnitInput value={unit} onChange={(v) => setUnit(v)} />
        </Field>
      </div>
      {qty > 0 && preview.length > 0 && (
        <div className="hint">총 입고 수량: <b>{totalQty.toLocaleString()} {unit}</b> ({preview.length}개 × {qty.toLocaleString()}{unit})</div>
      )}

      <div className="form-row">
        <Field label="입고일">
          <TextInput type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
        </Field>
        <Field label="업체명">
          <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="예: (주)한솔케미칼" />
        </Field>
      </div>
      <Field label="비고">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="선택 입력" />
      </Field>

      {preview.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--text-2)' }}>등록 예정 Lot 목록 ({preview.length}개)</div>
          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {preview.map((lot) => (
              <span key={lot} style={{ background: 'var(--blue-bg, #eff6ff)', color: 'var(--blue)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>{lot}</span>
            ))}
          </div>
        </div>
      )}

      {busy && progress && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--blue)', borderRadius: 3, width: `${(progress.done / progress.total) * 100}%`, transition: 'width 0.2s' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{progress.done} / {progress.total} 완료</div>
        </div>
      )}
    </Modal>
  );
}
