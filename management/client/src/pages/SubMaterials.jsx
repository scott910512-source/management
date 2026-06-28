import { useEffect, useState, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Modal, Field, TextInput, Select, useToast, ConfirmDialog, Empty, Loading, Badge } from '../components/ui';
import { UnitInput, ItemSelect, expandLot, BalanceBox, BatchFields } from '../components/inputs';
import { TrendModal } from '../components/TrendModal';
import { UseModal } from '../components/UseModal';
import { BulkUseModal } from '../components/BulkUseModal';
import { BulkReceiveModal } from '../components/BulkReceiveModal';

const blank = { name: '', receivedDate: '', lotNo: '', vendor: '', unit: 'kg', weight: '', note: '', pkgCount: '', pkgSize: '', pkgUnit: '', pkgType: '' };
const today = () => new Date().toISOString().slice(0, 10);

function groupByName(rows) {
  const groups = [];
  const idx = {};
  for (const r of rows) {
    if (!(r.name in idx)) {
      idx[r.name] = groups.length;
      groups.push({ name: r.name, lots: [] });
    }
    groups[idx[r.name]].lots.push(r);
  }
  return groups;
}

/** 품목 그룹을 제품명(사용처)별로 묶는다. summaryArr: [{name, product}] */
function groupByProductThenName(rows, summaryArr) {
  const itemGroups = groupByName(rows);
  const productOf = (name) => {
    const s = (summaryArr || []).find((x) => x.name === name);
    return (s && s.product) ? s.product : '(제품 미지정)';
  };
  const out = [];
  const pidx = {};
  for (const ig of itemGroups) {
    const p = productOf(ig.name);
    if (!(p in pidx)) { pidx[p] = out.length; out.push({ product: p, items: [] }); }
    out[pidx[p]].items.push(ig);
  }
  return out;
}

