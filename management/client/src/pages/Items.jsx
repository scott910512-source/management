import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Modal, Field, TextInput, Select, useToast, ConfirmDialog, Empty, Loading, Badge } from '../components/ui';
import { UnitInput, EtcSelect } from '../components/inputs';

const blank = { category: 'raw', name: '', unit: 'kg', safetyStock: '', warningPct: '', vendor: '', product: '', productEtc: '', defaultQty: '', lotPattern: '', pkgSize: '', pkgUnit: '', pkgType: '', hazardous: false, hazardousMaxQty: '', hazardousWarnPct: '', note: '' };

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
      <div className="page-head" style={{ marginTop: 8 }}>
        <div className="desc">원·부재료의 <b>품목</b>과 <b>안전재고 목표값</b>을 관리합니다. 사용자는 등록 시 이 목록에서 품목을 선택합니다.</div>
        <button className="btn sm" onClick={() => setEdit({ mode: 'create', data: { ...blank, category: cat } })}>+ 품목 등록</button>
      </div>

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
                <th>제품명</th>
                <th>단위</th>
                <th className="num">안전재고</th>
                <th className="num">경고기준</th>
                <th className="num">보관한도</th>
                <th className="num">기본수량</th>
                <th>Package</th>
                <th>Lot 양식</th>
                <th>기본 업체명</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td><b>{it.name}</b>{it.hazardous === '1' && <Badge color="red" style={{ marginLeft: 6 }}>유해</Badge>}</td>
                  <td>{it.product ? <Badge color={it.product === '공통' ? 'green' : 'blue'}>{it.product}</Badge> : <span className="muted">–</span>}</td>
                  <td><Badge>{it.unit}</Badge></td>
                  <td className="num">{Number(it.safetyStock).toLocaleString()}</td>
                  <td className="num">{it.warningPct ? <Badge color="orange">{it.warningPct}%</Badge> : <span className="muted">–</span>}</td>
                  <td className="num muted">{it.hazardous === '1' && it.hazardousMaxQty ? <span title={`경고기준: ${it.hazardousWarnPct || 80}%`}>{Number(it.hazardousMaxQty).toLocaleString()}</span> : '–'}</td>
                  <td className="num muted">{it.defaultQty || '–'}</td>
                  <td className="muted">{it.pkgType ? `${it.pkgSize}${it.pkgUnit}/${it.pkgType}` : '–'}</td>
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
      <ProductBomCard toast={toast} />
      <CanisterDefaultsCard toast={toast} />

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
  const [productNames, setProductNames] = useState([]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get('/products').then((d) => setProductNames((d.items || []).map((p) => p.name))).catch(() => {});
  }, []);

  // 제품 셀렉트 옵션 — 마스터 + 현재값(레거시 자유입력) 포함
  const productOptions = Array.from(new Set([...productNames, ...(f.product && f.product !== '기타' ? [f.product] : [])]));

  async function submit() {
    if (!f.name.trim()) return onError('품목명을 입력하세요.');
    const product = f.product === '기타' ? (f.productEtc || '').trim() : f.product;
    setBusy(true);
    try {
      const payload = { category: f.category, name: f.name.trim(), unit: f.unit, safetyStock: f.safetyStock === '' ? 0 : Number(f.safetyStock), warningPct: f.warningPct, vendor: f.vendor, product, defaultQty: f.defaultQty, lotPattern: f.lotPattern, pkgSize: f.pkgSize, pkgUnit: f.pkgUnit, pkgType: f.pkgType, hazardous: f.hazardous, hazardousMaxQty: f.hazardousMaxQty, hazardousWarnPct: f.hazardousWarnPct, note: f.note };
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
      {/* Package 설정 최상단 */}
      <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Package 설정</div>
        <div className="form-row">
          <Field label="Package 종류">
            <Select value={f.pkgType} onChange={(e) => set('pkgType', e.target.value)}>
              <option value="">없음</option>
              <option value="Drum">Drum</option>
              <option value="Can">Can</option>
              <option value="Set">Set</option>
              <option value="ea">ea</option>
            </Select>
          </Field>
          <Field label="Package 당 수량">
            <TextInput type="number" value={f.pkgSize} onChange={(e) => set('pkgSize', e.target.value)} placeholder="예: 200" disabled={!f.pkgType} />
          </Field>
          <Field label="Package 단위">
            <Select value={f.pkgUnit} onChange={(e) => set('pkgUnit', e.target.value)} disabled={!f.pkgType}>
              <option value="">–</option>
              <option value="L">L</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="ea">ea</option>
            </Select>
          </Field>
        </div>
        {f.pkgType && f.pkgSize && f.pkgUnit && (
          <div className="hint">1 {f.pkgType} = {f.pkgSize}{f.pkgUnit}</div>
        )}
      </div>
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
        <Field label="안전재고 목표값">
          <TextInput type="number" value={f.safetyStock} onChange={(e) => set('safetyStock', e.target.value)} placeholder="0" />
        </Field>
        <Field label="경고기준 %" hint="재고수준이 이 % 미만이면 경고 표시 (미설정 시 전역설정 사용)">
          <TextInput type="number" value={f.warningPct} onChange={(e) => set('warningPct', e.target.value)} placeholder="예: 80" />
        </Field>
      </div>
      <Field label="제품명" hint="기준정보 제품 목록에서 선택(없으면 기타로 직접입력). BOM·자동입력 기준이 됩니다">
        <EtcSelect options={productOptions} value={f.product} etc={f.productEtc} onChange={(v, etc) => setF((p) => ({ ...p, product: v, productEtc: etc || '' }))} placeholder="제품 직접 입력" />
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
      <Field label="유해화학물질">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!f.hazardous} onChange={(e) => set('hazardous', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--red)' }} />
          <span style={{ color: f.hazardous ? 'var(--red)' : 'var(--text-2)' }}>
            {f.hazardous ? '⚠ 유해화학물질로 지정됨 — 관리대장에 기록됩니다' : '해당 없음'}
          </span>
        </label>
      </Field>
      {f.hazardous && (
        <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--red-light, #fca5a5)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>⚠ 유해화학물질 보관 한도</div>
          <div className="form-row">
            <Field label="보관가능수량" hint="지정수량 기준 — 이 수량을 기준으로 경고 발생">
              <TextInput type="number" value={f.hazardousMaxQty} onChange={(e) => set('hazardousMaxQty', e.target.value)} placeholder={`예: 500 (${f.unit})`} />
            </Field>
            <Field label="경고 기준 %" hint="보관가능수량 대비 이 % 이상이면 경고 (기본 80%)">
              <TextInput type="number" value={f.hazardousWarnPct} onChange={(e) => set('hazardousWarnPct', e.target.value)} placeholder="예: 80" />
            </Field>
          </div>
          {f.hazardousMaxQty && (
            <div className="hint" style={{ color: 'var(--red)' }}>
              현재 설정: 보관가능수량 {Number(f.hazardousMaxQty).toLocaleString()}{f.unit} 의 {f.hazardousWarnPct || 80}% ({Math.round(Number(f.hazardousMaxQty) * (Number(f.hazardousWarnPct || 80) / 100)).toLocaleString()}{f.unit}) 초과 시 경고
            </div>
          )}
        </div>
      )}
      <Field label="비고">
        <TextInput value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="선택 입력" />
      </Field>
    </Modal>
  );
}

