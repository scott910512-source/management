import { useEffect, useState, useCallback } from 'react';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty, Badge, Select, Modal, Field, TextInput, ConfirmDialog, useToast } from '../components/ui';

const catLabel = { raw: '원재료', sub: '부재료', canister: 'Canister' };
const catColor = { raw: 'blue', sub: 'purple', canister: 'green' };
const inTypes = ['입고', '반입'];

export default function Transactions() {
  const { isAdmin, canWrite } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [delBulk, setDelBulk] = useState(false);
  const [f, setF] = useState({ materialType: '', type: '', q: '', from: '', to: '', sort: 'category' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  function setMonth(offset) {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, d.getMonth() + 1, 0).getDate();
    setF((p) => ({ ...p, from: `${y}-${m}-01`, to: `${y}-${m}-${last}` }));
  }

  const params = () => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  };

  const load = useCallback(async () => {
    const d = await api.get('/transactions?' + params());
    setItems(d.items);
    setSel(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => (items && s.size === items.length ? new Set() : new Set((items || []).map((t) => t.id))));
  async function removeBulk() {
    try { const r = await api.post('/transactions/bulk-delete', { ids: [...sel] }); setDelBulk(false); load(); toast.ok(`${r.removed}건 삭제했습니다.`); }
    catch (e) { toast.err(e.message); }
  }

  return (
    <>
      <div className="page-head">
        <div className="desc">원재료·부재료·Canister의 입출고(수불) 작성 이력 전체입니다. 해당 없는 항목은 빈칸으로 표시됩니다.</div>
        <div className="btn-row">
          {isAdmin && sel.size > 0 && <button className="btn danger sm" onClick={() => setDelBulk(true)}>선택 삭제 ({sel.size})</button>}
          <button className="btn secondary sm" onClick={() => downloadCsv('/transactions/export?' + params())}>⬇ CSV Export</button>
        </div>
      </div>

      <div className="toolbar">
        <Select value={f.materialType} onChange={(e) => set('materialType', e.target.value)} style={{ width: 130 }}>
          <option value="">대분류 전체</option>
          <option value="raw">원재료</option>
          <option value="sub">부재료</option>
          <option value="canister">Canister</option>
        </Select>
        <Select value={f.type} onChange={(e) => set('type', e.target.value)} style={{ width: 120 }}>
          <option value="">입출고 전체</option>
          <option value="입고">입고</option>
          <option value="출고">출고</option>
          <option value="반입">반입</option>
          <option value="반출">반출</option>
        </Select>
        <Select value={f.sort} onChange={(e) => set('sort', e.target.value)} style={{ width: 150 }}>
          <option value="category">대분류·품목순</option>
          <option value="date">최신순</option>
        </Select>
        <div className="search">
          <span>🔍</span>
          <input placeholder="품목/Lot/내용물 검색" value={f.q} onChange={(e) => set('q', e.target.value)} />
        </div>
        <div className="spacer" />
        <button className="btn secondary sm" onClick={() => setMonth(-1)}>지난달</button>
        <button className="btn secondary sm" onClick={() => setMonth(0)}>이번달</button>
        <button className="btn secondary sm" onClick={() => setF((p) => ({ ...p, from: '', to: '' }))}>전체</button>
        <input className="input" type="date" style={{ width: 145 }} value={f.from} onChange={(e) => set('from', e.target.value)} />
        <span className="muted">~</span>
        <input className="input" type="date" style={{ width: 145 }} value={f.to} onChange={(e) => set('to', e.target.value)} />
      </div>

      <div className="card table-wrap">
        {!items ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty>수불 내역이 없습니다.</Empty>
        ) : (
          <table className="tbl compact">
            <thead>
              <tr>
                {isAdmin && <th style={{ width: 1 }}><input type="checkbox" checked={items.length > 0 && sel.size === items.length} onChange={toggleAll} title="전체 선택" /></th>}
                <th>일시</th>
                <th>대분류</th>
                <th>제품/품목</th>
                <th>Lot / 내용물</th>
                <th>구분</th>
                <th className="num">수량</th>
                <th className="num">처리후</th>
                <th>비고</th>
                <th>작성자</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} style={sel.has(t.id) ? { background: 'var(--accent-soft, #eaf3fe)' } : {}}>
                  {isAdmin && <td><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} /></td>}
                  <td className="muted">{(t.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                  <td><Badge color={catColor[t.materialType] || ''}>{catLabel[t.materialType] || t.materialType}</Badge></td>
                  <td><b>{t.materialName || ''}</b></td>
                  <td className="muted">{t.lotNo || t.content || ''}</td>
                  <td><Badge color={inTypes.includes(t.type) ? 'green' : 'orange'}>{t.type}</Badge></td>
                  <td className="num">{t.quantity ? Number(t.quantity).toLocaleString() + (t.unit || '') : ''}</td>
                  <td className="num muted">{t.balanceAfter !== '' && t.balanceAfter != null ? Number(t.balanceAfter).toLocaleString() + (t.unit || '') : ''}</td>
                  <td className="muted">{t.note || ''}</td>
                  <td className="muted">{t.createdBy || ''}</td>
                  <td>
                    <div className="btn-row">
                      {canWrite && <button className="btn secondary sm" onClick={() => setEdit(t)}>수정</button>}
                      {isAdmin && <button className="btn danger sm" onClick={() => setDel(t)}>삭제</button>}
                      {!canWrite && <span className="muted" style={{ fontSize: 12 }}>조회</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <TxEditForm tx={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); toast.ok('수정했습니다.'); }} onError={(m) => toast.err(m)} />
      )}
      {del && (
        <ConfirmDialog
          title="수불 내역 삭제"
          message="이 수불 내역을 삭제할까요? (재고 수량은 자동 보정되지 않습니다)"
          onClose={() => setDel(null)}
          onConfirm={async () => { try { await api.del('/transactions/' + del.id); setDel(null); load(); toast.ok('삭제했습니다.'); } catch (e) { toast.err(e.message); } }}
        />
      )}
      {delBulk && (
        <ConfirmDialog
          title="수불 내역 일괄 삭제"
          message={`선택한 ${sel.size}건의 수불 내역을 삭제할까요? (재고 수량은 자동 보정되지 않습니다)`}
          onClose={() => setDelBulk(false)}
          onConfirm={removeBulk}
        />
      )}
    </>
  );
}

function TxEditForm({ tx, onClose, onSaved, onError }) {
  const [note, setNote] = useState(tx.note || '');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { await api.patch('/transactions/' + tx.id, { note }); onSaved(); }
    catch (e) { onError(e.message); } finally { setBusy(false); }
  }
  return (
    <Modal
      title="수불 내역 수정"
      subtitle={`${tx.materialName} · ${tx.type} ${tx.quantity}${tx.unit || ''}`}
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </>}
    >
      <Field label="비고" hint="수량·구분 등 기록 정정은 관리자에게 문의(재고는 자동 보정되지 않음)">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="비고 입력" autoFocus />
      </Field>
    </Modal>
  );
}
