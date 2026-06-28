import { useEffect, useState, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Loading, Empty, Badge, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { SmartSearch } from '../components/SmartSearch';

const statColor = { 완료: 'green', 완료대기: 'orange', 진행중: 'blue', 대기: '', 지연: 'red' };
const prioColor = { 상: 'red', 중: 'orange', 하: '' };
// 그룹(제품/사용제품)별 본문 행 음영 — 헤더 팔레트(gt0~4)의 옅은 버전
const ROW_TINTS = ['#f6f9ff', '#f5fbf7', '#fffaf3', '#faf5fe', '#fff6f8'];

function QuickGroup({ icon, color, title, actions, navigate }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="quick-ico" style={{ background: color, flexShrink: 0 }}><Icon name={icon} size={20} /></div>
      <div style={{ fontSize: 13, fontWeight: 600, width: 52, flexShrink: 0 }}>{title}</div>
      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
        {actions.map(([label, to]) => (
          <button key={label} className="quick-act" style={{ flex: 1 }} onClick={() => navigate(to)}>{label}</button>
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
  const { canWrite, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [dash, setDash] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [matTab, setMatTab] = useState('raw');
  const [warnIdx, setWarnIdx] = useState(0); // 경고 롤 현재 인덱스
  const [warnOpen, setWarnOpen] = useState(false); // 경고 전체 펼침

  // 경고 자동 롤(여러 개면 4초마다 다음 경고로) — 펼침 상태에서는 정지
  useEffect(() => {
    if (warnOpen || !warnings || warnings.length <= 1) return;
    const id = setInterval(() => setWarnIdx((i) => (i + 1) % warnings.length), 4000);
    return () => clearInterval(id);
  }, [warnOpen, warnings]);

  const loadWarnings = useCallback(() => api.get('/warnings').then((d) => setWarnings(d.items)), []);
  const loadTasks = useCallback(() => api.get('/tasks?all=1').then((d) => setTasks(d.items)), []);
  useEffect(() => {
    api.get('/dashboard').then(setDash).catch(() => setDash({ error: true }));
    loadWarnings();
    loadTasks();
  }, [loadWarnings, loadTasks]);

  async function ack(key, content) {
    try { await api.post('/warnings/ack', { key, content }); loadWarnings(); } catch (e) { toast.err(e.message); }
  }
  async function dismiss(key, content) {
    try { await api.post('/warnings/dismiss', { key, content }); loadWarnings(); toast.ok('이 경고를 내 화면에서 숨겼습니다.'); } catch (e) { toast.err(e.message); }
  }
  async function completeTask(t) {
    try {
      await api.patch('/tasks/' + t.id, { status: '완료' });
      loadTasks();
      toast.ok(isAdmin ? '완료 처리했습니다.' : '완료 요청했습니다. 관리자 승인 후 완료됩니다.');
    } catch (e) { toast.err(e.message); }
  }
  async function approveTask(t) {
    try { await api.patch('/tasks/' + t.id, { status: '완료' }); loadTasks(); toast.ok('완료를 승인했습니다.'); } catch (e) { toast.err(e.message); }
  }

  if (!dash) return <Loading />;
  if (dash.error) return <Empty>대시보드를 불러오지 못했습니다.</Empty>;

  const mat = matTab === 'raw' ? dash.rawSummary : dash.subSummary;
  const matPath = matTab === 'raw' ? '/raw' : '/sub';

  // Task 신호등 집계 — 지연/완료를 제외한 나머지(진행중·대기·완료대기)는 '진행 중'으로 묶음
  const allTasks = tasks || [];
  const tStat = allTasks.reduce((a, t) => {
    if (t.status === '완료') a.done++;
    else if (t.status === '지연') a.late++;
    else a.prog++;
    return a;
  }, { prog: 0, late: 0, done: 0 });
  const activeTasks = allTasks.filter((t) => t.status !== '완료');

  // 진행 Task 카드 (경고 바로 아래로 이동)
  const taskCard = (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h3 style={{ margin: 0 }}>진행 Task</h3>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, fontWeight: 600 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: '#2da44e', display: 'inline-block' }} />진행 중 {tStat.prog}건</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: '#e5534b', display: 'inline-block' }} />지연 {tStat.late}건</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-3)' }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: '#a0a0a8', display: 'inline-block' }} />완료 {tStat.done}건</span>
          </div>
        </div>
        <span className="inline-link" onClick={() => navigate('/tasks')}>+ Task 등록 / 관리 →</span>
      </div>
      <div className="table-wrap">
        {!tasks ? <Loading /> : activeTasks.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>진행 중인 Task가 없습니다.</div>
        ) : (
          <table className="tbl compact">
            <thead>
              <tr><th>우선</th><th>Task명</th><th>구분</th><th>담당</th><th>완료예정</th><th>현황</th><th style={{ width: 1 }}></th></tr>
            </thead>
            <tbody>
              {activeTasks.map((t) => (
                <tr key={t.id}>
                  <td><Badge color={prioColor[t.priority]}>{t.priority}</Badge></td>
                  <td><b>{t.title}</b></td>
                  <td className="muted">{t.category === '기타' ? t.categoryEtc || '기타' : t.category}</td>
                  <td className="muted">{t.assignee || '–'}</td>
                  <td className="muted">{t.dueDate || '–'}</td>
                  <td><Badge color={statColor[t.status]} dot>{t.status}</Badge></td>
                  <td>
                    <div className="btn-row">
                      {t.status === '완료대기' && isAdmin && <button className="btn ghost sm" onClick={() => approveTask(t)}>승인</button>}
                      {t.status === '완료대기' && !isAdmin && <span className="muted" style={{ fontSize: 12 }}>승인 대기중</span>}
                      {canWrite && t.status !== '완료' && t.status !== '완료대기' && <button className="btn ghost sm" onClick={() => completeTask(t)}>완료</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // 경고 한 건 렌더(롤/전체 공통)
  const renderWarn = (w, rolling) => (
    <div className={`warn-item ${w.level === 'warn' ? 'warn' : ''}`} key={w.key} style={rolling ? { animation: 'fade 0.35s ease' } : undefined}>
      <span className="wbar" />
      <div className="wc">
        <div className="wmsg">{w.content}</div>
        <div className="wack">확인 {w.ackCount}/{w.totalUsers}명{w.ackedByMe ? ' · 내 확인 완료' : ''}</div>
      </div>
      {canWrite && !w.ackedByMe && <button className="btn sm" onClick={() => ack(w.key, w.content)}>확인</button>}
      {canWrite && <button className="btn secondary sm" onClick={() => dismiss(w.key, w.content)}>삭제</button>}
    </div>
  );
  const warnCount = warnings ? warnings.length : 0;
  const curWarn = warnCount ? warnings[warnIdx % warnCount] : null;

  return (
    <>
      {/* 1) 최상단 경고 롤 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>⚠ 경고 {warnings ? `(${warnCount})` : ''}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {warnCount > 1 && !warnOpen && (
              <>
                <button className="btn ghost sm" title="이전 경고" onClick={() => setWarnIdx((i) => (i - 1 + warnCount) % warnCount)}>▲</button>
                <span className="muted" style={{ fontSize: 12, minWidth: 34, textAlign: 'center' }}>{(warnIdx % warnCount) + 1} / {warnCount}</span>
                <button className="btn ghost sm" title="다음 경고" onClick={() => setWarnIdx((i) => (i + 1) % warnCount)}>▼</button>
              </>
            )}
            {warnCount > 0
              ? <button className="btn secondary sm" onClick={() => setWarnOpen((v) => !v)}>{warnOpen ? '접기' : `전체 펼치기 (${warnCount})`}</button>
              : <span className="hint">안전재고 부족 · Canister · 유해물질</span>}
          </div>
        </div>
        <div>
          {!warnings ? <Loading /> : warnCount === 0 ? (
            <div className="empty" style={{ padding: 20 }}>현재 경고가 없습니다. 👍</div>
          ) : warnOpen ? (
            warnings.map((w) => renderWarn(w, false))
          ) : (
            renderWarn(curWarn, true)
          )}
        </div>
      </div>

      {/* 2) 진행 Task — 경고 바로 아래 */}
      {taskCard}

      {/* 3) 퀵 입력 */}
      {canWrite && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>퀵 입력</div>
          <div className="grid grid-3">
            <QuickGroup navigate={navigate} icon="canister" color="#0071e3" title="원재료" actions={[['입고', '/raw?new=1'], ['사용', '/raw?use=1']]} />
            <QuickGroup navigate={navigate} icon="drum" color="#5e5ce6" title="부재료" actions={[['입고', '/sub?new=1'], ['사용', '/sub?use=1']]} />
            <QuickGroup navigate={navigate} icon="star" color="#34c759" title="Canister" actions={[['등록', '/canisters?new=1'], ['수불 등록', '/canisters?move=1']]} />
          </div>
        </div>
      )}

      {/* 4) 요약 현황 — 원·부재료(좌) + Canister(우) */}
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
                  {groupByProduct(mat).map((g, gi) => (
                    <Fragment key={g.product}>
                      <tr className={`group-row gt${gi % 5}`}><td colSpan={7}>{g.product}</td></tr>
                      {g.rows.map((r) => (
                        <tr key={r.name} className={r.below ? 'row-low' : ''} style={{ cursor: 'pointer', background: r.below ? undefined : ROW_TINTS[gi % 5] }} onClick={() => navigate(`${matPath}?q=${encodeURIComponent(r.name)}`)}>
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
                  {groupByProduct(dash.canisterSummary.map((c) => ({ ...c, product: c.content }))).map((g, gi) => (
                    <Fragment key={g.product}>
                      <tr className={`group-row gt${gi % 5}`}><td colSpan={4}>제품명: {g.product}</td></tr>
                      {g.rows.map((c, i) => (
                        <tr key={i} style={{ cursor: 'pointer', background: ROW_TINTS[gi % 5] }} onClick={() => navigate('/canisters')}>
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

      {/* 5) AI 자연어 검색 — 최하단 */}
      <div className="card card-pad">
        <SmartSearch inline />
      </div>
    </>
  );
}
