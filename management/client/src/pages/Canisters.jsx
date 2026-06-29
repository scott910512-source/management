import { useEffect, useState, useCallback, Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadCsv } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Modal, Field, TextInput, Select, useToast, ConfirmDialog, Empty, Loading, Badge, statusColor } from '../components/ui';
import { EtcSelect, BalanceBox } from '../components/inputs';

const blankCreate = { canisterNo: '', size: '50L', sizeEtc: '', location: '2공장현장', locationEtc: '', status: '수령', statusEtc: '', content: '', weight: '', note: '' };

/** Canister 목록을 제품명별로 묶는다. */
function groupByContent(rows) {
  const groups = [];
  const idx = {};
  for (const c of rows) {
    const k = c.content || '(비어있음)';
    if (!(k in idx)) { idx[k] = groups.length; groups.push({ content: k, rows: [] }); }
    groups[idx[k]].rows.push(c);
  }
  return groups;
}

export default function Canisters() {
  const { isAdmin, canWrite } = useAuth();
  const toast = useToast();
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState(null);
  const [allCanisters, setAllCanisters] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ q: '', content: '', size: '', location: '', status: '' });
  const [create, setCreate] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [sp] = useSearchParams();

  useEffect(() => {
    if (sp.get('move') === '1') setMoveOpen(true);
    if (sp.get('new') === '1') setCreate(true);
  }, [sp]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const [d, s, all] = await Promise.all([api.get('/canisters?' + params.toString()), api.get('/canisters/summary'), api.get('/canisters')]);
    setItems(d.items);
    setSummary(s);
    setAllCanisters(all.items || []);
  }, [filters]);

  useEffect(() => {
    api.get('/meta').then(setMeta);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    downloadCsv('/canisters/export?' + params.toString());
  }
  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v }));
  if (!meta) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div className="desc">Canister별 <b>내용물(제품)·무게</b>를 관리하고, 반입/반출 이력을 용기이력카드로 추적합니다.</div>
        <div className="btn-row">
          <button className="btn secondary sm" onClick={exportCsv}>⬇ CSV</button>
          {canWrite && <button className="btn secondary sm" onClick={() => setMoveOpen(true)}>↔ Canister 이력 등록</button>}
          {canWrite && <button className="btn sm" onClick={() => setCreate(true)}>+ Canister 등록</button>}
        </div>
      </div>

      {summary && (
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <div className="card stat"><div className="label">⬢ 총 보유</div><div className="value">{summary.total}<span className="unit">개</span></div></div>
          <div className="card stat"><div className="label">사용중</div><div className="value">{summary.byStatus['사용중'] || 0}<span className="unit">개</span></div></div>
          <div className="card stat"><div className="label">세정의뢰</div><div className="value" style={{ color: 'var(--orange)' }}>{summary.byStatus['세정의뢰'] || 0}<span className="unit">개</span></div></div>
          <div className="card stat"><div className="label">사용금지</div><div className="value" style={{ color: 'var(--red)' }}>{summary.byStatus['사용금지'] || 0}<span className="unit">개</span></div></div>
        </div>
      )}

      <div className="toolbar">
        <div className="search">
          <span>🔍</span>
          <input placeholder="Canister No. / 내용물 검색" value={filters.q} onChange={(e) => setF('q', e.target.value)} />
        </div>
        <Select value={filters.content} onChange={(e) => setF('content', e.target.value)} style={{ width: 140 }}>
          <option value="">제품명 전체</option>
          {(meta.canisterContents || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filters.size} onChange={(e) => setF('size', e.target.value)} style={{ width: 120 }}>
          <option value="">사이즈 전체</option>
          {meta.canisterSizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filters.location} onChange={(e) => setF('location', e.target.value)} style={{ width: 140 }}>
          <option value="">위치 전체</option>
          {meta.canisterLocations.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filters.status} onChange={(e) => setF('status', e.target.value)} style={{ width: 130 }}>
          <option value="">상태 전체</option>
          {meta.canisterStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      <div className="card table-wrap">
        {!items ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty>조건에 맞는 Canister가 없습니다.</Empty>
        ) : (
          <table className="tbl compact">
            <thead>
              <tr>
                <th>Canister No.</th>
                <th>사이즈</th>
                <th>제품명</th>
                <th className="num">무게</th>
                <th>위치</th>
                <th>상태</th>
                <th>비고</th>
                <th>최종변경</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {groupByContent(items).map((g) => {
                // 사이즈별 개수 + 총무게 합산
                const sizeCount = {};
                let totalW = 0;
                g.rows.forEach((c) => { const k = c.sizeLabel || c.size; sizeCount[k] = (sizeCount[k] || 0) + 1; totalW += Number(c.weight || 0); });
                const sizeStr = Object.entries(sizeCount).map(([s, n]) => `${s} ${n}개`).join(', ');
                const unit = g.rows[0]?.unit || 'kg';
                return (
                <Fragment key={g.content}>
                  <tr className="group-row"><td colSpan={9}>제품명: {g.content} · 총 {g.rows.length}개 ({sizeStr}) · 총무게 {totalW.toLocaleString()}{unit}</td></tr>
                  {g.rows.map((c) => (
                    <tr key={c.id} className={c.capWarn ? 'cap-warn' : ''}>
                      <td style={{ paddingLeft: 24 }}><Link to={`/canisters/${c.id}`} className="inline-link"><b>{c.canisterNo}</b></Link></td>
                      <td><Badge>{c.sizeLabel}</Badge></td>
                      <td>{c.content ? c.content : <span className="muted">(비어있음)</span>}</td>
                      <td className="num">
                        <span style={{ color: c.capWarn ? 'var(--red)' : undefined, fontWeight: c.capWarn ? 700 : undefined }}>{Number(c.weight || 0).toLocaleString()}</span>
                        {c.maxKg != null && <span className="muted" style={{ fontSize: 11 }}> / {c.maxKg}kg{c.capPct != null ? ` (${c.capPct}%)` : ''}</span>}
                        {c.capWarn && <span className="badge red" style={{ marginLeft: 4 }}>임박</span>}
                      </td>
                      <td className="muted">{c.locationLabel}</td>
                      <td>{canWrite ? <StatusSelect c={c} statuses={meta.canisterStatuses} onChanged={load} onError={(m) => toast.err(m)} /> : <Badge color={statusColor(c.status)} dot>{c.statusLabel}</Badge>}</td>
                      <td className="muted" style={{ maxWidth: 160, whiteSpace: 'normal' }}>{c.note || '–'}</td>
                      <td className="muted">{(c.updatedAt || '').slice(0, 10)}</td>
                      <td>
                        <div className="btn-row">
                          <Link to={`/canisters/${c.id}`} className="btn ghost sm">이력카드</Link>
                          {isAdmin && <button className="btn secondary sm" onClick={() => setEdit(c)}>수정</button>}
                          {isAdmin && <button className="btn danger sm" onClick={() => setDel(c)}>삭제</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {create && (
        <CanisterForm meta={meta} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); load(); toast.ok('Canister를 등록했습니다.'); }} onError={(m) => toast.err(m)} />
      )}
      {moveOpen && (
        <MoveForm meta={meta} canisters={allCanisters} onClose={() => setMoveOpen(false)} onSaved={() => { setMoveOpen(false); load(); toast.ok('이력이 기록되었습니다.'); }} onError={(m) => toast.err(m)} />
      )}
      {edit && (
        <CanisterEditForm meta={meta} item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); toast.ok('수정했습니다.'); }} onError={(m) => toast.err(m)} />
      )}
      {del && (
        <ConfirmDialog
          title="Canister 삭제"
          message={`'${del.canisterNo}' 및 해당 용기 이력 전체가 삭제됩니다. 계속할까요?`}
          onClose={() => setDel(null)}
          onConfirm={async () => {
            try { await api.del('/canisters/' + del.id); setDel(null); load(); toast.ok('삭제했습니다.'); }
            catch (e) { toast.err(e.message); }
          }}
        />
      )}
    </>
  );
}

// 목록에서 상태를 바로 변경(클릭 → 선택). 변경 시 '상태변경' 이력으로 기록된다.
function StatusSelect({ c, statuses, onChanged, onError }) {
  const [busy, setBusy] = useState(false);
  const opts = statuses.includes(c.status) ? statuses : [c.status, ...statuses];
  async function change(next) {
    if (next === c.status) return;
    setBusy(true);
    try {
      await api.post(`/canisters/${c.id}/move`, { type: '상태변경', status: next });
      onChanged();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }
  return (
    <select
      value={c.status}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      title="클릭하여 상태 변경"
      style={{
        border: '1px solid var(--line-2)', borderRadius: 6, padding: '2px 6px', fontSize: 12,
        fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', color: `var(--${statusColor(c.status) || 'text'})`, background: 'var(--surface)',
      }}
    >
      {opts.map((s) => <option key={s} value={s} style={{ color: 'var(--text)' }}>{s}</option>)}
    </select>
  );
}

function CanisterForm({ meta, onClose, onSaved, onError }) {
  const [f, setF] = useState({ ...blankCreate });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // 기준정보의 Canister 기본값으로 초기화
  useEffect(() => {
    api.get('/settings').then((d) => setF((p) => ({
      ...p,
      size: d.settings.canisterDefaultSize || p.size,
      location: d.settings.canisterDefaultLocation || p.location,
      status: d.settings.canisterDefaultStatus || p.status,
    })));
  }, []);

  async function submit() {
    if (!f.canisterNo.trim()) return onError('Canister No.를 입력하세요.');
    const content = f.content === '기타' ? (f.contentEtc || '').trim() : f.content;
    setBusy(true);
    try {
      await api.post('/canisters', { ...f, content, canisterNo: f.canisterNo.trim(), weight: f.weight === '' ? 0 : Number(f.weight) });
      // 기타 직접입력 시 기준정보 내용물 목록에 자동 추가
      if (f.content === '기타') {
        try {
          const s = await api.get('/settings');
          const existing = (s.settings.canisterContents || '').split(',').map(v => v.trim()).filter(Boolean);
          if (!existing.includes(content)) {
            await api.patch('/settings', { canisterContents: [...existing, content].join(',') });
          }
        } catch { /* 기준정보 저장 실패는 조용히 무시 */ }
      }
      onSaved();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal
      title="Canister 등록"
      subtitle="새 용기를 등록합니다. (내용물/무게가 있으면 반입 이력이 자동 생성)"
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </>}
    >
      <Field label="제품명" required>
        <EtcSelect options={meta.canisterContents || []} value={f.content} etc={f.contentEtc || ''} onChange={(v, etc) => setF((p) => ({ ...p, content: v, contentEtc: etc || '' }))} placeholder="내용물 직접 입력" />
      </Field>
      <Field label="무게">
        <TextInput type="number" value={f.weight} onChange={(e) => set('weight', e.target.value)} placeholder="0" />
      </Field>
      <Field label="Canister No." required>
        <TextInput value={f.canisterNo} onChange={(e) => set('canisterNo', e.target.value)} placeholder="예: CN-004" />
      </Field>
      <Field label="용기 사이즈" required>
        <EtcSelect options={meta.canisterSizes} value={f.size} etc={f.sizeEtc} onChange={(v, etc) => setF((p) => ({ ...p, size: v, sizeEtc: etc }))} placeholder="사이즈 입력" />
      </Field>
      <Field label="위치" required>
        <EtcSelect options={meta.canisterLocations} value={f.location} etc={f.locationEtc} onChange={(v, etc) => setF((p) => ({ ...p, location: v, locationEtc: etc }))} placeholder="위치 입력" />
      </Field>
      <Field label="상태" required>
        <EtcSelect options={meta.canisterStatuses} value={f.status} etc={f.statusEtc} onChange={(v, etc) => setF((p) => ({ ...p, status: v, statusEtc: etc }))} placeholder="상태 입력" />
      </Field>
      <Field label="비고">
        <TextInput value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="선택 입력" />
      </Field>
    </Modal>
  );
}

function MoveForm({ meta, canisters, onClose, onSaved, onError }) {
  const [cid, setCid] = useState(canisters[0]?.id || '');
  const sel = canisters.find((c) => c.id === cid);
  const [f, setF] = useState({ type: '반출', weight: '', location: '', locationEtc: '', status: '', statusEtc: '', note: '' });
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // 선택한 Canister의 현재 위치/상태를 기본값으로
  useEffect(() => {
    if (sel) setF((p) => ({ ...p, location: sel.location, locationEtc: sel.locationEtc || '', status: sel.status, statusEtc: sel.statusEtc || '' }));
  }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!cid) return onError('Canister를 선택하세요.');
    if (f.type !== '상태변경' && (!f.weight || Number(f.weight) <= 0)) return onError('무게를 입력하세요.');
    setBusy(true);
    try {
      await api.post(`/canisters/${cid}/move`, { ...f, weight: f.weight === '' ? 0 : Number(f.weight), txDate });
      onSaved();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal
      title="Canister 이력 등록 (반입/반출)"
      subtitle={sel ? `현재: ${sel.content || '비어있음'} · ${Number(sel.weight || 0).toLocaleString()} · ${sel.locationLabel} · ${sel.statusLabel}` : '목록에서 Canister를 선택하세요'}
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy || !cid}>{busy ? '처리 중…' : '이력 기록'}</button>
      </>}
    >
      <Field label="Canister 선택" required>
        <Select value={cid} onChange={(e) => setCid(e.target.value)}>
          <option value="" disabled>Canister 선택</option>
          {canisters.map((c) => <option key={c.id} value={c.id}>{c.canisterNo} ({c.content || '비어있음'} · {Number(c.weight || 0).toLocaleString()})</option>)}
        </Select>
      </Field>
      {sel && (
        <div style={{ background: 'var(--bg2)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
          제품(내용물): <b style={{ color: 'var(--text)' }}>{sel.content || '비어있음'}</b>
          <span style={{ fontSize: 11, marginLeft: 8 }}>(제품명 변경은 Canister 수정에서만 가능)</span>
        </div>
      )}
      <Field label="구분" required>
        <Select value={f.type} onChange={(e) => set('type', e.target.value)}>
          {meta.canisterMoveTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      {f.type !== '상태변경' && (
        <>
          {sel && (
            <BalanceBox
              cur={Number(sel.weight) || 0}
              qty={Number(f.weight) || 0}
              type={f.type}
              unit={sel.unit || 'kg'}
              over={f.type === '반출' && Number(f.weight) > (Number(sel.weight) || 0)}
              hasQty={!!f.weight}
            />
          )}
          <Field label={f.type === '반입' ? '반입 무게' : '반출 무게'} required>
            <div style={{ display: 'flex', gap: 6 }}>
              <TextInput type="number" value={f.weight} onChange={(e) => set('weight', e.target.value)} placeholder="0" autoFocus />
              {f.type === '반출' && sel && <button type="button" className="btn secondary sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('weight', String(Number(sel.weight) || 0))}>전량</button>}
            </div>
          </Field>
        </>
      )}
      <div className="form-row">
        <Field label="위치">
          <EtcSelect options={meta.canisterLocations} value={f.location || meta.canisterLocations[0]} etc={f.locationEtc} onChange={(v, etc) => setF((p) => ({ ...p, location: v, locationEtc: etc }))} />
        </Field>
        <Field label="상태">
          <EtcSelect options={meta.canisterStatuses} value={f.status || meta.canisterStatuses[0]} etc={f.statusEtc} onChange={(v, etc) => setF((p) => ({ ...p, status: v, statusEtc: etc }))} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="이력 날짜" hint="실제 발생 날짜 (기본: 오늘)">
          <TextInput type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        </Field>
        <Field label="비고">
          <TextInput value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="예: 2공장 충전 후 반입" />
        </Field>
      </div>
    </Modal>
  );
}

function CanisterEditForm({ meta, item, onClose, onSaved, onError }) {
  const [f, setF] = useState({ canisterNo: item.canisterNo, size: item.size, sizeEtc: item.sizeEtc || '', content: item.content || '', contentEtc: '', note: item.note || '' });
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!f.canisterNo.trim()) return onError('Canister No.를 입력하세요.');
    setBusy(true);
    const content = f.content === '기타' ? (f.contentEtc || '').trim() : f.content;
    try {
      await api.patch('/canisters/' + item.id, { canisterNo: f.canisterNo.trim(), size: f.size, sizeEtc: f.sizeEtc, content, note: f.note });
      onSaved();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }
  return (
    <Modal
      title={`Canister 수정 — ${item.canisterNo}`}
      subtitle="제품명·No.·사이즈는 관리자만 변경할 수 있습니다."
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </>}
    >
      <Field label="Canister No." required>
        <TextInput value={f.canisterNo} onChange={(e) => setF((p) => ({ ...p, canisterNo: e.target.value }))} autoFocus />
      </Field>
      <Field label="제품명(내용물)" hint="이력 등록에서는 변경 불가 — 여기서만 수정">
        <EtcSelect options={meta.canisterContents || []} value={f.content} etc={f.contentEtc} onChange={(v, etc) => setF((p) => ({ ...p, content: v, contentEtc: etc || '' }))} placeholder="내용물 직접 입력" />
      </Field>
      <Field label="용기 사이즈" required>
        <EtcSelect options={meta.canisterSizes} value={f.size} etc={f.sizeEtc} onChange={(v, etc) => setF((p) => ({ ...p, size: v, sizeEtc: etc }))} placeholder="사이즈 입력" />
      </Field>
      <Field label="비고">
        <TextInput value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} placeholder="선택 입력" />
      </Field>
    </Modal>
  );
}
