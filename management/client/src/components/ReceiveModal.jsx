import { useState, useMemo } from 'react';
import { api } from '../api';
import { Modal, Field, TextInput, Select } from './ui';
import { UnitInput, ItemSelect, expandLot } from './inputs';

const todayStr = () => new Date().toISOString().slice(0, 10);
const newRow = (defaults = {}) => ({ lotNo: '', qty: '', unit: 'kg', vendor: '', note: '', ...defaults });

/**
 * 통합 입고 모달
 * - 행 추가 방식으로 개별 Lot 입력 (Lot No / 수량 / 단위 / 업체명 / 비고)
 * - [일괄생성하기] 패널로 A01~A20 자동생성 후 행에 추가
 * props: base('raw-materials'|'sub-materials'), onClose, onSaved(msg), onError(msg)
 */
export function ReceiveModal({ base, onClose, onSaved, onError }) {
  const isSub = base === 'sub-materials';

  const [itemName, setItemName] = useState('');
  const [meta, setMeta] = useState(null);
  const [lotPattern, setLotPattern] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [rows, setRows] = useState([newRow()]);
  const [showBulk, setShowBulk] = useState(false);

  // 자동생성 패널 상태
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
    const defUnit = m?.unit || 'kg';
    const defVendor = m?.vendor || '';
    const defQty = m?.defaultQty || '';
    const defLot = m?.lotPattern ? expandLot(m.lotPattern) : '';
    if (m?.lotPattern) { setLotPattern(m.lotPattern); setPrefix(defLot); }
    else { setLotPattern(''); }
    // 첫 행에 기본값 채움, 나머지 빈 행도 단위 갱신
    setRows((prev) => prev.map((r, i) => ({
      ...r,
      unit: defUnit,
      vendor: r.vendor || defVendor,
      qty: r.qty || defQty,
      lotNo: i === 0 && !r.lotNo && defLot ? defLot : r.lotNo,
    })));
    if (defQty) setQtyPer(defQty);
  }

  // 행 제어
  function addRow() {
    const defUnit = meta?.unit || 'kg';
    const defVendor = meta?.vendor || '';
    const defQty = meta?.defaultQty || '';
    const defLot = lotPattern ? expandLot(lotPattern) : '';
    setRows((p) => [...p, newRow({ unit: defUnit, vendor: defVendor, qty: defQty, lotNo: defLot })]);
  }
  function removeRow(i) { if (rows.length > 1) setRows((p) => p.filter((_, idx) => idx !== i)); }
  function updateRow(i, field, val) { setRows((p) => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r)); }
  function autoLot(i) { if (lotPattern) updateRow(i, 'lotNo', expandLot(lotPattern)); }

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

  function applyBulk() {
    const q = parseFloat(qtyPer);
    if (autoPreview.length === 0) return onError('Lot 범위를 올바르게 입력하세요. (최대 100개)');
    if (!(q > 0)) return onError('Lot당 수량을 입력하세요.');
    const defUnit = meta?.unit || 'kg';
    const defVendor = meta?.vendor || '';
    const generated = autoPreview.map((lot) => newRow({ lotNo: lot, qty: String(q), unit: defUnit, vendor: defVendor }));
    // 빈 행만 있으면 교체, 아니면 추가
    const hasData = rows.some((r) => r.lotNo.trim() || Number(r.qty) > 0);
    setRows(hasData ? [...rows, ...generated] : generated);
    setShowBulk(false);
  }

  // 제출
  async function submit() {
    if (!itemName.trim()) return onError('품목을 선택하거나 입력하세요.');
    if (!receivedDate) return onError('입고일을 입력하세요.');
    const valid = rows.filter((r) => r.lotNo.trim() && Number(r.qty) > 0);
    if (valid.length === 0) return onError('Lot No와 수량을 입력하세요.');

    setBusy(true);
    setProgress({ done: 0, total: valid.length });
    const failed = [];

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      const qNum = Number(r.qty);
      try {
        const payload = isSub
          ? { name: itemName.trim(), lotNo: r.lotNo.trim(), unit: r.unit, vendor: r.vendor, receivedDate, note: r.note, weight: qNum, initialWeight: qNum }
          : { itemName: itemName.trim(), lotNo: r.lotNo.trim(), unit: r.unit, vendor: r.vendor, receivedDate, note: r.note, quantity: qNum };
        await api.post(`/${base}`, payload);
        setProgress({ done: i + 1, total: valid.length });
      } catch (e) {
        failed.push(`${r.lotNo}: ${e.message}`);
      }
    }

    setBusy(false);
    setProgress(null);
    if (failed.length === 0) onSaved(`${valid.length}개 Lot 입고 등록 완료 (${itemName})`);
    else if (failed.length < valid.length) onSaved(`${valid.length - failed.length}개 완료, ${failed.length}개 실패:\n${failed.join('\n')}`);
    else onError(`전체 실패:\n${failed.join('\n')}`);
  }

  const validCount = rows.filter((r) => r.lotNo.trim() && Number(r.qty) > 0).length;
  const totalQty = rows.filter((r) => r.lotNo.trim() && Number(r.qty) > 0).reduce((s, r) => s + Number(r.qty), 0);
  const canSubmit = !busy && !!itemName.trim() && !!receivedDate && validCount > 0;

  return (
    <Modal
      title={isSub ? '부재료 입고' : '원재료 입고'}
      size="lg"
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose} disabled={busy}>취소</button>
        <button className="btn" onClick={submit} disabled={!canSubmit}>
          {busy && progress ? `등록 중… (${progress.done}/${progress.total})` : `${validCount > 0 ? validCount + '개 ' : ''}저장`}
        </button>
      </>}
    >
      {/* 품목 */}
      <Field label="품목" required hint="목록에서 선택하거나 '기타'로 직접 입력">
        <ItemSelect category={isSub ? 'sub' : 'raw'} value={itemName} onChange={handleItemChange} />
      </Field>

      {/* 입고일 */}
      <Field label="입고일" required>
        <div style={{ display: 'flex', gap: 6, maxWidth: 260 }}>
          <TextInput
            type="date"
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn secondary sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setReceivedDate(todayStr())}>오늘</button>
        </div>
      </Field>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0 12px' }} />

      {/* Lot 입력 테이블 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '26%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: 32 }} />
          </colgroup>
          <thead>
            <tr style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>
              <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Lot No <span style={{ color: 'var(--red)' }}>*</span></th>
              <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>수량 <span style={{ color: 'var(--red)' }}>*</span></th>
              <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>단위</th>
              <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>업체명</th>
              <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>비고</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ verticalAlign: 'middle' }}>
                <td style={{ paddingRight: 4, paddingBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <TextInput value={row.lotNo} onChange={(e) => updateRow(i, 'lotNo', e.target.value)} placeholder="예: T-2026-001" style={{ flex: 1, minWidth: 0, fontSize: 13 }} />
                    {lotPattern && <button type="button" className="btn ghost sm" title="자동채움" onClick={() => autoLot(i)} style={{ padding: '0 4px', fontSize: 13 }}>↻</button>}
                  </div>
                </td>
                <td style={{ paddingRight: 4, paddingBottom: 6 }}>
                  <TextInput type="number" value={row.qty} onChange={(e) => updateRow(i, 'qty', e.target.value)} placeholder="0" style={{ fontSize: 13 }} />
                </td>
                <td style={{ paddingRight: 4, paddingBottom: 6 }}>
                  <UnitInput value={row.unit} onChange={(v) => updateRow(i, 'unit', v)} style={{ fontSize: 13 }} />
                </td>
                <td style={{ paddingRight: 4, paddingBottom: 6 }}>
                  <TextInput value={row.vendor} onChange={(e) => updateRow(i, 'vendor', e.target.value)} placeholder="업체명" style={{ fontSize: 13 }} />
                </td>
                <td style={{ paddingRight: 4, paddingBottom: 6 }}>
                  <TextInput value={row.note} onChange={(e) => updateRow(i, 'note', e.target.value)} placeholder="비고" style={{ fontSize: 13 }} />
                </td>
                <td style={{ paddingBottom: 6 }}>
                  <button className="btn ghost sm" style={{ color: 'var(--red)', padding: '0 6px' }} onClick={() => removeRow(i)} disabled={rows.length === 1}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 행 추가 + 요약 + 일괄생성 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        <button className="btn secondary sm" onClick={addRow} disabled={busy}>+ 행 추가</button>
        <button className="btn secondary sm" onClick={() => setShowBulk((v) => !v)} disabled={busy}>
          {showBulk ? '▲ 일괄생성 닫기' : '▼ 일괄생성하기'}
        </button>
        {validCount > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 'auto' }}>
            {validCount}개 Lot · 총 <b>{totalQty.toLocaleString()}</b>
          </span>
        )}
      </div>

      {/* 일괄생성 패널 */}
      {showBulk && (
        <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', marginTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Lot 자동생성 (A01 ~ A20 형식)</div>
          <Field label="Lot 앞번호 (prefix)" required hint="예: T-2026-A">
            <TextInput value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="예: T-2026-A" />
          </Field>
          <div className="form-row">
            <Field label="시작 번호" required>
              <TextInput type="number" value={startNum} onChange={(e) => setStartNum(e.target.value)} placeholder="1" min="1" />
            </Field>
            <Field label="끝 번호" required>
              <TextInput type="number" value={endNum} onChange={(e) => setEndNum(e.target.value)} placeholder="20" min="1" />
            </Field>
            <Field label="자릿수">
              <Select value={digits} onChange={(e) => setDigits(e.target.value)}>
                <option value="1">1자리 (1, 2…)</option>
                <option value="2">2자리 (01, 02…)</option>
                <option value="3">3자리 (001, 002…)</option>
              </Select>
            </Field>
            <Field label="Lot당 수량" required>
              <TextInput type="number" value={qtyPer} onChange={(e) => setQtyPer(e.target.value)} placeholder="0" />
            </Field>
          </div>
          {parseInt(endNum) - parseInt(startNum) > 99 && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 6 }}>⚠ 최대 100개까지 가능합니다.</div>
          )}
          {autoPreview.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
              예시: <b>{autoPreview[0]}</b> ~ <b>{autoPreview[autoPreview.length - 1]}</b> (총 {autoPreview.length}개)
              {parseFloat(qtyPer) > 0 && <> · 총 <b>{(parseFloat(qtyPer) * autoPreview.length).toLocaleString()}</b></>}
            </div>
          )}
          <button className="btn sm" onClick={applyBulk} disabled={autoPreview.length === 0}>
            ↓ {autoPreview.length > 0 ? `${autoPreview.length}개 ` : ''}행에 추가
          </button>
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
