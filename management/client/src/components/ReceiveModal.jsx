import { useState, useMemo } from 'react';
import { api } from '../api';
import { Modal, Field, TextInput, Select } from './ui';
import { UnitInput, ItemSelect, expandLot } from './inputs';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * 통합 입고 모달 — 단건 / 다량(수기기입·자동기입) 3가지 모드 지원
 * props: base('raw-materials'|'sub-materials'), onClose, onSaved(msg), onError(msg)
 */
export function ReceiveModal({ base, onClose, onSaved, onError }) {
  const isSub = base === 'sub-materials';

  // 최상위 모드: single(단건) | bulk(다량)
  const [mode, setMode] = useState('single');
  // 다량 서브모드: manual(수기기입) | auto(자동기입)
  const [bulkMode, setBulkMode] = useState('manual');

  // ── 공통 품목/메타
  const [itemName, setItemName] = useState('');
  const [meta, setMeta] = useState(null);
  const [unit, setUnit] = useState('kg');
  const [vendor, setVendor] = useState('');
  const [receivedDate, setReceivedDate] = useState(today());
  const [note, setNote] = useState('');

  // ── 단건 모드 전용
  const [lotNo, setLotNo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pkgCount, setPkgCount] = useState('');
  const [lotPattern, setLotPattern] = useState('');
  const hasPkg = !!(meta?.pkgType);
  const pkgSize = meta?.pkgSize || '';
  const pkgUnit = meta?.pkgUnit || '';
  const pkgQty = hasPkg && pkgCount && pkgSize ? Number(pkgCount) * Number(pkgSize) : null;

  // ── 다량 수기기입 모드
  const [manualLots, setManualLots] = useState([{ lotNo: '', qty: '' }]);

  // ── 다량 자동기입 모드
  const [prefix, setPrefix] = useState('');
  const [startNum, setStartNum] = useState('1');
  const [endNum, setEndNum] = useState('');
  const [digits, setDigits] = useState('2');
  const [qtyPer, setQtyPer] = useState('');

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  function handleItemChange(name, m) {
    setItemName(name);
    setMeta(m);
    if (m) {
      if (m.unit) setUnit(m.unit);
      if (m.vendor) setVendor(m.vendor);
      if (m.defaultQty) { setQuantity(m.defaultQty); setQtyPer(m.defaultQty); }
      if (m.lotPattern) {
        const expanded = expandLot(m.lotPattern);
        setLotNo(expanded);
        setPrefix(expanded);
        setLotPattern(m.lotPattern);
      }
    }
  }

  // 자동기입 Lot 미리보기
  const autoPreview = useMemo(() => {
    const s = parseInt(startNum, 10);
    const e = parseInt(endNum, 10);
    const d = parseInt(digits, 10) || 2;
    if (!prefix || isNaN(s) || isNaN(e) || s > e || e - s > 99) return [];
    const lots = [];
    for (let i = s; i <= e; i++) lots.push(`${prefix}${String(i).padStart(d, '0')}`);
    return lots;
  }, [prefix, startNum, endNum, digits]);

  // ── 제출
  async function submit() {
    if (!itemName.trim()) return onError('품목을 선택하거나 입력하세요.');

    if (mode === 'single') {
      if (!lotNo.trim()) return onError('Lot No를 입력하세요.');
      setBusy(true);
      try {
        const payload = isSub
          ? { name: itemName.trim(), lotNo: lotNo.trim(), unit, vendor, receivedDate, note }
          : { itemName: itemName.trim(), lotNo: lotNo.trim(), unit, vendor, receivedDate, note };
        if (hasPkg && pkgCount) {
          payload.pkgCount = Number(pkgCount);
          payload.pkgSize = Number(pkgSize);
        } else {
          const q = Number(quantity);
          if (isSub) { payload.weight = q; payload.initialWeight = q; }
          else payload.quantity = q;
        }
        await api.post(`/${base}`, payload);
        onSaved('원재료 Lot을 등록했습니다.');
      } catch (e) { onError(e.message); } finally { setBusy(false); }
      return;
    }

    // 다량 모드
    let lots = [];
    const qtyField = isSub ? 'weight' : 'quantity';
    if (bulkMode === 'manual') {
      const valid = manualLots.filter((r) => r.lotNo.trim() && Number(r.qty) > 0);
      if (valid.length === 0) return onError('등록할 Lot 정보를 입력하세요.');
      lots = valid.map((r) => ({ lotNo: r.lotNo.trim(), [qtyField]: Number(r.qty) }));
    } else {
      if (autoPreview.length === 0) return onError('Lot 범위를 올바르게 입력하세요. (최대 100개)');
      const q = parseFloat(qtyPer);
      if (!(q > 0)) return onError('Lot당 수량을 입력하세요.');
      lots = autoPreview.map((no) => ({ lotNo: no, [qtyField]: q }));
    }

    setBusy(true);
    setProgress({ done: 0, total: lots.length });
    const failed = [];
    for (let i = 0; i < lots.length; i++) {
      const { lotNo: ln, ...qObj } = lots[i];
      try {
        const payload = isSub
          ? { name: itemName.trim(), lotNo: ln, unit, vendor, receivedDate, note, ...qObj, initialWeight: qObj.weight }
          : { itemName: itemName.trim(), lotNo: ln, unit, vendor, receivedDate, note, ...qObj };
        await api.post(`/${base}`, payload);
        setProgress({ done: i + 1, total: lots.length });
      } catch (e) { failed.push(`${ln}: ${e.message}`); }
    }
    setBusy(false);
    setProgress(null);
    if (failed.length === 0) onSaved(`${lots.length}개 Lot 입고 등록 완료 (${itemName})`);
    else if (failed.length < lots.length) onSaved(`${lots.length - failed.length}개 등록 완료, ${failed.length}개 실패:\n${failed.join('\n')}`);
    else onError(`전체 실패:\n${failed.join('\n')}`);
  }

  // ── 수기기입 행 제어
  function addManualRow() { setManualLots((p) => [...p, { lotNo: '', qty: '' }]); }
  function removeManualRow(i) { setManualLots((p) => p.filter((_, idx) => idx !== i)); }
  function updateManualRow(i, field, val) { setManualLots((p) => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r)); }

  const canSubmit = !busy && (
    mode === 'single'
      ? lotNo.trim().length > 0
      : bulkMode === 'manual'
        ? manualLots.some((r) => r.lotNo.trim() && Number(r.qty) > 0)
        : autoPreview.length > 0
  );

  const autoQty = parseFloat(qtyPer) || 0;

  return (
    <Modal
      title={isSub ? '부재료 입고' : '원재료 입고'}
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose} disabled={busy}>취소</button>
        <button className="btn" onClick={submit} disabled={!canSubmit}>
          {busy && progress ? `등록 중… (${progress.done}/${progress.total})` : '저장'}
        </button>
      </>}
    >
      {/* 모드 선택 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['single', 'bulk'].map((m) => (
          <button
            key={m}
            className={`btn sm ${mode === m ? '' : 'secondary'}`}
            onClick={() => setMode(m)}
            disabled={busy}
          >
            {m === 'single' ? '단건 입고' : '다량 입고'}
          </button>
        ))}
      </div>

      {/* 공통: 품목 */}
      <Field label="품목" required hint="목록에서 선택하거나 '기타'로 직접 입력">
        <ItemSelect category={isSub ? 'sub' : 'raw'} value={itemName} onChange={handleItemChange} />
      </Field>

      {/* 공통: 단위/입고일/업체 */}
      <div className="form-row">
        <Field label="단위" required>
          <UnitInput value={unit} onChange={(v) => setUnit(v)} />
        </Field>
        <Field label="입고일">
          <TextInput type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="업체명">
          <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="예: (주)한솔케미칼" />
        </Field>
        <Field label="비고">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="선택 입력" />
        </Field>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

      {/* ── 단건 입고 */}
      {mode === 'single' && (
        <>
          <div className="form-row">
            <Field label="Lot No" required>
              <div style={{ display: 'flex', gap: 6 }}>
                <TextInput value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="예: T-2026-003" />
                {lotPattern && (
                  <button type="button" className="btn secondary sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setLotNo(expandLot(lotPattern))}>↻ 자동</button>
                )}
              </div>
            </Field>
            {hasPkg ? (
              <Field label={`수량 (${meta.pkgType})`} hint={pkgSize ? `1${meta.pkgType} = ${pkgSize}${pkgUnit || unit}` : ''}>
                <TextInput type="number" value={pkgCount} onChange={(e) => setPkgCount(e.target.value)} placeholder="예: 2" />
              </Field>
            ) : (
              <Field label="수량">
                <TextInput type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
              </Field>
            )}
          </div>
          {hasPkg && pkgQty !== null && (
            <div className="hint" style={{ marginBottom: 8 }}>총 수량: <b>{pkgQty.toLocaleString()}{pkgUnit || unit}</b> ({pkgCount}{meta.pkgType} × {pkgSize}{pkgUnit || unit})</div>
          )}
        </>
      )}

      {/* ── 다량 입고 */}
      {mode === 'bulk' && (
        <>
          {/* 서브모드 탭 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['manual', 'auto'].map((m) => (
              <button
                key={m}
                className={`btn sm ${bulkMode === m ? '' : 'secondary'}`}
                onClick={() => setBulkMode(m)}
                disabled={busy}
              >
                {m === 'manual' ? '수기 기입' : '자동 기입'}
              </button>
            ))}
          </div>

          {/* 수기 기입 */}
          {bulkMode === 'manual' && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Lot 목록 입력</div>
              {manualLots.map((row, i) => (
                <div key={i} className="form-row" style={{ alignItems: 'flex-end', marginBottom: 6 }}>
                  <Field label={i === 0 ? 'Lot No' : ''} style={{ flex: 2 }}>
                    <TextInput value={row.lotNo} onChange={(e) => updateManualRow(i, 'lotNo', e.target.value)} placeholder={`Lot ${i + 1}`} />
                  </Field>
                  <Field label={i === 0 ? `수량 (${unit})` : ''} style={{ flex: 1 }}>
                    <TextInput type="number" value={row.qty} onChange={(e) => updateManualRow(i, 'qty', e.target.value)} placeholder="0" />
                  </Field>
                  {manualLots.length > 1 && (
                    <button className="btn ghost sm" style={{ color: 'var(--red)', marginBottom: 4 }} onClick={() => removeManualRow(i)}>✕</button>
                  )}
                </div>
              ))}
              <button className="btn secondary sm" onClick={addManualRow} disabled={busy}>+ Lot 추가</button>
              <div className="hint" style={{ marginTop: 6 }}>총 {manualLots.filter((r) => r.lotNo.trim() && Number(r.qty) > 0).length}개 Lot 등록 예정</div>
            </div>
          )}

          {/* 자동 기입 */}
          {bulkMode === 'auto' && (
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px' }}>
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
                <Field label="자릿수" hint="01이면 2">
                  <Select value={digits} onChange={(e) => setDigits(e.target.value)}>
                    <option value="1">1자리 (1, 2…)</option>
                    <option value="2">2자리 (01, 02…)</option>
                    <option value="3">3자리 (001, 002…)</option>
                  </Select>
                </Field>
              </div>
              {autoPreview.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-2)' }}>
                  예시: <b>{autoPreview[0]}</b> ~ <b>{autoPreview[autoPreview.length - 1]}</b> (총 {autoPreview.length}개)
                </div>
              )}
              {parseInt(endNum) - parseInt(startNum) > 99 && (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>⚠ 최대 100개까지 한 번에 등록 가능합니다.</div>
              )}
              <div className="form-row" style={{ marginTop: 12 }}>
                <Field label="Lot당 수량" required>
                  <TextInput type="number" value={qtyPer} onChange={(e) => setQtyPer(e.target.value)} placeholder="0" />
                </Field>
              </div>
              {autoQty > 0 && autoPreview.length > 0 && (
                <div className="hint">총 입고 수량: <b>{(autoQty * autoPreview.length).toLocaleString()} {unit}</b> ({autoPreview.length}개 × {autoQty.toLocaleString()}{unit})</div>
              )}
              {autoPreview.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--text-2)' }}>등록 예정 Lot ({autoPreview.length}개)</div>
                  <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {autoPreview.map((lot) => (
                      <span key={lot} style={{ background: 'var(--blue-bg, #eff6ff)', color: 'var(--blue)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>{lot}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 진행 표시 */}
      {busy && progress && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--blue)', borderRadius: 3, width: `${(progress.done / progress.total) * 100}%`, transition: 'width 0.2s' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{progress.done} / {progress.total} 완료</div>
        </div>
      )}
    </Modal>
  );
}
