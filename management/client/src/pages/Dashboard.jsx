import { useEffect, useState, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty, Badge, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { SmartSearch } from '../components/SmartSearch';

const statColor = { 완료: 'green', 진행중: 'blue', 대기: '', 지연: 'red' };
const prioColor = { 상: 'red', 중: 'orange', 하: '' };

function QuickGroup({ icon, color, title, actions, navigate }) {
  return (
    <div className="quick-box" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="quick-ico" style={{ background: color }}><Icon name={icon} size={22} /></div>
        <div className="qt" style={{ fontSize: 15 }}>{title}</div>
      </div>
      <div className="quick-acts">
        {actions.map(([label, to]) => (
          <button key={label} className="quick-act" onClick={() => navigate(to)}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/** 요약 행을 제품(사용처)별로 묶는다. 미지정/공통은 뒤로. */
function groupByProduct(rows) {
  const groups = [];
  const idx = {};
  for (const r of rows) {
    const key = r.product || '미지정';
    if (!(key in idx)) { idx[key] = groups.length; groups.push({ product: key, rows: [] }); }
    groups[idx[key]].rows.push(r);
  }
  return groups;
}

export default function Dashboard() {
  const { canWrite } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [dash, setDash] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [matTab, setMatTab] = useState('raw');

  const loadWarnings = useCallback(() => api.get('/warnings').then((d) => setWarnings(d.items)), []);
  const loadTasks = useCallback(() => api.get('/tasks').then((d) => setTasks(d.items)), []);
  useEffect(() => {
    api.get('/dashboard').then(setDash).catch(() => setDash({ error: true }));
    loadWarnings();
    loadTasks();
  }, [loadWarnings, loadTasks]);

  async function ack(key, content) {
    try { await api.post('/warnings/ack', { key, content }); loadWarnings(); } catch (e) { toast.err(e.message); }
  }
  async function dismiss(key, content) {
    try { await api.post('/warnings/dismiss', { key, content }); loadWarnings(); toast.ok('경고를 숨겼습니다.'); } catch (e) { toast.err(e.message); }
  }
  async function completeTask(t) {
    try { await api.patch('/tasks/' + t.id, { status: '완료' }); loadTasks(); toast.ok('완료 처리했습니다.'); } catch (e) { toast.err(e.message); }
  }

  if (!dash) return <Loading />;
  if (dash.error) return <Empty>대시보드를 불러오지 못했습니다.</Empty>;

  const mat = matTab === 'raw' ? dash.rawSummary : dash.subSummary;
  const matPath = matTab === 'raw' ? '/raw' : '/sub';

  return (
    <>
      {/* 0) AI 스마트 검색 */}
      <SmartSearch />

      {/* 1) 퀵메뉴 (묶음) — 조회 전용(팀관리자)에는 숨김 */}
      {canWrite && (
        <div className="quickmenu">
          <QuickGroup navigate={navigate} icon="canister" color="#0071e3" title="원재료" actions={[['입고', '/raw?new=1', ''], ['사용', '/raw?use=1']]} />
          <QuickGroup navigate={navigate} icon="drum" color="#5e5ce6" title="부재료" actions={[['입고', '/sub?new=1', ''], ['사용', '/sub?use=1']]} />
          <QuickGroup navigate={navigate} icon="star" color="#34c759" title="Canister" actions={[['수불 등록', '/canisters?move=1', '']]} />
        </div>
      )}

      {/* 2) 경고 영역 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>⚠ 경고 {warnings ? `(${warnings.length})` : ''}</h3>
          <span className="hint">안전재고 부족 · Canister 용량 초과</span>
        </div>
        <div>
          {!warnings ? <Loading /> : warnings.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>현재 경고가 없습니다. 👍</div>
          ) : warnings.map((w) => (
            <div className={`warn-item ${w.level === 'warn' ? 'warn' : ''}`} key={w.key}>
              <span className="wbar" />
              <div className="wc">
                <div className="wmsg">{w.content}</div>
                <div className="wack">
                  확인 {w.ackCount}/{w.totalUsers}명 {w.ackedByMe ? '· 내 확인 완료' : ''}
                  {w.pending && w.pending.length > 0 && <> · 미확인: {w.pending.join(', ')}</>}
                </div>
              </div>
              {canWrite && !w.ackedByMe && <button className="btn sm" onClick={() => ack(w.key, w.content)}>확인</button>}
              {canWrite && <button className="btn secondary sm" onClick={() => dismiss(w.key, w.content)}>삭제</button>}
            </div>
          ))}
        </div>
      </div>

      {/* 3) 요약 현황 */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h3>원·부재료 현황 (제품별)</h3>
            <div className="btn-row">
              <button className={`btn sm ${matTab === 'raw' ? '' : 'secondary'}`} onClick={() => setMatTab('raw')}>원재료</button>
              <button className={`btn sm ${matTab === 'sub' ? '' : 'secondary'}`} onClick={() => setMatTab('sub')}>부재료</button>
            </div>
          </div>
          <div className="table-wrap">
            {mat.length === 0 ? <Empty>품목이 없습니다.</Empty> : (
              <table className="tbl compact">
                <thead>
                  <tr><th>품목</th><th className="num">잔여 Lot</th><th className="num">현재고</th><th>단위</th><th className="num">최소재고</th><th className="num">안전%</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {groupByProduct(mat).map((g) => (
                    <Fragment key={g.product}>
                      <tr className="group-row"><td colSpan={7}>🏷 {g.product}</td></tr>
                      {g.rows.map((r) => (
                        <tr key={r.name} className={r.below ? 'row-low' : ''} style={{ cursor: 'pointer' }} onClick={() => navigate(matPath)}>
                          <td><b className="inline-link">{r.name}</b></td>
                          <td className="num">{r.lots}</td>
                          <td className="num"><b>{r.current.toLocaleString()}</b></td>
                          <td className="muted">{r.unit}</td>
                          <td className="num muted">{r.minStock ? r.minStock.toLocaleString() : '–'}</td>
                          <td className="num">{r.level == null ? '–' : `${r.level}%`}</td>
                          <td><span className={`state-pill state-${r.state}`}>{r.state}</span></td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Canister 현황</h3><span className="inline-link" onClick={() => navigate('/canisters')}>전체 →</span></div>
          <div className="table-wrap">
            {dash.canisterSummary.length === 0 ? <Empty>Canister가 없습니다.</Empty> : (
              <table className="tbl compact">
                <thead>
                  <tr><th>종류</th><th className="num">개수</th><th className="num">Total 무게</th><th>최대 무게 비고</th></tr>
                </thead>
                <tbody>
                  {groupByProduct(dash.canisterSummary.map((c) => ({ ...c, product: c.content }))).map((g) => (
                    <Fragment key={g.product}>
                      <tr className="group-row"><td colSpan={4}>🛢 사용제품: {g.product}</td></tr>
                      {g.rows.map((c, i) => (
                        <tr key={i} style={{ cursor: 'pointer' }} onClick={() => navigate('/canisters')}>
                          <td style={{ paddingLeft: 24 }}><Badge>{c.size}</Badge></td>
                          <td className="num">{c.count}</td>
                          <td className="num">{c.totalWeight.toLocaleString()}</td>
                          <td className="muted">{c.heaviestNote || '–'}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 4) Task */}
      <div className="card">
        <div className="card-head">
          <h3>진행 Task {tasks ? `(${tasks.length})` : ''}</h3>
          <span className="inline-link" onClick={() => navigate('/tasks')}>+ Task 등록 / 관리 →</span>
        </div>
        <div className="table-wrap">
          {!tasks ? <Loading /> : tasks.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>진행 중인 Task가 없습니다.</div>
          ) : (
            <table className="tbl compact">
              <thead>
                <tr><th>우선</th><th>Task명</th><th>구분</th><th>담당</th><th>완료예정</th><th>현황</th><th style={{ width: 1 }}></th></tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td><Badge color={prioColor[t.priority]}>{t.priority}</Badge></td>
                    <td><b>{t.title}</b></td>
                    <td className="muted">{t.category === '기타' ? t.categoryEtc || '기타' : t.category}</td>
                    <td className="muted">{t.assignee || '–'}</td>
                    <td className="muted">{t.dueDate || '–'}</td>
                    <td><Badge color={statColor[t.status]} dot>{t.status}</Badge></td>
                    <td>{canWrite && <div className="btn-row"><button className="btn ghost sm" onClick={() => completeTask(t)}>완료</button></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
