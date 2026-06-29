import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, downloadCsv } from '../api';
import { Loading, Empty, Badge, statusColor, useToast, Modal, Field, TextInput, Select } from '../components/ui';
import { EtcSelect, BalanceBox } from '../components/inputs';
import { useAuth } from '../auth/AuthContext';

const typeColor = { 반입: 'green', 반출: 'orange', 상태변경: 'purple' };

export default function CanisterDetail() {
  const { id } = useParams();
  const { canWrite } = useAuth();
  const toast = useToast();
  const [item, setItem] = useState(null);
  const [history, setHistory] = useState(null);
  const [meta, setMeta] = useState(null);
  const [move, setMove] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, h] = await Promise.all([api.get('/canisters/' + id), api.get(`/canisters/${id}/history`)]);
      setItem(c.item);
      setHistory(h.items);
    } catch (e) {
      setErr(e.message);
    }
  }, [id]);

  useEffect(() => {
    api.get('/meta').then(setMeta);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (err) return <Empty>{err} <Link to="/canisters" className="inline-link">목록으로</Link></Empty>;
  if (!item || !history) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/canisters" className="inline-link">← Canister 목록</Link>
          <h2 style={{ marginTop: 8, fontSize: 24 }}>{item.canisterNo}</h2>
        </div>
        <div className="btn-row">
          <button className="btn secondary sm" onClick={() => { downloadCsv(`/canisters/${id}/history/export`); toast.ok('이력 CSV를 내려받습니다.'); }}>⬇ 이력 CSV</button>
          {canWrite && <button className="btn sm" onClick={() => setMove(true)} disabled={!meta}>↔ 반입/반출 등록</button>}
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="label">제품(내용물)</div><div className="value" style={{ fontSize: 20 }}>{item.content || <span className="muted">비어있음</span>}</div></div>
        <div className="card stat"><div className="label">현재 무게</div><div className="value" style={{ fontSize: 22 }}>{Number(item.weight || 0).toLocaleString()}</div></div>
        <div className="card stat"><div className="label">위치 / 사이즈</div><div className="value" style={{ fontSize: 18 }}>{item.locationLabel}<div className="muted" style={{ fontSize: 13 }}>{item.sizeLabel}</div></div></div>
        <div className="card stat"><div className="label">상태</div><div style={{ marginTop: 10 }}><Badge color={statusColor(item.status)} dot>{item.statusLabel}</Badge></div></div>
      </div>

      <div className="card">
        <div className="card-head"><h3>용기이력카드 — 반입/반출 내역</h3><Badge>{history.length}건</Badge></div>
        <div className="table-wrap">
          {history.length === 0 ? (
            <Empty>이력이 없습니다.</Empty>
          ) : (
            <table className="tbl compact">
              <thead>
                <tr><th>일시</th><th>구분</th><th>제품(내용물)</th><th className="num">무게</th><th>위치</th><th>상태</th><th>비고</th><th>작성자</th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="muted">{(h.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td><Badge color={typeColor[h.type] || ''}>{h.type}</Badge></td>
                    <td>{h.content || <span className="muted">–</span>}</td>
                    <td className="num">{Number(h.weight || 0).toLocaleString()}</td>
                    <td className="muted">{h.location}</td>
                    <td><Badge color={statusColor(h.status)} dot>{h.status}</Badge></td>
                    <td className="muted">{h.note || '–'}</td>
                    <td className="muted">{h.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {move && meta && (
        <DetailMoveForm
          meta={meta}
          item={item}
          onClose={() => setMove(false)}
          onSaved={() => { setMove(false); load(); toast.ok('이력이 기록되었습니다.'); }}
          onError={(m) => toast.err(m)}
        />
      )}
    </>
  );
}

function DetailMoveForm({ meta, item, onClose, onSaved, onError }) {
  const [f, setF] = useState({
    type: '반출', weight: '',
    location: item.location, locationEtc: item.locationEtc || '',
    status: item.status, statusEtc: item.statusEtc || '', note: '',
  });
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const cur = Number(item.weight) || 0;
  const over = f.type === '반출' && Number(f.weight) > cur;

  async function submit() {
    if (f.type !== '상태변경' && (!f.weight || Number(f.weight) <= 0)) return onError('무게를 입력하세요.');
    if (over) return onError('반출 무게가 현재 내용물 무게를 초과합니다.');
    setBusy(true);
    try {
      await api.post(`/canisters/${item.id}/move`, { ...f, weight: f.weight === '' ? 0 : Number(f.weight), txDate });
      onSaved();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal
      title={`반입/반출 등록 — ${item.canisterNo}`}
      subtitle={`현재: ${item.content || '비어있음'} · ${cur.toLocaleString()} · ${item.locationLabel} · ${item.statusLabel}`}
      onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy || over}>{busy ? '처리 중…' : '이력 기록'}</button>
      </>}
    >
      {/* 제품명 읽기전용 표시 */}
      <div style={{ background: 'var(--bg2)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
        제품(내용물): <b style={{ color: 'var(--text)' }}>{item.content || '비어있음'}</b>
        <span style={{ fontSize: 11, marginLeft: 8 }}>(제품명 변경은 수정에서만 가능)</span>
      </div>
      <Field label="구분" required>
        <Select value={f.type} onChange={(e) => set('type', e.target.value)}>
          {meta.canisterMoveTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      {f.type !== '상태변경' && (
        <>
          <BalanceBox cur={cur} qty={Number(f.weight) || 0} type={f.type} unit={item.unit || 'kg'} over={over} hasQty={!!f.weight} />
          <Field label={f.type === '반입' ? '반입 무게' : '반출 무게'} required error={over ? '현재 무게를 초과했습니다.' : ''}>
            <div style={{ display: 'flex', gap: 6 }}>
              <TextInput type="number" value={f.weight} onChange={(e) => set('weight', e.target.value)} placeholder="0" autoFocus />
              {f.type === '반출' && <button type="button" className="btn secondary sm" style={{ whiteSpace: 'nowrap' }} onClick={() => set('weight', String(cur))}>전량</button>}
            </div>
          </Field>
        </>
      )}
      <div className="form-row">
        <Field label="위치">
          <EtcSelect options={meta.canisterLocations} value={f.location} etc={f.locationEtc} onChange={(v, etc) => setF((p) => ({ ...p, location: v, locationEtc: etc }))} />
        </Field>
        <Field label="상태">
          <EtcSelect options={meta.canisterStatuses} value={f.status} etc={f.statusEtc} onChange={(v, etc) => setF((p) => ({ ...p, status: v, statusEtc: etc }))} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="이력 날짜" hint="실제 발생 날짜 (기본: 오늘)">
          <TextInput type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        </Field>
        <Field label="비고">
          <TextInput value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="예: 공정 사용 반출" />
        </Field>
      </div>
    </Modal>
  );
}
