import { useEffect, useState, useCallback, Fragment } from 'react';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty, Badge, ConfirmDialog, useToast } from '../components/ui';

const catLabel = (c) => (c === 'raw' ? '원재료' : c === 'sub' ? '부재료' : c);
const catColor = (c) => (c === 'raw' ? 'blue' : 'orange');
const MAX_COLS = 3; // 가로 투입품목 칸 수(최대 3)

// 한 배치의 materials(품목+Lot 단위)를 품목명 기준으로 묶어 [{name,category,lots:[{qty,unit,lotNo}]}]
function groupByItem(materials) {
  const map = new Map();
  for (const m of materials) {
    if (!map.has(m.name)) map.set(m.name, { name: m.name, category: m.category, lots: [] });
    map.get(m.name).lots.push({ qty: m.quantity, unit: m.unit, lotNo: m.lotNo });
  }
  return Array.from(map.values());
}

// 투입품목 한 칸 — 품목명 + (Lot 다수면 세로로) 수량·Lot
function ItemCell({ item }) {
  if (!item) return <td className="muted" style={{ textAlign: 'center' }}>–</td>;
  return (
    <td style={{ verticalAlign: 'top' }}>
      <div style={{ marginBottom: 3 }}><Badge color={catColor(item.category)}>{catLabel(item.category)}</Badge> <b>{item.name}</b></div>
      {item.lots.map((l, i) => (
        <div key={i} className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
          <b style={{ color: 'var(--text)' }}>{Number(l.qty).toLocaleString()}{l.unit}</b> · {l.lotNo || '–'}
        </div>
      ))}
    </td>
  );
}

export default function InputHistory() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [delBulk, setDelBulk] = useState(false);

  const load = useCallback(async () => {
    const d = await api.get('/batches/inputs');
    setItems(d.items);
    setSel(new Set());
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function removeBulk() {
    try { const r = await api.post('/transactions/bulk-delete', { batchIds: [...sel], restock: true }); setDelBulk(false); load(); toast.ok(`${r.removed}건(투입 ${sel.size}배치) 삭제 · 재고를 원복했습니다.`); }
    catch (e) { toast.err(e.message); }
  }

  // 제품(사용처)별 그룹 → 탭
  const productLabel = (p) => p || '(제품 미지정)';
  const products = [];
  const byProduct = {};
  for (const b of items || []) {
    const key = productLabel(b.product);
    if (!byProduct[key]) { byProduct[key] = []; products.push(key); }
    byProduct[key].push(b);
  }
  // 현재 탭 보정
  useEffect(() => {
    if (products.length && !products.includes(tab)) setTab(products[0]);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const batches = (byProduct[tab] || []).map((b) => ({ ...b, grouped: groupByItem(b.materials) }));

  return (
    <>
      <div className="page-head">
        <div className="desc">합성 Batch별 원·부재료 <b>투입 현황</b>을 <b>제품별 탭</b>으로 확인합니다. 출고(사용) 시 입력한 Batch No. 기준으로 집계됩니다.</div>
        <div className="btn-row">
          {isAdmin && sel.size > 0 && <button className="btn danger sm" onClick={() => setDelBulk(true)}>선택 삭제 ({sel.size}배치)</button>}
          <button className="btn secondary sm" onClick={() => downloadCsv('/batches/inputs/export')}>⬇ CSV 다운로드</button>
        </div>
      </div>

      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="card card-pad"><Empty>투입이력이 없습니다. 원·부재료 출고(사용) 시 Batch No.를 입력하면 이곳에 집계됩니다.</Empty></div>
      ) : (
        <>
          <div className="sheet-tabs">
            {products.map((p) => (
              <button key={p} className={`sheet-tab ${tab === p ? 'active' : ''}`} onClick={() => setTab(p)}>{p}</button>
            ))}
          </div>

          <div className="card table-wrap" style={{ borderTopLeftRadius: 0 }}>
            <table className="tbl compact">
              <thead>
                <tr>
                  {isAdmin && <th style={{ width: 1 }}></th>}
                  <th style={{ width: 70 }}>Batch</th>
                  <th style={{ width: 100 }}>합성시작일</th>
                  <th>투입품목 1</th>
                  <th>투입품목 2</th>
                  <th>투입품목 3</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const over = b.grouped.slice(MAX_COLS); // 4번째 이상 품목
                  return (
                    <Fragment key={b.batchId}>
                      <tr style={sel.has(b.batchId) ? { background: 'var(--accent-soft, #eaf3fe)' } : {}}>
                        {isAdmin && <td style={{ verticalAlign: 'top' }}><input type="checkbox" checked={sel.has(b.batchId)} onChange={() => toggle(b.batchId)} /></td>}
                        <td style={{ verticalAlign: 'top' }}><b style={{ color: 'var(--accent)', fontSize: 15 }}>#{b.batchNo}</b></td>
                        <td className="muted" style={{ verticalAlign: 'top' }}>{b.startDate || '–'}</td>
                        {[0, 1, 2].map((i) => <ItemCell key={i} item={b.grouped[i]} />)}
                      </tr>
                      {over.length > 0 && (
                        <tr>
                          {isAdmin && <td></td>}
                          <td></td>
                          <td className="muted" style={{ fontSize: 11 }}>추가 투입</td>
                          <td colSpan={3} style={{ fontSize: 12 }} className="muted">
                            {over.map((it) => `${it.name}(${it.lots.map((l) => `${Number(l.qty).toLocaleString()}${l.unit}/${l.lotNo}`).join(', ')})`).join(' · ')}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {delBulk && (
        <ConfirmDialog
          title="투입이력 일괄 삭제"
          message={`선택한 ${sel.size}개 배치의 투입(출고) 내역을 삭제할까요? 수불 이력에서도 함께 제거되고, 출고되었던 수량은 해당 Lot 재고로 다시 원복됩니다.`}
          onClose={() => setDelBulk(false)}
          onConfirm={removeBulk}
        />
      )}
    </>
  );
}
