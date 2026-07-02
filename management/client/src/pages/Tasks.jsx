import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Modal, Field, TextInput, Select, useToast, ConfirmDialog, Empty, Loading, Badge } from '../components/ui';

const blank = { title: '', category: '공정', categoryEtc: '', priority: '중', assignee: '', dueDate: '', status: '대기', note: '' };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const cycleLabel = (t) => {
  if (t.cycle === '일') return '매일';
  if (t.cycle === '주') return `매주 ${WEEKDAYS[Number(t.weekday) || 0]}요일`;
  if (t.cycle === '월') return `매월 ${t.monthday || 1}일`;
  return t.cycle;
};
const prioColor = { 상: 'red', 중: 'orange', 하: '' };
const statColor = { 완료: 'green', 완료대기: 'orange', 진행중: 'blue', 대기: '', 지연: 'red' };
const today = () => new Date().toISOString().slice(0, 10);
function isOverdue(t) { return t.dueDate && t.status !== '완료' && t.dueDate < today(); }

export default function Tasks() {
  const { isAdmin, canWrite, user } = useAuth();
  const toast = useToast();
  const [meta, setMeta] = useState(null);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState(null);
  const [showAll, setShowAll] = useState(true);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [showRecurring, setShowRecurring] = useState(false);

  const load = useCallback(async () => {
    const d = await api.get('/tasks' + (showAll ? '?all=1' : ''));
    setItems(d.items);
  }, [showAll]);
  useEffect(() => {
    api.get('/meta').then(setMeta);
    api.get('/users/options').then((d) => setUsers(d.items));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const nameOf = (id) => users.find((u) => u.id === id)?.name || id || '–';

  async function complete(t) {
    try {
      await api.patch('/tasks/' + t.id, { status: '완료' });
      load();
      toast.ok(isAdmin ? '완료 처리했습니다.' : '완료 요청했습니다. 관리자 승인 후 완료됩니다.');
    } catch (e) { toast.err(e.message); }
  }
  async function approve(t) {
    try { await api.patch('/tasks/' + t.id, { status: '완료' }); load(); toast.ok('완료를 승인했습니다.'); }
    catch (e) { toast.err(e.message); }
  }
  async function reject(t) {
    try { await api.patch('/tasks/' + t.id, { status: '진행중' }); load(); toast.ok('완료 요청을 반려했습니다.'); }
    catch (e) { toast.err(e.message); }
  }
  const canEdit = (t) => isAdmin || (user && t.createdBy === user.id);

  if (!meta) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div className="desc">등록된 할 일(Task)을 전체 사용자가 확인하고 처리합니다.</div>
        <div className="btn-row">
          <button className={`btn sm ${showAll ? '' : 'secondary'}`} onClick={() => setShowAll((v) => !v)}>{showAll ? '✓ 완료 포함' : '완료 포함'}</button>
          {canWrite && <button className="btn secondary sm" onClick={() => setShowRecurring(true)}>🔁 정기 업무</button>}
          {canWrite && <button className="btn sm" onClick={() => setEdit({ mode: 'create', data: { ...blank } })}>+ Task 등록</button>}
        </div>
      </div>

      <div className="card table-wrap">
        {!items ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty>등록된 Task가 없습니다.</Empty>
        ) : (
          <table className="tbl compact">
            <thead>
              <tr>
                <th>우선</th><th>Task명</th><th>구분</th><th>담당자</th><th>완료예정</th><th>진행현황</th><th>등록일</th><th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} style={t.status === '완료' ? { opacity: 0.55 } : isOverdue(t) ? { background: 'var(--red-bg, #fff1f1)' } : {}}>
                  <td><Badge color={prioColor[t.priority]}>{t.priority}</Badge></td>
                  <td><b>{t.title}</b>{t.recurringId && <span title="정기 업무" style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent,#0071e3)', fontWeight: 600 }}>🔁 정기</span>}{t.note && <div className="muted" style={{ fontSize: 12 }}>{t.note}</div>}</td>
                  <td className="muted">{t.category === '기타' ? t.categoryEtc || '기타' : t.category}</td>
                  <td className="muted">{nameOf(t.assignee)}</td>
                  <td className="muted" style={isOverdue(t) ? { color: 'var(--red)', fontWeight: 600 } : {}}>{t.dueDate || '–'}{isOverdue(t) && ' ⚠'}</td>
                  <td><Badge color={statColor[t.status]} dot>{t.status}</Badge></td>
                  <td className="muted">{(t.createdAt || '').slice(0, 10)}<div style={{ fontSize: 11 }}>by {nameOf(t.createdBy)}</div></td>
                  <td>
                    <div className="btn-row">
                      {/* 완료대기: 관리자는 승인/반려, 일반 사용자는 '승인 대기중' 표시 */}
                      {t.status === '완료대기' && isAdmin && <button className="btn sm" onClick={() => approve(t)}>승인</button>}
                      {t.status === '완료대기' && isAdmin && <button className="btn secondary sm" onClick={() => reject(t)}>반려</button>}
                      {t.status === '완료대기' && !isAdmin && <span className="muted" style={{ fontSize: 12 }}>승인 대기중</span>}
                      {/* 완료 처리 (완료/완료대기가 아닌 경우) */}
                      {canWrite && t.status !== '완료' && t.status !== '완료대기' && <button className="btn ghost sm" onClick={() => complete(t)}>완료</button>}
                      {/* 내용 수정 — 작성자 또는 관리자만 */}
                      {canWrite && canEdit(t) && <button className="btn secondary sm" onClick={() => setEdit({ mode: 'edit', data: { ...t } })}>수정</button>}
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
        <TaskForm
          mode={edit.mode} initial={edit.data} meta={meta} users={users}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); toast.ok(edit.mode === 'create' ? 'Task를 등록했습니다.' : '수정했습니다.'); }}
          onError={(m) => toast.err(m)}
        />
      )}
      {del && (
        <ConfirmDialog title="Task 삭제" message={`'${del.title}' 를 삭제할까요?`} onClose={() => setDel(null)}
          onConfirm={async () => { try { await api.del('/tasks/' + del.id); setDel(null); load(); toast.ok('삭제했습니다.'); } catch (e) { toast.err(e.message); } }} />
      )}
      {showRecurring && (
        <RecurringManager meta={meta} users={users} isAdmin={isAdmin} user={user}
          onClose={() => setShowRecurring(false)} onChanged={load} toast={toast} />
      )}
    </>
  );
}

