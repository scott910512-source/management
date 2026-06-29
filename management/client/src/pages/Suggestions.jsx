import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Modal, Field, TextInput, Select, useToast, ConfirmDialog, Empty, Loading, Badge } from '../components/ui';

// 건의 항목 — 메뉴 기준 + 기타(직접입력)
const CATEGORIES = ['종합현황', 'AI 검색', '원재료', '부재료', 'Canister', '수불 이력', '원·부재료 투입이력', '이상발생 목록', 'Task 관리', '유해화학물질', '기준정보', '관리자 설정', '전반/기타'];

const blank = { title: '', category: '종합현황', categoryEtc: '', content: '' };

export default function Suggestions() {
  const { user, isAdmin, isDemo } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);

  const load = useCallback(async () => {
    const d = await api.get('/suggestions');
    setItems(d.items);
  }, []);
  useEffect(() => { load(); }, [load]);

  const canEdit = (s) => user && s.createdBy === user.id;

  async function complete(s, done) {
    try {
      await api.patch('/suggestions/' + s.id, { status: done ? '완료' : '대기' });
      load();
      toast.ok(done ? '완료 처리했습니다.' : '완료를 취소했습니다.');
    } catch (e) { toast.err(e.message); }
  }

  const catLabel = (s) => (s.category === '전반/기타' && s.categoryEtc ? s.categoryEtc : s.category === '기타' && s.categoryEtc ? s.categoryEtc : s.category);

  if (isDemo) return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>데모 계정은 건의사항을 이용할 수 없습니다.</div>
      <div className="muted">건의사항 등록 및 조회는 일반 계정에서만 가능합니다.</div>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div className="desc">시스템 개선 <b>건의사항</b>을 등록합니다. 작성자는 수정·삭제할 수 있고, 관리자가 완료 처리합니다.</div>
        <button className="btn sm" onClick={() => setEdit({ mode: 'create', data: { ...blank } })}>+ 건의 등록</button>
      </div>

      <div className="card table-wrap">
        {!items ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty>등록된 건의사항이 없습니다. 우측 상단 [건의 등록]으로 추가하세요.</Empty>
        ) : (
          <table className="tbl compact">
            <thead>
              <tr>
                <th style={{ width: 80 }}>상태</th>
                <th style={{ width: 130 }}>항목</th>
                <th>제목</th>
                <th style={{ width: 110 }}>작성자</th>
                <th style={{ width: 96 }}>등록일</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} style={s.status === '완료' ? { opacity: 0.6 } : {}}>
                  <td><Badge color={s.status === '완료' ? 'green' : 'orange'} dot>{s.status}</Badge></td>
                  <td className="muted">{catLabel(s)}</td>
                  <td><b className="inline-link" style={{ cursor: 'pointer' }} onClick={() => setView(s)}>{s.title}</b></td>
                  <td className="muted">{s.createdByName}</td>
                  <td className="muted">{(s.createdAt || '').slice(0, 10)}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn ghost sm" onClick={() => setView(s)}>보기</button>
                      {isAdmin && (s.status === '완료'
                        ? <button className="btn secondary sm" onClick={() => complete(s, false)}>완료취소</button>
                        : <button className="btn sm" onClick={() => complete(s, true)}>완료</button>)}
                      {canEdit(s) && <button className="btn secondary sm" onClick={() => setEdit({ mode: 'edit', data: { ...s } })}>수정</button>}
                      {(canEdit(s) || isAdmin) && <button className="btn danger sm" onClick={() => setDel(s)}>삭제</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <SuggestionForm
          mode={edit.mode} initial={edit.data}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); toast.ok(edit.mode === 'create' ? '건의를 등록했습니다.' : '수정했습니다.'); }}
          onError={(m) => toast.err(m)}
        />
      )}
      {view && (
        <Modal title={view.title} onClose={() => setView(null)} footer={<button className="btn secondary" onClick={() => setView(null)}>닫기</button>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <Badge color={view.status === '완료' ? 'green' : 'orange'} dot>{view.status}</Badge>
            <Badge>{catLabel(view)}</Badge>
            <span className="muted" style={{ fontSize: 12 }}>{view.createdByName} · {(view.createdAt || '').slice(0, 10)}</span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{view.content}</div>
          {view.status === '완료' && <div className="hint" style={{ marginTop: 12, color: 'var(--green)' }}>✓ 완료 처리 — {view.completedByName} ({(view.completedAt || '').slice(0, 10)})</div>}
        </Modal>
      )}
      {del && (
        <ConfirmDialog title="건의사항 삭제" message={`'${del.title}' 를 삭제할까요?`} onClose={() => setDel(null)}
          onConfirm={async () => { try { await api.del('/suggestions/' + del.id); setDel(null); load(); toast.ok('삭제했습니다.'); } catch (e) { toast.err(e.message); } }} />
      )}
    </>
  );
}

function SuggestionForm({ mode, initial, onClose, onSaved, onError }) {
  const [f, setF] = useState({ ...blank, ...initial });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isEtc = f.category === '전반/기타';

  async function submit() {
    if (!f.title.trim()) return onError('제목을 입력하세요.');
    if (!f.content.trim()) return onError('내용을 입력하세요.');
    setBusy(true);
    try {
      const payload = { title: f.title.trim(), category: f.category, categoryEtc: f.categoryEtc, content: f.content };
      if (mode === 'create') await api.post('/suggestions', payload);
      else await api.patch('/suggestions/' + initial.id, payload);
      onSaved();
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={mode === 'create' ? '건의 등록' : '건의 수정'} onClose={onClose}
      footer={<>
        <button className="btn secondary" onClick={onClose}>취소</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </>}>
      <Field label="제목" required>
        <TextInput value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="예: 원재료 입고 시 단가 입력란 추가 요청" autoFocus />
      </Field>
      <Field label="항목 (메뉴 선택)" required hint="건의 대상 메뉴를 선택하거나 '전반/기타'에서 직접 입력">
        <Select value={f.category} onChange={(e) => set('category', e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>
      {isEtc && (
        <Field label="항목 직접입력">
          <TextInput value={f.categoryEtc} onChange={(e) => set('categoryEtc', e.target.value)} placeholder="항목 입력" />
        </Field>
      )}
      <Field label="내용" required>
        <textarea className="input" rows={6} value={f.content} onChange={(e) => set('content', e.target.value)} placeholder="개선이 필요한 내용을 자세히 적어주세요." style={{ resize: 'vertical', fontFamily: 'inherit' }} />
      </Field>
    </Modal>
  );
}