function ProductBomCard({ toast }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [boms, setBoms] = useState([]);
  const [sel, setSel] = useState('');
  const [newProduct, setNewProduct] = useState('');
  const [lineItem, setLineItem] = useState('');
  const [lineQty, setLineQty] = useState('');

  const load = useCallback(async () => {
    const [p, it, b] = await Promise.all([api.get('/products'), api.get('/items'), api.get('/products/bom')]);
    setProducts(p.items);
    setItems(it.items);
    setBoms(b.items);
    setSel((prev) => (p.items.some((x) => x.name === prev) ? prev : (p.items[0]?.name || '')));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addProduct() {
    const name = newProduct.trim();
    if (!name) return;
    try { await api.post('/products', { name }); setNewProduct(''); await load(); setSel(name); toast.ok('제품을 추가했습니다.'); }
    catch (e) { toast.err(e.message); }
  }
  async function delProduct(p) {
    if (!window.confirm(`'${p.name}' 제품과 해당 BOM을 삭제할까요?`)) return;
    try { await api.del('/products/' + p.id); await load(); toast.ok('삭제했습니다.'); } catch (e) { toast.err(e.message); }
  }
  async function addLine() {
    const it = items.find((x) => x.name === lineItem);
    if (!it) return toast.err('품목을 선택하세요.');
    if (lineQty === '' || Number(lineQty) < 0) return toast.err('기준량을 입력하세요.');
    try {
      await api.post('/products/bom', { product: sel, category: it.category, materialName: it.name, qtyPerBatch: Number(lineQty) });
      setLineItem(''); setLineQty(''); await load(); toast.ok('기준량을 저장했습니다.');
    } catch (e) { toast.err(e.message); }
  }
  async function delLine(id) {
    try { await api.del('/products/bom/' + id); await load(); } catch (e) { toast.err(e.message); }
  }

  const selBoms = boms.filter((b) => b.product === sel);
  const unitOf = (name) => items.find((i) => i.name === name)?.unit || '';

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>제품명 · Batch 사용기준값 (BOM)</h3>
      <p className="hint" style={{ marginBottom: 16 }}>제품을 만들고 제품별로 원·부재료의 <b>Batch당 기준 투입량</b>을 설정합니다. 사용(출고) 시 제품·Batch를 지정하면 이 수량이 자동 입력됩니다.</p>

      <div className="form-row" style={{ marginBottom: 12, maxWidth: 420 }}>
        <TextInput placeholder="새 제품명 (예: A제품)" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addProduct()} />
        <button className="btn sm" onClick={addProduct}>+ 제품 추가</button>
      </div>

      {products.length === 0 ? (
        <Empty>등록된 제품이 없습니다. 위에서 제품을 먼저 추가하세요.</Empty>
      ) : (
        <>
          <div className="sheet-tabs" style={{ marginBottom: 0 }}>
            {products.map((p) => (
              <button key={p.id} className={`sheet-tab ${sel === p.name ? 'active' : ''}`} onClick={() => setSel(p.name)}>{p.name}</button>
            ))}
          </div>
          <div className="card table-wrap" style={{ borderTopLeftRadius: 0 }}>
            <table className="tbl compact">
              <thead>
                <tr><th style={{ width: 80 }}>구분</th><th>품목</th><th className="num" style={{ width: 140 }}>Batch당 기준량</th><th style={{ width: 60 }}>단위</th><th style={{ width: 1 }}></th></tr>
              </thead>
              <tbody>
                {selBoms.length === 0 ? (
                  <tr><td colSpan={5}><span className="muted">설정된 기준량이 없습니다. 아래에서 추가하세요.</span></td></tr>
                ) : selBoms.map((b) => (
                  <tr key={b.id}>
                    <td><Badge color={b.category === 'raw' ? 'blue' : 'orange'}>{b.category === 'raw' ? '원재료' : '부재료'}</Badge></td>
                    <td><b>{b.materialName}</b></td>
                    <td className="num">{Number(b.qtyPerBatch).toLocaleString()}</td>
                    <td className="muted">{unitOf(b.materialName)}</td>
                    <td><button className="btn danger sm" onClick={() => delLine(b.id)}>삭제</button></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}>
                    <Select value={lineItem} onChange={(e) => setLineItem(e.target.value)}>
                      <option value="">+ 품목 선택</option>
                      {items.map((i) => <option key={i.id} value={i.name}>[{i.category === 'raw' ? '원' : '부'}] {i.name}</option>)}
                    </Select>
                  </td>
                  <td><TextInput type="number" value={lineQty} onChange={(e) => setLineQty(e.target.value)} placeholder="기준량" style={{ width: 120 }} /></td>
                  <td className="muted">{unitOf(lineItem)}</td>
                  <td><button className="btn sm" onClick={addLine} disabled={!lineItem}>추가</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn secondary sm danger" onClick={() => delProduct(products.find((p) => p.name === sel))}>현재 제품 삭제</button>
          </div>
        </>
      )}
    </div>
  );
}

function CanisterDefaultsCard({ toast }) {
  const [settings, setSettings] = useState(null);
  const [cnSizes, setCnSizes] = useState('');
  const [cnLocs, setCnLocs] = useState('');
  const [cnStats, setCnStats] = useState('');
  const [cnContents, setCnContents] = useState('');
  const [defSize, setDefSize] = useState('');
  const [defLoc, setDefLoc] = useState('');
  const [defStat, setDefStat] = useState('');
  const [defContent, setDefContent] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newStat, setNewStat] = useState('');
  const [newContent, setNewContent] = useState('');
  const [sizeMax, setSizeMax] = useState({}); // { size: 'kg' } 사이즈별 최대 사용가능 무게
  const [busy, setBusy] = useState(false);

  function toArr(str) { return (str || '').split(',').map(s => s.trim()).filter(Boolean); }
  function parseMax(str) { const m = {}; (str || '').split(',').forEach(p => { const [s, k] = p.split(':').map(x => (x || '').trim()); if (s) m[s] = k || ''; }); return m; }
  function serializeMax(map, sizes) { return sizes.filter(s => map[s] !== '' && map[s] != null).map(s => `${s}:${map[s]}`).join(','); }

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
      setCnContents(s.canisterContents || '톨루엔,황산,활성탄,실링패드');
      setSizeMax(parseMax(s.canisterSizeMaxKg || '5gal:20,50L:50,100L:100,200L:200'));
      setDefSize(s.canisterDefaultSize || '50L');
      setDefLoc(s.canisterDefaultLocation || '2공장현장');
      setDefStat(s.canisterDefaultStatus || '수령');
      setDefContent(s.canisterDefaultContent || '');
    });
  }, []);

  async function save() {
    setBusy(true);
    try {
      await api.patch('/settings', {
        canisterSizes: cnSizes,
        canisterLocations: cnLocs,
        canisterStatuses: cnStats,
        canisterContents: cnContents,
        canisterDefaultSize: defSize,
        canisterDefaultLocation: defLoc,
        canisterDefaultStatus: defStat,
        canisterDefaultContent: defContent,
        canisterSizeMaxKg: serializeMax(sizeMax, toArr(cnSizes)),
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* 사이즈 */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>사이즈 목록 · 최대 사용가능(kg)</div>
          <Field label="기본값" style={{ marginBottom: 8 }}>
            <Select value={defSize} onChange={e => setDefSize(e.target.value)}>
              {toArr(cnSizes).map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <TextInput placeholder="새 사이즈 (예: 500L)" value={newSize} onChange={e => setNewSize(e.target.value)} />
            <button className="btn sm secondary" onClick={() => addItem(cnSizes, newSize, setCnSizes, setNewSize)}>추가</button>
          </div>
          <div style={colStyle}>
            {toArr(cnSizes).map(s => (
              <div key={s} style={{ ...tagStyle, gap: 6 }}>
                <span style={{ fontSize: 13, flex: 1 }}>{s}</span>
                <input
                  type="number"
                  value={sizeMax[s] ?? ''}
                  onChange={(e) => setSizeMax((p) => ({ ...p, [s]: e.target.value }))}
                  placeholder="Max kg"
                  title="최대 사용가능 무게(kg) — 90% 이상이면 경고"
                  style={{ width: 70, fontSize: 12, padding: '2px 6px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'inherit' }}
                />
                <span className="muted" style={{ fontSize: 11 }}>kg</span>
                <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnSizes, s, setCnSizes)}>×</button>
              </div>
            ))}
          </div>
          <div className="hint" style={{ marginTop: 6 }}>무게가 최대 사용가능값의 90% 이상이면 현황에서 경고(빨간 테두리)됩니다.</div>
        </div>

        {/* 위치 */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>위치 목록</div>
          <Field label="기본값" style={{ marginBottom: 8 }}>
            <Select value={defLoc} onChange={e => setDefLoc(e.target.value)}>
              {toArr(cnLocs).map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <TextInput placeholder="새 위치 (예: 1공장현장)" value={newLoc} onChange={e => setNewLoc(e.target.value)} />
            <button className="btn sm secondary" onClick={() => addItem(cnLocs, newLoc, setCnLocs, setNewLoc)}>추가</button>
          </div>
          <div style={colStyle}>
            {toArr(cnLocs).map(s => (
              <div key={s} style={tagStyle}>
                <span style={{ fontSize: 13 }}>{s}</span>
                <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnLocs, s, setCnLocs)}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* 상태 */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>상태 목록</div>
          <Field label="기본값" style={{ marginBottom: 8 }}>
            <Select value={defStat} onChange={e => setDefStat(e.target.value)}>
              {toArr(cnStats).map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <TextInput placeholder="새 상태 (예: 검사중)" value={newStat} onChange={e => setNewStat(e.target.value)} />
            <button className="btn sm secondary" onClick={() => addItem(cnStats, newStat, setCnStats, setNewStat)}>추가</button>
          </div>
          <div style={colStyle}>
            {toArr(cnStats).map(s => (
              <div key={s} style={tagStyle}>
                <span style={{ fontSize: 13 }}>{s}</span>
                <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnStats, s, setCnStats)}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* 취급물질 */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>취급물질 목록</div>
          <Field label="기본값" style={{ marginBottom: 8 }}>
            <Select value={defContent} onChange={e => setDefContent(e.target.value)}>
              <option value="">선택 안 함</option>
              {toArr(cnContents).map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <TextInput placeholder="새 취급물질 (예: 메탄올)" value={newContent} onChange={e => setNewContent(e.target.value)} />
            <button className="btn sm secondary" onClick={() => addItem(cnContents, newContent, setCnContents, setNewContent)}>추가</button>
          </div>
          <div style={colStyle}>
            {toArr(cnContents).map(s => (
              <div key={s} style={tagStyle}>
                <span style={{ fontSize: 13 }}>{s}</span>
                <button className="btn ghost sm" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => removeItem(cnContents, s, setCnContents)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="btn" onClick={save} disabled={busy}>{busy ? '저장 중…' : 'Canister 기준정보 저장'}</button>
    </div>
  );
}
