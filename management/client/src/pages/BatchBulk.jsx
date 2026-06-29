import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Modal, Select, Loading, Empty, ConfirmDialog, useToast } from '../components/ui';

const todayStr = () => new Date().toISOString().slice(0, 10);
const catLabel = (c) => (c === 'raw' ? '원재료' : c === 'sub' ? '부재료' : c);

// 자동 FIFO 분배 계획 — 오래된 Lot부터 채워 [{lotNo, take}] 반환(1개 Lot 부족 시 여러 Lot)
function fifoPlan(lots, qty) {
  const out = [];
  let remain = qty;
  for (const l of (lots || [])) {
    if (remain <= 0) break;
    const take = Math.min(Number(l.quantity) || 0, remain);
    if (take > 0) { out.push({ lotNo: l.lotNo, take }); remain -= take; }
  }
  return out;
}

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
  const [showLot, setShowLot] = useState(false); // Lot 직접 지정 표시 여부(기본 숨김)
  const [member, setMember] = useState({}); // 컬럼별 선택된 품목(납품업체) — { colKey: memberName }

  const key = (m) => `${m.category}|${m.name}`;
  // 컬럼의 현재 선택 멤버(품목) 객체
  const activeMember = (m) => (m.members || []).find((x) => x.name === (member[key(m)] || m.defaultMember)) || (m.members || [])[0] || m;

  // 제품 선택 시 BOM + 재고 로드
  useEffect(() => {
    if (!product) { setMats(null); setRows([]); return; }
    setLoading(true);
    api.get(`/batches/bom-stock?product=${encodeURIComponent(product)}&date=${startDate}`)
      .then((d) => {
        setMats(d.materials || []);
        setNextNo(d.nextNo || 1);
        // 컬럼별 기본 멤버 초기화
        const mm = {};
        (d.materials || []).forEach((m) => { mm[`${m.category}|${m.name}`] = m.defaultMember; });
        setMember(mm);
        // 첫 배치 1개를 BOM 기준량으로 자동 채워 시작
        const qty = {};
        (d.materials || []).forEach((m) => { qty[`${m.category}|${m.name}`] = m.qtyPerBatch; });
        setRows([{ no: String(d.nextNo || 1), year: startDate.slice(2, 4), qty, lot: {} }]); // lot[k] = [lotNo...]
      })
      .catch((e) => toast.err(e.message))
      .finally(() => setLoading(false));
  }, [product]); // eslint-disable-line

  // 멤버 변경 시 해당 컬럼 Lot 지정 초기화(다른 품목의 Lot이므로)
  const setColMember = (m, name) => {
    const k = key(m);
    setMember((p) => ({ ...p, [k]: name }));
    setRows((rs) => rs.map((r) => ({ ...r, lot: { ...r.lot, [k]: [] } })));
  };
  // Lot 체크박스 토글(다수 선택 가능 — 1개 Lot로 부족할 때)
  const toggleLot = (i, k, lotNo) => setRows((rs) => rs.map((r, idx) => {
    if (idx !== i) return r;
    const cur = r.lot[k] || [];
    const next = cur.includes(lotNo) ? cur.filter((x) => x !== lotNo) : [...cur, lotNo];
    return { ...r, lot: { ...r.lot, [k]: next } };
  }));

  const addRow = () => {
    const used = rows.map((r) => Number(r.no));
    const no = String(Math.max(nextNo - 1, ...used) + 1);
    const qty = {};
    (mats || []).forEach((m) => { qty[`${m.category}|${m.name}`] = m.qtyPerBatch; });
    setRows((rs) => [...rs, { no, year: (rs[0] && rs[0].year) || startDate.slice(2, 4), qty, lot: {} }]);
  };
  const delRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  const setYear = (i, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, year: v } : r));
  const setQty = (i, k, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, qty: { ...r.qty, [k]: v } } : r));
  const setLot = (i, k, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, lot: { ...r.lot, [k]: v } } : r));
  const setNo = (i, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, no: v } : r));

  // 자재별 총 사용량 / 차감 후 잔량
  const totals = useMemo(() => {
    const t = {};
    (mats || []).forEach((m) => {
      const k = key(m);
      const am = activeMember(m);
      const sum = rows.reduce((s, r) => s + (Number(r.qty[k]) || 0), 0);
      t[k] = { sum, after: (am.stock || 0) - sum, short: sum > (am.stock || 0) };
    });
    return t;
  }, [mats, rows, member]);

  const anyShort = Object.values(totals).some((x) => x.short);

  const post = (payload) => api.post('/batches/bulk', payload);

  const submit = async () => {
    if (!product) return toast.err('제품(사용처)을 선택하세요.');
    const batches = rows
      .filter((r) => String(r.no).trim())
      .map((r) => ({ no: r.no, year: r.year ? '20' + r.year : undefined, lines: (mats || []).map((m) => ({ category: m.category, name: activeMember(m).name, quantity: Number(r.qty[key(m)]) || 0, lotNos: r.lot[key(m)] || [] })) }));
    if (batches.length === 0) return toast.err('배치를 입력하세요.');
    if (anyShort) return toast.err('재고가 부족한 자재가 있습니다.');
    const payload = { product, startDate, txDate: startDate, batches };
    setSaving(true);
    try {
      const res = await post(payload);
      toast.ok(`${res.batches}개 배치 · ${res.transactions}건 출고 처리되었습니다.`);
      onDone();
    } catch (e) {
      if (e.status === 409 && e.data && e.data.fifoWarning) {
        setFifoWarn({ violations: e.data.violations || [], payload }); // 강제 여부 확인
      } else {
        toast.err(e.message);
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
      toast.ok(`${res.batches}개 배치 처리 · 이상발생 ${res.anomalies}건 기록되었습니다.`);
      onDone();
    } catch (e) {
      toast.err(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
   <>
    <Modal
      title="배치 일괄 처리"
      subtitle="제품을 고르면 BOM 자재가 자동으로 채워집니다. 출고는 오래된 Lot부터 자동 처리됩니다."
      size="xl"
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
        {mats && mats.length > 0 && (
          <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showLot} onChange={(e) => setShowLot(e.target.checked)} />
            Lot 직접 지정
          </label>
        )}
      </div>

      {loading && <Loading />}
      {!loading && product && mats && mats.length === 0 && <Empty>이 제품에 등록된 BOM 자재가 없습니다. (기준정보에서 BOM 설정 필요)</Empty>}

      {!loading && mats && mats.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="batch-matrix">
            <thead>
              <tr>
                <th className="bm-corner">배치 No.</th>
                {mats.map((m) => {
                  const am = activeMember(m);
                  return (
                  <th key={key(m)}>
                    <div className="bm-mat">{m.group || m.name}</div>
                    {m.members && m.members.length > 1 ? (
                      <select className="bm-member" value={member[key(m)] || m.defaultMember} onChange={(e) => setColMember(m, e.target.value)} title="납품업체(품목) 선택">
                        {m.members.map((mb) => <option key={mb.name} value={mb.name}>{mb.name}{mb.vendor ? ` · ${mb.vendor}` : ''}{mb.isDefault ? ' (기본)' : ''}</option>)}
                      </select>
                    ) : null}
                    <div className="bm-meta">재고 {(am.stock || 0).toLocaleString()}{m.unit} · BOM {m.qtyPerBatch}</div>
                  </th>
                  );
                })}
                <th className="bm-del"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <input className="bm-yr" value={r.year || ''} onChange={(e) => setYear(i, e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} title="연도(2자리)" />
                      <span className="bm-hash">#</span>
                      <input className="bm-no" value={r.no} onChange={(e) => setNo(i, e.target.value.replace(/[^0-9]/g, ''))} />
                    </span>
                  </td>
                  {mats.map((m) => {
                    const k = key(m);
                    const am = activeMember(m);
                    const sel = r.lot[k] || []; // 선택된 Lot 목록(빈 배열=자동 FIFO 전체)
                    const effLots = sel.length ? (am.lots || []).filter((l) => sel.includes(l.lotNo)) : (am.lots || []);
                    const plan = fifoPlan(effLots, Number(r.qty[k]) || 0);
                    return (
                      <td key={k}>
                        <input
                          className="bm-qty"
                          type="number" min="0"
                          value={r.qty[k] ?? ''}
                          onChange={(e) => setQty(i, k, e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        {showLot ? (
                          <div className="bm-lotpick">
                            {(am.lots || []).length === 0 ? <span className="bm-short">Lot 없음</span>
                              : (am.lots || []).map((l) => (
                                <label key={l.lotNo} title={`입고 ${l.receivedDate}`}>
                                  <input type="checkbox" checked={sel.includes(l.lotNo)} onChange={() => toggleLot(i, k, l.lotNo)} />
                                  {l.lotNo} <span className="bm-take">{l.quantity.toLocaleString()}{m.unit}</span>
                                </label>
                              ))}
                          </div>
                        ) : (
                          <div className="bm-lotinfo" title="출고될 Lot (선입선출)">
                            {plan.length === 0 ? <span className="bm-short">{am.oldestLot ? `↳ ${am.oldestLot}` : 'Lot 없음'}</span>
                              : plan.map((p) => <div key={p.lotNo}>↳ {p.lotNo} <span className="bm-take">{p.take.toLocaleString()}{m.unit}</span></div>)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="bm-del">
                    {rows.length > 1 && <button className="bm-x" onClick={() => delRow(i)} title="배치 삭제">✕</button>}
                  </td>
                </tr>
              ))}
              <tr className="bm-after">
                <td>차감 후 잔량</td>
                {mats.map((m) => {
                  const t = totals[key(m)];
                  return <td key={key(m)} className={t.short ? 'bm-short' : ''}><b>{t.after.toLocaleString()}</b> {m.unit}{t.short ? ' ⚠' : ''}</td>;
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
  const { canWrite, isAdmin, plant } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [inputs, setInputs] = useState(null);
  const [open, setOpen] = useState(false);
  const [expand, setExpand] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [delBulk, setDelBulk] = useState(false);
  const [sp, setSp] = useSearchParams();

  // 종합현황 퀵메뉴(?new=1)로 진입 시 새 배치 처리 모달 자동 오픈
  useEffect(() => {
    if (sp.get('new') === '1' && canWrite) { setOpen(true); setSp({}, { replace: true }); }
  }, [sp]); // eslint-disable-line

  const load = () => {
    Promise.all([api.get('/products'), api.get('/batches/inputs')])
      .then(([p, b]) => { setProducts(p.items || []); setInputs(b.items || []); setSel(new Set()); })
      .catch(() => { setProducts([]); setInputs([]); });
  };
  useEffect(load, [plant]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function removeBulk() {
    try { const r = await api.post('/transactions/bulk-delete', { batchIds: [...sel], restock: true }); setDelBulk(false); load(); toast.ok(`${r.removed}건(${sel.size}배치) 삭제 · 재고를 원복했습니다.`); }
    catch (e) { toast.err(e.message); }
  }

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
        <div className="desc" style={{ flex: 1 }}>제품(사용처)별 BOM 자재를 배치로 출고 처리하고, <b>투입이력</b>을 함께 확인합니다. 출고는 오래된 Lot부터 FIFO 자동 분배됩니다.</div>
        {isAdmin && sel.size > 0 && <button className="btn danger sm" onClick={() => setDelBulk(true)}>선택 삭제 ({sel.size}배치)</button>}
        <button className="btn secondary sm" onClick={() => downloadCsv('/batches/inputs/export')}>CSV 내보내기</button>
        {canWrite && <button className="btn" onClick={() => setOpen(true)}>+ 새 배치 처리</button>}
      </div>

      {inputs === null && <Loading />}
      {inputs && inputs.length === 0 && <Empty>아직 처리된 배치가 없습니다. [+ 새 배치 처리]로 시작하세요.</Empty>}

      {inputs && inputs.length > 0 && (
        <div className="card card-pad">
          <table className="tbl">
            <thead>
              <tr>{isAdmin && <th style={{ width: 1 }}></th>}<th>제품(사용처)</th><th>배치 No.</th><th>합성 시작일</th><th style={{ textAlign: 'right' }}>투입 자재</th><th style={{ textAlign: 'right' }}>총 사용량</th><th></th></tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([prod, list]) => (
                <Fragment key={prod}>
                  <tr><td colSpan={isAdmin ? 7 : 6} style={{ fontWeight: 700, background: 'var(--accent-soft, #f3f6fb)' }}>{prod}</td></tr>
                  {list.map((b) => (
                    <Fragment key={b.batchId}>
                      <tr style={{ cursor: 'pointer', ...(sel.has(b.batchId) ? { background: 'var(--accent-soft,#eaf3fe)' } : {}) }} onClick={() => setExpand(expand === b.batchId ? null : b.batchId)}>
                        {isAdmin && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(b.batchId)} onChange={() => toggle(b.batchId)} /></td>}
                        <td>{b.product || '(미지정)'}</td>
                        <td><b>#{b.batchNo}</b></td>
                        <td>{b.startDate || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{b.materials.length}종</td>
                        <td style={{ textAlign: 'right' }}>{totalOf(b)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--blue,#0071e3)' }}>{expand === b.batchId ? '▲' : '▼'}</td>
                      </tr>
                      {expand === b.batchId && (
                        <tr key={b.batchId + '_d'}>
                          <td colSpan={isAdmin ? 7 : 6} style={{ background: '#fafbff' }}>
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
      {delBulk && (
        <ConfirmDialog
          title="배치 삭제 (재고 원복)"
          message={`선택한 ${sel.size}개 배치의 투입(출고) 내역을 삭제할까요? 수불 이력에서 제거되고, 출고되었던 수량은 해당 Lot 재고로 다시 원복됩니다.`}
          onClose={() => setDelBulk(false)}
          onConfirm={removeBulk}
        />
      )}
    </div>
  );
}
