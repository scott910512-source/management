import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Modal, Field, TextInput, Select, useToast, ConfirmDialog, Empty, Loading, Badge } from '../components/ui';

const blank = { title: '', category: '공정', categoryEtc: '', priority: '중', assignee: '', dueDate: '', status: '대기', note: '' };
const prioColor = { 상: 'red', 중: 'orange', 하: '' };
const statColor = { 완료: 'green', 진행중: 'blue', 대기: '', 지연: 'red' };

export default function Tasks() {
  const { isAdmin, canWrite } = useAuth();
  const toast = useToast();
  const [meta, setMeta] = useState(null);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState(null);
  const [showAll, setShowAll] = useState(true);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);

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
    try { await api.patch('/tasks/' + t.id, { status: '완료' }); load(); toast.ok('완료 처리했습니다.'); }
    catch (e) { toast.err(e.message); }
  }

  if (!meta) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div className="desc">등록된 할 일(Task)을 전체 사용자가 확인하고 처리합니다.</div>
        <div className="btn-row">
          <button className={`btn sm ${showAll ? '' : 'secondary'}`} onClick={() => setShowAll((v) => !v)}>{showAll ? '✓ 완료 포함' : '완료 포함'}</button>
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
                <tr key={t.id} style={t.status === '완료' ? { opacity: 0.55 } : {}}>
                  <td><Badge color={prioColor[t.priority]}>{t.priority}</Badge></td>
                  <td><b>{t.title}</b>{t.note && <div className="muted" style={{ fontSize: 12 }}>{t.note}</div>}</td>
                  <td className="muted">{t.category === '기타' ? t.categoryEtc || '기타' : t.category}</td>
                  <td className="muted">{nameOf(t.assignee)}</td>
                  <td className="muted">{t.dueDate || '–'}</td>
                  <td><Badge color={statColor[t.status]} dot>{t.status}</Badge></td>
                  <td className="muted">{(t.createdAt || '').slice(0, 10)}</td>
                  <td>
                    <div className="btn-row">
                      {canWrite && t.status !== '완료' && <button className="btn ghost sm" onClick={() => complete(t)}>완료</button>}
                      {canWrite && <button className="btn secondary sm" onClick={() => setEdit({ mode: 'edit', data: { ...t } })}>수정</button>}
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
    </>
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
