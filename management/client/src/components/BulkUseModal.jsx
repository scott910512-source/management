import { useState, useMemo, useEffect } from 'react';
import { api } from '../api';
import { Modal, Field, TextInput, Select } from './ui';

/**
 * 일괄 출고 모달 — 여러 품목을 한 번에 출고 처리한다.
 * 입력한 사용 수량은 해당 품목의 Lot(세부 Lot A01~A20 포함)에 FIFO 순서로 자동 분배된다.
 * 즉 A01을 먼저 소진하고 부족분은 A02, A03… 순으로 처리되어, Lot에 등록된 전체를 한 번에 처리할 수 있다.
 * items: 전체 Lot 목록(active), nameField: 품목명 키, qtyField: 잔량 키
 */
export function BulkUseModal({ base, items, nameField, qtyField, title, onClose, onSaved, onError }) {
  const [qtys, setQtys] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // 공통 합성 Batch (전체 품목 동일 적용, 수정 가능)
  const [product, setProduct] = useState('');
  const [batchNo, setBatchNo] = useState('1');
  const [batchStartDate, setBatchStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [productList, setProductList] = useState([]);
  const category = base === 'sub-materials' ? 'sub' : 'raw';

  useEffect(() => {
    api.get('/products').then((d) => setProductList((d.items || []).map((p) => p.name))).catch(() => {});
  }, []);

  // 품목별 그룹 + FIFO 정렬된 Lot 목록(입고일 → Lot번호 오름차순: A01 먼저)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of items) {
      const name = r[nameField];
      const qty = Number(r[qtyField]) || 0;
      if (qty <= 0) continue;
      if (!map.has(name)) map.set(name, { name, total: 0, unit: r.unit || '', lots: [] });
      const g = map.get(name);
      g.total += qty;
      g.lots.push(r);
    }
    for (const g of map.values()) {
      g.lots.sort((a, b) => {
        const da = a.receivedDate || '9999';
        const db = b.receivedDate || '9999';
        if (da !== db) return da < db ? -1 : 1;
        return (a.lotNo || '').localeCompare(b.lotNo || '');
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, nameField, qtyField]);

  // 제품(사용처) 선택 시 BOM 기준량으로 각 품목 사용수량 자동 채움
  useEffect(() => {
    if (!product) return;
    let alive = true;
    api.get(`/products/bom?product=${encodeURIComponent(product)}`).then((d) => {
      if (!alive) return;
      const std = {};
      for (const b of d.items || []) if (b.category === category) std[b.materialName] = Number(b.qtyPerBatch) || 0;
      setQtys((prev) => {
        const next = { ...prev };
        for (const g of grouped) if (std[g.name] != null && std[g.name] > 0) next[g.name] = String(std[g.name]);
        return next;
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIFO 분배 미리보기 — 입력 수량이 어느 Lot에 얼마씩 들어가는지
  function distribute(g) {
    let remaining = Number(qtys[g.name]) || 0;
    const used = [];
    for (const lot of g.lots) {
      if (remaining <= 0) break;
      const bal = Number(lot[qtyField]) || 0;
      if (bal <= 0) continue;
      const take = Math.min(remaining, bal);
      used.push({ lot, take });
      remaining -= take;
    }
    return { used, short: remaining > 0 ? remaining : 0 };
  }

  async function submit() {
    const toProcess = grouped.filter((g) => qtys[g.name] && Number(qtys[g.name]) > 0);
    if (toProcess.length === 0) return onError('사용할 수량을 1개 이상 입력하세요.');
    for (const g of toProcess) {
      if (Number(qtys[g.name]) > g.total) {
        return onError(`'${g.name}' 사용 수량이 총 재고(${g.total.toLocaleString()}${g.unit})를 초과합니다.`);
      }
    }
    setBusy(true);
    const okItems = [];
    const errors = [];
    let lotCount = 0;
    for (const g of toProcess) {
      const { used } = distribute(g);
      try {
        for (const { lot, take } of used) {
          // FIFO 순서대로 가장 오래된 Lot부터 출고하므로 선입선출 위반이 발생하지 않는다.
          await api.post(`/${base}/${lot.id}/transaction`, { type: '출고', quantity: take, note: note || '일괄 출고(FIFO 분배)', batchNo, product, batchStartDate });
          lotCount++;
        }
        okItems.push(g.name);
      } catch (e) {
        errors.push(`${g.name}: ${e.message}`);
      }
    }
    setBusy(false);
    if (okItems.length > 0) {
      onSaved(`${okItems.length}개 품목 출고 완료 (Lot ${lotCount}건 FIFO 분배)${errors.length ? ` · ${errors.length}건 오류` : ''}`);
    } else if (errors.length > 0) {
      onError(errors.join('\n'));
    }
  }

  const setQty = (name, val) => setQtys((p) => ({ ...p, [name]: val }));
  const total = grouped.filter((g) => qtys[g.name] && Number(qtys[g.name]) > 0).length;

  return (
    <Modal
      title={title || '일괄 출고'}
      subtitle="품목별 사용 수량 입력 → FIFO(A01부터) 자동 분배 처리"
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy || total === 0}>
          {busy ? '처리 중…' : `출고 처리 (${total}개 품목)`}
        </button>
      </>}
    >
      {/* 공통 합성 Batch — 전체 품목 동일 적용(수정 가능) */}
      <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>합성 Batch (공통 적용 · 투입이력 기록)</div>
        <div className="form-row">
          <Field label="제품(사용처)" hint="선택 시 BOM 기준량 자동 입력">
            <Select value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">선택 안 함</option>
              {productList.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Batch No.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>#</span>
              <TextInput type="number" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="1" />
            </div>
          </Field>
          <Field label="합성 시작일">
            <TextInput type="date" value={batchStartDate} onChange={(e) => setBatchStartDate(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="공통 비고" hint="모든 출고 내역에 동일하게 적용됩니다">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 3공정 A배치 투입" />
      </Field>
      <div style={{ marginTop: 12 }}>
        <table className="tbl compact">
          <thead>
            <tr>
              <th>품목명</th>
              <th className="num">총 재고</th>
              <th>사용 수량</th>
              <th>분배(FIFO)</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              const inputQty = Number(qtys[g.name]) || 0;
              const over = inputQty > g.total;
              const dist = inputQty > 0 ? distribute(g) : null;
              return (
                <tr key={g.name} style={inputQty > 0 ? { background: 'var(--bg2)' } : {}}>
                  <td><b>{g.name}</b> <span className="muted" style={{ fontSize: 11 }}>({g.lots.length} Lot)</span></td>
                  <td className="num">{g.total.toLocaleString()} <span className="muted">{g.unit}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TextInput
                        type="number"
                        value={qtys[g.name] || ''}
                        onChange={(e) => setQty(g.name, e.target.value)}
                        placeholder="0"
                        style={{ width: 90 }}
                      />
                      <button type="button" className="btn secondary sm" onClick={() => setQty(g.name, String(g.total))}>전량</button>
                      <span className="muted" style={{ fontSize: 12 }}>{g.unit}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {!dist ? <span className="muted">–</span> : over ? (
                      <span style={{ color: 'var(--red)' }}>총 재고 초과</span>
                    ) : (
                      <span className="muted">{dist.used.map((u) => `${u.lot.lotNo}(${u.take.toLocaleString()})`).join(' → ')}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>입력한 수량은 가장 오래된 Lot(세부 Lot은 A01)부터 차례로 소진되어 여러 Lot에 자동 분배됩니다.</p>
      </div>
    </Modal>
  );
}