export default function SubMaterials() {
  const { isAdmin, canWrite } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('list');
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState(null);
  const [groups, setGroups] = useState(null);
  const [activeItem, setActiveItem] = useState('');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [trend, setTrend] = useState(false);
  const [useOpen, setUseOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkReceiveOpen, setBulkReceiveOpen] = useState(false);
  const [lotHistory, setLotHistory] = useState(null);
  const [edit, setEdit] = useState(null);
  const [tx, setTx] = useState(null);
  const [del, setDel] = useState(null);
  const [sp] = useSearchParams();

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (showAll) params.set('all', '1');
    const [d, g, s] = await Promise.all([
      api.get('/sub-materials?' + params.toString()),
      api.get('/sub-materials/by-item'),
      api.get('/sub-materials/summary'),
    ]);
    setItems(d.items);
    setGroups(g.items);
    setSummary(s.items);
    if (g.items.length && !g.items.some((x) => x.name === activeItem)) setActiveItem(g.items[0].name);
  }, [q, showAll]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (sp.get('new') === '1') setEdit({ mode: 'create', data: { ...blank, receivedDate: today() } });
    if (sp.get('use') === '1') setUseOpen(true);
  }, [sp]);

  function exportCsv() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    downloadCsv('/sub-materials/export?' + params.toString());
  }
  const lowSet = new Set((summary || []).filter((s) => s.below).map((s) => s.name));
  const activeGroup = groups && groups.find((g) => g.name === activeItem);

  return (
    <>
      {/* 부재료 현황 요약 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>부재료 현황</h3></div>
        <div className="table-wrap">
          {!summary ? <Loading /> : summary.length === 0 ? <Empty>등록된 품목이 없습니다.</Empty> : (
            <table className="tbl compact">
              <thead>
                <tr><th>품목</th><th className="num">총잔량</th><th className="num">재고수준</th><th className="num">안전재고</th><th className="num">Lot수</th><th>최근 입고</th><th>최근 사용</th></tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.name}>
                    <td><b>{s.name}</b>{!s.isMaster && <span className="muted" style={{ fontWeight: 400 }}> (기타)</span>}</td>
                    <td className="num"><b>{s.totalQuantity.toLocaleString()}</b> <span className="muted">{s.unit}</span></td>
                    <td className="num">{s.level == null ? <span className="muted">–</span> : <b style={{ color: s.below ? 'var(--red)' : 'var(--green)' }}>{s.level}%</b>}</td>
                    <td className="num muted">{s.safetyStock ? s.safetyStock.toLocaleString() : '–'}{s.warningPct ? <span className="muted" style={{fontSize:11}}> ({s.warningPct}%)</span> : ''}</td>
                    <td className="num muted">{s.lots}</td>
                    <td className="muted">{s.lastReceived || '–'}</td>
                    <td className="muted">{s.lastUsed || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="page-head">
        <div className="desc">부재료를 품목 안에서 <b>Lot 단위</b>로 관리합니다. (입고일/Lot No/잔량/업체명)</div>
        <div className="btn-row">
          <button className="btn secondary sm" onClick={() => setTrend(true)}>📈 사용량 분석</button>
          <button className="btn secondary sm" onClick={exportCsv}>⬇ CSV</button>
          {canWrite && <button className="btn secondary sm" onClick={() => setBulkOpen(true)}>− 일괄 출고</button>}
          {canWrite && <button className="btn secondary sm" onClick={() => setUseOpen(true)}>− 부재료 사용</button>}
          {canWrite && <button className="btn secondary sm" onClick={() => setBulkReceiveOpen(true)}>+ 다량 입고</button>}
          {canWrite && <button className="btn sm" onClick={() => setEdit({ mode: 'create', data: { ...blank, receivedDate: today() } })}>+ 부재료 입고</button>}
        </div>
      </div>

      <div className="toolbar">
        <div className="btn-row">
          <button className={`btn sm ${tab === 'list' ? '' : 'secondary'}`} onClick={() => setTab('list')}>전체 목록</button>
          <button className={`btn sm ${tab === 'byItem' ? '' : 'secondary'}`} onClick={() => setTab('byItem')}>품목별 내역현황</button>
        </div>
        <div className="spacer" />
        {tab === 'list' && (
          <>
            <div className="search">
              <span>🔍</span>
              <input placeholder="품목명 / Lot No 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className={`btn sm ${showAll ? '' : 'secondary'}`} onClick={() => setShowAll((v) => !v)}>
              {showAll ? '✓ 완료 Lot 포함' : '완료 Lot 포함'}
            </button>
          </>
        )}
      </div>

      {tab === 'list' ? (
        <div className="card table-wrap">
          {!items ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty>등록된 부재료가 없습니다.</Empty>
          ) : (
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Lot No</th>
                  <th className="num">잔량 / 입고</th>
                  <th>업체명</th>
                  <th>입고일</th>
                  <th>비고</th>
                  <th>등록자</th>
                  <th style={{ width: 1 }}></th>
                </tr>
              </thead>
              <tbody>
                {groupByProductThenName(items, summary).map((pg, pi) => (
                <Fragment key={pg.product}>
                  <tr className={`group-row gt${pi % 5}`}><td colSpan={7}>제품명: {pg.product}</td></tr>
                  {pg.items.map((g) => {
                  const totalW = g.lots.reduce((s, r) => s + (Number(r.weight) || 0), 0);
                  const unit = g.lots[0]?.unit || '';
                  const totalPkg = g.lots.reduce((s, r) => s + (Number(r.pkgCount) || 0), 0);
                  const pkgType = g.lots.find(r => r.pkgCount)?.pkgType || '';
                  const oldest = g.lots.reduce((pick, r) => (!pick || (r.receivedDate && r.receivedDate < pick.receivedDate) ? r : pick), null);
                  return (
                  <Fragment key={g.name}>
                    <tr className={`group-row ${lowSet.has(g.name) ? 'row-low' : ''}`}>
                      <td style={{ paddingLeft: 20 }}>📦 <b>{g.name}</b> · {g.lots.length} Lot {lowSet.has(g.name) && <span className="badge red" style={{ marginLeft: 4 }}>안전재고 부족</span>}</td>
                      <td className="num"><b>{totalW.toLocaleString()}{unit}</b>{totalPkg > 0 && <span className="muted"> ({totalPkg}{pkgType})</span>}</td>
                      <td></td>
                      <td className="muted">{oldest?.receivedDate || ''}</td>
                      <td><span style={{color:'var(--blue)', fontSize: 12}}>{oldest?.lotNo || ''}</span></td>
                      <td></td>
                      <td></td>
                    </tr>
                    {g.lots.map((r) => (
                      <tr key={r.id}>
                        <td style={{ paddingLeft: 24 }}><Badge color="blue">{r.lotNo}</Badge></td>
                        <td className="num">
                          {r.pkgCount && Number(r.pkgCount) > 0
                            ? <><b>{Number(r.pkgCount)}</b><span className="muted">{r.pkgType || 'pkg'}</span> <span className="muted">({Number(r.weight).toLocaleString()} / {Number(r.initialWeight).toLocaleString()}{r.unit})</span></>
                            : <><b>{Number(r.weight).toLocaleString()}</b> <span className="muted">/ {Number(r.initialWeight).toLocaleString()}{r.unit}</span></>}
                        </td>
                        <td className="muted">{r.vendor || '–'}</td>
                        <td className="muted">{r.receivedDate || '–'}</td>
                        <td className="muted">{r.note || '–'}</td>
                        <td className="muted">{r.updatedBy}</td>
                        <td>
                          <div className="btn-row">
                            <button className="btn ghost sm" onClick={() => setLotHistory(r)}>이력</button>
                            {canWrite && <button className="btn ghost sm" onClick={() => setTx(r)}>수불</button>}
                            {canWrite && <button className="btn secondary sm" onClick={() => setEdit({ mode: 'edit', data: { ...r } })}>수정</button>}
                            {isAdmin && <button className="btn danger sm" onClick={() => setDel(r)}>삭제</button>}
                            {!canWrite && <span className="muted" style={{ fontSize: 12 }}>조회</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                  );
                  })}
                </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div className="toolbar" style={{ gap: 6 }}>
            {groups && groups.map((g) => (
              <button key={g.name} className={`btn sm ${activeItem === g.name ? '' : 'secondary'}`} onClick={() => setActiveItem(g.name)}>
                {g.name} ({g.lots})
              </button>
            ))}
          </div>
          <div className="card table-wrap">
            {!groups ? (
              <Loading />
            ) : !activeGroup ? (
              <Empty>데이터가 없습니다.</Empty>
            ) : (
              <>
                <div className="card-head">
                  <h3>{activeGroup.name} — 입고일순</h3>
                  <Badge color="green">총 잔량 {activeGroup.totalWeight.toLocaleString()}{activeGroup.unit}</Badge>
                </div>
                <table className="tbl compact">
                  <thead>
                    <tr><th>입고일</th><th>Lot No</th><th>업체명</th><th className="num">잔량 / 입고</th><th>비고</th></tr>
                  </thead>
                  <tbody>
                    {activeGroup.items.map((it) => (
                      <tr key={it.id}>
                        <td className="muted">{it.receivedDate || '–'}</td>
                        <td><Badge color="blue">{it.lotNo}</Badge></td>
                        <td className="muted">{it.vendor || '–'}</td>
                        <td className="num">{Number(it.weight).toLocaleString()} <span className="muted">/ {Number(it.initialWeight).toLocaleString()}{it.unit}</span></td>
                        <td className="muted">{it.note || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}

      {edit && (
        <SubForm
          mode={edit.mode}
          initial={edit.data}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); toast.ok(edit.mode === 'create' ? '부재료를 등록했습니다.' : '수정했습니다.'); }}
          onError={(m) => toast.err(m)}
        />
      )}
      {tx && (
        <SubTxForm item={tx} onClose={() => setTx(null)} onSaved={() => { setTx(null); load(); toast.ok('수불 처리되었습니다.'); }} onError={(m) => toast.err(m)} />
      )}
      {del && (
        <ConfirmDialog
          title="부재료 삭제"
          message={`'${del.name}' (Lot ${del.lotNo})을 삭제할까요?`}
          onClose={() => setDel(null)}
          onConfirm={async () => {
            try { await api.del('/sub-materials/' + del.id); setDel(null); load(); toast.ok('삭제했습니다.'); }
            catch (e) { toast.err(e.message); }
          }}
        />
      )}
      {bulkReceiveOpen && (
        <BulkReceiveModal
          base="sub-materials"
          onClose={() => setBulkReceiveOpen(false)}
          onSaved={(msg) => { setBulkReceiveOpen(false); load(); toast.ok(msg); }}
          onError={(m) => toast.err(m)}
        />
      )}
      {lotHistory && <LotHistoryModal base="sub-materials" item={lotHistory} onClose={() => setLotHistory(null)} />}
      {trend && <TrendModal category="sub" title="부재료 사용량 분석" onClose={() => setTrend(false)} />}
      {bulkOpen && (
        <BulkUseModal
          title="부재료 일괄 출고" base="sub-materials" items={items || []} nameField="name" qtyField="weight"
          onClose={() => setBulkOpen(false)}
          onSaved={(msg) => { setBulkOpen(false); load(); toast.ok(msg); }}
          onError={(m) => toast.err(m)}
        />
      )}
      {useOpen && (
        <UseModal
          title="부재료 사용 (출고)" base="sub-materials" items={items || []} nameField="name" qtyField="weight"
          onClose={() => setUseOpen(false)}
          onSaved={() => { setUseOpen(false); load(); toast.ok('사용 처리되었습니다.'); }}
          onError={(m) => toast.err(m)}
        />
      )}
    </>
  );
}

function SubForm({ mode, initial, onClose, onSaved, onError }) {
  const [f, setF] = useState({ ...blank, ...initial });
  const [lotPattern, setLotPattern] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const hasPkg = !!f.pkgType;
  const pkgQty = hasPkg && f.pkgCount && f.pkgSize ? Number(f.pkgCount) * Number(f.pkgSize) : null;

  async function submit() {
    if (!f.name.trim()) return onError('품목을 선택하거나 입력하세요.');
    if (!f.lotNo.trim()) return onError('Lot No를 입력하세요.');
    setBusy(true);
    try {
      const payload = { name: f.name.trim(), receivedDate: f.receivedDate, lotNo: f.lotNo.trim(), vendor: f.vendor, unit: f.unit, note: f.note };
      if (mode === 'create') {
        if (hasPkg && f.pkgCount) {
          payload.pkgCount = Number(f.pkgCount);
          payload.pkgSize = Number(f.pkgSize);
        } else {
          payload.weight = f.weight === '' ? 0 : Number(f.weight);
        }
        await api.post('/sub-materials', payload);
      } else {
        await api.patch('/sub-materials/' + initial.id, payload);
      }
      onSaved();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal
      title={mode === 'create' ? '부재료 입고' : '부재료 수정'}
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </>}
    >
      <Field label="품목" required hint="목록에서 선택하거나 '기타'로 직접 입력">
        {mode === 'create' ? (
          <ItemSelect category="sub" value={f.name} onChange={(name, m) => {
            setLotPattern(m?.lotPattern || '');
            setF((p) => ({
              ...p, name,
              unit: m?.unit || p.unit,
              vendor: m?.vendor || p.vendor,
              weight: p.weight === '' && m?.defaultQty ? m.defaultQty : p.weight,
              lotNo: m?.lotPattern ? expandLot(m.lotPattern) : p.lotNo,
              pkgType: m?.pkgType || '',
              pkgSize: m?.pkgSize || '',
              pkgUnit: m?.pkgUnit || '',
            }));
          }} />
        ) : (
          <TextInput value={f.name} onChange={(e) => set('name', e.target.value)} />
        )}
      </Field>
      <div className="form-row">
        <Field label="Lot No" required>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextInput value={f.lotNo} onChange={(e) => set('lotNo', e.target.value)} placeholder="예: L-2026-001" />
            {lotPattern && <button type="button" className="btn secondary sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('lotNo', expandLot(lotPattern))}>↻ 자동생성</button>}
          </div>
        </Field>
        <Field label="입고일">
          <TextInput type="date" value={f.receivedDate} onChange={(e) => set('receivedDate', e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        {mode === 'create' && hasPkg ? (
          <Field label={`수량 (${f.pkgType})`} hint={f.pkgSize ? `1${f.pkgType} = ${f.pkgSize}${f.pkgUnit || f.unit}` : ''}>
            <TextInput type="number" value={f.pkgCount} onChange={(e) => set('pkgCount', e.target.value)} placeholder="예: 2" />
          </Field>
        ) : (
          <Field label={mode === 'create' ? '무게(입고)' : '잔량 (수불로만 변경)'} required={mode === 'create'}>
            <TextInput type="number" value={f.weight} onChange={(e) => set('weight', e.target.value)} placeholder="0" disabled={mode === 'edit'} />
          </Field>
        )}
        <Field label="단위" required>
          <UnitInput value={f.unit} onChange={(v) => set('unit', v)} />
        </Field>
      </div>
      {mode === 'create' && hasPkg && pkgQty !== null && (
        <div className="hint" style={{ marginBottom: 8 }}>총 수량: <b>{pkgQty.toLocaleString()}{f.pkgUnit || f.unit}</b> ({f.pkgCount}{f.pkgType} × {f.pkgSize}{f.pkgUnit || f.unit})</div>
      )}
      <Field label="업체명">
        <TextInput value={f.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="예: 대정화학" />
      </Field>
      <Field label="비고">
        <TextInput value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="선택 입력" />
      </Field>
    </Modal>
  );
}

function SubTxForm({ item, onClose, onSaved, onError }) {
  const [type, setType] = useState('출고');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [txDate, setTxDate] = useState(today());
  const [batch, setBatch] = useState({});
  const [busy, setBusy] = useState(false);
  const [fifo, setFifo] = useState(null);
  const cur = Number(item.weight);
  const qty = Number(quantity);
  const over = type === '출고' && qty > cur;

  async function doSubmit(force) {
    setBusy(true);
    try {
      const batchFields = type === '출고' ? { batchNo: batch.batchNo, product: batch.product, batchStartDate: batch.batchStartDate } : {};
      await api.post(`/sub-materials/${item.id}/transaction`, { type, quantity: qty, note, force, txDate, ...batchFields });
      onSaved();
    } catch (e) {
      if (e.status === 409 && e.data && e.data.fifoWarning) setFifo(e.data);
      else onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function submit() {
    if (!quantity || qty <= 0) return onError('무게는 0보다 커야 합니다.');
    if (over) return onError('출고(소진) 무게가 현재 잔량을 초과합니다.');
    doSubmit(false);
  }

  return (
    <>
      <Modal
        title={`수불 — ${item.name} (Lot ${item.lotNo})`}
        subtitle={`현재 잔량 ${cur.toLocaleString()}${item.unit}`}
        onClose={onClose}
        footer={<>
          <button className="btn secondary" onClick={onClose}>취소</button>
          <button className="btn" onClick={submit} disabled={busy || over}>{busy ? '처리 중…' : '확인'}</button>
        </>}
      >
        <Field label="구분" required>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="출고">출고 (소진)</option>
            <option value="입고">입고 (추가)</option>
          </Select>
        </Field>
        <BalanceBox cur={cur} qty={qty} type={type} unit={item.unit} over={over} hasQty={!!quantity} />
        <Field label={`무게 (${item.unit})`} required error={over ? '현재 잔량을 초과했습니다.' : ''}>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextInput type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" autoFocus />
            {type === '출고' && <button type="button" className="btn secondary sm" style={{ whiteSpace: 'nowrap' }} onClick={() => setQuantity(String(cur))}>전량</button>}
          </div>
        </Field>
        <Field label="수불 날짜" hint="실제 발생 날짜 (기본: 오늘)">
          <TextInput type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        </Field>
        {type === '출고' && <BatchFields category="sub" materialName={item.name} date={txDate} onChange={setBatch} onAutofillQty={(q) => setQuantity(String(q))} />}
        <Field label="비고">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 라인 보충" />
        </Field>
      </Modal>

      {fifo && (
        <Modal
          title="⚠ 선입선출 오류"
          onClose={() => setFifo(null)}
          footer={<>
            <button className="btn secondary" onClick={() => setFifo(null)}>취소</button>
            <button className="btn danger" onClick={() => { setFifo(null); doSubmit(true); }}>강제 사용</button>
          </>}
        >
          <p style={{ margin: 0, color: 'var(--text-2)' }}>
            {fifo.message}<br />
            더 빠른 Lot: <b>{fifo.earliest?.lotNo}</b> (입고 {fifo.earliest?.receivedDate})
            <br /><br />
            강제 사용 시 <b>이상발생 목록에 자동 기록</b>됩니다. 계속하시겠습니까?
          </p>
        </Modal>
      )}
    </>
  );
}

function LotHistoryModal({ base, item, onClose }) {
  const [hist, setHist] = useState(null);
  useEffect(() => {
    api.get(`/${base}/${item.id}/transactions`).then((d) => setHist(d.items)).catch(() => setHist([]));
  }, [base, item.id]);
  const label = base === 'raw-materials' ? item.itemName : item.name;
  return (
    <Modal title={`수불 이력 — ${label} (Lot ${item.lotNo})`} onClose={onClose} footer={<button className="btn secondary" onClick={onClose}>닫기</button>}>
      {!hist ? <Loading /> : hist.length === 0 ? <Empty>이력이 없습니다.</Empty> : (
        <table className="tbl compact">
          <thead><tr><th>일시</th><th>구분</th><th className="num">수량</th><th className="num">처리후</th><th>비고</th><th>작성자</th></tr></thead>
          <tbody>
            {hist.map((t) => (
              <tr key={t.id}>
                <td className="muted">{(t.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                <td><Badge color={['입고', '반입'].includes(t.type) ? 'green' : 'orange'}>{t.type}</Badge></td>
                <td className="num">{Number(t.quantity).toLocaleString()}{t.unit}</td>
                <td className="num muted">{Number(t.balanceAfter).toLocaleString()}{t.unit}</td>
                <td className="muted">{t.note || '–'}</td>
                <td className="muted">{t.createdBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