const rcBlank = { title: '', category: '현장관리', categoryEtc: '', priority: '중', assignee: '', note: '', cycle: '월', weekday: '1', monthday: '1' };

function RecurringManager({ meta, users, isAdmin, user, onClose, onChanged, toast }) {
  const [items, setItems] = useState(null);
  const [f, setF] = useState({ ...rcBlank });
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const nameOf = (id) => users.find((u) => u.id === id)?.name || id || '미지정';
  const canEdit = (t) => isAdmin || (user && t.createdBy === user.id);

  const load = async () => { const d = await api.get('/tasks/recurring'); setItems(d.items); };
  useEffect(() => { load(); }, []);

  const reset = () => { setF({ ...rcBlank }); setEditId(null); };
  const save = async () => {
    if (!f.title.trim()) return toast.err('정기 업무명을 입력하세요.');
    setBusy(true);
    try {
      const payload = { title: f.title.trim(), category: f.category, categoryEtc: f.categoryEtc, priority: f.priority, assignee: f.assignee, note: f.note, cycle: f.cycle, weekday: f.weekday, monthday: f.monthday };
      if (editId) await api.patch('/tasks/recurring/' + editId, payload);
      else await api.post('/tasks/recurring', payload);
      toast.ok(editId ? '수정했습니다.' : '정기 업무를 등록했습니다.');
      reset(); await load(); onChanged();
    } catch (e) { toast.err(e.message); } finally { setBusy(false); }
  };
  const toggle = async (t) => { try { await api.patch('/tasks/recurring/' + t.id, { active: String(t.active) === '0' }); await load(); onChanged(); } catch (e) { toast.err(e.message); } };
  const remove = async (t) => { try { await api.del('/tasks/recurring/' + t.id); await load(); onChanged(); toast.ok('삭제했습니다.'); } catch (e) { toast.err(e.message); } };
  const startEdit = (t) => { setEditId(t.id); setF({ title: t.title, category: t.category, categoryEtc: t.categoryEtc || '', priority: t.priority, assignee: t.assignee || '', note: t.note || '', cycle: t.cycle, weekday: t.weekday || '1', monthday: t.monthday || '1' }); };

  return (
    <Modal title="정기(반복) 업무 관리" subtitle="주기(일/주/월)마다 Task 목록에 자동으로 생성됩니다." size="lg" onClose={onClose}
      footer={<button className="btn secondary" onClick={onClose}>닫기</button>}>
      {/* 등록/수정 폼 */}
      <div className="card card-pad" style={{ marginBottom: 14, background: 'var(--bg-2,#fafafd)' }}>
        <Field label="정기 업무명" required>
          <TextInput value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="예: 일일 안전점검 / 주간 재고실사 / 월간 설비점검" />
        </Field>
        <div className="form-row">
          <Field label="주기" required>
            <Select value={f.cycle} onChange={(e) => set('cycle', e.target.value)}>
              <option value="일">매일</option><option value="주">매주</option><option value="월">매월</option>
            </Select>
          </Field>
          {f.cycle === '주' && (
            <Field label="요일">
              <Select value={f.weekday} onChange={(e) => set('weekday', e.target.value)}>
                {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}요일</option>)}
              </Select>
            </Field>
          )}
          {f.cycle === '월' && (
            <Field label="일자">
              <Select value={f.monthday} onChange={(e) => set('monthday', e.target.value)}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}일</option>)}
              </Select>
            </Field>
          )}
        </div>
        <div className="form-row">
          <Field label="구분" required>
            <Select value={f.category} onChange={(e) => set('category', e.target.value)}>
              {meta.taskCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="우선순위" required>
            <Select value={f.priority} onChange={(e) => set('priority', e.target.value)}>
              {meta.taskPriorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="담당자">
            <Select value={f.assignee} onChange={(e) => set('assignee', e.target.value)}>
              <option value="">미지정</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
            </Select>
          </Field>
          <Field label="비고"><TextInput value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="선택 입력" /></Field>
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          {editId && <button className="btn secondary sm" onClick={reset}>취소</button>}
          <button className="btn sm" onClick={save} disabled={busy}>{busy ? '저장 중…' : editId ? '수정 저장' : '+ 정기 업무 추가'}</button>
        </div>
      </div>

      {/* 목록 */}
      {!items ? <Loading /> : items.length === 0 ? <Empty>등록된 정기 업무가 없습니다.</Empty> : (
        <table className="tbl compact">
          <thead><tr><th>주기</th><th>업무명</th><th>구분</th><th>담당자</th><th>상태</th><th style={{ width: 1 }}></th></tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} style={String(t.active) === '0' ? { opacity: 0.5 } : {}}>
                <td><Badge color="blue">{cycleLabel(t)}</Badge></td>
                <td><b>{t.title}</b>{t.note && <div className="muted" style={{ fontSize: 12 }}>{t.note}</div>}</td>
                <td className="muted">{t.category === '기타' ? t.categoryEtc || '기타' : t.category}</td>
                <td className="muted">{nameOf(t.assignee)}</td>
                <td>{String(t.active) === '0' ? <span className="muted">중지</span> : <Badge color="green" dot>활성</Badge>}</td>
                <td>
                  <div className="btn-row">
                    {canEdit(t) && <button className="btn secondary sm" onClick={() => startEdit(t)}>수정</button>}
                    {canEdit(t) && <button className="btn secondary sm" onClick={() => toggle(t)}>{String(t.active) === '0' ? '재개' : '중지'}</button>}
                    {canEdit(t) && <button className="btn danger sm" onClick={() => remove(t)}>삭제</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function TaskForm({ mode, initial, meta, users, onClose, onSaved, onError }) {
  const [f, setF] = useState({ ...blank, ...initial });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.title.trim()) return onError('Task명을 입력하세요.');
    setBusy(true);
    try {
      const payload = { title: f.title.trim(), category: f.category, categoryEtc: f.categoryEtc, priority: f.priority, assignee: f.assignee, dueDate: f.dueDate, status: f.status, note: f.note };
      if (mode === 'create') await api.post('/tasks', payload);
      else await api.patch('/tasks/' + initial.id, payload);
      onSaved();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={mode === 'create' ? 'Task 등록' : 'Task 수정'} onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </>}>
      <Field label="Task명" required>
        <TextInput value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="예: 3류창고 Canister 세정 확인" autoFocus />
      </Field>
      <div className="form-row">
        <Field label="구분" required>
          <Select value={f.category} onChange={(e) => set('category', e.target.value)}>
            {meta.taskCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="우선순위" required>
          <Select value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            {meta.taskPriorities.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      </div>
      {f.category === '기타' && (
        <Field label="구분 직접입력"><TextInput value={f.categoryEtc} onChange={(e) => set('categoryEtc', e.target.value)} placeholder="구분 입력" /></Field>
      )}
      <div className="form-row">
        <Field label="담당자">
          <Select value={f.assignee} onChange={(e) => set('assignee', e.target.value)}>
            <option value="">미지정</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
          </Select>
        </Field>
        <Field label="완료 예정일">
          <TextInput type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="진행현황" required>
          <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
            {meta.taskStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="비고"><TextInput value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="선택 입력" /></Field>
      </div>
    </Modal>
  );
}
