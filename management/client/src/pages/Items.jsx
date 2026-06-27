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
  const [settings, setSettings] = useState(null);
  const [cnSizes, setCnSizes] = useState('');
  const [cnLocs, setCnLocs] = useState('');
  const [cnStats, setCnStats] = useState('');
  const [defSize, setDefSize] = useState('');
  const [defLoc, setDefLoc] = useState('');
  const [defStat, setDefStat] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newStat, setNewStat] = useState('');
  const [busy, setBusy] = useState(false);

  function toArr(str) { return (str || '').split(',').map(s => s.trim()).filter(Boolean); }

  function addItem(current, newVal, setter, newSetter) {
    const val = newVal.trim();
    if (!val) return;
    const arr = toArr(current);
    if (arr.includes(val)) { toast.err('이미 존재하는 항목입니다.'); return; }
    setter([...arr, val].join(','));
    newSetter('');
  }

  function removeItem(current, item, setter) {
    setter(toArr(current).filter(s => s !== item).join(','));
  }

  useEffect(() => {
    api.get('/settings').then((d) => {
      const s = d.settings;
      setSettings(s);
      setCnSizes(s.canisterSizes || '5gal,50L,100L,200L');
      setCnLocs(s.canisterLocations || '2공장현장,3류창고,4류창고');
      setCnStats(s.canisterStatuses || '수령,사용중,사용완료,세정의뢰,사용금지');
      setDefSize(s.canisterDefaultSize || '50L');
      setDefLoc(s.canisterDefaultLocation || '2공장현장');
      setDefStat(s.canisterDefaultStatus || '수령');
    });
  }, []);

  async function save() {
    setBusy(true);
    try {
      await api.patch('/settings', {
        canisterSizes: cnSizes,
        canisterLocations: cnLocs,
        canisterStatuses: cnStats,
        canisterDefaultSize: defSize,
        canisterDefaultLocation: defLoc,
        canisterDefaultStatus: defStat,
      });
      toast.ok('Canister 기준정보를 저장했습니다.');
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  }

  if (!settings) return null;

  const colStyle = { display: 'flex', flexDirection: 'column', gap: 6 };
  const tagStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)', borderRadius: 6, padding: '4px 10px' };

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>Canister 기준정보 관리</h3>
      <p className="hint" style={{ marginBottom: 16 }}>Canister 등록 시 사용할 사이즈·위치·상태 목록과 기본값을 관리합니다.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 20 }}>
        {/* 사이즈 */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>사이즈 목록</div>
          <div style={colStyle}>
            {toArr(cnSizes).map(s => (
              <div key={s} style={tagStyle}>
                <span style={{ fontSize: 13 }}>{s}</span>
                <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnSizes, s, setCnSizes)}>×</button>
              </div>
            ))}
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <TextInput placeholder="새 사이즈 (예: 500L)" value={newSize} onChange={e => setNewSize(e.target.value)} />
            <button className="btn sm secondary" onClick={() => addItem(cnSizes, newSize, setCnSizes, setNewSize)}>추가</button>
          </div>
          <Field label="기본값" style={{ marginTop: 10 }}>
            <Select value={defSize} onChange={e => setDefSize(e.target.value)}>
              {toArr(cnSizes).map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        {/* 위치 */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>위치 목록</div>
          <div style={colStyle}>
            {toArr(cnLocs).map(s => (
              <div key={s} style={tagStyle}>
                <span style={{ fontSize: 13 }}>{s}</span>
                <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnLocs, s, setCnLocs)}>×</button>
              </div>
            ))}
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <TextInput placeholder="새 위치 (예: 1공장현장)" value={newLoc} onChange={e => setNewLoc(e.target.value)} />
            <button className="btn sm secondary" onClick={() => addItem(cnLocs, newLoc, setCnLocs, setNewLoc)}>추가</button>
          </div>
          <Field label="기본값" style={{ marginTop: 10 }}>
            <Select value={defLoc} onChange={e => setDefLoc(e.target.value)}>
              {toArr(cnLocs).map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        {/* 상태 */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>상태 목록</div>
          <div style={colStyle}>
            {toArr(cnStats).map(s => (
              <div key={s} style={tagStyle}>
                <span style={{ fontSize: 13 }}>{s}</span>
                <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnStats, s, setCnStats)}>×</button>
              </div>
            ))}
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
            <TextInput placeholder="새 상태 (예: 검사중)" value={newStat} onChange={e => setNewStat(e.target.value)} />
            <button className="btn sm secondary" onClick={() => addItem(cnStats, newStat, setCnStats, setNewStat)}>추가</button>
          </div>
          <Field label="기본값" style={{ marginTop: 10 }}>
            <Select value={defStat} onChange={e => setDefStat(e.target.value)}>
              {toArr(cnStats).map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      <button className="btn" onClick={save} disabled={busy}>{busy ? '저장 중…' : 'Canister 기준정보 저장'}</button>
    </div>
  );
}
