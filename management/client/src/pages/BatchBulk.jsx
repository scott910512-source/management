import { Fragment, useEffect, useMemo, useState } from 'react';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Modal, Select, Loading, Empty, ConfirmDialog, useToast } from '../components/ui';

const todayStr = () => new Date().toISOString().slice(0, 10);
const catLabel = (c) => (c === 'raw' ? '원재료' : c === 'sub' ? '부재료' : c);

// ===== 입력 팝업 (행=배치 / 열=자재) =====
function BulkModal({ products, onClose, onDone }) {
  const toast = useToast();
  const [product, setProduct] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [mats, setMats] = useState(null); // BOM 자재 + 재고
  const [nextNo, setNextNo] = useState(1);
  const [rows, setRows] = useState([]); // [{ no, qty: {key: number}, lot: {key: lotNo} }]
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fifoWarn, setFifoWarn] = useState(null); // { violations, payload }

  const key = (m) => `${m.category}|${m.name}`;

  // 제품 선택 시 BOM + 재고 로드
  useEffect(() => {
    if (!product) { setMats(null); setRows([]); return; }
    setLoading(true);
    api.get(`/batches/bom-stock?product=${encodeURIComponent(product)}&date=${startDate}`)
      .then((d) => {
        setMats(d.materials || []);
        setNextNo(d.nextNo || 1);
        // 첫 배치 1개를 BOM 기준량으로 자동 채워 시작
        const qty = {};
        (d.materials || []).forEach((m) => { qty[`${m.category}|${m.name}`] = m.qtyPerBatch; });
        setRows([{ no: String(d.nextNo || 1), qty, lot: {} }]);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [product]); // eslint-disable-line

  const addRow = () => {
    const used = rows.map((r) => Number(r.no));
    const no = String(Math.max(nextNo - 1, ...used) + 1);
    const qty = {};
    (mats || []).forEach((m) => { qty[`${m.category}|${m.name}`] = m.qtyPerBatch; });
    setRows((rs) => [...rs, { no, qty, lot: {} }]);
  };
  const delRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const setQty = (i, k, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, qty: { ...r.qty, [k]: v } } : r));
  const setLot = (i, k, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, lot: { ...r.lot, [k]: v } } : r));
  const setNo = (i, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, no: v } : r));

  // 자재별 총 사용량 / 차감 후 잔량
  const totals = useMemo(() => {
    const t = {};
    (mats || []).forEach((m) => {
      const k = key(m);
      const sum = rows.reduce((s, r) => s + (Number(r.qty[k]) || 0), 0);
      t[k] = { sum, after: m.stock - sum, short: sum > m.stock };
    });
    return t;
  }, [mats, rows]);

  const anyShort = Object.values(totals).some((x) => x.short);

  const post = (payload) => api.post('/batches/bulk', payload);

  const submit = async () => {
    if (!product) return toast.error('제품(사용처)을 선택하세요.');
    const batches = rows
      .filter((r) => String(r.no).trim())
      .map((r) => ({ no: r.no, lines: (mats || []).map((m) => ({ category: m.category, name: m.name, quantity: Number(r.qty[key(m)]) || 0, lotNo: r.lot[key(m)] || '' })) }));
    if (batches.length === 0) return toast.error('배치를 입력하세요.');
    if (anyShort) return toast.error('재고가 부족한 자재가 있습니다.');
    const payload = { product, startDate, txDate: startDate, batches };
    setSaving(true);
    try {
      const res = await post(payload);
      toast.success(`${res.batches}개 배치 · ${res.transactions}건 출고 처리되었습니다.`);
      onDone();
    } catch (e) {
      if (e.status === 409 && e.data && e.data.fifoWarning) {
        setFifoWarn({ violations: e.data.violations || [], payload }); // 강제 여부 확인
      } else {
        toast.error(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // 선입선출 경고 → 강제 진행
  const forceSubmit = async () => {
    const payload = { ...fifoWarn.payload, force: true };
    setFifoWarn(null);
    setSaving(true);
    try {
      const res = await post(payload);
      toast.success(`${res.batches}개 배치 처리 · 이상발생 ${res.anomalies}건 기록되었습니다.`);
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
   <>
    <Modal
      title="배치 일괄 처리"
      subtitle="제품(사용처)의 BOM 자재를 여러 배치에 한 번에 출고 — 기본 FIFO 자동, Lot 직접 선택 가능"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={addRow} disabled={!mats || !mats.length}>+ 배치 추가</button>
          <div style={{ flex: 1 }} />
          <button className="btn secondary" onClick={onClose}>취소</button>
          <button className="btn" onClick={submit} disabled={saving || !mats || !mats.length || anyShort}>
            {saving ? '처리 중…' : `일괄 출고 처리${rows.length ? ` (${rows.length}배치)` : ''}`}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>사용처 (제품군)</label>
          <Select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">제품 선택…</option>
            {products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </Select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>합성 시작일</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        {mats && <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-2)' }}>BOM 자재 <b>{mats.length}종</b> 자동 로드 · 다음 배치번호 <b>#{nextNo}</b></div>}
      </div>

      {loading && <Loading />}
      {!loading && product && mats && mats.length === 0 && <Empty>이 제품에 등록된 BOM 자재가 없습니다. (기준정보에서 BOM 설정 필요)</Empty>}

      {!loading && mats && mats.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="batch-matrix">
            <thead>
              <tr>
                <th className="bm-corner">배치 No.</th>
                {mats.map((m) => (
                  <th key={key(m)}>
                    <div className="bm-mat">{m.name}</div>
                    <div className="bm-meta">{catLabel(m.category)} · {m.unit}</div>
                    <div className="bm-meta">BOM {m.qtyPerBatch}{m.unit} / 배치</div>
                  </th>
                ))}
                <th className="bm-del"></th>
              </tr>
              <tr className="bm-stockrow">
                <th>현재 재고</th>
                {mats.map((m) => (
                  <th key={key(m)}>
                    <b>{m.stock.toLocaleString()}</b> {m.unit}
                    <div className="bm-meta">{m.oldestLot ? `${m.oldestLot} 우선` : 'Lot 없음'}</div>
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className="bm-hash">#</span>
                    <input className="bm-no" value={r.no} onChange={(e) => setNo(i, e.target.value.replace(/[^0-9]/g, ''))} />
                  </td>
                  {mats.map((m) => {
                    const k = key(m);
                    const manual = r.lot[k];
                    return (
                      <td key={k}>
                        <input
                          className="bm-qty"
                          type="number" min="0"
                          value={r.qty[k] ?? ''}
                          onChange={(e) => setQty(i, k, e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        <select
                          className={`bm-lot ${manual ? 'on' : ''}`}
                          value={manual || ''}
                          onChange={(e) => setLot(i, k, e.target.value)}
                          title="Lot 선택 — 기본은 자동(FIFO)"
                        >
                          <option value="">자동 (FIFO)</option>
                          {(m.lots || []).map((l) => (
                            <option key={l.lotNo} value={l.lotNo}>{l.lotNo} · {l.quantity.toLocaleString()}{m.unit}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td className="bm-del">
                    {rows.length > 1 && <button className="bm-x" onClick={() => delRow(i)} title="배치 삭제">✕</button>}
                  </td>
                </tr>
              ))}
              <tr className="bm-sum">
                <td>총 사용량</td>
                {mats.map((m) => { const t = totals[key(m)]; return <td key={key(m)}>{t.sum.toLocaleString()} {m.unit}</td>; })}
                <td></td>
              </tr>
              <tr className="bm-after">
                <td>차감 후 잔량</td>
                {mats.map((m) => {
                  const t = totals[key(m)];
                  return <td key={key(m)} className={t.short ? 'bm-short' : ''}>{t.after.toLocaleString()} {m.unit}{t.short ? ' ⚠' : ''}</td>;
                })}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {anyShort && <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--red-soft,#ffe9e7)', color: 'var(--red,#ff3b30)', fontSize: 13.5 }}>재고가 부족한 자재가 있어 처리할 수 없습니다. 사용량을 줄이거나 입고 후 진행하세요.</div>}
    </Modal>
    {fifoWarn && (
      <ConfirmDialog
        title="선입선출(FIFO) 경고"
        danger
        confirmLabel="강제 사용 (이상발생 기록)"
        onConfirm={forceSubmit}
        onClose={() => setFifoWarn(null)}
        message={
          <span>
            입고일이 더 빠른 Lot이 있는데 다른 Lot을 지정했습니다. 강제 사용 시 [이상발생 목록]에 기록됩니다.
            <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
              {fifoWarn.violations.map((v, i) => (
                <li key={i} style={{ fontSize: 13 }}>#{v.batchNo} <b>{v.name}</b> — 지정 {v.chosenLot} · 더 빠른 Lot <b>{v.earliestLot}</b>({v.earliestDate})</li>
              ))}
            </ul>
          </span>
        }
      />
    )}
   </>
  );
}

// ===== 현황 페이지 =====
export default function BatchBulk() {
  const { canWrite, plant } = useAuth();
  const [products, setProducts] = useState([]);
  const [inputs, setInputs] = useState(null);
  const [open, setOpen] = useState(false);
  const [expand, setExpand] = useState(null);

  const load = () => {
    Promise.all([api.get('/products'), api.get('/batches/inputs')])
      .then(([p, b]) => { setProducts(p.items || []); setInputs(b.items || []); })
      .catch(() => { setProducts([]); setInputs([]); });
  };
  useEffect(load, [plant]);

  // 제품별 그룹핑
  const grouped = useMemo(() => {
    const g = {};
    (inputs || []).forEach((b) => { (g[b.product || '(미지정)'] = g[b.product || '(미지정)'] || []).push(b); });
    return g;
  }, [inputs]);

  const totalOf = (b) => {
    const byUnit = {};
    b.materials.forEach((m) => { byUnit[m.unit] = (byUnit[m.unit] || 0) + (Number(m.quantity) || 0); });
    return Object.entries(byUnit).map(([u, v]) => `${v.toLocaleString()} ${u}`).join(' / ');
  };

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="desc" style={{ flex: 1 }}>제품(사용처)의 BOM 자재를 여러 배치에 한 번에 출고 처리합니다. 출고는 가장 오래된 Lot부터 FIFO로 자동 분배됩니다.</div>
        <button className="btn secondary sm" onClick={() => downloadCsv('/batches/inputs/export')}>CSV 내보내기</button>
        {canWrite && <button className="btn" onClick={() => setOpen(true)}>+ 새 배치 처리</button>}
      </div>

      {inputs === null && <Loading />}
      {inputs && inputs.length === 0 && <Empty>아직 처리된 배치가 없습니다. [+ 새 배치 처리]로 시작하세요.</Empty>}

      {inputs && inputs.length > 0 && (
        <div className="card card-pad">
          <table className="tbl">
            <thead>
              <tr><th>제품(사용처)</th><th>배치 No.</th><th>합성 시작일</th><th style={{ textAlign: 'right' }}>투입 자재</th><th style={{ textAlign: 'right' }}>총 사용량</th><th></th></tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([prod, list]) => (
                <Fragment key={prod}>
                  <tr><td colSpan={6} style={{ fontWeight: 700, background: 'var(--accent-soft, #f3f6fb)' }}>{prod}</td></tr>
                  {list.map((b) => (
                    <Fragment key={b.batchId}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => setExpand(expand === b.batchId ? null : b.batchId)}>
                        <td>{b.product || '(미지정)'}</td>
                        <td><b>#{b.batchNo}</b></td>
                        <td>{b.startDate || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{b.materials.length}종</td>
                        <td style={{ textAlign: 'right' }}>{totalOf(b)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--blue,#0071e3)' }}>{expand === b.batchId ? '▲' : '▼'}</td>
                      </tr>
                      {expand === b.batchId && (
                        <tr key={b.batchId + '_d'}>
                          <td colSpan={6} style={{ background: '#fafbff' }}>
                            <table className="tbl compact">
                              <thead><tr><th>구분</th><th>품목</th><th style={{ textAlign: 'right' }}>투입량</th><th>투입 Lot</th></tr></thead>
                              <tbody>
                                {b.materials.map((m, i) => (
                                  <tr key={i}><td>{catLabel(m.category)}</td><td>{m.name}</td><td style={{ textAlign: 'right' }}>{Number(m.quantity).toLocaleString()} {m.unit}</td><td>{m.lotNo}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <BulkModal products={products} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}
