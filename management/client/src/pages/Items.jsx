import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Modal, Field, TextInput, Select, useToast, ConfirmDialog, Empty, Loading, Badge } from '../components/ui';
import { UnitInput } from '../components/inputs';

const blank = { category: 'raw', name: '', unit: 'kg', safetyStock: '', vendor: '', product: '', defaultQty: '', lotPattern: '', note: '' };

export default function Items() {
  const toast = useToast();
  const [cat, setCat] = useState('raw');
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);

  const load = useCallback(async () => {
    const d = await api.get('/items?category=' + cat);
    setItems(d.items);
  }, [cat]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div className="desc">원·부재료의 <b>품목</b>과 <b>안전재고 목표값</b>을 관리합니다. 사용자는 등록 시 이 목록에서 품목을 선택합니다.</div>
        <button className="btn sm" onClick={() => setEdit({ mode: 'create', data: { ...blank, category: cat } })}>+ 품목 등록</button>
      </div>

      <CanisterDefaultsCard toast={toast} />

      <div className="toolbar">
        <div className="btn-row">
          <button className={`btn sm ${cat === 'raw' ? '' : 'secondary'}`} onClick={() => setCat('raw')}>원재료</button>
          <button className={`btn sm ${cat === 'sub' ? '' : 'secondary'}`} onClick={() => setCat('sub')}>부재료</button>
        </div>
      </div>

      <div className="card table-wrap">
        {!items ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty>등록된 품목이 없습니다. 우측 상단 [품목 등록]으로 추가하세요.</Empty>
        ) : (
          <table className="tbl compact">
            <thead>
              <tr>
                <th>품목명</th>
                <th>제품(사용처)</th>
                <th>단위</th>
                <th className="num">안전재고</th>
                <th className="num">기본수량</th>
                <th>Lot 양식</th>
                <th>기본 업체명</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td><b>{it.name}</b></td>
                  <td>{it.product ? <Badge color={it.product === '공통' ? 'green' : 'blue'}>{it.product}</Badge> : <span className="muted">–</span>}</td>
                  <td><Badge>{it.unit}</Badge></td>
                  <td className="num">{Number(it.safetyStock).toLocaleString()}</td>
                  <td className="num muted">{it.defaultQty || '–'}</td>
                  <td className="muted">{it.lotPattern || '–'}</td>
                  <td className="muted">{it.vendor || '–'}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn secondary sm" onClick={() => setEdit({ mode: 'edit', data: { ...it } })}>수정</button>
                      <button className="btn danger sm" onClick={() => setDel(it)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <ItemForm
          mode={edit.mode}
          initial={edit.data}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); toast.ok(edit.mode === 'create' ? '품목을 등록했습니다.' : '수정했습니다.'); }}
          onError={(m) => toast.err(m)}
        />
      )}
      {del && (
        <ConfirmDialog
          title="품목 삭제"
          message={`'${del.name}' 품목을 삭제할까요? (이미 등록된 Lot/이력 데이터는 유지됩니다)`}
          onClose={() => setDel(null)}
          onConfirm={async () => {
            try { await api.del('/items/' + del.id); setDel(null); load(); toast.ok('삭제했습니다.'); }
            catch (e) { toast.err(e.message); }
          }}
        />
      )}
    </>
  );
}

function ItemForm({ mode, initial, onClose, onSaved, onError }) {
  const [f, setF] = useState({ ...blank, ...initial });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.name.trim()) return onError('품목명을 입력하세요.');
    setBusy(true);
    try {
      const payload = { category: f.category, name: f.name.trim(), unit: f.unit, safetyStock: f.safetyStock === '' ? 0 : Number(f.safetyStock), vendor: f.vendor, product: f.product, defaultQty: f.defaultQty, lotPattern: f.lotPattern, note: f.note };
      if (mode === 'create') await api.post('/items', payload);
      else await api.patch('/items/' + initial.id, payload);
      onSaved();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal
      title={mode === 'create' ? '품목 등록' : '품목 수정'}
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </>}
    >
      <Field label="구분" required>
        <Select value={f.category} onChange={(e) => set('category', e.target.value)} disabled={mode === 'edit'}>
          <option value="raw">원재료</option>
          <option value="sub">부재료</option>
        </Select>
      </Field>
      <Field label="품목명" required>
        <TextInput value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 톨루엔" autoFocus />
      </Field>
      <div className="form-row">
        <Field label="단위" required>
          <UnitInput value={f.unit} onChange={(v) => set('unit', v)} />
        </Field>
        <Field label="안전재고 목표값" hint="이 값 대비 % 로 재고수준 표시">
          <TextInput type="number" value={f.safetyStock} onChange={(e) => set('safetyStock', e.target.value)} placeholder="0" />
        </Field>
      </div>
      <Field label="제품(사용처)" hint="원재료=사용 제품 / 부재료=공통 또는 제품">
        <TextInput value={f.product} onChange={(e) => set('product', e.target.value)} placeholder="예: A제품 / 공통" />
      </Field>
      <div className="form-row">
        <Field label="기본 입고수량" hint="등록 시 자동 입력">
          <TextInput type="number" value={f.defaultQty} onChange={(e) => set('defaultQty', e.target.value)} placeholder="예: 800" />
        </Field>
        <Field label="Lot 양식" hint="{YYYY}{MM}{DD} 사용 가능">
          <TextInput value={f.lotPattern} onChange={(e) => set('lotPattern', e.target.value)} placeholder="예: T-{YYYY}-" />
        </Field>
      </div>
      <Field label="기본 업체명" hint="원/부재료 등록 시 자동 입력(수정 가능)">
        <TextInput value={f.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="예: (주)한솔케미칼" />
      </Field>
      <Field label="비고">
        <TextInput value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="선택 입력" />
      </Field>
    </Modal>
  );
}

function CanisterDefaultsCard({ toast }) {
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState({ canisterDefaultSize: '', canisterDefaultLocation: '', canisterDefaultStatus: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/meta').then(setMeta);
    api.get('/settings').then((d) => setF({
      canisterDefaultSize: d.settings.canisterDefaultSize,
      canisterDefaultLocation: d.settings.canisterDefaultLocation,
      canisterDefaultStatus: d.settings.canisterDefaultStatus,
    }));
  }, []);
  async function save() {
    setBusy(true);
    try { await api.patch('/settings', f); toast.ok('Canister 기본값을 저장했습니다.'); }
    catch (e) { toast.err(e.message); } finally { setBusy(false); }
  }
  if (!meta) return null;
  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 6 }}>Canister 기본값</h3>
      <p className="hint" style={{ marginBottom: 14 }}>Canister 등록 시 자동 선택될 기본 사이즈·위치·상태입니다.</p>
      <div className="form-row" style={{ maxWidth: 620 }}>
        <Field label="기본 사이즈">
          <Select value={f.canisterDefaultSize} onChange={(e) => setF((p) => ({ ...p, canisterDefaultSize: e.target.value }))}>
            {meta.canisterSizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="기본 위치">
          <Select value={f.canisterDefaultLocation} onChange={(e) => setF((p) => ({ ...p, canisterDefaultLocation: e.target.value }))}>
            {meta.canisterLocations.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="기본 상태">
          <Select value={f.canisterDefaultStatus} onChange={(e) => setF((p) => ({ ...p, canisterDefaultStatus: e.target.value }))}>
            {meta.canisterStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <button className="btn" onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
    </div>
  );
}
