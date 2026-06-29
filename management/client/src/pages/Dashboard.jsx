import { useEffect, useState, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
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
  const [topSlot, setTopSlot] = useState(null); // 상단바 경고 슬롯(포털 대상)
  const [rollSec, setRollSec] = useState(4); // 경고 롤 간격(초) — 관리자설정
  useEffect(() => { setTopSlot(document.getElementById('topbar-slot')); }, []);
  useEffect(() => { api.get('/settings').then((d) => setRollSec(Number(d.settings.warningRollSeconds) || 4)).catch(() => {}); }, []);

  // 경고 자동 롤(여러 개면 설정 간격마다 다음 경고로) — 펼침 상태에서는 정지
  useEffect(() => {
    if (warnOpen || !warnings || warnings.length <= 1) return;
    const id = setInterval(() => setWarnIdx((i) => (i + 1) % warnings.length), Math.max(1, rollSec) * 1000);
    return () => clearInterval(id);
  }, [warnOpen, warnings, rollSec]);

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
  const taskPanel = (
    <div className="card card-pad" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)' }}>진행 Task</div>
        <span className="inline-link" style={{ fontSize: 12 }} onClick={() => navigate('/tasks')}>상세보기 →</span>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: '#2da44e', display: 'inline-block' }} />진행 {tStat.prog}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5534b', display: 'inline-block' }} />지연 {tStat.late}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-3)' }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: '#a0a0a8', display: 'inline-block' }} />완료 {tStat.done}</span>
      </div>
      <div style={{ flex: 1 }}>
        {!tasks ? <Loading /> : activeTasks.length === 0 ? (
          <div className="muted" style={{ fontSize: 13, padding: '8px 0' }}>진행 중인 Task가 없습니다.</div>
        ) : activeTasks.slice(0, 5).map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--line)' }}>
            <Badge color={prioColor[t.priority]}>{t.priority}</Badge>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} title={t.title} onClick={() => navigate('/tasks')}><b>{t.title}</b></span>
            <Badge color={statColor[t.status]} dot>{t.status}</Badge>
            {t.status === '완료대기' && isAdmin && <button className="btn ghost sm" onClick={() => approveTask(t)}>승인</button>}
            {canWrite && t.status !== '완료' && t.status !== '완료대기' && <button className="btn ghost sm" onClick={() => completeTask(t)}>완료</button>}
          </div>
        ))}
        {activeTasks.length > 5 && <div className="inline-link" style={{ fontSize: 12, paddingTop: 8 }} onClick={() => navigate('/tasks')}>외 {activeTasks.length - 5}건 더보기 →</div>}
      </div>
    </div>
  );

  const warnCount = warnings ? warnings.length : 0;
  const curWarn = warnCount ? warnings[warnIdx % warnCount] : null;

  // 상단바(타이틀 우측) 경고 위젯 — 내용 + 확인/삭제만 심플하게(여러 건은 ‹ › 롤)
  const topWarn = (
    <div className={`topwarn ${curWarn ? (curWarn.level === 'warn' ? 'warn' : 'danger') : 'ok'}`}>
      {warnCount === 0 ? (
        <span className="topwarn-ok">⚠ 경고 없음</span>
      ) : (
        <>
          <span className="topwarn-badge">⚠ {warnCount}</span>
          {warnCount > 1 && (
            <span className="topwarn-nav">
              <button onClick={() => setWarnIdx((i) => (i - 1 + warnCount) % warnCount)} title="이전 경고">‹</button>
              <span className="topwarn-idx">{(warnIdx % warnCount) + 1}/{warnCount}</span>
              <button onClick={() => setWarnIdx((i) => (i + 1) % warnCount)} title="다음 경고">›</button>
            </span>
          )}
          <span className="topwarn-msg" title={curWarn.content}>{curWarn.content}</span>
          {canWrite && !curWarn.ackedByMe && <button className="btn sm" onClick={() => ack(curWarn.key, curWarn.content)}>확인</button>}
          {canWrite && <button className="btn secondary sm" onClick={() => dismiss(curWarn.key, curWarn.content)}>삭제</button>}
        </>
      )}
    </div>
  );

  return (
    <div className="dash-tight">
      {/* 경고 → 상단바(타이틀 우측)로 포털 */}
      {topSlot && createPortal(topWarn, topSlot)}

      {/* 최상단: 퀵메뉴(좌, 좁게) + 진행 Task(우, 넓게) */}
      <div className="grid" style={{ marginBottom: 8, alignItems: 'stretch', gridTemplateColumns: canWrite ? 'minmax(280px, 1fr) 2fr' : '1fr' }}>
        {canWrite && (
          <div className="card card-pad" style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>퀵 입력</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <QuickGroup navigate={navigate} icon="canister" color="#0071e3" title="원재료" actions={[['입고', '/raw?new=1'], ['사용', '/raw?use=1']]} />
              <QuickGroup navigate={navigate} icon="drum" color="#5e5ce6" title="부재료" actions={[['입고', '/sub?new=1'], ['사용', '/sub?use=1']]} />
              <QuickGroup navigate={navigate} icon="star" color="#34c759" title="Canister" actions={[['등록', '/canisters?new=1'], ['수불 등록', '/canisters?move=1']]} />
              <QuickGroup navigate={navigate} icon="task" color="#ff9f0a" title="배치" actions={[['일괄 처리', '/batch-bulk']]} />
            </div>
          </div>
        )}
        {taskPanel}
      </div>

      {/* AI 자연어 검색 — 하단 전체폭 */}
      <div className="card card-pad" style={{ marginBottom: 8 }}>
        <SmartSearch inline />
      </div>

      {/* 요약 현황 — 원·부재료(좌) + Canister(우) */}
      <div className="grid grid-2" style={{ marginBottom: 8 }}>
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

    </div>
  );
}
