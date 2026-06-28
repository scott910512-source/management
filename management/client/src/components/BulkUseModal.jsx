import { useState, useMemo } from 'react';
import { api } from '../api';
import { Modal, Field, TextInput } from './ui';

/**
 * 일괄 출고 모달 — 여러 품목을 한 번에 출고 처리한다.
 * items: 전체 Lot 목록 (active 포함), nameField: 품목명 키, qtyField: 잔량 키
 */
export function BulkUseModal({ base, items, nameField, qtyField, title, onClose, onSaved, onError }) {
  const [qtys, setQtys] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [fifoConflicts, setFifoConflicts] = useState(null); // [{g, fifoData}] waiting for force confirm

  // 품목별로 그룹화: 총 잔량 + FIFO 기준 가장 오래된 Lot
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of items) {
      const name = r[nameField];
      const qty = Number(r[qtyField]) || 0;
      if (qty <= 0) continue;
      if (!map.has(name)) map.set(name, { name, total: 0, unit: r.unit || '', oldestLot: null });
      const g = map.get(name);
      g.total += qty;
      if (!g.oldestLot || (r.receivedDate && r.receivedDate < g.oldestLot.receivedDate)) {
        g.oldestLot = r;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, nameField, qtyField]);

  async function doSubmit(toProcess, force) {
    setBusy(true);
    const errors = [];
    const ok = [];
    const fifoList = [];
    for (const g of toProcess) {
      try {
        await api.post(`/${base}/${g.oldestLot.id}/transaction`, {
          type: '출고',
          quantity: Number(qtys[g.name]),
          note: note || '일괄 출고',
          force,
        });
        ok.push(g.name);
      } catch (e) {
        if (!force && e.status === 409 && e.data?.fifoWarning) {
          fifoList.push({ g, fifoData: e.data });
        } else {
          errors.push(`${g.name}: ${e.message}`);
        }
      }
    }
    setBusy(false);
    if (fifoList.length > 0) {
      setFifoConflicts(fifoList);
      if (ok.length > 0) onSaved(`${ok.length}개 품목 출고 완료 (선입선출 오류 ${fifoList.length}건 확인 필요)`);
    } else {
      if (ok.length > 0) onSaved(`${ok.length}개 품목 출고 완료${errors.length > 0 ? ` (${errors.length}건 오류)` : ''}`);
      if (errors.length > 0) onError(errors.join('\n'));
    }
  }

  async function submit() {
    const toProcess = grouped.filter((g) => qtys[g.name] && Number(qtys[g.name]) > 0);
    if (toProcess.length === 0) return onError('사용할 수량을 1개 이상 입력하세요.');
    await doSubmit(toProcess, false);
  }

  async function forceSubmit() {
    if (!fifoConflicts) return;
    const toForce = fifoConflicts.map((c) => c.g);
    setFifoConflicts(null);
    await doSubmit(toForce, true);
  }

  const setQty = (name, val) => setQtys((p) => ({ ...p, [name]: val }));
  const total = grouped.filter((g) => qtys[g.name] && Number(qtys[g.name]) > 0).length;

  if (fifoConflicts) {
    return (
      <Modal
        title="⚠ 선입선출 오류 확인"
        onClose={() => setFifoConflicts(null)}
        footer={<>
          <button className="btn secondary" onClick={() => setFifoConflicts(null)}>취소</button>
          <button className="btn danger" onClick={forceSubmit}>강제 출고</button>
        </>}
      >
        <p style={{ margin: '0 0 12px', color: 'var(--text-2)' }}>
          아래 품목에서 선입선출 오류가 발생했습니다. 강제 출고 시 <b>이상발생 목록에 자동 기록</b>됩니다.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {fifoConflicts.map(({ g, fifoData }) => (
            <li key={g.name} style={{ marginBottom: 6 }}>
              <b>{g.name}</b> — 더 빠른 Lot: <b>{fifoData.earliest?.lotNo}</b> (입고 {fifoData.earliest?.receivedDate})
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      title={title || '일괄 출고'}
      subtitle="품목별 사용 수량 입력 → 한 번에 처리"
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy || total === 0}>
          {busy ? '처리 중…' : `출고 처리 (${total}개 품목)`}
        </button>
      </>}
    >
      <Field label="공통 비고" hint="모든 출고 내역에 동일하게 적용됩니다">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 3공정 A배치 투입" />
      </Field>
      <div style={{ marginTop: 12 }}>
        <table className="tbl compact">
          <thead>
            <tr>
              <th>품목명</th>
              <th className="num">현재고</th>
              <th className="num">선입 Lot 잔량</th>
              <th>사용 수량</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              const lotQty = Number(g.oldestLot?.[qtyField]) || 0;
              const inputQty = Number(qtys[g.name]) || 0;
              const over = inputQty > lotQty;
              return (
                <tr key={g.name} style={inputQty > 0 ? { background: 'var(--bg2)' } : {}}>
                  <td><b>{g.name}</b></td>
                  <td className="num">{g.total.toLocaleString()} <span className="muted">{g.unit}</span></td>
                  <td className="num">
                    <span style={{ color: over ? 'var(--red)' : undefined }}>
                      {lotQty.toLocaleString()}
                    </span>
                    <span className="muted" style={{ fontSize: 11 }}> {g.unit}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TextInput
                        type="number"
                        value={qtys[g.name] || ''}
                        onChange={(e) => setQty(g.name, e.target.value)}
                        placeholder="0"
                        style={{ width: 90 }}
                      />
                      <span className="muted" style={{ fontSize: 12 }}>{g.unit}</span>
                      {over && <span style={{ color: 'var(--red)', fontSize: 11 }}>선입 Lot 초과</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>선입선출(FIFO) 기준으로 가장 오래된 Lot이 자동 선택됩니다. 선입 Lot 잔량을 초과하면 분할 처리가 필요합니다.</p>
      </div>
    </Modal>
  );
}
