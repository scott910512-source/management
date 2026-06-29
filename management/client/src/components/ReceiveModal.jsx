import { useState, useMemo } from 'react';
import { api } from '../api';
import { Modal, Field, TextInput, Select } from './ui';
import { UnitInput, ItemSelect, expandLot } from './inputs';

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * 통합 입고 모달
 * - 개별 Lot 등록: 행 추가 방식으로 다수 Lot 입력 (1개도 가능)
 * - Lot 자동생성: prefix + 범위로 자동 생성
 *
 * props: base('raw-materials'|'sub-materials'), onClose, onSaved(msg), onError(msg)
 */
export function ReceiveModal({ base, onClose, onSaved, onError }) {
  const isSub = base === 'sub-materials';

  const [mode, setMode] = useState('manual'); // 'manual' | 'auto'

  // ── 공통
  const [itemName, setItemName] = useState('');
  const [meta, setMeta] = useState(null);
  const [unit, setUnit] = useState('kg');
  const [vendor, setVendor] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [note, setNote] = useState('');
  const [lotPattern, setLotPattern] = useState('');

  // ── 개별 Lot 등록 (행 배열)
  const [rows, setRows] = useState([{ lotNo: '', qty: '' }]);

  // ── 자동생성
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
      if (m.defaultQty) {
        setQtyPer(m.defaultQty);
        setRows((prev) => prev.map((r, i) => i === 0 && !r.qty ? { ...r, qty: m.defaultQty } : r));
      }
      if (m.lotPattern) {
        const expanded = expandLot(m.lotPattern);
        setLotPattern(m.lotPattern);
        setPrefix(expanded);
        setRows((prev) => prev.map((r, i) => i === 0 && !r.lotNo ? { ...r, lotNo: expanded } : r));
      }
    }
  }

  // 자동생성 미리보기
  const autoPreview = useMemo(() => {
    const s = parseInt(startNum, 10);
    const e = parseInt(endNum, 10);
    const d = parseInt(digits, 10) || 2;
    if (!prefix || isNaN(s) || isNaN(e) || s > e || e - s > 99) return [];
    const lots = [];
    for (let i = s; i <= e; i++) lots.push(`${prefix}${String(i).padStart(d, '0')}`);
    return lots;
  }, [prefix, startNum, endNum, digits]);

  // 행 제어
  function addRow() { setRows((p) => [...p, { lotNo: '', qty: '' }]); }
  function removeRow(i) { setRows((p) => p.filter((_, idx) => idx !== i)); }
  function updateRow(i, field, val) { setRows((p) => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r)); }
  function autoFillLotNo(i) {
    if (lotPattern) updateRow(i, 'lotNo', expandLot(lotPattern));
  }

  // ── 제출
  async function submit() {
    if (!itemName.trim()) return onError('품목을 선택하거나 입력하세요.');
    if (!receivedDate) return onError('입고일을 입력하세요.');

    let lots = [];
    const qtyKey = isSub ? 'weight' : 'quantity';

    if (mode === 'manual') {
      const valid = rows.filter((r) => r.lotNo.trim() && Number(r.qty) > 0);
      if (valid.length === 0) return onError('Lot No와 수량을 입력하세요.');
      lots = valid.map((r) => ({ lotNo: r.lotNo.trim(), [qtyKey]: Number(r.qty) }));
    } else {
      if (autoPreview.length === 0) return onError('Lot 범위를 올바르게 입력하세요. (최대 100개)');
      const q = parseFloat(qtyPer);
      if (!(q > 0)) return onError('Lot당 수량을 입력하세요.');
      lots = autoPreview.map((no) => ({ lotNo: no, [qtyKey]: q }));
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
      } catch (e) {
        failed.push(`${ln}: ${e.message}`);
      }
    }

    setBusy(false);
    setProgress(null);
    if (failed.length === 0) onSaved(`${lots.length}개 Lot 입고 등록 완료 (${itemName})`);
    else if (failed.length < lots.length) onSaved(`${lots.length - failed.length}개 완료, ${failed.length}개 실패:\n${failed.join('\n')}`);
    else onError(`전체 실패:\n${failed.join('\n')}`);
  }

  const autoQty = parseFloat(qtyPer) || 0;
  const validRowCount = rows.filter((r) => r.lotNo.trim() && Number(r.qty) > 0).length;

  const canSubmit = !busy && !!itemName.trim() && !!receivedDate && (
    mode === 'manual' ? validRowCount > 0 : autoPreview.length > 0 && autoQty > 0
  );

  return (
    <Modal
      title={isSub ? '부재료 입고' : '원재료 입고'}
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose} disabled={busy}>취소</button>
        <button className="btn" onClick={submit} disabled={!canSubmit}>
          {busy && progress
            ? `등록 중… (${progress.done}/${progress.total})`
            : mode === 'manual'
              ? `${validRowCount > 0 ? validRowCount + '개 ' : ''}저장`
              : `${autoPreview.length > 0 ? autoPreview.length + '개 ' : ''}저장`}
        </button>
      </>}
    >
      {/* 품목 */}
      <Field label="품목" required hint="목록에서 선택하거나 '기타'로 직접 입력">
        <ItemSelect category={isSub ? 'sub' : 'raw'} value={itemName} onChange={handleItemChange} />
      </Field>

      {/* 입고일 + 단위 — Lot 입력 전 배치 */}
      <div className="form-row">
        <Field label="입고일" required>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextInput
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              placeholder="날짜 선택"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn secondary sm"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => setReceivedDate(todayStr())}
            >오늘</button>
          </div>
        </Field>
        <Field label="단위" required>
          <UnitInput value={unit} onChange={(v) => setUnit(v)} />
        </Field>
      </div>

      {/* 업체명 + 비고 */}
      <div className="form-row">
        <Field label="업체명">
          <TextInput value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="예: (주)한솔케미칼" />
        </Field>
        <Field label="비고">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="선택 입력" />
        </Field>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

      {/* 모드 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`btn sm ${mode === 'manual' ? '' : 'secondary'}`} onClick={() => setMode('manual')} disabled={busy}>
          개별 Lot 등록
        </button>
        <button className={`btn sm ${mode === 'auto' ? '' : 'secondary'}`} onClick={() => setMode('auto')} disabled={busy}>
          Lot 자동생성
        </button>
      </div>

      {/* ── 개별 Lot 등록 */}
      {mode === 'manual' && (
        <div>
          {/* 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, marginBottom: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', padding: '0 2px' }}>
            <span>Lot No <span style={{ color: 'var(--red)' }}>*</span></span>
            <span style={{ width: 110 }}>수량({unit}) <span style={{ color: 'var(--red)' }}>*</span></span>
            <span style={{ width: 28 }}></span>
          </div>

          {rows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <TextInput
                  value={row.lotNo}
                  onChange={(e) => updateRow(i, 'lotNo', e.target.value)}
                  placeholder={`Lot ${i + 1}`}
                  style={{ flex: 1 }}
                />
                {lotPattern && (
                  <button type="button" className="btn ghost sm" title="Lot 자동생성" onClick={() => autoFillLotNo(i)}>↻</button>
                )}
              </div>
              <TextInput
                type="number"
                value={row.qty}
                onChange={(e) => updateRow(i, 'qty', e.target.value)}
                placeholder="0"
                style={{ width: 110 }}
              />
              <button
                className="btn ghost sm"
                style={{ color: 'var(--red)', width: 28, padding: 0 }}
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                title="삭제"
              >✕</button>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <button className="btn secondary sm" onClick={addRow} disabled={busy}>+ Lot 추가</button>
            {validRowCount > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {validRowCount}개 Lot · 총 {rows.filter((r) => r.lotNo.trim() && Number(r.qty) > 0).reduce((s, r) => s + Number(r.qty), 0).toLocaleString()} {unit}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Lot 자동생성 */}
      {mode === 'auto' && (
        <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px' }}>
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
          {parseInt(endNum) - parseInt(startNum) > 99 && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>⚠ 최대 100개까지 한 번에 등록 가능합니다.</div>
          )}
          <Field label="Lot당 수량" required>
            <TextInput type="number" value={qtyPer} onChange={(e) => setQtyPer(e.target.value)} placeholder="0" />
          </Field>
          {autoPreview.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 8px' }}>
                예시: <b>{autoPreview[0]}</b> ~ <b>{autoPreview[autoPreview.length - 1]}</b> (총 {autoPreview.length}개)
                {autoQty > 0 && <> · 총 <b>{(autoQty * autoPreview.length).toLocaleString()} {unit}</b></>}
              </div>
              <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {autoPreview.map((lot) => (
                  <span key={lot} style={{ background: 'var(--blue-bg, #eff6ff)', color: 'var(--blue)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500 }}>{lot}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 진행 바 */}
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
