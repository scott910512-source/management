import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty, Badge, useToast, ConfirmDialog, Select, Field, TextInput, Modal } from '../components/ui';

const statusBadge = { pending: { c: 'orange', t: '승인대기' }, approved: { c: 'green', t: '승인됨' }, rejected: { c: 'red', t: '거절/금지' } };

export default function Admin() {
  const { user, isSuper } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [del, setDel] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPw, setNewPw] = useState('');

  const load = useCallback(async () => {
    if (!isSuper) { setItems([]); return; }
    const d = await api.get('/users');
    setItems(d.items);
  }, [isSuper]);
  useEffect(() => {
    load();
  }, [load]);

  async function action(fn, okMsg) {
    try {
      await fn();
      await load();
      toast.ok(okMsg);
    } catch (e) {
      toast.err(e.message);
    }
  }

  if (!items) return <Loading />;
  const pending = items.filter((u) => u.status === 'pending');

  return (
    <>
      <div className="page-head">
        <div className="desc">가입 승인·권한 관리와 안전재고 경고 비율을 설정합니다.</div>
      </div>

      <SafetyRatioCard toast={toast} />
      <SettingsLogCard />

      {!isSuper && (
        <div className="card card-pad">
          <p className="hint" style={{ margin: 0 }}>현재 공장의 <b>기준정보·경고 비율</b>을 관리할 수 있습니다. 사용자 관리는 총괄관리자만 가능합니다.</p>
        </div>
      )}

      {isSuper && pending.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--orange)' }}>
          <div className="card-head"><h3>승인 대기 {pending.length}건</h3></div>
          <div className="card-pad">
            {pending.map((u) => (
              <div key={u.id} className="safety-row" style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <div className="safety-name">{u.name} <span className="muted" style={{ fontWeight: 400 }}>({u.id})</span></div>
                  <div className="safety-qty">신청일 {(u.createdAt || '').slice(0, 10)}</div>
                </div>
                <div className="btn-row">
                  <button className="btn sm" onClick={() => action(() => api.post(`/users/${u.id}/approve`, { role: 'user' }), '등록자로 승인했습니다.')}>등록자 승인</button>
                  <button className="btn secondary sm" onClick={() => action(() => api.post(`/users/${u.id}/approve`, { role: 'admin' }), '관리자로 승인했습니다.')}>관리자 승인</button>
                  <button className="btn danger sm" onClick={() => action(() => api.post(`/users/${u.id}/reject`), '거절했습니다.')}>거절</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSuper && (
      <div className="card table-wrap">
        <div className="card-head"><h3>전체 사용자 {items.length}명</h3></div>
        {items.length === 0 ? (
          <Empty>사용자가 없습니다.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>아이디</th><th>이름</th><th>역할</th><th>공장범위</th><th>상태</th><th>가입일</th><th style={{ width: 1 }}></th></tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const sb = statusBadge[u.status] || { c: '', t: u.status };
                const self = u.id === user.id;
                return (
                  <tr key={u.id}>
                    <td><b>{u.id}</b>{self && <span className="muted"> (나)</span>}</td>
                    <td>{u.name}</td>
                    <td>
                      <Select
                        value={u.role}
                        disabled={self}
                        onChange={(e) => action(() => api.patch(`/users/${u.id}`, { role: e.target.value }), '역할을 변경했습니다.')}
                        style={{ width: 130 }}
                      >
                        <option value="user">사용자(등록)</option>
                        <option value="admin">공장 관리자</option>
                        <option value="viewer">팀관리자(조회)</option>
                      </Select>
                    </td>
                    <td>
                      <Select
                        value={u.plantScope || '2공장'}
                        disabled={self}
                        onChange={(e) => action(() => api.patch(`/users/${u.id}`, { plantScope: e.target.value, plant: e.target.value === 'all' ? '2공장' : e.target.value }), '공장 범위를 변경했습니다.')}
                        style={{ width: 110 }}
                      >
                        <option value="all">전체</option>
                        <option value="1공장">1공장</option>
                        <option value="2공장">2공장</option>
                      </Select>
                    </td>
                    <td><Badge color={sb.c} dot>{sb.t}</Badge></td>
                    <td className="muted">{(u.createdAt || '').slice(0, 10)}</td>
                    <td>
                      <div className="btn-row">
                        {u.status !== 'approved' && (
                          <button className="btn ghost sm" onClick={() => action(() => api.post(`/users/${u.id}/approve`, { role: u.role }), '승인했습니다.')}>승인</button>
                        )}
                        {!self && <button className="btn secondary sm" onClick={() => { setResetTarget(u); setNewPw(''); }}>비번초기화</button>}
                        {!self && <button className="btn danger sm" onClick={() => setDel(u)}>삭제</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}

      {resetTarget && (
        <Modal title={`비밀번호 초기화 — ${resetTarget.name}`} size="sm" onClose={() => setResetTarget(null)}
          footer={
            <>
              <button className="btn" onClick={async () => {
                if (newPw.length < 4) { toast.err('비밀번호는 4자 이상이어야 합니다.'); return; }
                await action(() => api.patch(`/users/${resetTarget.id}`, { password: newPw }), `${resetTarget.name} 비밀번호를 초기화했습니다.`);
                setResetTarget(null);
              }}>확인</button>
              <button className="btn secondary" onClick={() => setResetTarget(null)}>취소</button>
            </>
          }
        >
          <Field label="새 비밀번호" hint="4자 이상 입력하세요.">
            <TextInput type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호" autoFocus />
          </Field>
        </Modal>
      )}

      {del && (
        <ConfirmDialog
          title="사용자 삭제"
          message={`'${del.name}(${del.id})' 계정을 삭제할까요?`}
          onClose={() => setDel(null)}
          onConfirm={() => { setDel(null); action(() => api.del('/users/' + del.id), '삭제했습니다.'); }}
        />
      )}
    </>
  );
}

function SafetyRatioCard({ toast }) {
  const [ratio, setRatio] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/settings').then((d) => { setRatio(d.settings.safetyRatioPercent); setLoaded(true); });
  }, []);
  async function save() {
    setBusy(true);
    try { await api.patch('/settings', { safetyRatioPercent: Number(ratio) }); toast.ok('경고 비율을 저장했습니다.'); }
    catch (e) { toast.err(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 6 }}>안전재고 경고 비율</h3>
      <p className="hint" style={{ marginBottom: 14 }}>
        품목별 <b>안전재고 목표값</b>은 [기준정보]에서 설정합니다. 현재 재고가 <b>(목표값 × 비율%)</b> 미만이면 경고합니다.
      </p>
      <Field label="경고 비율 (%)" hint="예: 100 → 목표값 미만 시 경고 / 120 → 목표값의 1.2배 미만 시 경고">
        <div className="form-row" style={{ maxWidth: 260 }}>
          <TextInput type="number" value={ratio} onChange={(e) => setRatio(e.target.value)} disabled={!loaded} />
          <button className="btn" onClick={save} disabled={busy || !loaded}>{busy ? '저장 중…' : '저장'}</button>
        </div>
      </Field>
    </div>
  );
}

const KEY_LABELS = {
  safetyRatioPercent: '안전재고 경고 비율',
  canisterDefaultSize: 'Canister 기본 사이즈',
  canisterDefaultLocation: 'Canister 기본 위치',
  canisterDefaultStatus: 'Canister 기본 상태',
  canisterDefaultContent: 'Canister 기본 내용물',
  canisterSizes: 'Canister 사이즈 목록',
  canisterLocations: 'Canister 위치 목록',
  canisterStatuses: 'Canister 상태 목록',
  canisterContents: 'Canister 내용물 목록',
};

function SettingsLogCard() {
  const [logs, setLogs] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && !logs) {
      api.get('/settings/log').then((d) => setLogs(d.items)).catch(() => setLogs([]));
    }
  }, [open, logs]);
  return (
    <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>설정 변경 이력</h3>
        <button className="btn ghost sm" onClick={() => setOpen((v) => !v)}>{open ? '숨기기' : '펼치기'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          {!logs ? <Loading /> : logs.length === 0 ? <Empty>변경 이력이 없습니다.</Empty> : (
            <table className="tbl compact">
              <thead><tr><th>일시</th><th>항목</th><th>이전 값</th><th>변경 후 값</th><th>변경자</th></tr></thead>
              <tbody>
                {logs.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{(r.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td>{KEY_LABELS[r.key] || r.key}</td>
                    <td className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.oldValue || '–'}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.newValue || '–'}</td>
                    <td className="muted">{r.changedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

